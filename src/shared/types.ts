export type DocumentSourceType = 'file' | 'web'
export type DocumentImportStatus = 1 | 2 | 3

export interface DocumentRecord {
  id: string
  name: string
  source_type: DocumentSourceType
  file_path?: string
  created_at: number
  import_status: DocumentImportStatus
}

export interface SearchResult {
  id: string
  text: string
  document_name: string
  document_id?: string
  source_type?: string
  // IPC 传输时为 JSON string，后端存储时为对象
  metadata?:
    | string
    | {
        page: number
      }
  _distance?: number
  created_at?: number
  _score?: number
  _relevance_score?: number
  document?: DocumentRecord
}

export interface SearchResponse {
  results: SearchResult[]
  tokens: string[]
}

export interface ChunkListItem {
  id: string
  text: string
  document_name: string
  document_id?: string
  source_type?: string
  // IPC 传输时为 JSON string，后端存储时为对象
  metadata?:
    | string
    | {
        page: number
      }
  created_at?: number
  vector?: number[]
}

export interface ChunkListResponse {
  items: ChunkListItem[]
  total: number
}

// Deprecated: kept for backward compatibility if needed, but should be removed eventually
export interface DocumentListItem extends ChunkListItem {}

export interface DocumentListResponse {
  items: DocumentRecord[]
  total: number
}
