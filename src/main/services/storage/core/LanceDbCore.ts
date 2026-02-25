import * as lancedb from '@lancedb/lancedb'
import fs from 'fs'
import * as arrow from 'apache-arrow'
import { LANCE_DB_PATH } from '../../../utils/paths'
import type { TableConfig } from '../../../types/store'

export enum LanceDbCoreStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error'
}

export const LANCE_TABLES = {
  CHUNK: 'chunk',
  DOCUMENT: 'document',
  CHAT_SESSION: 'chat_session',
  CHAT_MESSAGE: 'chat_message',
  LLM_CONFIG: 'llm_config',
  WRITING_FOLDER: 'writing_folder',
  WRITING_DOCUMENT: 'writing_document',
  WRITING_WORKFLOW_RUN: 'writing_workflow_run'
} as const

export type LanceTableName = (typeof LANCE_TABLES)[keyof typeof LANCE_TABLES]

export class LanceDbCore {
  private db: lancedb.Connection | null = null
  private status: LanceDbCoreStatus = LanceDbCoreStatus.UNINITIALIZED

  public getStatus(): LanceDbCoreStatus {
    return this.status
  }

  public isReady(): boolean {
    return this.status === LanceDbCoreStatus.READY
  }

  public async initialize(): Promise<void> {
    if (this.status === LanceDbCoreStatus.READY) return
    if (this.status === LanceDbCoreStatus.INITIALIZING) return

    this.status = LanceDbCoreStatus.INITIALIZING
    try {
      if (!fs.existsSync(LANCE_DB_PATH)) {
        fs.mkdirSync(LANCE_DB_PATH, { recursive: true })
      }

      this.db = await lancedb.connect(LANCE_DB_PATH)
      await this.ensureTables()
      this.status = LanceDbCoreStatus.READY
    } catch (error) {
      this.status = LanceDbCoreStatus.ERROR
      throw error
    }
  }

  public async close(): Promise<void> {
    this.db = null
    this.status = LanceDbCoreStatus.UNINITIALIZED
  }

  public getConnection(): lancedb.Connection {
    this.assertReady()
    return this.db!
  }

  public async tableExists(name: string): Promise<boolean> {
    this.assertReady()
    const names = await this.db!.tableNames()
    return names.includes(name)
  }

  public async openTable(name: LanceTableName | string): Promise<any> {
    this.assertReady()
    const names = await this.db!.tableNames()
    if (!names.includes(String(name))) {
      throw new Error(`Table not found: ${String(name)}`)
    }
    return this.db!.openTable(String(name))
  }

  public escapeSqlString(value: string): string {
    return String(value || '').replace(/'/g, "''")
  }

  public buildInClause(column: string, values?: string[]): string | undefined {
    const list = (values || []).map((v) => String(v || '').trim()).filter(Boolean)
    if (list.length === 0) return undefined
    return `${column} IN (${list.map((v) => `'${this.escapeSqlString(v)}'`).join(',')})`
  }

  public combineWhere(parts: Array<string | undefined>): string | undefined {
    const clauses = parts.map((p) => (p || '').trim()).filter(Boolean)
    if (clauses.length === 0) return undefined
    if (clauses.length === 1) return clauses[0]
    return clauses.map((c) => `(${c})`).join(' AND ')
  }

  public buildWhereFromKeyword(keyword?: string, fields?: string[]): string | undefined {
    const trimmed = String(keyword || '').trim()
    if (!trimmed) return undefined
    const isSql =
      /(\bAND\b|\bOR\b|\bNOT\b|=|>=|<=|>|<|\bLIKE\b|\bNOT LIKE\b|\bIN\b|\bIS NULL\b|\bIS NOT NULL\b|regexp_match\s*\()/i.test(
        trimmed
      )
    if (isSql) return trimmed

    const kw = this.escapeSqlString(trimmed)
    const targets = (fields || []).filter(Boolean)
    if (targets.length === 0) return undefined
    return targets.map((f) => `${f} LIKE '%${kw}%'`).join(' OR ')
  }

  private assertReady(): void {
    if (this.status !== LanceDbCoreStatus.READY || !this.db) {
      throw new Error(`LanceDbCore not ready: ${this.status}`)
    }
  }

  private async ensureTables(): Promise<void> {
    if (!this.db) throw new Error('Database connection not established')
    const tableConfigs = this.getTableConfigs()
    for (const config of tableConfigs) {
      await this.ensureTable(config)
    }
  }

  private async ensureTable(config: TableConfig): Promise<void> {
    if (!this.db) throw new Error('Database connection not established')

    const tableNames = await this.db.tableNames()
    if (!tableNames.includes(config.name)) {
      const table = await this.db.createEmptyTable(config.name, config.schema)

      if (config.vectorIndexConfig) {
        await table.createIndex(config.vectorIndexConfig.column, config.vectorIndexConfig.options)
      }

      if (config.ftsIndexConfig) {
        await table.createIndex(config.ftsIndexConfig.column, config.ftsIndexConfig.options)
      }
    }
  }

  private getTableConfigs(): TableConfig[] {
    return [
      {
        name: LANCE_TABLES.CHUNK,
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
        name: LANCE_TABLES.DOCUMENT,
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
        name: LANCE_TABLES.CHAT_SESSION,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('title', new arrow.Utf8()),
          new arrow.Field('created_at', new arrow.Int64())
        ])
      },
      {
        name: LANCE_TABLES.CHAT_MESSAGE,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('session_id', new arrow.Utf8()),
          new arrow.Field('role', new arrow.Utf8()),
          new arrow.Field('content', new arrow.Utf8()),
          new arrow.Field('timestamp', new arrow.Int64()),
          new arrow.Field('sources', new arrow.Utf8(), true),
          new arrow.Field('error', new arrow.Bool(), true)
        ])
      },
      {
        name: LANCE_TABLES.LLM_CONFIG,
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
        name: LANCE_TABLES.WRITING_FOLDER,
        schema: new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8()),
          new arrow.Field('name', new arrow.Utf8()),
          new arrow.Field('parent_id', new arrow.Utf8(), true),
          new arrow.Field('created_at', new arrow.Int64()),
          new arrow.Field('updated_at', new arrow.Int64())
        ])
      },
      {
        name: LANCE_TABLES.WRITING_DOCUMENT,
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
        name: LANCE_TABLES.WRITING_WORKFLOW_RUN,
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
}

