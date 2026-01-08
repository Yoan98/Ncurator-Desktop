import * as arrow from 'apache-arrow'

/**
 * LanceDB Table Configuration
 */
export interface TableConfig {
  name: string
  schema: arrow.Schema
  vectorIndexConfig?: {
    column: string
    options?: Record<string, unknown>
  }
  ftsIndexConfig?: {
    column: string
    options?: Record<string, unknown>
  }
}

/**
 * Document source type
 */
export type DocumentSourceType = 'file' | 'web'

/**
 * Document record
 */
export interface DocumentRecord {
  id: string
  name: string
  sourceType: DocumentSourceType
  filePath?: string
  createdAt: number
}

/**
 * Document chunk input for indexing
 */
export interface ChunkInput {
  text: string
  id: string
  document_id: string
  document_name: string
}

/**
 * Search result from vector or FTS search
 */
export interface SearchResult {
  id: string
  text: string
  document_name: string
  document_id?: string
  _distance?: number
  createdAt?: number
  _score?: number
  _relevance_score?: number
  document?: DocumentRecord
}

export interface DocumentListItem {
  id: string
  text: string
  document_name: string
  document_id?: string
  createdAt?: number
  vector: number[]
}

export interface DocumentListResponse {
  items: DocumentListItem[]
  total: number
}
