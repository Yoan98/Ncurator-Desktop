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
 * Document chunk stored in LanceDB
 */
export interface DocumentChunk {
  vector: Float32Array
  text: string
  id: string
  filename: string
  createdAt?: number
}

/**
 * Document chunk input for indexing
 */
export interface ChunkInput {
  text: string
  id: string
  filename: string
}

/**
 * Search result from vector or FTS search
 */
export interface SearchResult {
  id: string
  text: string
  filename: string
  score?: number
  _distance?: number
}

/**
 * Namespace for backward compatibility
 * @deprecated Use named exports instead
 */
export namespace VectorStoreTable {
  export type Chunk = DocumentChunk
}
