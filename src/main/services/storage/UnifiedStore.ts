import * as lancedb from '@lancedb/lancedb'
import { LANCE_DB_PATH } from '../../utils/paths'
import fs from 'fs'
import * as arrow from 'apache-arrow'
import type {
  TableConfig,
  ChunkInput,
  DocumentListResponse,
  DocumentRecord
} from '../../types/store'

enum ServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error'
}

/**
 * UnifiedStore - Single source of truth for all LanceDB operations
 * Handles vector storage, FTS indexing, and metadata management
 */
export class UnifiedStore {
  private static instance: UnifiedStore
  private db: lancedb.Connection | null = null

  // Table name constants
  private readonly TABLE_CHUNK = 'chunk'
  private readonly TABLE_DOCUMENT = 'document'

  private reranker: lancedb.rerankers.RRFReranker | null = null

  private status: ServiceStatus = ServiceStatus.UNINITIALIZED

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
    if (this.status === ServiceStatus.READY) return

    if (this.status === ServiceStatus.INITIALIZING) {
      return
    }

    this.status = ServiceStatus.INITIALIZING
    try {
      if (!fs.existsSync(LANCE_DB_PATH)) {
        fs.mkdirSync(LANCE_DB_PATH, { recursive: true })
      }

      this.db = await lancedb.connect(LANCE_DB_PATH)

      // Initialize all tables
      await this.initializeTables()
      this.status = ServiceStatus.READY
    } catch (error) {
      this.status = ServiceStatus.ERROR
      throw error
    }
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
        name: this.TABLE_CHUNK,
        schema: new arrow.Schema([
          new arrow.Field(
            'vector',
            new arrow.FixedSizeList(768, new arrow.Field('item', new arrow.Float32()))
          ),
          new arrow.Field('text', new arrow.Utf8()),
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('document_id', new arrow.Utf8()),
          new arrow.Field('document_name', new arrow.Utf8()),
          new arrow.Field('createdAt', new arrow.Int64())
        ]),
        // 暂时先不使用向量索引
        // vectorIndexConfig: {
        //   column: 'vector',
        //   options: { config: lancedb.Index.hnswSq() }
        // },
        ftsIndexConfig: {
          column: 'text',
          options: {
            config: lancedb.Index.fts({
              baseTokenizer: 'ngram',
              ngramMinLength: 2,
              ngramMaxLength: 3
            })
          }
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
      // Check if schema matches and update if necessary - logic omitted for simplicity
      // In a real app we might want to migrate schema
    }
  }

  /**
   * Add a document record
   */
  public async addDocument(doc: DocumentRecord): Promise<void> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const table = await this.db!.openTable(this.TABLE_DOCUMENT)
    // @ts-ignore 类型没问题
    await table.add([doc])
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
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const data = vectors.map((vector, i) => ({
      vector: Array.from(vector),
      text: chunks[i].text,
      id: chunks[i].id,
      document_id: chunks[i].document_id,
      document_name: chunks[i].document_name,
      createdAt: Date.now()
    }))

    const table = await this.db!.openTable(this.TABLE_CHUNK)
    await table.add(data)
  }

  /**
   * Vector similarity search
   */
  public async vectorSearch(queryVector: Float32Array, limit = 50) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return []

    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const results = await table
      .vectorSearch(queryVector)
      .distanceType('cosine')
      .limit(limit)
      .toArray()

    return results.map((item) => ({
      ...item,
      createdAt: Number(item.createdAt)
    }))
  }

  private buildWhereFromKeyword(keyword?: string): string | undefined {
    const trimmed = (keyword || '').trim()
    if (!trimmed) return undefined
    const isSql =
      /(\bAND\b|\bOR\b|\bNOT\b|=|>=|<=|>|<|\bLIKE\b|\bNOT LIKE\b|\bIN\b|\bIS NULL\b|\bIS NOT NULL\b|regexp_match\s*\()/i.test(
        trimmed
      )
    if (isSql) return trimmed

    // Simple keyword matching for now
    const kw = trimmed.replace(/'/g, "''")
    return `(text LIKE '%${kw}%' OR document_name LIKE '%${kw}%')`
  }

  /**
   * Full-text search
   */
  public async ftsSearch(query: string, limit = 50) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return []

    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const results = await table.query().fullTextSearch(query).limit(limit).toArray()

    return results.map((item) => ({
      ...item,
      createdAt: Number(item.createdAt)
    }))
  }

  public async hybridSearch(queryVector: Float32Array, query: string, limit = 50) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return []

    const reranker = await this.getRRFReranker()
    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const results = await table
      .query()
      .fullTextSearch(query)
      .nearestTo(queryVector)
      .distanceType('cosine')
      .rerank(reranker)
      .limit(limit)
      .toArray()

    return results.map((item) => ({
      ...item,
      createdAt: Number(item.createdAt)
    }))
  }

  public async listDocuments({
    keyword,
    page,
    pageSize
  }: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<DocumentListResponse> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }
    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return { items: [], total: 0 }
    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const where = this.buildWhereFromKeyword(keyword)
    const total = await table.countRows(where)
    const skip = Math.max(0, (page - 1) * pageSize)
    const query = table.query()
    if (where && where.trim().length > 0) {
      query.where(where)
    }
    const rows = await query.limit(pageSize).offset(skip).toArray()
    const pageItems = rows.map((item) => ({
      id: item.id,
      text: item.text,
      document_name: item.document_name,
      document_id: item.document_id,
      createdAt: Number(item.createdAt),
      vector: Array.isArray(item.vector)
        ? (item.vector as number[])
        : Array.from((item.vector || []) as Float32Array)
    }))
    return { items: pageItems, total }
  }

  /**
   * Drop a table completely (remove its storage and indices)
   */
  public async dropTable(tableName: string): Promise<{ existed: boolean }> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }
    if (!this.db) {
      throw new Error('Database connection not established')
    }

    const tableNames = await this.db.tableNames()
    const existed = tableNames.includes(tableName)
    if (!existed) {
      return { existed: false }
    }

    const dbWithMaybeDrop = this.db

    await dbWithMaybeDrop.dropTable(tableName)
    return { existed: true }
  }

  /**
   * Convenience: drop the documents table
   */
  public async dropDocumentsTable(): Promise<{ existed: boolean }> {
    // Drop both chunk and document tables
    const chunkRes = await this.dropTable(this.TABLE_CHUNK)
    const docRes = await this.dropTable(this.TABLE_DOCUMENT)
    return { existed: chunkRes.existed || docRes.existed }
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
