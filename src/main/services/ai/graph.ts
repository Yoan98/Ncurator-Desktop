import { END, START, StateGraph, StateSchema } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { z } from 'zod/v4'
import type { AiPlanTask, AiRunContext, AiRunState } from './types'
import { createChatModel } from '../llm/chatModel'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { buildRetrievalTools } from './tools/retrievalTools'
import { buildWritingTools } from './tools/writingTools'

const parseJsonObject = (text: string): any => {
  const trimmed = String(text || '').trim()
  try {
    return JSON.parse(trimmed)
  } catch (err) {
    void err
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1)
    return JSON.parse(slice)
  }
  throw new Error('无法解析 JSON 输出')
}

const createAiRunStateSchema = () =>
  new StateSchema({
    runId: z.string(),
    sessionId: z.string(),
    status: z.enum(['running', 'completed', 'failed', 'cancelled']).default('running'),
    input: z.string(),
    plan: z.array(z.any()).default(() => []),
    activeTaskId: z.string().optional(),
    error: z.string().optional(),
    outputText: z.string().optional()
  })

const pickNextTask = (plan: AiPlanTask[]) => {
  for (const t of plan) {
    if (t.status === 'pending') return t
    if (t.status === 'running') return t
  }
  return null
}

const ensurePlan = async (ctx: AiRunContext, state: AiRunState): Promise<AiPlanTask[]> => {
  if (Array.isArray(state.plan) && state.plan.length > 0) return state.plan

  const heuristic: AiPlanTask[] = [
    {
      id: 'task-1',
      title: state.input.includes('新增') || state.input.includes('修改') ? '写作文档' : '本地检索',
      kind: state.input.includes('新增') || state.input.includes('修改') ? 'writer' : 'retrieval',
      status: 'pending',
      attempts: 0
    }
  ]

  try {
    const history = await ctx.loadHistory()
    const json = await ctx.chatJson({
      system:
        'You are a task planner. Output JSON only as: {"tasks":[{"id":"...","title":"...","kind":"retrieval"|"writer"}]}.',
      user: `User message:\n${state.input}\n\nSession summary:\n${history.sessionSummaryText}\n\nRecent turns:\n${history.recentTurnsText}`,
      temperature: 0.1
    })
    const tasks = Array.isArray(json?.tasks) ? json.tasks : []
    const mapped: AiPlanTask[] = tasks
      .map((t: any, i: number) => ({
        id: String(t?.id || `task-${i + 1}`),
        title: String(t?.title || 'Task'),
        kind: t?.kind === 'writer' ? 'writer' : 'retrieval',
        status: 'pending' as const,
        attempts: 0
      }))
      .filter((t: any) => Boolean(t.id && t.title))
    return mapped.length ? mapped : heuristic
  } catch (e) {
    void e
    return heuristic
  }
}

const hostNode = async (ctx: AiRunContext, state: AiRunState): Promise<Partial<AiRunState>> => {
  ctx.checkCancelled()

  const plan = await ensurePlan(ctx, state)
  if (!state.plan.length && plan.length) {
    ctx.sendEvent({ type: 'plan_created', runId: state.runId, plan })
  }
  const failed = plan.find((t) => t.status === 'failed')
  if (failed) {
    ctx.sendEvent({
      type: 'task_failed',
      runId: state.runId,
      taskId: failed.id,
      error: failed.error || state.error || 'failed'
    })
    return {
      plan,
      status: 'failed',
      error: failed.error || state.error || 'failed'
    }
  }

  const next = pickNextTask(plan)
  if (!next) {
    return { plan, activeTaskId: undefined }
  }

  if (next.status === 'pending') {
    const updated: AiPlanTask[] = plan.map((t) =>
      t.id === next.id ? { ...t, status: 'running' as const } : t
    )
    ctx.sendEvent({ type: 'task_started', runId: state.runId, taskId: next.id })
    return { plan: updated, activeTaskId: next.id }
  }

  return { plan, activeTaskId: next.id }
}

const retrievalNode = async (
  ctx: AiRunContext,
  state: AiRunState
): Promise<Partial<AiRunState>> => {
  ctx.checkCancelled()
  const taskId = state.activeTaskId
  if (!taskId) return {}

  const tools = buildRetrievalTools({ ctx, runId: state.runId, taskId })
  const toolNode = new ToolNode(tools)
  const cfg = await ctx.getModelConfig()
  const model = createChatModel(cfg, { temperature: 0.2 }).bindTools(tools)

  const task = (state.plan || []).find((t: any) => t.id === taskId)
  const system = [
    'You are a retrieval agent for a local desktop knowledge base.',
    'Use the provided tools to gather the minimal required evidence for the current task.',
    'After tool use, output JSON only as {"satisfied": true|false, "note": "short"}',
    'If you are not satisfied, call more tools and refine queries.',
    'Do not include any additional keys in the JSON.'
  ].join('\n')
  const user = `User input:\n${state.input}\n\nTask:\n${String(task?.title || taskId)}`

  let satisfied = false
  let note = ''
  let lastAi: AIMessage | null = null

  const messages: any[] = [new SystemMessage(system), new HumanMessage(user)]

  for (let i = 0; i < 3; i += 1) {
    ctx.checkCancelled()
    const ai = (await model.invoke(messages)) as AIMessage
    lastAi = ai
    messages.push(ai)

    const toolCalls = Array.isArray((ai as any)?.tool_calls) ? (ai as any).tool_calls : []
    if (toolCalls.length > 0) {
      const out = await toolNode.invoke({ messages: [ai] })
      const toolMessages = Array.isArray((out as any)?.messages) ? (out as any).messages : []
      messages.push(...toolMessages)
      continue
    }

    const content = typeof (ai as any)?.content === 'string' ? (ai as any).content : ''
    try {
      const json = parseJsonObject(content)
      satisfied = Boolean(json?.satisfied)
      note = String(json?.note || '')
    } catch (e) {
      void e
      satisfied = false
      note = ''
    }

    if (satisfied) break
  }

  if (!satisfied) {
    const updated: AiPlanTask[] = ((state.plan || []) as any[]).map((t: any) => {
      if (t.id !== taskId) return t
      const attempts = Number(t.attempts || 0) + 1
      return { ...t, attempts, status: 'failed' as const, error: note || 'retrieval not satisfied' }
    }) as AiPlanTask[]
    return {
      plan: updated,
      error: note || 'retrieval not satisfied',
      outputText: lastAi ? String((lastAi as any).content || '') : undefined
    }
  }

  const updated: AiPlanTask[] = ((state.plan || []) as any[]).map((t: any) => {
    if (t.id !== taskId) return t
    const attempts = Number(t.attempts || 0) + 1
    return { ...t, attempts, status: 'completed' as const }
  }) as AiPlanTask[]
  ctx.sendEvent({ type: 'task_completed', runId: state.runId, taskId })
  return { plan: updated, outputText: note || state.outputText }
}

