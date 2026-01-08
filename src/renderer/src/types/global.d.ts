import type { ElectronAPI } from '@electron-toolkit/preload'
import type { SearchResult, DocumentListItem, SearchResponse } from '../../../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ingestFile: (file: File) => Promise<{ success: boolean; count?: number; error?: string }>
      search: (query: string) => Promise<SearchResponse>
      ftsSearch: (query: string) => Promise<SearchResult[]>
      vectorSearch: (query: string) => Promise<SearchResult[]>
      hybridSearch: (query: string) => Promise<SearchResult[]>
      listDocuments: (payload: {
        keyword?: string
        page: number
        pageSize: number
      }) => Promise<{ items: DocumentListItem[]; total: number }>
      dropDocumentsTable: () => Promise<{ success: boolean; existed?: boolean; error?: string }>
    }
  }
}
