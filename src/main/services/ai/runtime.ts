import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { AiRunContext, AiRunDeps, AiRunStartPayload } from './types'
import { createChatModel } from '../llm/chatModel'
import type { ChatMessage, ChatSessionMemory } from '../../types/store'

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

const clipText = (text: string, maxChars: number) => {
  const t = String(text || '')
  if (t.length <= maxChars) return t
  return t.slice(0, maxChars)
}

const formatTurns = (messages: ChatMessage[]) => {
  return messages
    .map((m) => {
      const role = String(m.role || 'user')
      const content = String(m.content || '')
      return `${role}: ${content}`
    })
    .join('\n')
}

export const createAiRunContext = (payload: AiRunStartPayload, deps: AiRunDeps): AiRunContext => {
  const checkCancelled = () => {
    if (deps.isCancelled()) {
      const e: any = new Error('cancelled')
      e.code = 'CANCELLED'
      throw e
    }
  }

  const getActiveConfig = async () => {
    const cfg = await deps.llmStore.getActive()
    if (!cfg) throw new Error('未配置可用的大模型，请先在「大模型配置」中设置并启用一个模型')
    return cfg
  }

  const chatJson: AiRunContext['chatJson'] = async ({ system, user, temperature }) => {
    checkCancelled()
    const cfg = await getActiveConfig()
    const model = createChatModel(cfg, { temperature: temperature ?? 0.2 })
    const res = await model.invoke([new SystemMessage(system), new HumanMessage(user)])
    const text = typeof res?.content === 'string' ? res.content : String(res?.content ?? '')
    if (!text) throw new Error('大模型返回为空')
    return parseJsonObject(text)
  }

  const loadHistory: AiRunContext['loadHistory'] = async (limits) => {
    checkCancelled()
    const recentTurns = Math.max(1, Math.min(50, Number(limits?.recentTurns ?? 12)))
    const maxRecentTurnsChars = Math.max(
      500,
      Math.min(20000, Number(limits?.maxRecentTurnsChars ?? 6000))
    )
    const maxSummaryChars = Math.max(200, Math.min(8000, Number(limits?.maxSummaryChars ?? 1200)))

    const messages = await deps.chatStore.getRecentChatMessages(payload.sessionId, recentTurns)
    const recentTurnsText = clipText(formatTurns(messages), maxRecentTurnsChars)

    const memory = (await deps.chatStore.getSessionMemory(
      payload.sessionId
    )) as ChatSessionMemory | null
    const sessionSummaryText = clipText(String(memory?.summary || ''), maxSummaryChars)

    return { recentTurnsText, sessionSummaryText }
  }

  return {
    runId: payload.runId,
    sessionId: payload.sessionId,
    checkCancelled,
    chatJson,
    sendEvent: deps.sendEvent,
    loadHistory,
    getModelConfig: getActiveConfig,
    documentsStore: deps.documentsStore,
    writingStore: deps.writingStore,
    embeddingService: deps.embeddingService
  }
}
