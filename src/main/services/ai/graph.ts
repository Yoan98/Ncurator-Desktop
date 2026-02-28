import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { END, START, StateGraph, StateSchema } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { z } from 'zod/v4'
import type { AiPlanTask, AiRunContext, AiRunState, AiTaskKind } from './types'
import { createChatModel } from '../llm/chatModel'
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { JsonObject } from '../../../shared/types'
import { buildRetrievalTools } from './tools/retrievalTools'
import { runTerminalCommand } from './tools/terminalExec'

const CAPABILITY_KINDS: AiTaskKind[] = ['local_kb_retrieval', 'terminal_exec', 'docx']
const MAX_RETRIEVAL_DISPATCH_STEPS = 3
const MAX_TOOL_ROUNDS_PER_DISPATCH = 3

const MAX_TERMINAL_STEPS = 4
const TERMINAL_TIMEOUT_MS = 15000
const TERMINAL_MAX_OUTPUT_CHARS = 8000
const TERMINAL_SAFE_PREVIEW_CHARS = 600

type ChatContentChunk = { text?: string }
type ToolCallCarrier = { tool_calls?: unknown[]; content?: unknown }
type ToolNodeOutput = { messages?: unknown[] }

const parseJsonObject = <T extends JsonObject>(text: string): T => {
  const trimmed = String(text || '').trim()
  try {
    return JSON.parse(trimmed) as T
  } catch (err) {
    void err
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1)
    return JSON.parse(slice) as T
  }
  throw new Error('无法解析 JSON 输出')
}

const getMessageText = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return String(content ?? '')

  return content
    .map((chunk: unknown) => {
      if (typeof chunk === 'string') return chunk
      const c = chunk as ChatContentChunk
      if (typeof c?.text === 'string') return c.text
      return ''
    })
    .join('\n')
}

const clipText = (text: string, maxChars: number) => {
  const raw = String(text || '')
  if (raw.length <= maxChars) return { text: raw, truncated: false }
  return { text: raw.slice(0, maxChars), truncated: true }
}

