export type DocumentSourceType = 'file' | 'web'

export interface DocumentRecord {
  id: string
  name: string
  sourceType: DocumentSourceType
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

export interface DocumentListResponse {
  items: DocumentListItem[]
  total: number
}
