import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ChatSessionMemory } from '../../types/store'
import type { ChatStore } from '../storage/domains/ChatStore'
import type { LlmConfigStore } from '../storage/domains/LlmConfigStore'
import { createChatModel } from '../llm/chatModel'

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

const normalizeMemory = (input: any): ChatSessionMemory => {
  const obj = input && typeof input === 'object' ? input : {}
  const toList = (v: any) => (Array.isArray(v) ? v : []).map((x) => String(x || '').trim()).filter(Boolean)
  return {
    summary: String(obj.summary || '').trim(),
    openTasks: toList(obj.openTasks).slice(0, 20),
    userPrefs: toList(obj.userPrefs).slice(0, 20),
    pinnedFacts: toList(obj.pinnedFacts).slice(0, 20),
    linkedWritingDocumentIds: toList(obj.linkedWritingDocumentIds).slice(0, 50)
  }
}

export const updateSessionMemoryAfterRun = async (input: {
  sessionId: string
  userInput: string
  assistantOutput: string
  chatStore: ChatStore
  llmStore: LlmConfigStore
}): Promise<void> => {
  const sessionId = String(input.sessionId || '').trim()
  if (!sessionId) return

  const prev = (await input.chatStore.getSessionMemory(sessionId)) || {
    summary: '',
    openTasks: [],
    userPrefs: [],
    pinnedFacts: [],
    linkedWritingDocumentIds: []
  }

  const cfg = await input.llmStore.getActive()
  if (!cfg) return

  const model = createChatModel(cfg, { temperature: 0.2 })
  const res = await model.invoke([
    new SystemMessage(
      [
        'You update session memory for a desktop chat assistant.',
        'Return JSON only with keys:',
        'summary, openTasks, userPrefs, pinnedFacts, linkedWritingDocumentIds.',
        'Do not include secrets or credentials.',
        'Keep summary concise.',
        'Use arrays of short strings.'
      ].join('\n')
    ),
    new HumanMessage(
      JSON.stringify({
        previousMemory: prev,
        newExchange: {
          user: String(input.userInput || ''),
          assistant: String(input.assistantOutput || '')
        }
      })
    )
  ])
  const text = typeof res?.content === 'string' ? res.content : String(res?.content ?? '')
  if (!text) return
  const json = parseJsonObject(text)
  const memory = normalizeMemory(json)
  await input.chatStore.saveSessionMemory(sessionId, memory)
}
