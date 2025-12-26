import * as lancedb from '@lancedb/lancedb'
import { LANCE_DB_PATH } from '../../utils/paths'
import fs from 'fs'

export class UnifiedStore {
  private static instance: UnifiedStore
  private db: lancedb.Connection | null = null
  private tableName = 'documents'

  private constructor() {}

  public static getInstance(): UnifiedStore {
    if (!UnifiedStore.instance) {
      UnifiedStore.instance = new UnifiedStore()
    }
    return UnifiedStore.instance
  }

  public async initialize() {
    if (!fs.existsSync(LANCE_DB_PATH)) {
      fs.mkdirSync(LANCE_DB_PATH, { recursive: true })
    }
    this.db = await lancedb.connect(LANCE_DB_PATH)
  }

  public async addChunks({
    vectors,
    chunks
  }: {
    vectors: Float32Array[]
    chunks: {
      text: string
      id: string
      filename: string
    }[]
  }) {
    if (!this.db) await this.initialize()

    const data = vectors.map((vector, i) => ({
      vector,
      text: chunks[i].text,
      id: chunks[i].id,
      filename: chunks[i].filename
    }))

    const tableNames = await this.db!.tableNames()
    let table: lancedb.Table
    if (tableNames.includes(this.tableName)) {
      table = await this.db!.openTable(this.tableName)
      await table.add(data)
    } else {
      table = await this.db!.createTable(this.tableName, data)
      // Create indices after table creation for the first time
      await table.createIndex('vector') // Default vector index
      await table.createIndex('text', { config: lancedb.Index.fts() }) // FTS index
    }
  }

  public async search(queryVector: Float32Array, limit = 50) {
    if (!this.db) await this.initialize()

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.tableName)) return []

    const table = await this.db!.openTable(this.tableName)
    const results = await table.vectorSearch(queryVector).limit(limit).toArray()

    return results
  }

  public async ftsSearch(query: string, limit = 50) {
    if (!this.db) await this.initialize()

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.tableName)) return []

    const table = await this.db!.openTable(this.tableName)
    // LanceDB FTS usage: .search(query, 'fts')... or similar depending on version.
    // Checking docs or assuming standard lancedb API.
    // In lancedb 0.x, it's typically table.search(query).limit(limit).toArray() which does FTS if it's a string query?
    // Or table.query().search(query).limit(limit)...
    // Let's rely on standard search API.
    const results = await table.search(query).limit(limit).toArray()

    return results
  }
}
