import OpenAI from 'openai'
import { normalizeForIpc } from '../../../utils/serialization'
import type { WritingWorkflowRunRecord, WritingWorkflowRunStatus } from '../../../types/store'
import type {
  ChatCompleteInput,
  WorkflowDeps,
  WritingWorkflowContext,
  WritingWorkflowStartPayload
} from './types'

const normalizeBaseURL = (baseURL: string) => {
  let url = String(baseURL || '').trim()
  if (url.endsWith('/chat/completions')) url = url.replace(/\/chat\/completions\/?$/, '')
  if (url.endsWith('/v1/chat/completions')) url = url.replace(/\/chat\/completions\/?$/, '')
  url = url.replace(/\/$/, '')
  return url
}

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

export const createWritingWorkflowContext = (
  payload: WritingWorkflowStartPayload,
  deps: WorkflowDeps
): WritingWorkflowContext => {
  const checkCancelled = () => {
    if (deps.isCancelled()) {
      const e: any = new Error('cancelled')
      e.code = 'CANCELLED'
      throw e
    }
  }

  const stageStarted: WritingWorkflowContext['stageStarted'] = (stageId) => {
    deps.sendEvent({ type: 'stage_started', runId: payload.runId, stageId })
  }

  const stageOutput: WritingWorkflowContext['stageOutput'] = (stageId, stagePayload) => {
    deps.sendEvent({ type: 'stage_output', runId: payload.runId, stageId, payload: stagePayload })
  }

  const stageCompleted: WritingWorkflowContext['stageCompleted'] = (stageId) => {
    deps.sendEvent({ type: 'stage_completed', runId: payload.runId, stageId })
  }

  const writeRun: WritingWorkflowContext['writeRun'] = async (partial) => {
    const existing = await deps.writingStore.getWorkflowRun(payload.runId)
    const now = Date.now()
    const merged: WritingWorkflowRunRecord = {
      id: payload.runId,
      writing_document_id: payload.writingDocumentId,
      status: (partial.status ?? 'running') as WritingWorkflowRunStatus,
      input: partial.input ?? payload.input,
      created_at: partial.created_at ?? existing?.created_at ?? now,
      updated_at: partial.updated_at ?? now,
      outline: partial.outline ?? existing?.outline,
      retrieval_plan: partial.retrieval_plan ?? existing?.retrieval_plan,
      retrieved: partial.retrieved ?? existing?.retrieved,
      citations: partial.citations ?? existing?.citations,
      draft_markdown: partial.draft_markdown ?? existing?.draft_markdown,
      error: partial.error ?? existing?.error
    }
    await deps.writingStore.saveWorkflowRun(merged)
  }

  const getActiveConfig = async () => {
    const config = await deps.llmStore.getActive()
    if (!config) throw new Error('未配置可用的大模型，请先在「大模型配置」中设置并启用一个模型')
    return config
  }

  const chatComplete = async ({ system, user, temperature }: ChatCompleteInput) => {
    checkCancelled()
    const cfg = await getActiveConfig()
    const client = new OpenAI({
      baseURL: normalizeBaseURL(cfg.base_url),
      apiKey: cfg.api_key
    })
    const res = await client.chat.completions.create({
      model: cfg.model_name,
      temperature,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ] as any
    })
    const content = res.choices?.[0]?.message?.content
    if (!content) throw new Error('大模型返回为空')
    return content
  }

  return {
    runId: payload.runId,
    documentsStore: deps.documentsStore,
    embeddingService: deps.embeddingService,
    checkCancelled,
    stageStarted,
    stageOutput,
    stageCompleted,
    writeRun,
    chatComplete,
    parseJsonObject,
    normalizeSearchResult: normalizeForIpc
  }
}
