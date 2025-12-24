import { Document, Charset } from 'flexsearch'
import Sqlite from 'flexsearch/db/sqlite'
import { FULL_TEXT_DB_PATH } from '../../utils/paths'
import fs from 'fs'
import path from 'path'

export class FullTextStore {
  private static instance: FullTextStore
  private index: Document
  private db: InstanceType<typeof Sqlite> | null = null
  private mountTask: Promise<void> | null = null
  private initialized = false

  private constructor() {
    this.index = new Document({
      document: {
        id: 'id',
        index: ['text', 'filename'],
        store: true
      },
      tokenize: 'forward',
      encoder: Charset.CJK
    })
  }

  public static getInstance(): FullTextStore {
    if (!FullTextStore.instance) {
      FullTextStore.instance = new FullTextStore()
    }
    return FullTextStore.instance
  }

  public async initialize() {
    if (this.initialized) return
    if (this.mountTask) return this.mountTask

    if (!fs.existsSync(FULL_TEXT_DB_PATH)) {
      fs.mkdirSync(FULL_TEXT_DB_PATH, { recursive: true })
    }

    const dbName = path.join(FULL_TEXT_DB_PATH, 'flexsearch')
    this.db = new Sqlite(dbName)

    this.mountTask = this.index
      .mount(this.db)
      .then(() => {
        this.initialized = true
      })
      .catch((error) => {
        this.db = null
        this.mountTask = null
        throw error
      })

    return this.mountTask
  }

  public async addChunks(
    chunks: {
      text: string
      id: string
      filename?: string
    }[]
  ) {
    await this.initialize()
    for (const chunk of chunks) {
      this.index.add(chunk)
    }
    await this.index.commit()
  }

  public async search(query: string, limit = 50) {
    await this.initialize()
    const results = await this.index.search(query, {
      limit,
      enrich: true
    })

    return results
  }

  public async flush() {
    await this.initialize()
    await this.index.commit()
  }

  public async close() {
    if (!this.initialized) return
    await this.index.commit()
    const db = this.db
    await db?.close()
    this.db = null
    this.mountTask = null
    this.initialized = false
  }
}
