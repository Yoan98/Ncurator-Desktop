import type {
  AiRunApprovalDecisionRequest,
  AiRunApprovalDecisionResponse,
  AiRunCancelResponse,
  AiRunEvent,
  AiRunStartRequest,
  AiRunStartResponse,
  ChatMessage,
  ChatSession,
  ChunkListResponse,
  DocumentRecord,
  LLMConfig,
  SearchResponse,
  SearchResult,
  SearchSourceFilter,
  WebIngestPayload
} from '../shared/types'

export type ModelInfo = {
  id: string
  name: string
  description: string
  tags: string[]
  isDownloaded: boolean
}

export type DownloadProgress = {
  repoId: string
  file?: string
  status: string
  progress: number
  totalFiles?: number
  completedFiles?: number
  error?: string
}

export type DesktopApi = {
  ingestFile: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>
  ingestFiles: (files: File[]) => Promise<{ success: boolean; created?: number; error?: string }>
  ingestWeb: (payload: WebIngestPayload) => Promise<{ success: boolean; count?: number; error?: string }>
  ingestWebs: (
    payload: WebIngestPayload[]
  ) => Promise<{ success: boolean; created?: number; error?: string }>
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>
  search: (query: string, sourceType?: SearchSourceFilter) => Promise<SearchResponse>
  ftsSearch: (query: string, sourceType?: SearchSourceFilter) => Promise<SearchResult[]>
  vectorSearch: (query: string, sourceType?: SearchSourceFilter) => Promise<SearchResult[]>
  hybridSearch: (query: string, sourceType?: SearchSourceFilter) => Promise<SearchResult[]>
  listDocuments: (payload: {
    keyword?: string
    page: number
    pageSize: number
  }) => Promise<{ items: DocumentRecord[]; total: number }>
  listChunks: (payload: {
    keyword?: string
    page: number
    pageSize: number
  }) => Promise<ChunkListResponse>
  deleteDocuments: (
    ids: string[]
  ) => Promise<{ success: boolean; deletedDocs?: number; deletedChunks?: number; error?: string }>
  dropDocumentsTable: () => Promise<{ success: boolean; existed?: boolean; error?: string }>
  documentListRefresh: (cb: () => void) => void
  removeDocumentListRefreshListeners: () => void
  downloadModel: (repoId: string) => Promise<{ success: boolean; error?: string }>
  onDownloadProgress: (cb: (progressData: DownloadProgress) => void) => void
  removeDownloadProgressListeners: () => void
  getModels: () => Promise<ModelInfo[]>
  getEmbeddingStatus: () => Promise<'uninitialized' | 'initializing' | 'ready' | 'error'>
  readFile: (filePath: string) => Promise<Uint8Array>
  chatSessionList: () => Promise<ChatSession[]>
  chatSessionSave: (session: ChatSession) => Promise<{ success: boolean; error?: string }>
  chatSessionDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  chatMessageList: (sessionId: string) => Promise<ChatMessage[]>
  chatMessageSave: (message: ChatMessage) => Promise<{ success: boolean; error?: string }>
  llmConfigList: () => Promise<LLMConfig[]>
  llmConfigSave: (config: LLMConfig) => Promise<{ success: boolean; error?: string }>
  llmConfigDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  llmConfigSetActive: (id: string) => Promise<{ success: boolean; error?: string }>
  aiRunStart: (payload: AiRunStartRequest) => Promise<AiRunStartResponse>
  aiRunCancel: (runId: string) => Promise<AiRunCancelResponse>
  aiRunApprovalDecide: (
    payload: AiRunApprovalDecisionRequest
  ) => Promise<AiRunApprovalDecisionResponse>
  onAiRunEvent: (cb: (event: AiRunEvent) => void) => void
  removeAiRunEventListeners: () => void
}
