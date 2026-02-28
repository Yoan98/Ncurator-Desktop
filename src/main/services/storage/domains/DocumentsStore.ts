import * as lancedb from '@lancedb/lancedb'
import type {
  ChunkInput,
  ChunkListResponse,
  DocumentListResponse,
  DocumentRecord,
  SearchResult
} from '../../../types/store'
import { LanceDbCore, LANCE_TABLES } from '../core/LanceDbCore'
import { asRecord, toNumber, toNumberArray, toOptionalNumber, toOptionalString, toString } from '../../../utils/decoder'

type ChunkRow = Record<string, unknown> & {
  id?: unknown
  text?: unknown
  document_name?: unknown
  document_id?: unknown
  source_type?: unknown
  metadata?: unknown
  created_at?: unknown
  vector?: unknown
}

type DocumentRow = Record<string, unknown> & {
  id?: unknown
  name?: unknown
  source_type?: unknown
  file_path?: unknown
  created_at?: unknown
  import_status?: unknown
}

const normalizeSourceType = (value: unknown): DocumentRecord['source_type'] =>
  String(value || '') === 'web' ? 'web' : 'file'

const normalizeChunkMetadata = (value: unknown): SearchResult['metadata'] => {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  const row = asRecord(value)
  return { page: toNumber(row.page, 1) }
}

const toDocumentRecord = (value: unknown): DocumentRecord => {
  const row = asRecord(value) as DocumentRow
  const status = toNumber(row.import_status, 2)
  const importStatus = (status === 1 ? 1 : status === 3 ? 3 : 2) as 1 | 2 | 3
  return {
    id: toString(row.id),
    name: toString(row.name),
    source_type: normalizeSourceType(row.source_type),
    file_path: toOptionalString(row.file_path),
    created_at: toNumber(row.created_at),
    import_status: importStatus
  }
}

const toSearchResult = (value: unknown): SearchResult => {
  const row = asRecord(value) as ChunkRow
  return {
    id: toString(row.id),
    text: toString(row.text),
    document_name: toString(row.document_name),
    document_id: toOptionalString(row.document_id),
    source_type: toOptionalString(row.source_type),
    metadata: normalizeChunkMetadata(row.metadata),
    _distance: toOptionalNumber(row._distance),
    created_at: toNumber(row.created_at),
    _score: toOptionalNumber(row._score),
    _relevance_score: toOptionalNumber(row._relevance_score)
  }
}

export class DocumentsStore {
  private reranker: lancedb.rerankers.RRFReranker | null = null

  public constructor(private readonly core: LanceDbCore) {}

  private async getRRFReranker(): Promise<lancedb.rerankers.RRFReranker> {
    if (this.reranker) return this.reranker
    this.reranker = await lancedb.rerankers.RRFReranker.create()
    return this.reranker
  }