const writerNode = async (ctx: AiRunContext, state: AiRunState): Promise<Partial<AiRunState>> => {
  ctx.checkCancelled()
  const taskId = state.activeTaskId
  if (!taskId) return {}

  const tools = buildWritingTools({ ctx, runId: state.runId, taskId })
  const toolNode = new ToolNode(tools)
  const cfg = await ctx.getModelConfig()
  const model = createChatModel(cfg, { temperature: 0.2 }).bindTools(tools)

  const task = (state.plan || []).find((t: any) => t.id === taskId)
  const system = [
    'You are a writing agent for the local writing workspace.',
    'You MUST use tools to create or modify writing documents.',
    'After tool use, output JSON only as {"satisfied": true|false, "note": "short"}.',
    'If you are not satisfied, call more tools and refine edits.',
    'Do not include any additional keys in the JSON.'
  ].join('\n')
  const user = `User input:\n${state.input}\n\nTask:\n${String(task?.title || taskId)}`

  let satisfied = false
  let note = ''
  let lastAi: AIMessage | null = null

  const messages: any[] = [new SystemMessage(system), new HumanMessage(user)]

  for (let i = 0; i < 5; i += 1) {
    ctx.checkCancelled()
    const ai = (await model.invoke(messages)) as AIMessage
    lastAi = ai
    messages.push(ai)

    const toolCalls = Array.isArray((ai as any)?.tool_calls) ? (ai as any).tool_calls : []
    if (toolCalls.length > 0) {
      const out = await toolNode.invoke({ messages: [ai] })
      const toolMessages = Array.isArray((out as any)?.messages) ? (out as any).messages : []
      messages.push(...toolMessages)
      continue
    }

    const content = typeof (ai as any)?.content === 'string' ? (ai as any).content : ''
    try {
      const json = parseJsonObject(content)
      satisfied = Boolean(json?.satisfied)
      note = String(json?.note || '')
    } catch (e) {
      void e
      satisfied = false
      note = ''
    }

    if (satisfied) break
  }

  if (!satisfied) {
    const updated: AiPlanTask[] = ((state.plan || []) as any[]).map((t: any) => {
      if (t.id !== taskId) return t
      const attempts = Number(t.attempts || 0) + 1
      return { ...t, attempts, status: 'failed' as const, error: note || 'writer not satisfied' }
    }) as AiPlanTask[]
    return {
      plan: updated,
      error: note || 'writer not satisfied',
      outputText: lastAi ? String((lastAi as any).content || '') : undefined
    }
  }

  const updated: AiPlanTask[] = ((state.plan || []) as any[]).map((t: any) => {
    if (t.id !== taskId) return t
    const attempts = Number(t.attempts || 0) + 1
    return { ...t, attempts, status: 'completed' as const }
  }) as AiPlanTask[]
  ctx.sendEvent({ type: 'task_completed', runId: state.runId, taskId })
  return { plan: updated, outputText: note || state.outputText }
}

const answerNode = async (ctx: AiRunContext, state: AiRunState): Promise<Partial<AiRunState>> => {
  ctx.checkCancelled()
  const failed = (state.plan || []).find((t: any) => t.status === 'failed')
  if (failed) {
    return {
      status: 'failed',
      error: failed.error || state.error || 'failed',
      outputText: `失败：${failed.error || state.error || 'failed'}`
    }
  }
  return {
    status: 'completed',
    outputText: '已完成。'
  }
}

export const buildAiRunGraph = (ctx: AiRunContext) => {
  const State = createAiRunStateSchema()

  return new StateGraph(State)
    .addNode('host', (s: AiRunState) => hostNode(ctx, s))
    .addNode('retrieval', (s: AiRunState) => retrievalNode(ctx, s))
    .addNode('writer', (s: AiRunState) => writerNode(ctx, s))
    .addNode('answer', (s: AiRunState) => answerNode(ctx, s))
    .addEdge(START, 'host')
    .addConditionalEdges('host', (s: AiRunState) => {
      const failed = (s.plan || []).some((t: any) => t.status === 'failed')
      if (failed) return 'answer'
      const next = pickNextTask((s.plan || []) as any)
      if (!next) return 'answer'
      return next.kind === 'writer' ? 'writer' : 'retrieval'
    })
    .addEdge('retrieval', 'host')
    .addEdge('writer', 'host')
    .addEdge('answer', END)
    .compile()
}
