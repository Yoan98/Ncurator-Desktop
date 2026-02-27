import type { ChatMessage, ChatSession, ChatSessionMemory } from '../../../types/store'
import { LanceDbCore, LANCE_TABLES } from '../core/LanceDbCore'

export class ChatStore {
  public constructor(private readonly core: LanceDbCore) {}

  public async saveSessionMemory(sessionId: string, memory: ChatSessionMemory): Promise<void> {
    const safeId = this.core.escapeSqlString(sessionId)
    const table = await this.core.openTable(LANCE_TABLES.CHAT_SESSION_MEMORY)
    await table.delete(`session_id = '${safeId}'`)
    await table.add([
      {
        session_id: sessionId,
        memory_json: JSON.stringify(memory),
        updated_at: Date.now()
      }
    ])
  }

  public async getSessionMemory(sessionId: string): Promise<ChatSessionMemory | null> {
    const safeId = this.core.escapeSqlString(sessionId)
    const table = await this.core.openTable(LANCE_TABLES.CHAT_SESSION_MEMORY)
    const rows = await table.query().where(`session_id = '${safeId}'`).toArray()
    const row = rows?.[0]
    if (!row?.memory_json) return null
    try {
      return JSON.parse(String(row.memory_json)) as ChatSessionMemory
    } catch (e) {
      void e
      return null
    }
  }

  public async saveChatSession(session: ChatSession): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.CHAT_SESSION)
    await table.delete(`id = '${this.core.escapeSqlString(session.id)}'`)
    await table.add([{ ...session }])
  }

  public async getChatSessions(): Promise<ChatSession[]> {
    const table = await this.core.openTable(LANCE_TABLES.CHAT_SESSION)
    const results = await table.query().toArray()
    return results
      .map((r: any) => ({
        id: r.id as string,
        title: r.title as string,
        created_at: Number(r.created_at)
      }))
      .sort((a, b) => b.created_at - a.created_at)
  }

  public async deleteChatSession(id: string): Promise<void> {
    const safeId = this.core.escapeSqlString(id)
    const sessionTable = await this.core.openTable(LANCE_TABLES.CHAT_SESSION)
    await sessionTable.delete(`id = '${safeId}'`)

    const msgTable = await this.core.openTable(LANCE_TABLES.CHAT_MESSAGE)
    await msgTable.delete(`session_id = '${safeId}'`)

    const memoryTable = await this.core.openTable(LANCE_TABLES.CHAT_SESSION_MEMORY)
    await memoryTable.delete(`session_id = '${safeId}'`)
  }

  public async saveChatMessage(message: ChatMessage): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.CHAT_MESSAGE)
    await table.delete(`id = '${this.core.escapeSqlString(message.id)}'`)
    await table.add([{ ...message }])
  }

  public async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    const table = await this.core.openTable(LANCE_TABLES.CHAT_MESSAGE)
    const results = await table
      .query()
      .where(`session_id = '${this.core.escapeSqlString(sessionId)}'`)
      .toArray()
    return results
      .map((r: any) => ({
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

  public async getRecentChatMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const n = Math.max(1, Math.min(50, Number(limit || 0)))
    const all = await this.getChatMessages(sessionId)
    if (all.length <= n) return all
    return all.slice(all.length - n)
  }
}
