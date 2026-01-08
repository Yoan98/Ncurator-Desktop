import * as arrow from 'apache-arrow'
import {
  DocumentRecord,
  SearchResult,
  DocumentListItem,
  DocumentListResponse
} from '../../shared/types'

export type { DocumentRecord, SearchResult, DocumentListItem, DocumentListResponse }

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
  documentId: string
  documentName: string
  sourceType: string
  metadata: {
    page: number
  }
}