  public async addDocument(doc: DocumentRecord): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.DOCUMENT)
    await table.add([
      {
        id: doc.id,
        name: doc.name,
        source_type: doc.source_type,
        file_path: doc.file_path,
        created_at: doc.created_at,
        import_status: doc.import_status
      }
    ])
  }

  public async updateDocumentImportStatus(id: string, status: number): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.DOCUMENT)
    await table.update({
      where: `id = '${this.core.escapeSqlString(id)}'`,
      values: { import_status: status }
    })
  }

  public async updateDocumentById(
    id: string,
    values: Partial<Pick<DocumentRecord, 'name' | 'file_path' | 'source_type'>>
  ): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.DOCUMENT)
    await table.update({ where: `id = '${this.core.escapeSqlString(id)}'`, values })
  }

  public async addChunks(params: { vectors: Float32Array[]; chunks: ChunkInput[] }): Promise<void> {
    const { vectors, chunks } = params
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

    const table = await this.core.openTable(LANCE_TABLES.CHUNK)
    await table.add(data)
  }

  public async vectorSearch(
    queryVector: Float32Array,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    const table = await this.core.openTable(LANCE_TABLES.CHUNK)
    const query = table.query()
    const where = this.core.combineWhere([
      sourceType ? `source_type = '${this.core.escapeSqlString(sourceType)}'` : undefined,
      this.core.buildInClause('document_id', documentIds)
    ])
    if (where) query.where(where)
    const results = await query.nearestTo(queryVector).distanceType('cosine').limit(limit).toArray()
    return results.map(toSearchResult)
  }

  public async ftsSearch(
    queryText: string,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    const table = await this.core.openTable(LANCE_TABLES.CHUNK)
    const q = table.query()
    const where = this.core.combineWhere([
      sourceType ? `source_type = '${this.core.escapeSqlString(sourceType)}'` : undefined,
      this.core.buildInClause('document_id', documentIds)
    ])
    if (where) q.where(where)
    const results = await q.fullTextSearch(queryText).limit(limit).toArray()
    return results.map(toSearchResult)
  }

  public async hybridSearch(
    queryVector: Float32Array,
    queryText: string,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    const reranker = await this.getRRFReranker()
    const table = await this.core.openTable(LANCE_TABLES.CHUNK)
    const q = table.query()
    const where = this.core.combineWhere([
      sourceType ? `source_type = '${this.core.escapeSqlString(sourceType)}'` : undefined,
      this.core.buildInClause('document_id', documentIds)
    ])
    if (where) q.where(where)
    const results = await q
      .fullTextSearch(queryText)
      .nearestTo(queryVector)
      .distanceType('cosine')
      .rerank(reranker)
      .limit(limit)
      .toArray()
    return results.map(toSearchResult)
  }

  public async search(
    queryVector: Float32Array,
    queryText: string,
    limit = 50,
    sourceType?: string,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    const results = await this.hybridSearch(queryVector, queryText, limit, sourceType, documentIds)
    if (results.length === 0) return []

    const resultDocumentIds = Array.from(
      new Set(results.map((r) => r.document_id).filter(Boolean))
    ) as string[]
    if (resultDocumentIds.length === 0) return results

    const docTable = await this.core.openTable(LANCE_TABLES.DOCUMENT)
    const whereClause = this.core.buildInClause('id', resultDocumentIds)
    if (!whereClause) return results
    const documents = await docTable.query().where(whereClause).toArray()
    const docMap = new Map(
      documents.map((row) => {
        const doc = toDocumentRecord(row)
        return [doc.id, doc] as const
      })
    )

    return results.map((item) => ({
      ...item,
      document: item.document_id ? docMap.get(item.document_id) : undefined
    }))
  }

  public async listDocuments(params: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<DocumentListResponse> {
    const { keyword, page, pageSize } = params
    const table = await this.core.openTable(LANCE_TABLES.DOCUMENT)

    let where: string | undefined = undefined
    const kw = String(keyword || '').trim()
    if (kw) {
      where = `name LIKE '%${this.core.escapeSqlString(kw)}%'`
    }

    const total = await table.countRows(where)
    const skip = Math.max(0, (page - 1) * pageSize)

    const query = table.query()
    if (where) query.where(where)
    const rows = await query.limit(pageSize).offset(skip).toArray()

    const items = rows.map(toDocumentRecord)

    return { items, total }
  }

  public async listChunks(params: {
    keyword?: string
    page: number
    pageSize: number
  }): Promise<ChunkListResponse> {
    const { keyword, page, pageSize } = params
    const table = await this.core.openTable(LANCE_TABLES.CHUNK)

    const where = this.core.buildWhereFromKeyword(keyword, ['text', 'document_name'])
    const total = await table.countRows(where)
    const skip = Math.max(0, (page - 1) * pageSize)

    const query = table.query()
    if (where && where.trim().length > 0) query.where(where)
    const rows = await query.limit(pageSize).offset(skip).toArray()

    const items = rows.map((item) => {
      const row = asRecord(item) as ChunkRow
      return {
        id: toString(row.id),
        text: toString(row.text),
        document_name: toString(row.document_name),
        document_id: toOptionalString(row.document_id),
        source_type: normalizeSourceType(row.source_type),
        metadata: normalizeChunkMetadata(row.metadata),
        created_at: toNumber(row.created_at),
        vector: toNumberArray(row.vector)
      }
    })

    return { items, total }
  }

  public async dropDocumentsStorage(): Promise<{ existed: boolean }> {
    const db = this.core.getConnection()
    const tableNames = await db.tableNames()
    const existedChunk = tableNames.includes(LANCE_TABLES.CHUNK)
    const existedDoc = tableNames.includes(LANCE_TABLES.DOCUMENT)
    if (existedChunk) await db.dropTable(LANCE_TABLES.CHUNK)
    if (existedDoc) await db.dropTable(LANCE_TABLES.DOCUMENT)
    return { existed: existedChunk || existedDoc }
  }

  public async deleteDocumentsByIds(ids: string[]): Promise<{ success: boolean; msg?: string }> {
    if (!ids || ids.length === 0) {
      return { success: false, msg: 'No document IDs provided' }
    }
    try {
      const chunkTable = await this.core.openTable(LANCE_TABLES.CHUNK)
      const docTable = await this.core.openTable(LANCE_TABLES.DOCUMENT)
      for (const id of ids) {
        const safeId = this.core.escapeSqlString(id)
        await chunkTable.delete(`document_id = "${safeId}"`)
        await docTable.delete(`id = "${safeId}"`)
      }
    } catch (error: unknown) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) }
    }
    return { success: true, msg: 'Documents deleted successfully' }
  }
}
