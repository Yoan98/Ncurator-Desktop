import * as arrow from 'apache-arrow'
import {
  DocumentRecord,
  SearchResult,
  DocumentListItem,
  DocumentListResponse,
  ChunkListItem,
  ChunkListResponse
} from '../../shared/types'

export type {
  DocumentRecord,
  SearchResult,
  DocumentListItem,
  DocumentListResponse,
  ChunkListItem,
  ChunkListResponse
}

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
 * Document chunk input for indexing
 */
export interface ChunkInput {
  text: string
  id: string
  document_id: string
  document_name: string
  source_type: string
  metadata: {
    page: number
  }
}
