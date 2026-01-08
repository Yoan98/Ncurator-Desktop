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
  documentId: string
  documentName: string
  sourceType: string
  metadata: {
    page: number
  }
}

/**
 * Search result from vector or FTS search
 */
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
