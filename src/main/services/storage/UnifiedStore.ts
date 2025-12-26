import * as lancedb from '@lancedb/lancedb'
import { LANCE_DB_PATH } from '../../utils/paths'
import fs from 'fs'
import * as arrow from 'apache-arrow'
import type { TableConfig, ChunkInput } from '../../types/store'
import { config } from 'process'

/**
 * UnifiedStore - Single source of truth for all LanceDB operations
 * Handles vector storage, FTS indexing, and metadata management
 */
export class UnifiedStore {
  private static instance: UnifiedStore
  private db: lancedb.Connection | null = null

  // Table name constants
  private readonly TABLE_DOCUMENTS = 'documents'
  // Add more table names here as needed
  // private readonly TABLE_METADATA = 'metadata'
  // private readonly TABLE_COLLECTIONS = 'collections'

  private reranker: lancedb.rerankers.RRFReranker | null = null

  private constructor() {}

  public static getInstance(): UnifiedStore {
    if (!UnifiedStore.instance) {
      UnifiedStore.instance = new UnifiedStore()
    }
    return UnifiedStore.instance
  }

  /**
   * Initialize database connection and all tables
   */
  public async initialize(): Promise<void> {
    if (!fs.existsSync(LANCE_DB_PATH)) {
      fs.mkdirSync(LANCE_DB_PATH, { recursive: true })
    }

    this.db = await lancedb.connect(LANCE_DB_PATH)

    // Initialize all tables
    await this.initializeTables()
  }

  /**
   * Initialize all required tables with their schemas
   */
  private async initializeTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection not established')
    }

    const tableConfigs = this.getTableConfigs()

    for (const config of tableConfigs) {
      await this.ensureTable(config)
    }
  }

  private async getRRFReranker(): Promise<lancedb.rerankers.RRFReranker> {
    if (this.reranker) return this.reranker

    this.reranker = await lancedb.rerankers.RRFReranker.create()
    return this.reranker
  }

  /**
   * Define all table configurations with Arrow schemas
   */
  private getTableConfigs(): TableConfig[] {
    return [
      // Documents table for storing document chunks with embeddings
      {
        name: this.TABLE_DOCUMENTS,
        schema: new arrow.Schema([
          new arrow.Field(
            'vector',
            new arrow.FixedSizeList(384, new arrow.Field('item', new arrow.Float32()))
          ),
          new arrow.Field('text', new arrow.Utf8()),
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('filename', new arrow.Utf8()),
          new arrow.Field('createdAt', new arrow.Int64())
        ]),
        // 暂时先不使用向量索引
        // vectorIndexConfig: {
        //   column: 'vector',
        //   options: { config: lancedb.Index.hnswSq() }
        // },
        ftsIndexConfig: {
          column: 'text',
          options: { config: lancedb.Index.fts() }
        }
      }
      // Add more table configurations here as needed
      // {
      //   name: this.TABLE_METADATA,
      //   schema: new arrow.Schema([...]),
      //   ...
      // }
    ]
  }

  /**
   * Ensure a table exists, create if not, and set up indices
   */
  private async ensureTable(config: TableConfig): Promise<void> {
    if (!this.db) {
      throw new Error('Database connection not established')
    }

    const tableNames = await this.db.tableNames()

    if (!tableNames.includes(config.name)) {
      console.log(`Creating table: ${config.name}`)

      // Create table with Arrow schema (empty table)
      const table = await this.db.createEmptyTable(config.name, config.schema)

      // Create vector index if configured
      if (config.vectorIndexConfig) {
        console.log(`Creating vector index on ${config.name}.${config.vectorIndexConfig.column}`)
        await table.createIndex(config.vectorIndexConfig.column, config.vectorIndexConfig.options)
      }

      // Create FTS index if configured
      if (config.ftsIndexConfig) {
        console.log(`Creating FTS index on ${config.name}.${config.ftsIndexConfig.column}`)
        await table.createIndex(config.ftsIndexConfig.column, config.ftsIndexConfig.options)
      }
    } else {
      console.log(`Table ${config.name} already exists`)
    }
  }

  /**
   * Add document chunks with embeddings to the documents table
   */
  public async addChunks({
    vectors,
    chunks
  }: {
    vectors: Float32Array[]
    chunks: ChunkInput[]
  }): Promise<void> {
    if (!this.db) await this.initialize()

    const data = vectors.map((vector, i) => ({
      vector,
      text: chunks[i].text,
      id: chunks[i].id,
      filename: chunks[i].filename,
      createdAt: Date.now()
    }))

    const table = await this.db!.openTable(this.TABLE_DOCUMENTS)
    await table.add(data)
  }

  /**
   * Vector similarity search
   */
  public async search(queryVector: Float32Array, limit = 50) {
    if (!this.db) await this.initialize()

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_DOCUMENTS)) return []

    const table = await this.db!.openTable(this.TABLE_DOCUMENTS)
    const results = await table
      .vectorSearch(queryVector)
      .distanceType('cosine')
      .limit(limit)
      .toArray()

    return results
  }

  /**
   * Full-text search
   */
  public async ftsSearch(query: string, limit = 50) {
    if (!this.db) await this.initialize()

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_DOCUMENTS)) return []

    const table = await this.db!.openTable(this.TABLE_DOCUMENTS)
    const results = await table.search(query).limit(limit).toArray()

    return results
  }

  public async hybridSearch(queryVector: Float32Array, query: string, limit = 50) {
    if (!this.db) await this.initialize()

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_DOCUMENTS)) return []

    const reranker = await this.getRRFReranker()
    const table = await this.db!.openTable(this.TABLE_DOCUMENTS)
    const results = await table
      .query()
      .fullTextSearch(query)
      .nearestTo(queryVector)
      .rerank(reranker)
      .limit(limit)
      .toArray()

    return results
  }

  /**
   * Get database connection (for advanced operations)
   */
  public getConnection(): lancedb.Connection | null {
    return this.db
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    // LanceDB connections are typically auto-managed, but we can null the reference
    this.db = null
  }
}
