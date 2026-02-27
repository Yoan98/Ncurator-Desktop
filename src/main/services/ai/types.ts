import type { ChatStore } from '../storage/domains/ChatStore'
import type { DocumentsStore } from '../storage/domains/DocumentsStore'
import type { LlmConfigStore } from '../storage/domains/LlmConfigStore'
import type { WritingStore } from '../storage/domains/WritingStore'
import type { EmbeddingService } from '../vector/EmbeddingService'
import type { AiRunEvent, LLMConfig } from '../../../shared/types'

export type AiTaskKind = 'retrieval' | 'writer'
export type AiTaskStatus = 'pending' | 'running' | 'completed' | 'failed'
export type AiRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export type AiPlanTask = {
  id: string
  title: string
  kind: AiTaskKind
  status: AiTaskStatus
  attempts: number
  error?: string
}

export type AiRunState = {
  runId: string
  sessionId: string
  status: AiRunStatus
  input: string
  plan: AiPlanTask[]
  activeTaskId?: string
  error?: string
  outputText?: string
}

export type AiRunStartPayload = {
  runId: string
  sessionId: string
  input: string
}

export type AiRunDeps = {
  llmStore: LlmConfigStore
  chatStore: ChatStore
  documentsStore: DocumentsStore
  writingStore: WritingStore
  embeddingService: EmbeddingService
  isCancelled: () => boolean
  sendEvent: (event: AiRunEvent) => void
}

export type AiRunContext = {
  runId: string
  sessionId: string
  checkCancelled: () => void
  chatJson: (input: { system: string; user: string; temperature?: number }) => Promise<any>
  sendEvent: (event: AiRunEvent) => void
  loadHistory: (limits?: {
    recentTurns?: number
    maxRecentTurnsChars?: number
    maxSummaryChars?: number
  }) => Promise<{ recentTurnsText: string; sessionSummaryText: string }>
  getModelConfig: () => Promise<LLMConfig>
  documentsStore: DocumentsStore
  writingStore: WritingStore
  embeddingService: EmbeddingService
}
