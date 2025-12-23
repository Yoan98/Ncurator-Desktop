import { Document, Charset } from 'flexsearch'
import { FULL_TEXT_DB_PATH } from '../../utils/paths'
import fs from 'fs'

export class FullIndexStore {
  private static instance: FullIndexStore
  private index: any // FlexSearch types are tricky, using any for now or I need to import specific types

  private constructor() {
    this.index = new Document({
      document: {
        id: 'id',
        index: ['text', 'filename'],
        store: true
      },
      tokenize: 'forward', // good for partial matches
      encoder: Charset.CJK
    })
  }

  public static getInstance(): FullIndexStore {
    if (!FullIndexStore.instance) {
      FullIndexStore.instance = new FullIndexStore()
    }
    return FullIndexStore.instance
  }

  public async initialize() {
    if (!fs.existsSync(FULL_TEXT_DB_PATH)) {
      fs.mkdirSync(FULL_TEXT_DB_PATH, { recursive: true })
    }
    await this.loadIndex()
  }

  public async addDocuments(
    chunks: {
      text: string
      id: string
    }[]
  ) {
    for (const chunk of chunks) {
      this.index.add(chunk)
    }
    await this.saveIndex()
  }

  public async search(query: string, limit = 50) {
    const results = await this.index.search(query, {
      limit,
      enrich: true // Get stored content
    })

    return results
  }

  private async saveIndex() {
    // FlexSearch export is a bit complex for Document.
    // We need to export each key.
    // For simplicity in this demo, we might skip full persistence implementation
    // or just export keys to JSON files.
    // This is a placeholder for persistence.
    // Real implementation requires iterating keys and writing files.
    /*
    const keys = await this.index.export();
    // Write keys to disk
    */
  }

  private async loadIndex() {
    // Load from disk
  }
}
