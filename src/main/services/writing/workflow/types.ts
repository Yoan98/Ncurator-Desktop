import type {
  SearchResult,
  WritingWorkflowEvent,
  WritingWorkflowRunRecord,
  WritingWorkflowRunStatus,
  WritingWorkflowStageId
} from '../../../types/store'
import type { DocumentsStore } from '../../storage/domains/DocumentsStore'
import type { LlmConfigStore } from '../../storage/domains/LlmConfigStore'
import type { WritingStore } from '../../storage/domains/WritingStore'
import type { EmbeddingService } from '../../vector/EmbeddingService'
import type { Citation, Outline, RetrievalPlan } from '../prompts'

export type SendEvent = (event: WritingWorkflowEvent) => void

export interface WritingWorkflowStartPayload {
  runId: string
  input: string
  selectedDocumentIds?: string[]
  writingDocumentId?: string
}

export type RetrievedChunk = {
  chunkId: string
  documentId?: string
  documentName: string
  text: string
  metadata?: any
  score?: number
}

export type WritingState = {
  runId: string
  status: WritingWorkflowRunStatus
  writingDocumentId?: string
  input: string
  selectedDocumentIds: string[]
  outline?: Outline
  retrievalPlan?: RetrievalPlan
  retrieved?: RetrievedChunk[]
  citations?: Citation[]
  draftMarkdown?: string
  error?: string
}

export type WorkflowDeps = {
  documentsStore: DocumentsStore
  llmStore: LlmConfigStore
  writingStore: WritingStore
  embeddingService: EmbeddingService
  sendEvent: SendEvent
  isCancelled: () => boolean
}

export type ChatCompleteInput = {
  system: string
  user: string
  temperature: number
}

export type WritingWorkflowContext = {
  runId: string
  documentsStore: DocumentsStore
  embeddingService: EmbeddingService
  checkCancelled: () => void
  stageStarted: (stageId: WritingWorkflowStageId) => void
  stageOutput: (stageId: WritingWorkflowStageId, payload: any) => void
  stageCompleted: (stageId: WritingWorkflowStageId) => void
  writeRun: (partial: Partial<WritingWorkflowRunRecord>) => Promise<void>
  chatComplete: (input: ChatCompleteInput) => Promise<string>
  parseJsonObject: (text: string) => any
  normalizeSearchResult: (r: SearchResult) => any
}
