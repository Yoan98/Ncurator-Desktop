import type { ElectronAPI } from '@electron-toolkit/preload'

export interface DocumentRecord {
  id: string
  name: string
  sourceType: 'file' | 'web'
  filePath?: string
  createdAt: number
}

export interface SearchResult {
  id: string
  text: string
  documentName: string
  documentId?: string
  sourceType?: string
  metadata?: {
    page: number
  }
  _distance?: number
  createdAt?: number
  _score?: number
  _relevance_score?: number
  document?: DocumentRecord
}

export interface SearchResponse {
  results: SearchResult[]
  tokens: string[]
}

export interface DocumentListItem {
  id: string
  text: string
  documentName: string
  documentId?: string
  sourceType?: string
  metadata?: {
    page: number
  }
  createdAt?: number
  vector: number[]
}

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
