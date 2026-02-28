import { LanceDbCore } from './core/LanceDbCore'
import { ChatStore } from './domains/ChatStore'
import { DocumentsStore } from './domains/DocumentsStore'
import { LlmConfigStore } from './domains/LlmConfigStore'

export class StorageService {
  private static instance: StorageService

  public readonly core: LanceDbCore
  public readonly documents: DocumentsStore
  public readonly chat: ChatStore
  public readonly llm: LlmConfigStore

  private constructor() {
    this.core = new LanceDbCore()
    this.documents = new DocumentsStore(this.core)
    this.chat = new ChatStore(this.core)
    this.llm = new LlmConfigStore(this.core)
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService()
    }
    return StorageService.instance
  }

  public async initialize(): Promise<void> {
    await this.core.initialize()
  }

  public async close(): Promise<void> {
    await this.core.close()
  }
}
