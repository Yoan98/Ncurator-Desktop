import * as lancedb from '@lancedb/lancedb'
import { VECTOR_DB_PATH } from '../../utils/paths'
import fs from 'fs'

export class VectorStore {
  private static instance: VectorStore
  private db: lancedb.Connection | null = null
  private tableName = 'documents'

  private constructor() {}

  public static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore()
    }
    return VectorStore.instance
  }

  public async initialize() {
    if (!fs.existsSync(VECTOR_DB_PATH)) {
      fs.mkdirSync(VECTOR_DB_PATH, { recursive: true })
    }
    this.db = await lancedb.connect(VECTOR_DB_PATH)
  }

  public async addDocuments({
    vectors,
    chunks
  }: {
    vectors: number[][]
    chunks: {
      text: string
      id: string
    }[]
  }) {
    if (!this.db) await this.initialize()

    const data: VectorStoreTable.Chunk[] = vectors.map((vector, i) => ({
      vector,
      text: chunks[i].text,
      id: chunks[i].id
    }))

    // Check if table exists, if not create it
    const tableNames = await this.db!.tableNames()
    if (tableNames.includes(this.tableName)) {
      const table = await this.db!.openTable(this.tableName)
      await table.add(data)
    } else {
      await this.db!.createTable(this.tableName, data)
    }
  }

  public async search(queryVector: number[], limit = 50) {
    if (!this.db) await this.initialize()

    const tableNames = await this.db!.tableNames()
    if (!tableNames.includes(this.tableName)) return []

    const table = await this.db!.openTable(this.tableName)
    const results = await table.vectorSearch(queryVector).limit(limit).toArray()

    return results
  }
}
