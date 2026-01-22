import * as lancedb from '@lancedb/lancedb'
import { LANCE_DB_PATH } from '../../utils/paths'
import fs from 'fs'
import * as arrow from 'apache-arrow'
import type {
  TableConfig,
  ChunkInput,
  DocumentListResponse,
  ChunkListResponse,
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
          new arrow.Field('documentId', new arrow.Utf8()),
          new arrow.Field('documentName', new arrow.Utf8()),
          new arrow.Field('sourceType', new arrow.Utf8()),
          new arrow.Field(
            'metadata',
            new arrow.Struct([new arrow.Field('page', new arrow.Int32())])
          ),
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
      },
      {
        name: this.TABLE_DOCUMENT,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('name', new arrow.Utf8()),
          new arrow.Field('sourceType', new arrow.Utf8()),
          new arrow.Field('filePath', new arrow.Utf8(), true),
          new arrow.Field('createdAt', new arrow.Int64()),
          new arrow.Field('importStatus', new arrow.Int32())
        ])
      }
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

  public async updateDocumentImportStatus(id: string, status: number): Promise<void> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }
    const table = await this.db!.openTable(this.TABLE_DOCUMENT)
    await table.update({ where: `id = '${id}'`, values: { importStatus: status } })
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
      documentId: chunks[i].documentId,
      documentName: chunks[i].documentName,
      sourceType: chunks[i].sourceType,
      metadata: chunks[i].metadata,
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

  public async search(queryVector: Float32Array, query: string, limit = 50) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    // 1. Get hybrid search results
    const results = await this.hybridSearch(queryVector, query, limit)
    if (results.length === 0) return []

    // 2. Extract unique document IDs
    const documentIds = Array.from(
      new Set(results.map((r) => r.documentId).filter(Boolean))
    ) as string[]
    if (documentIds.length === 0) return results

    // 3. Query documents details
    // We check if the document table exists first to be safe, though it should exist if initialized
    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_DOCUMENT)) return results

    const docTable = await this.db!.openTable(this.TABLE_DOCUMENT)

    // Construct SQL-like IN clause
    const whereClause = `id IN (${documentIds.map((id) => `'${id}'`).join(',')})`
    const documents = await docTable.query().where(whereClause).toArray()

    // 4. Map documents by ID
    const docMap = new Map(
      documents.map((d) => [
        d.id,
        {
          ...d,
          createdAt: Number(d.createdAt)
        }
      ])
    )

    // 5. Attach document info to results
    return results.map((item) => ({
      ...item,
      document: item.documentId ? docMap.get(item.documentId) : undefined
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
    return `(text LIKE '%${kw}%' OR documentName LIKE '%${kw}%')`
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
    if (!tableNames.includes(this.TABLE_DOCUMENT)) return { items: [], total: 0 }

    const table = await this.db!.openTable(this.TABLE_DOCUMENT)

    // Build where clause
    let where: string | undefined = undefined
    if (keyword && keyword.trim().length > 0) {
      // Escape keyword if needed, simple replacement for now
      const safeKeyword = keyword.replace(/'/g, "''")
      where = `name LIKE '%${safeKeyword}%'`
    }

    const total = await table.countRows(where)
    const skip = Math.max(0, (page - 1) * pageSize)

    const query = table.query()
    if (where) {
      query.where(where)
    }

    const rows = await query.limit(pageSize).offset(skip).toArray()

    const items = rows.map((item) => {
      const s = Number((item as any).importStatus ?? 2)
      const importStatus = (s === 1 ? 1 : s === 3 ? 3 : 2) as 1 | 2 | 3
      return {
        id: item.id as string,
        name: item.name as string,
        sourceType: item.sourceType as any,
        filePath: item.filePath as string,
        createdAt: Number(item.createdAt),
        importStatus
      }
    })

    return { items, total }
  }

  public async listChunks({
    keyword,
    page,
    pageSize
  }: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<ChunkListResponse> {
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

    const items = rows.map((item) => ({
      id: item.id as string,
      text: item.text as string,
      documentName: item.documentName as string,
      documentId: item.documentId as string,
      sourceType: item.sourceType as any,
      metadata: item.metadata as any,
      createdAt: Number(item.createdAt),
      vector: Array.isArray(item.vector)
        ? (item.vector as number[])
        : Array.from((item.vector || []) as Float32Array)
    }))

    return { items, total }
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

  public async deleteDocumentsByIds(ids: string[]): Promise<{ success: boolean; msg?: string }> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }
    if (!this.db) {
      throw new Error('Database connection not established')
    }
    if (!ids || ids.length === 0) {
      return { success: false, msg: 'No document IDs provided' }
    }
    try {
      const chunkTable = await this.db.openTable(this.TABLE_CHUNK)
      const docTable = await this.db.openTable(this.TABLE_DOCUMENT)

      const chunkTotal = await chunkTable.countRows()
      const docTotal = await docTable.countRows()
      console.log('chunk rows before delete', chunkTotal)
      console.log('doc rows before delete', docTotal)

      for (const id of ids) {
        const chunkWhere = `documentId = "${id}"`
        const docWhere = `id = "${id}"`

        await chunkTable.delete(chunkWhere)
        await docTable.delete(docWhere)
      }

      console.log('chunk rows after delete', await chunkTable.countRows())
      console.log('doc rows after delete', await docTable.countRows())
    } catch (error: any) {
      console.error('❌ [DELETE-DOCUMENTS] ERROR:', error)
      return { success: false, msg: error.message }
    }
    return { success: true, msg: 'Documents deleted successfully' }
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
