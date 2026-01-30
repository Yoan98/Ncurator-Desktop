import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  SearchResult,
  DocumentRecord,
  SearchResponse,
  ChunkListItem
} from '../../../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ingestFile: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>
      ingestFiles: (
        files: File[]
      ) => Promise<{ success: boolean; created?: number; error?: string }>
      search: (query: string) => Promise<SearchResponse>
      ftsSearch: (query: string) => Promise<SearchResult[]>
      vectorSearch: (query: string) => Promise<SearchResult[]>
      hybridSearch: (query: string) => Promise<SearchResult[]>
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
      readFile: (filePath: string) => Promise<Uint8Array>
    }
  }
}
