import type {
  WritingDocumentRecord,
  WritingFolderRecord,
  WritingWorkflowRunRecord,
  WritingWorkflowRunStatus
} from '../../../types/store'
import { LanceDbCore, LANCE_TABLES } from '../core/LanceDbCore'

export class WritingStore {
  public constructor(private readonly core: LanceDbCore) {}

  public async listFolders(): Promise<WritingFolderRecord[]> {
    const table = await this.core.openTable(LANCE_TABLES.WRITING_FOLDER)
    const rows = await table.query().toArray()
    return rows
      .map((r: any) => ({
        id: r.id as string,
        name: r.name as string,
        parent_id: (r.parent_id as string | undefined) || undefined,
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at)
      }))
      .sort((a, b) => a.created_at - b.created_at)
  }

  public async saveFolder(folder: WritingFolderRecord): Promise<void> {
    const now = Date.now()
    const table = await this.core.openTable(LANCE_TABLES.WRITING_FOLDER)
    const existing = await table
      .query()
      .where(`id = '${this.core.escapeSqlString(folder.id)}'`)
      .toArray()
    const createdAt = existing.length > 0 ? Number(existing[0].created_at) : folder.created_at || now
    await table.delete(`id = '${this.core.escapeSqlString(folder.id)}'`)
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

  public async deleteFolder(id: string): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.WRITING_FOLDER)
    await table.delete(`id = '${this.core.escapeSqlString(id)}'`)
  }

  public async listDocuments(folderId?: string): Promise<WritingDocumentRecord[]> {
    const table = await this.core.openTable(LANCE_TABLES.WRITING_DOCUMENT)
    const q = table.query()
    if (folderId) {
      q.where(`folder_id = '${this.core.escapeSqlString(folderId)}'`)
    } else {
      q.where('folder_id IS NULL')
    }
    const rows = await q.toArray()
    return rows
      .map((r: any) => ({
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

  public async getDocument(id: string): Promise<WritingDocumentRecord | null> {
    const table = await this.core.openTable(LANCE_TABLES.WRITING_DOCUMENT)
    const rows = await table
      .query()
      .where(`id = '${this.core.escapeSqlString(id)}'`)
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

  public async saveDocument(document: WritingDocumentRecord): Promise<void> {
    const now = Date.now()
    const table = await this.core.openTable(LANCE_TABLES.WRITING_DOCUMENT)
    const existing = await table
      .query()
      .where(`id = '${this.core.escapeSqlString(document.id)}'`)
      .toArray()
    const createdAt = existing.length > 0 ? Number(existing[0].created_at) : document.created_at || now
    await table.delete(`id = '${this.core.escapeSqlString(document.id)}'`)
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

  public async deleteDocument(id: string): Promise<void> {
    const table = await this.core.openTable(LANCE_TABLES.WRITING_DOCUMENT)
    await table.delete(`id = '${this.core.escapeSqlString(id)}'`)
  }

  public async saveWorkflowRun(run: WritingWorkflowRunRecord): Promise<void> {
    const now = Date.now()
    const table = await this.core.openTable(LANCE_TABLES.WRITING_WORKFLOW_RUN)
    const existing = await table.query().where(`id = '${this.core.escapeSqlString(run.id)}'`).toArray()
    const createdAt = existing.length > 0 ? Number(existing[0].created_at) : run.created_at || now
    await table.delete(`id = '${this.core.escapeSqlString(run.id)}'`)
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

  public async getWorkflowRun(id: string): Promise<WritingWorkflowRunRecord | null> {
    const table = await this.core.openTable(LANCE_TABLES.WRITING_WORKFLOW_RUN)
    const rows = await table.query().where(`id = '${this.core.escapeSqlString(id)}'`).toArray()
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
}

