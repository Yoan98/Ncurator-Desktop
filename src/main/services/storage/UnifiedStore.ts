import * as lancedb from '@lancedb/lancedb'
import { LANCE_DB_PATH } from '../../utils/paths'
import fs from 'fs'
import * as arrow from 'apache-arrow'
import type {
  TableConfig,
  ChunkInput,
  DocumentListResponse,
  ChunkListResponse,
  DocumentRecord,
  ChatSession,
  ChatMessage,
  LLMConfig,
  WritingFolderRecord,
  WritingDocumentRecord,
  WritingWorkflowRunRecord,
  WritingWorkflowRunStatus
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
  private readonly TABLE_CHAT_SESSION = 'chat_session'
  private readonly TABLE_CHAT_MESSAGE = 'chat_message'
  private readonly TABLE_LLM_CONFIG = 'llm_config'
  private readonly TABLE_WRITING_FOLDER = 'writing_folder'
  private readonly TABLE_WRITING_DOCUMENT = 'writing_document'
  private readonly TABLE_WRITING_WORKFLOW_RUN = 'writing_workflow_run'

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

  private escapeSqlString(value: string): string {
    return value.replace(/'/g, "''")
  }

  private buildInClause(column: string, values?: string[]): string | undefined {
    const list = (values || []).map((v) => v.trim()).filter(Boolean)
    if (list.length === 0) return undefined
    return `${column} IN (${list.map((v) => `'${this.escapeSqlString(v)}'`).join(',')})`
  }

  private combineWhere(parts: Array<string | undefined>): string | undefined {
    const clauses = parts.map((p) => (p || '').trim()).filter(Boolean)
    if (clauses.length === 0) return undefined
    if (clauses.length === 1) return clauses[0]
    return clauses.map((c) => `(${c})`).join(' AND ')
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
          new arrow.Field('source_type', new arrow.Utf8()),
          new arrow.Field(
            'metadata',
            new arrow.Struct([new arrow.Field('page', new arrow.Int32())])
          ),
          new arrow.Field('created_at', new arrow.Int64())
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
          new arrow.Field('source_type', new arrow.Utf8()),
          new arrow.Field('file_path', new arrow.Utf8(), true),
          new arrow.Field('created_at', new arrow.Int64()),
          new arrow.Field('import_status', new arrow.Int32())
        ])
      },
      {
        name: this.TABLE_CHAT_SESSION,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('title', new arrow.Utf8()),
          new arrow.Field('created_at', new arrow.Int64())
        ])
      },
      {
        name: this.TABLE_CHAT_MESSAGE,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('session_id', new arrow.Utf8()),
          new arrow.Field('role', new arrow.Utf8()),
          new arrow.Field('content', new arrow.Utf8()),
          new arrow.Field('timestamp', new arrow.Int64()),
          new arrow.Field('sources', new arrow.Utf8(), true), // Nullable
          new arrow.Field('error', new arrow.Bool(), true) // Nullable
        ])
      },
      {
        name: this.TABLE_LLM_CONFIG,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('name', new arrow.Utf8()),
          new arrow.Field('base_url', new arrow.Utf8()),
          new arrow.Field('model_name', new arrow.Utf8()),
          new arrow.Field('api_key', new arrow.Utf8()),
          new arrow.Field('is_active', new arrow.Bool())
        ])
      },
      {
        name: this.TABLE_WRITING_FOLDER,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('name', new arrow.Utf8()),
          new arrow.Field('parent_id', new arrow.Utf8(), true),
          new arrow.Field('created_at', new arrow.Int64()),
          new arrow.Field('updated_at', new arrow.Int64())
        ])
      },
      {
        name: this.TABLE_WRITING_DOCUMENT,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('title', new arrow.Utf8()),
          new arrow.Field('folder_id', new arrow.Utf8(), true),
          new arrow.Field('content', new arrow.Utf8()),
          new arrow.Field('markdown', new arrow.Utf8(), true),
          new arrow.Field('created_at', new arrow.Int64()),
          new arrow.Field('updated_at', new arrow.Int64())
        ])
      },
      {
        name: this.TABLE_WRITING_WORKFLOW_RUN,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('writing_document_id', new arrow.Utf8(), true),
          new arrow.Field('status', new arrow.Utf8()),
          new arrow.Field('input', new arrow.Utf8()),
          new arrow.Field('outline', new arrow.Utf8(), true),
          new arrow.Field('retrieval_plan', new arrow.Utf8(), true),
          new arrow.Field('retrieved', new arrow.Utf8(), true),
          new arrow.Field('citations', new arrow.Utf8(), true),
          new arrow.Field('draft_markdown', new arrow.Utf8(), true),
          new arrow.Field('error', new arrow.Utf8(), true),
          new arrow.Field('created_at', new arrow.Int64()),
          new arrow.Field('updated_at', new arrow.Int64())
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
    await table.update({ where: `id = '${id}'`, values: { import_status: status } })
  }

  public async updateDocumentById(
    id: string,
    values: Partial<Pick<DocumentRecord, 'name' | 'file_path' | 'source_type'>>
  ): Promise<void> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }
    const table = await this.db!.openTable(this.TABLE_DOCUMENT)
    await table.update({ where: `id = '${id}'`, values })
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
      source_type: chunks[i].source_type,
      metadata: chunks[i].metadata,
      created_at: Date.now()
    }))

    const table = await this.db!.openTable(this.TABLE_CHUNK)
    await table.add(data)
  }

  /**
   * Vector similarity search
   */
  public async vectorSearch(
    queryVector: Float32Array,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return []

    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const query = table.query()
    const where = this.combineWhere([
      sourceType ? `source_type = '${this.escapeSqlString(sourceType)}'` : undefined,
      this.buildInClause('document_id', documentIds)
    ])
    if (where) query.where(where)
    const results = await query.nearestTo(queryVector).distanceType('cosine').limit(limit).toArray()

    return results.map((item) => ({
      ...item,
      created_at: Number(item.created_at)
    }))
  }

  public async search(
    queryVector: Float32Array,
    query: string,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    // 1. Get hybrid search results
    const results = await this.hybridSearch(queryVector, query, limit, sourceType, documentIds)
    if (results.length === 0) return []

    // 2. Extract unique document IDs
    const resultDocumentIds = Array.from(
      new Set(results.map((r) => r.document_id).filter(Boolean))
    ) as string[]
    if (resultDocumentIds.length === 0) return results

    // 3. Query documents details
    // We check if the document table exists first to be safe, though it should exist if initialized
    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_DOCUMENT)) return results

    const docTable = await this.db!.openTable(this.TABLE_DOCUMENT)

    // Construct SQL-like IN clause
    const whereClause = this.buildInClause('id', resultDocumentIds)
    if (!whereClause) return results
    const documents = await docTable.query().where(whereClause).toArray()

    // 4. Map documents by ID
    const docMap = new Map(
      documents.map((d) => [
        d.id,
        {
          ...d,
          created_at: Number(d.created_at)
        }
      ])
    )

    // 5. Attach document info to results
    return results.map((item) => ({
      ...item,
      document: item.document_id ? docMap.get(item.document_id) : undefined
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
  public async ftsSearch(query: string, limit = 50, sourceType?: string, documentIds?: string[]) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return []

    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const q = table.query()
    const where = this.combineWhere([
      sourceType ? `source_type = '${this.escapeSqlString(sourceType)}'` : undefined,
      this.buildInClause('document_id', documentIds)
    ])
    if (where) q.where(where)
    const results = await q.fullTextSearch(query).limit(limit).toArray()

    return results.map((item) => ({
      ...item,
      created_at: Number(item.created_at)
    }))
  }

  public async hybridSearch(
    queryVector: Float32Array,
    query: string,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ) {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `UnifiedStore is not ready. Current status: ${this.status}. Please wait for initialization.`
      )
    }

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHUNK)) return []

    const reranker = await this.getRRFReranker()
    const table = await this.db!.openTable(this.TABLE_CHUNK)
    const q = table.query()
    const where = this.combineWhere([
      sourceType ? `source_type = '${this.escapeSqlString(sourceType)}'` : undefined,
      this.buildInClause('document_id', documentIds)
    ])
    if (where) q.where(where)
    const results = await q
      .fullTextSearch(query)
      .nearestTo(queryVector)
      .distanceType('cosine')
      .rerank(reranker)
      .limit(limit)
      .toArray()

    return results.map((item) => ({
      ...item,
      created_at: Number(item.created_at)
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
      const s = Number((item as any).import_status ?? 2)
      const importStatus = (s === 1 ? 1 : s === 3 ? 3 : 2) as 1 | 2 | 3
      return {
        id: item.id as string,
        name: item.name as string,
        source_type: item.source_type as any,
        file_path: item.file_path as string,
        created_at: Number(item.created_at),
        import_status: importStatus
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
      document_name: item.document_name as string,
      document_id: item.document_id as string,
      source_type: item.source_type as any,
      metadata: item.metadata as any,
      created_at: Number(item.created_at),
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

      for (const id of ids) {
        const chunkWhere = `document_id = "${id}"`
        const docWhere = `id = "${id}"`

        await chunkTable.delete(chunkWhere)
        await docTable.delete(docWhere)
      }
    } catch (error: any) {
      console.error('❌ [DELETE-DOCUMENTS] ERROR:', error)
      return { success: false, msg: error.message }
    }
    return { success: true, msg: 'Documents deleted successfully' }
  }

  // === Chat Session Methods ===
  public async saveChatSession(session: ChatSession): Promise<void> {
    if (this.status !== ServiceStatus.READY) throw new Error('Store not ready')
    const table = await this.db!.openTable(this.TABLE_CHAT_SESSION)
    await table.delete(`id = '${session.id}'`)
    await table.add([{ ...session }])
  }

  public async getChatSessions(): Promise<ChatSession[]> {
    if (this.status !== ServiceStatus.READY) return []
    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHAT_SESSION)) return []
    const table = await this.db!.openTable(this.TABLE_CHAT_SESSION)
    const results = await table.query().toArray()
    // Sort in memory
    return results
      .map((r) => ({
        id: r.id as string,
        title: r.title as string,
        created_at: Number(r.created_at)
      }))
      .sort((a, b) => b.created_at - a.created_at)
  }

  public async deleteChatSession(id: string): Promise<void> {
    if (this.status !== ServiceStatus.READY) return
    const sessionTable = await this.db!.openTable(this.TABLE_CHAT_SESSION)
    await sessionTable.delete(`id = '${id}'`)

    // Also delete messages
    const msgTable = await this.db!.openTable(this.TABLE_CHAT_MESSAGE)
    await msgTable.delete(`session_id = '${id}'`)
  }

  // === Chat Message Methods ===
  public async saveChatMessage(message: ChatMessage): Promise<void> {
    if (this.status !== ServiceStatus.READY) throw new Error('Store not ready')
    const table = await this.db!.openTable(this.TABLE_CHAT_MESSAGE)
    await table.delete(`id = '${message.id}'`)
    await table.add([{ ...message }])
  }

  public async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    if (this.status !== ServiceStatus.READY) return []
    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_CHAT_MESSAGE)) return []
    const table = await this.db!.openTable(this.TABLE_CHAT_MESSAGE)
    const results = await table.query().where(`session_id = '${sessionId}'`).toArray()
    return results
      .map((r) => ({
        id: r.id as string,
        session_id: r.session_id as string,
        role: r.role as any,
        content: r.content as string,
        timestamp: Number(r.timestamp),
        sources: r.sources as string,
        error: r.error as boolean
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  // === LLM Config Methods ===
  public async saveLLMConfig(config: LLMConfig): Promise<void> {
    if (this.status !== ServiceStatus.READY) throw new Error('Store not ready')
    const table = await this.db!.openTable(this.TABLE_LLM_CONFIG)
    await table.delete(`id = '${this.escapeSqlString(config.id)}'`)
    await table.add([{ ...config }])
  }

  public async getLLMConfigs(): Promise<LLMConfig[]> {
    if (this.status !== ServiceStatus.READY) return []
    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.TABLE_LLM_CONFIG)) return []
    const table = await this.db!.openTable(this.TABLE_LLM_CONFIG)
    const results = await table.query().toArray()
    return results.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      base_url: r.base_url as string,
      model_name: r.model_name as string,
      api_key: r.api_key as string,
      is_active: Boolean(r.is_active)
    }))
  }

  public async deleteLLMConfig(id: string): Promise<void> {
    if (this.status !== ServiceStatus.READY) return
    const table = await this.db!.openTable(this.TABLE_LLM_CONFIG)
    await table.delete(`id = '${this.escapeSqlString(id)}'`)
  }

  public async setLLMConfigActive(id: string): Promise<void> {
    if (this.status !== ServiceStatus.READY) return
    const table = await this.db!.openTable(this.TABLE_LLM_CONFIG)
    // Deactivate all
    await table.update({ where: 'is_active = true', values: { is_active: false } })
    // Activate target
    await table.update({ where: `id = '${this.escapeSqlString(id)}'`, values: { is_active: true } })
  }

  public async getActiveLLMConfig(): Promise<LLMConfig | null> {
    const configs = await this.getLLMConfigs()
    return configs.find((c) => c.is_active) || null
  }

  public async listWritingFolders(): Promise<WritingFolderRecord[]> {
    if (this.status !== ServiceStatus.READY) return []
    const table = await this.db!.openTable(this.TABLE_WRITING_FOLDER)
    const rows = await table.query().toArray()
    return rows
      .map((r) => ({
        id: r.id as string,
        name: r.name as string,
        parent_id: (r.parent_id as string | undefined) || undefined,
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at)
      }))
      .sort((a, b) => a.created_at - b.created_at)
  }

  public async saveWritingFolder(folder: WritingFolderRecord): Promise<void> {
    if (this.status !== ServiceStatus.READY) throw new Error('Store not ready')
    const now = Date.now()
    const table = await this.db!.openTable(this.TABLE_WRITING_FOLDER)
    const existing = await table
      .query()
      .where(`id = '${this.escapeSqlString(folder.id)}'`)
      .toArray()
    const createdAt =
      existing.length > 0 ? Number(existing[0].created_at) : folder.created_at || now
    await table.delete(`id = '${this.escapeSqlString(folder.id)}'`)
    await table.add([
      {
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id || null,
        created_at: createdAt,
        updated_at: folder.updated_at || now
      }
    ])
  }

  public async deleteWritingFolder(id: string): Promise<void> {
    if (this.status !== ServiceStatus.READY) return
    const folderTable = await this.db!.openTable(this.TABLE_WRITING_FOLDER)
    await folderTable.delete(`id = '${this.escapeSqlString(id)}'`)
  }

  public async listWritingDocuments(folderId?: string): Promise<WritingDocumentRecord[]> {
    if (this.status !== ServiceStatus.READY) return []
    const table = await this.db!.openTable(this.TABLE_WRITING_DOCUMENT)
    const q = table.query()
    if (folderId) {
      q.where(`folder_id = '${this.escapeSqlString(folderId)}'`)
    } else {
      q.where('folder_id IS NULL')
    }
    const rows = await q.toArray()
    return rows
      .map((r) => ({
        id: r.id as string,
        title: r.title as string,
        folder_id: (r.folder_id as string | undefined) || undefined,
        content: r.content as string,
        markdown: (r.markdown as string | undefined) || undefined,
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at)
      }))
      .sort((a, b) => b.updated_at - a.updated_at)
  }

  public async getWritingDocument(id: string): Promise<WritingDocumentRecord | null> {
    if (this.status !== ServiceStatus.READY) return null
    const table = await this.db!.openTable(this.TABLE_WRITING_DOCUMENT)
    const rows = await table
      .query()
      .where(`id = '${this.escapeSqlString(id)}'`)
      .toArray()
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id as string,
      title: r.title as string,
      folder_id: (r.folder_id as string | undefined) || undefined,
      content: r.content as string,
      markdown: (r.markdown as string | undefined) || undefined,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at)
    }
  }

  public async saveWritingDocument(document: WritingDocumentRecord): Promise<void> {
    if (this.status !== ServiceStatus.READY) throw new Error('Store not ready')
    const now = Date.now()
    const table = await this.db!.openTable(this.TABLE_WRITING_DOCUMENT)
    const existing = await table
      .query()
      .where(`id = '${this.escapeSqlString(document.id)}'`)
      .toArray()
    const createdAt =
      existing.length > 0 ? Number(existing[0].created_at) : document.created_at || now
    await table.delete(`id = '${this.escapeSqlString(document.id)}'`)
    await table.add([
      {
        id: document.id,
        title: document.title,
        folder_id: document.folder_id || null,
        content: document.content,
        markdown: document.markdown || null,
        created_at: createdAt,
        updated_at: document.updated_at || now
      }
    ])
  }

  public async deleteWritingDocument(id: string): Promise<void> {
    if (this.status !== ServiceStatus.READY) return
    const table = await this.db!.openTable(this.TABLE_WRITING_DOCUMENT)
    await table.delete(`id = '${this.escapeSqlString(id)}'`)
  }

  public async saveWritingWorkflowRun(run: WritingWorkflowRunRecord): Promise<void> {
    if (this.status !== ServiceStatus.READY) throw new Error('Store not ready')
    const now = Date.now()
    const table = await this.db!.openTable(this.TABLE_WRITING_WORKFLOW_RUN)
    const existing = await table
      .query()
      .where(`id = '${this.escapeSqlString(run.id)}'`)
      .toArray()
    const createdAt = existing.length > 0 ? Number(existing[0].created_at) : run.created_at || now
    await table.delete(`id = '${this.escapeSqlString(run.id)}'`)
    await table.add([
      {
        id: run.id,
        writing_document_id: run.writing_document_id || null,
        status: run.status,
        input: run.input,
        outline: run.outline || null,
        retrieval_plan: run.retrieval_plan || null,
        retrieved: run.retrieved || null,
        citations: run.citations || null,
        draft_markdown: run.draft_markdown || null,
        error: run.error || null,
        created_at: createdAt,
        updated_at: run.updated_at || now
      }
    ])
  }

  public async getWritingWorkflowRun(id: string): Promise<WritingWorkflowRunRecord | null> {
    if (this.status !== ServiceStatus.READY) return null
    const table = await this.db!.openTable(this.TABLE_WRITING_WORKFLOW_RUN)
    const rows = await table
      .query()
      .where(`id = '${this.escapeSqlString(id)}'`)
      .toArray()
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id as string,
      writing_document_id: (r.writing_document_id as string | undefined) || undefined,
      status: r.status as WritingWorkflowRunStatus,
      input: r.input as string,
      outline: (r.outline as string | undefined) || undefined,
      retrieval_plan: (r.retrieval_plan as string | undefined) || undefined,
      retrieved: (r.retrieved as string | undefined) || undefined,
      citations: (r.citations as string | undefined) || undefined,
      draft_markdown: (r.draft_markdown as string | undefined) || undefined,
      error: (r.error as string | undefined) || undefined,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at)
    }
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
