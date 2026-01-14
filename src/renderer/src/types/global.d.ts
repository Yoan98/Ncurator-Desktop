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
      dropDocumentsTable: () => Promise<{ success: boolean; existed?: boolean; error?: string }>
    }
  }
}
