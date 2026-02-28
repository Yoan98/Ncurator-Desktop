import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  SearchResult,
  DocumentRecord,
  SearchResponse,
  SearchSourceFilter,
  ChunkListItem,
  WebIngestPayload,
  ChatSession,
  ChatMessage,
  LLMConfig,
  AiRunEvent,
  AiRunStartRequest,
  AiRunStartResponse,
  AiRunCancelResponse,
  AiRunApprovalDecisionRequest,
  AiRunApprovalDecisionResponse
} from '../../../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ingestFile: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>
      ingestFiles: (
        files: File[]
      ) => Promise<{ success: boolean; created?: number; error?: string }>
      ingestWeb: (
        payload: WebIngestPayload
      ) => Promise<{ success: boolean; count?: number; error?: string }>
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
      }) => Promise<{ items: ChunkListItem[]; total: number }>
      deleteDocuments: (
        ids: string[]
      ) => Promise<{ success: boolean; msg?: string; error?: string }>
      dropDocumentsTable: () => Promise<{ success: boolean; existed?: boolean; error?: string }>
      documentListRefresh: (cb: () => void) => void
      removeDocumentListRefreshListeners: () => void
      downloadModel: (repoId: string) => Promise<{ success: boolean; error?: string }>
      onDownloadProgress: (
        cb: (progressData: {
          repoId: string
          file?: string
          status: string
          progress: number
          totalFiles?: number
          completedFiles?: number
          error?: string
        }) => void
      ) => void
      removeDownloadProgressListeners: () => void
      getModels: () => Promise<
        Array<{
          id: string
          name: string
          description: string
          tags: string[]
          isDownloaded: boolean
        }>
      >
      getEmbeddingStatus: () => Promise<'uninitialized' | 'initializing' | 'ready' | 'error'>
      readFile: (filePath: string) => Promise<Uint8Array>

      // Chat & LLM
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
  }
}