const isPathInsideRoot = (candidatePath: string, rootPath: string) => {
  const root = path.resolve(rootPath)
  const candidate = path.resolve(candidatePath)
  const rel = path.relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

const parseAbsolutePathTokens = (command: string): string[] => {
  const matches = String(command || '').match(/(^|[\s"'`])\/[^\s"'`;]+/g) || []
  return matches
    .map((token) => token.trim())
    .map((token) => token.replace(/^['"`]/, ''))
    .filter((token) => token.startsWith('/'))
}

const checkWorkspaceBoundary = (
  command: string,
  rootPath: string
): { ok: true } | { ok: false; reason: string } => {
  if (!rootPath) {
    return { ok: false, reason: 'workspace root path is missing' }
  }

  if (/(^|\s)cd\s+\.\.(\/|\s|$)/.test(command) || command.includes('../')) {
    return { ok: false, reason: 'command contains path escape pattern (..)' }
  }

  const absolutePaths = parseAbsolutePathTokens(command)
  for (const p of absolutePaths) {
    if (!isPathInsideRoot(p, rootPath)) {
      return { ok: false, reason: `path out of workspace boundary: ${p}` }
    }
  }

  return { ok: true }
}

const classifyCommandRisk = (command: string): 'low' | 'medium' | 'high' => {
  const text = String(command || '').toLowerCase()

  if (
    /\brm\s+-rf\b/.test(text) ||
    /\bmkfs\b/.test(text) ||
    /\bdd\b/.test(text) ||
    /\bshutdown\b/.test(text) ||
    /\breboot\b/.test(text) ||
    /\bchown\b/.test(text)
  ) {
    return 'high'
  }

  if (
    /\brm\b/.test(text) ||
    /\bmv\b/.test(text) ||
    /\bcp\b/.test(text) ||
    /\bmkdir\b/.test(text) ||
    /\btouch\b/.test(text) ||
    /\bchmod\b/.test(text) ||
    /\bcurl\b/.test(text) ||
    /\bwget\b/.test(text) ||
    /\bgit\s+push\b/.test(text) ||
    />/.test(text)
  ) {
    return 'medium'
  }

  return 'low'
}

const isKnownCapabilityKind = (kind: string): kind is AiTaskKind => {
  return CAPABILITY_KINDS.includes(kind as AiTaskKind)
}

const normalizePlannedKind = (kind: unknown): string => {
  const value = String(kind || '').trim()
  if (!value) return 'local_kb_retrieval'
  if (isKnownCapabilityKind(value)) return value
  return value
}

const inferHeuristicKind = (input: string): AiTaskKind => {
  const text = String(input || '')
  if (/\b(cmd|bash|shell|terminal|command|run)\b/i.test(text) || /终端|命令|脚本|执行/.test(text)) {
    return 'terminal_exec'
  }
  if (/\b(docx|word)\b/i.test(text) || /docx|word|文档/.test(text)) {
    return 'docx'
  }
  return 'local_kb_retrieval'
}

const createAiRunStateSchema = () =>
  // Keep state schema permissive enough for graph transitions while maintaining task shape.
  new StateSchema({
    runId: z.string(),
    sessionId: z.string(),
    status: z.enum(['running', 'completed', 'failed', 'cancelled']).default('running'),
    input: z.string(),
    plan: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          kind: z.string(),
          input: z.string().optional(),
          status: z.enum(['pending', 'running', 'completed', 'failed']),
          attempts: z.number(),
          error: z.string().optional(),
          resultCode: z.enum(['ok', 'not_implemented']).optional(),
          resultMessage: z.string().optional()
        })
      )
      .default(() => []),
    activeTaskId: z.string().optional(),
    error: z.string().optional(),
    outputText: z.string().optional()
  })

const pickNextTask = (plan: AiPlanTask[]) => {
  for (const t of plan) {
    if (t.status === 'running') return t
  }
  for (const t of plan) {
    if (t.status === 'pending') return t
  }
  return null
}

const ensurePlan = async (ctx: AiRunContext, state: AiRunState): Promise<AiPlanTask[]> => {
  if (Array.isArray(state.plan) && state.plan.length > 0) return state.plan

  const heuristicKind = inferHeuristicKind(state.input)
  const heuristic: AiPlanTask[] = [
    {
      id: 'task-1',
      title: '分析并完成请求',
      kind: heuristicKind,
      input: heuristicKind === 'terminal_exec' ? String(state.input || '').trim() : undefined,
      status: 'pending',
      attempts: 0
    }
  ]

  try {
    const history = await ctx.loadHistory()
    const json = await ctx.chatJson({
      system: [
        'You are a planning host for a desktop AI runtime.',
        'Output JSON only as: {"tasks":[{"id":"...","title":"...","kind":"local_kb_retrieval"|"terminal_exec"|"docx","input":"optional raw command for terminal_exec"}]}.',
        'For terminal tasks, set input to raw command text when available.',
        'Return tasks: [] only when no retrieval or execution is needed.'
      ].join(' '),
      user: `User message:\n${state.input}\n\nSession summary:\n${history.sessionSummaryText}\n\nRecent turns:\n${history.recentTurnsText}`,
      temperature: 0.1
    })

    if (!Array.isArray(json?.tasks)) return heuristic

    const mapped: AiPlanTask[] = json.tasks
      .map((t: unknown, i: number) => {
        const raw = t && typeof t === 'object' ? (t as Record<string, unknown>) : {}
        return {
          id: String(raw.id || `task-${i + 1}`),
          title: String(raw.title || 'Task'),
          kind: normalizePlannedKind(raw.kind),
          input: raw.input == null ? undefined : String(raw.input || '').trim(),
          status: 'pending' as const,
          attempts: 0
        }
      })
      .filter((t) => Boolean(t.id && t.title))

    return mapped
  } catch (e) {
    void e
    return heuristic
  }
}

const buildHostFinalAnswer = async (ctx: AiRunContext, state: AiRunState): Promise<string> => {
  ctx.checkCancelled()
  const planText = (state.plan || [])
    .map((t) => `${t.id} | ${t.kind} | ${t.status}${t.error ? ` | ${t.error}` : ''}`)
    .join('\n')

  try {
    const cfg = await ctx.getModelConfig()
    const model = createChatModel(cfg, { temperature: 0.2 })
    const res = await model.invoke([
      new SystemMessage(
        '你是桌面 AI 运行时中的 host。请基于用户输入和执行结果，输出简洁、直接、可执行的最终回复。'
      ),
      new HumanMessage(
        `用户输入:\n${state.input}\n\n计划执行情况:\n${planText || '无计划任务'}\n\n已知结论:\n${String(state.outputText || '').trim() || '无'}\n\n请直接给最终答复。`
      )
    ])
    const text = getMessageText((res as ToolCallCarrier)?.content).trim()
    if (text) return text
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.toLowerCase().includes('cancel')) throw e
  }

  return String(state.outputText || '').trim() || '已完成。'
}

const hostNode = async (ctx: AiRunContext, state: AiRunState): Promise<Partial<AiRunState>> => {
  ctx.checkCancelled()

  const plan = await ensurePlan(ctx, state)
  if (!state.plan.length && plan.length) {
    ctx.sendEvent({ type: 'plan_created', runId: state.runId, plan })
  }

  const failed = plan.find((t) => t.status === 'failed')
  if (failed) {
    return {
      plan,
      activeTaskId: undefined,
      status: 'failed',
      error: failed.error || state.error || 'failed'
    }
  }

  const next = pickNextTask(plan)
  if (!next) {
    const outputText = await buildHostFinalAnswer(ctx, { ...state, plan })
    return {
      plan,
      activeTaskId: undefined,
      status: 'completed',
      outputText
    }
  }

  if (next.status === 'pending') {
    const updated: AiPlanTask[] = plan.map((t) =>
      t.id === next.id ? { ...t, status: 'running' as const } : t
    )
    ctx.sendEvent({ type: 'task_started', runId: state.runId, taskId: next.id })
    return { plan: updated, activeTaskId: next.id, status: 'running' }
  }

  return { plan, activeTaskId: next.id, status: 'running' }
}

type CapabilityExecutor = (
  ctx: AiRunContext,
  state: AiRunState,
  task: AiPlanTask
) => Promise<Partial<AiRunState>>

const emitActivity = (input: {
  ctx: AiRunContext
  runId: string
  taskId?: string
  actionType: string
  status: 'started' | 'completed' | 'failed'
  summary: string
}) => {
  input.ctx.sendEvent({
    type: 'activity',
    runId: input.runId,
    taskId: input.taskId,
    activityId: randomUUID(),
    actionType: input.actionType,
    status: input.status,
    summary: input.summary,
    createdAt: Date.now()
  })
}

const markTaskFailed = (
  ctx: AiRunContext,
  state: AiRunState,
  taskId: string,
  error: string
): Partial<AiRunState> => {
  const plan = (state.plan || []).map((t) =>
    t.id === taskId
      ? {
          ...t,
          attempts: Number(t.attempts || 0) + 1,
          status: 'failed' as const,
          error,
          resultCode: undefined,
          resultMessage: undefined
        }
      : t
  )
  ctx.sendEvent({ type: 'task_failed', runId: state.runId, taskId, error })
  emitActivity({
    ctx,
    runId: state.runId,
    taskId,
    actionType: 'task',
    status: 'failed',
    summary: error
  })
  return {
    plan,
    activeTaskId: undefined,
    error,
    outputText: error
  }
}

const executeLocalKbRetrieval: CapabilityExecutor = async (ctx, state, task) => {
  ctx.checkCancelled()

  const tools = buildRetrievalTools({ ctx, runId: state.runId, taskId: task.id })
  const toolNode = new ToolNode(tools)
  const cfg = await ctx.getModelConfig()
  const model = createChatModel(cfg, { temperature: 0.2 }).bindTools(tools)

  const system = [
    'You are the `local_kb_retrieval` capability.',
    'Use retrieval tools to gather minimal evidence for this task.',
    'If evidence is enough, output JSON only as {"satisfied": true, "note": "short"}.',
    'If not enough, output JSON only as {"satisfied": false, "note": "short"}.',
    'Do not output any extra keys.'
  ].join('\n')
  const scopedDocumentIdsText =
    Array.isArray(ctx.selectedDocumentIds) && ctx.selectedDocumentIds.length > 0
      ? ctx.selectedDocumentIds.join(', ')
      : '(none)'
  const user = `User input:\n${state.input}\n\nTask:\n${String(task.title || task.id)}\n\nCurrent attempt: ${Number(task.attempts || 0) + 1}/${MAX_RETRIEVAL_DISPATCH_STEPS}\n\nScoped document ids from run context:\n${scopedDocumentIdsText}\n\nIf scope exists, keep retrieval within that scope by default.`

  let satisfied = false
  let note = ''
  let lastAi: AIMessage | null = null
  const messages: BaseMessage[] = [
    new SystemMessage(system),
    new HumanMessage(user)
  ]

  for (let i = 0; i < MAX_TOOL_ROUNDS_PER_DISPATCH; i += 1) {
    ctx.checkCancelled()
    const ai = (await model.invoke(messages)) as AIMessage
    lastAi = ai
    messages.push(ai)

    const toolCalls = (ai as ToolCallCarrier).tool_calls
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const out = (await toolNode.invoke({ messages: [ai] })) as ToolNodeOutput
      const toolMessages = (Array.isArray(out?.messages) ? out.messages : []) as BaseMessage[]
      messages.push(...toolMessages)
      continue
    }

    const content = getMessageText((ai as ToolCallCarrier)?.content)
    try {
      const json = parseJsonObject<{ satisfied?: boolean; note?: string }>(content)
      satisfied = Boolean(json?.satisfied)
      note = String(json?.note || '')
    } catch (e) {
      void e
      satisfied = false
      note = ''
    }
    break
  }

  const attempts = Number(task.attempts || 0) + 1
  if (satisfied) {
    const plan = (state.plan || []).map((t) =>
      t.id === task.id
        ? {
            ...t,
            attempts,
            status: 'completed' as const,
            error: undefined,
            resultCode: 'ok' as const,
            resultMessage: note || undefined
          }
        : t
    )
    ctx.sendEvent({ type: 'task_completed', runId: state.runId, taskId: task.id })
    ctx.sendEvent({
      type: 'task_result',
      runId: state.runId,
      taskId: task.id,
      code: 'ok',
      message: note || undefined
    })
    return {
      plan,
      activeTaskId: undefined,
      outputText: note || state.outputText
    }
  }

  if (attempts >= MAX_RETRIEVAL_DISPATCH_STEPS) {
    const err = note || 'local_kb_retrieval not satisfied'
    return markTaskFailed(ctx, state, task.id, err)
  }

  const plan = (state.plan || []).map((t) =>
    t.id === task.id
      ? {
          ...t,
          attempts,
          status: 'running' as const,
          error: undefined,
          resultCode: undefined,
          resultMessage: undefined
        }
      : t
  )

  return {
    plan,
    activeTaskId: undefined,
    outputText: note || getMessageText((lastAi as ToolCallCarrier | null)?.content || '') || state.outputText
  }
}

const decideTerminalNextStep = async (input: {
  ctx: AiRunContext
  state: AiRunState
  task: AiPlanTask
  stepIndex: number
  lastCommand: string
  lastOutputPreview: string
  lastExitCode: number | null
  timedOut: boolean
}): Promise<{ done: boolean; nextCommand?: string; note?: string }> => {
  const { ctx, state, task, stepIndex, lastCommand, lastOutputPreview, lastExitCode, timedOut } =
    input

  if (timedOut) {
    return { done: true, note: 'terminal command timed out' }
  }

  try {
    const json = await ctx.chatJson({
      system: [
        'You are the terminal_exec loop controller.',
        'Decide whether to finish or run another raw shell command.',
        'Output JSON only as: {"done": true|false, "nextCommand": "...", "note": "..."}.',
        'Only provide nextCommand when done=false.'
      ].join(' '),
      user: `User input:\n${state.input}\n\nTask:\n${task.title}\n\nLast command:\n${lastCommand}\n\nLast exit code:\n${String(lastExitCode)}\n\nLast output preview:\n${lastOutputPreview}\n\nCurrent step: ${stepIndex}/${MAX_TERMINAL_STEPS}`,
      temperature: 0.1
    })
    return {
      done: Boolean(json?.done),
      nextCommand: json?.nextCommand == null ? undefined : String(json.nextCommand || '').trim(),
      note: json?.note == null ? undefined : String(json.note || '').trim()
    }
  } catch (e) {
    void e
    return {
      done: lastExitCode === 0,
      note: lastExitCode === 0 ? 'command completed' : 'command failed'
    }
  }
}

const executeTerminalExec: CapabilityExecutor = async (ctx, state, task) => {
  ctx.checkCancelled()

  let command = String(task.input || task.title || '').trim()
  if (!command) {
    return markTaskFailed(ctx, state, task.id, 'terminal_exec requires raw command input')
  }

  const workspaceId = String(ctx.workspace?.workspaceId || '').trim()
  const workspaceRootPath = String(ctx.workspace?.rootPath || '').trim()
  if (!workspaceId || !workspaceRootPath) {
    ctx.sendEvent({
      type: 'workspace_required',
      runId: state.runId,
      taskId: task.id,
      reason: 'terminal_exec requires workspace binding before execution',
      requiredFields: ['workspaceId', 'rootPath'],
      createdAt: Date.now()
    })
    return markTaskFailed(ctx, state, task.id, 'workspace is required for terminal_exec')
  }

  const cwd = path.resolve(workspaceRootPath)

  for (let stepIndex = 1; stepIndex <= MAX_TERMINAL_STEPS; stepIndex += 1) {
    ctx.checkCancelled()

    const boundary = checkWorkspaceBoundary(command, cwd)
    if (!boundary.ok) {
      return markTaskFailed(ctx, state, task.id, `workspace boundary check failed: ${boundary.reason}`)
    }

    const riskLevel = classifyCommandRisk(command)
    if (riskLevel !== 'low') {
      const decision = await ctx.requestApproval({
        runId: state.runId,
        taskId: task.id,
        command,
        riskLevel,
        reason: `command classified as ${riskLevel} risk`
      })
      if (!decision.approved) {
        return markTaskFailed(ctx, state, task.id, decision.reason || 'approval denied')
      }
    }

    const stepId = randomUUID()
    ctx.sendEvent({
      type: 'terminal_step_started',
      runId: state.runId,
      taskId: task.id,
      stepId,
      stepIndex,
      command,
      cwd,
      createdAt: Date.now()
    })
    emitActivity({
      ctx,
      runId: state.runId,
      taskId: task.id,
      actionType: 'terminal_exec',
      status: 'started',
      summary: `执行命令: ${command}`
    })

    const result = await runTerminalCommand({
      command,
      cwd,
      timeoutMs: TERMINAL_TIMEOUT_MS,
      maxOutputChars: TERMINAL_MAX_OUTPUT_CHARS
    })

    const previewSource = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    const preview = clipText(previewSource || '(no output)', TERMINAL_SAFE_PREVIEW_CHARS)

    const stepError =
      result.timedOut || result.exitCode !== 0
        ? result.timedOut
          ? `command timed out after ${TERMINAL_TIMEOUT_MS}ms`
          : `command exited with code ${String(result.exitCode)}`
        : undefined

    if (stepError) {
      ctx.sendEvent({
        type: 'terminal_step_error',
        runId: state.runId,
        taskId: task.id,
        stepId,
        stepIndex,
        command,
        error: stepError,
        outputPreview: preview.text,
        completedAt: Date.now()
      })
      emitActivity({
        ctx,
        runId: state.runId,
        taskId: task.id,
        actionType: 'terminal_exec',
        status: 'failed',
        summary: `${command} -> ${stepError}`
      })
    } else {
      ctx.sendEvent({
        type: 'terminal_step_result',
        runId: state.runId,
        taskId: task.id,
        stepId,
        stepIndex,
        command,
        outputPreview: preview.text,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        truncated: result.truncated || preview.truncated,
        completedAt: Date.now()
      })
      emitActivity({
        ctx,
        runId: state.runId,
        taskId: task.id,
        actionType: 'terminal_exec',
        status: 'completed',
        summary: `${command} -> success`
      })
    }

    const decision = await decideTerminalNextStep({
      ctx,
      state,
      task,
      stepIndex,
      lastCommand: command,
      lastOutputPreview: preview.text,
      lastExitCode: result.exitCode,
      timedOut: result.timedOut
    })

    if (decision.done) {
      const attempts = Number(task.attempts || 0) + 1
      const plan = (state.plan || []).map((t) =>
        t.id === task.id
          ? {
              ...t,
              attempts,
              status: 'completed' as const,
              error: undefined,
              resultCode: 'ok' as const,
              resultMessage: decision.note || undefined
            }
          : t
      )
      ctx.sendEvent({ type: 'task_completed', runId: state.runId, taskId: task.id })
      ctx.sendEvent({
        type: 'task_result',
        runId: state.runId,
        taskId: task.id,
        code: 'ok',
        message: decision.note || undefined
      })
      return {
        plan,
        activeTaskId: undefined,
        outputText: decision.note || preview.text || state.outputText
      }
    }

    const nextCommand = String(decision.nextCommand || '').trim()
    if (!nextCommand) {
      return markTaskFailed(
        ctx,
        state,
        task.id,
        decision.note || 'terminal_exec requires nextCommand when done=false'
      )
    }

    command = nextCommand
  }

  return markTaskFailed(
    ctx,
    state,
    task.id,
    `terminal_exec exceeded max steps (${MAX_TERMINAL_STEPS})`
  )
}

const executeDocxPlaceholder: CapabilityExecutor = async (ctx, state, task) => {
  ctx.checkCancelled()
  const message = 'docx capability is planned but not implemented yet (Node.js-first placeholder)'
  const attempts = Number(task.attempts || 0) + 1
  const plan = (state.plan || []).map((t) =>
    t.id === task.id
      ? {
          ...t,
          attempts,
          status: 'completed' as const,
          error: undefined,
          resultCode: 'not_implemented' as const,
          resultMessage: message
        }
      : t
  )
  ctx.sendEvent({ type: 'task_completed', runId: state.runId, taskId: task.id })
  ctx.sendEvent({
    type: 'task_result',
    runId: state.runId,
    taskId: task.id,
    code: 'not_implemented',
    message
  })
  emitActivity({
    ctx,
    runId: state.runId,
    taskId: task.id,
    actionType: 'docx',
    status: 'completed',
    summary: message
  })
  return {
    plan,
    activeTaskId: undefined,
    outputText: message
  }
}

const capabilityRegistry = new Map<string, CapabilityExecutor>()

const registerCapability = (kind: string, executor: CapabilityExecutor) => {
  capabilityRegistry.set(String(kind || '').trim(), executor)
}

registerCapability('local_kb_retrieval', executeLocalKbRetrieval)
registerCapability('terminal_exec', executeTerminalExec)
registerCapability('docx', executeDocxPlaceholder)

const capabilityNode = async (ctx: AiRunContext, state: AiRunState): Promise<Partial<AiRunState>> => {
  ctx.checkCancelled()

  const taskId = state.activeTaskId
  if (!taskId) return {}

  const task = (state.plan || []).find((t) => t.id === taskId)
  if (!task) {
    return {
      plan: state.plan,
      activeTaskId: undefined,
      status: 'failed',
      error: `task not found: ${taskId}`
    }
  }

  const rawKind = String(task.kind || '').trim()
  const executor = capabilityRegistry.get(rawKind)
  if (!executor) {
    return markTaskFailed(ctx, state, task.id, `unsupported capability kind: ${rawKind || '(empty)'}`)
  }

  return executor(ctx, state, task)
}

export const buildAiRunGraph = (ctx: AiRunContext) => {
  const State = createAiRunStateSchema()

  return new StateGraph(State)
    .addNode('host', (s: AiRunState) => hostNode(ctx, s))
    .addNode('capability', (s: AiRunState) => capabilityNode(ctx, s))
    .addEdge(START, 'host')
    .addConditionalEdges('host', (s: AiRunState) => {
      if (s.status === 'failed' || s.status === 'completed' || s.status === 'cancelled') {
        return END
      }
      const next = pickNextTask((s.plan || []) as AiPlanTask[])
      if (!next) return END
      return 'capability'
    })
    .addEdge('capability', 'host')
    .compile()
}
