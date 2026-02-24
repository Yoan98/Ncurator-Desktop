import { ipcMain, shell } from 'electron'
import { IngestionService } from '../services/ingestion/loader'
import { EmbeddingService } from '../services/vector/EmbeddingService'
import { UnifiedStore } from '../services/storage/UnifiedStore'
import { ModelService } from '../services/model/ModelService'
import { WritingWorkflowService } from '../services/writing/WritingWorkflowService'
import { v4 as uuidv4 } from 'uuid'
import type {
  SearchResult,
  DocumentRecord,
  DocumentListResponse,
  ChunkListResponse,
  ChatSession,
  ChatMessage,
  LLMConfig,
  WritingFolderRecord,
  WritingDocumentRecord,
  WritingWorkflowRunRecord
} from '../types/store'
import path from 'path'
import fs from 'fs'
import { DOCUMENTS_PATH } from '../utils/paths'
import { WEB_INGEST_CONCURRENCY } from '../utils/constant'
import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict'
import { normalizeForIpc } from '../utils/serialization'

const jieba = Jieba.withDict(dict)

export function registerHandlers(services: {
  ingestionService: IngestionService
  embeddingService: EmbeddingService
  unifiedStore: UnifiedStore
  modelService: ModelService
}) {
  const { ingestionService, embeddingService, unifiedStore, modelService } = services
  const activeWritingRuns = new Map<string, { cancelled: boolean; senderId: number }>()

  ipcMain.handle('ingest-file', async (event, filePath: string, filename: string) => {
    let documentId: string = ''
    try {
      console.log('📄 [INGEST-FILE] FILENAME:', filename)

      documentId = uuidv4()
      const docsDir = DOCUMENTS_PATH
      // Ensure directory exists
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true })
      }

      // Generate saved file path (using ID to avoid collisions, or keeping filename)
      // Strategy: documentId_filename to ensure uniqueness while keeping readability
      const savedFileName = `${filename}`
      const savedFilePath = path.join(docsDir, savedFileName)

      console.log('💾 [INGEST-FILE] COPYING FILE TO:', savedFilePath)
      fs.copyFileSync(filePath, savedFilePath)

      console.log('📝 [INGEST-FILE] ADDING DOCUMENT RECORD')
      await unifiedStore.addDocument({
        id: documentId,
        name: filename,
        source_type: 'file',
        file_path: savedFilePath,
        created_at: Date.now(),
        import_status: 1
      })

      console.log('🔧 [INGEST-FILE] STEP 1: SPLIT DOCS')
      // 1. Load and Split
      const splitDocs = await ingestionService.processFile(savedFilePath)

      console.log(
        `✅ [INGEST-FILE] STEP 1 DONE: BIG=${splitDocs.bigSplitDocs.length} MINI=${splitDocs.miniSplitDocs.length}`
      )

      console.log('🧠 [INGEST-FILE] STEP 2: EMBEDDING DOCS')
      // 2. Embed
      const allSplitDocs = [...splitDocs.bigSplitDocs, ...splitDocs.miniSplitDocs]

      // Embed in batches if needed, but for now simple loop or all at once (transformers.js might handle batching or single)
      // Transformers.js pipe usually takes string or array of strings.
      // But our embed method takes string. Let's do parallel or sequential.

      const allChunkVectors: Float32Array[] = []
      for (const doc of allSplitDocs) {
        const { data: vector } = await embeddingService.embed(doc.pageContent)
        allChunkVectors.push(vector)
      }
      console.log('🧠 [INGEST-FILE] EMBEDDING COUNT:', allChunkVectors.length)

      console.log('💾 [INGEST-FILE] STEP 3: STORING DOCS')
      // 3. Store in LanceDB (Unified)
      const chunks = allChunkVectors.map((_, i) => ({
        text: allSplitDocs[i].pageContent,
        id: uuidv4(),
        document_id: documentId,
        document_name: filename,
        source_type: 'file',
        metadata: {
          page: allSplitDocs[i].metadata.loc?.pageNumber || 1
        }
      }))

      await unifiedStore.addChunks({
        vectors: allChunkVectors,
        chunks
      })
      console.log('✅ [INGEST-FILE] STORED DOCS IN UNIFIED LANCEDB')
      await unifiedStore.updateDocumentImportStatus(documentId, 2)
      event.sender.send('document-list-refresh')

      return { success: true, count: chunks.length }
    } catch (error: any) {
      console.error('❌ [INGEST-FILE] ERROR:', error)
      if (documentId) {
        await unifiedStore.updateDocumentImportStatus(documentId, 3).catch(() => {})
        event.sender.send('document-list-refresh')
      }
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('ingest-files', async (event, files: Array<{ path: string; name: string }>) => {
    try {
      const docsDir = DOCUMENTS_PATH
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true })
      }
      const created: {
        id: string
        name: string
        savedPath: string
      }[] = []
      for (const f of files) {
        const documentId = uuidv4()
        const savedFileName = `${f.name}`
        const savedFilePath = path.join(docsDir, savedFileName)
        fs.copyFileSync(f.path, savedFilePath)
        await unifiedStore.addDocument({
          id: documentId,
          name: f.name,
          source_type: 'file',
          file_path: savedFilePath,
          created_at: Date.now(),
          import_status: 1
        })
        created.push({ id: documentId, name: f.name, savedPath: savedFilePath })
      }
      ;(async () => {
        for (const c of created) {
          try {
            console.log(`SPLIT DOCS FOR ${c.name}`)
            const splitDocs = await ingestionService.processFile(c.savedPath)
            const allSplitDocs = [...splitDocs.bigSplitDocs, ...splitDocs.miniSplitDocs]
            const allChunkVectors: Float32Array[] = []
            console.log(`EMBED DOCS FOR ${c.name}`)
            for (const doc of allSplitDocs) {
              const { data: vector } = await embeddingService.embed(doc.pageContent)
              allChunkVectors.push(vector)
            }
            const chunks = allChunkVectors.map((_, i) => ({
              text: allSplitDocs[i].pageContent,
              id: uuidv4(),
              document_id: c.id,
              document_name: c.name,
              source_type: 'file',
              metadata: {
                page: allSplitDocs[i].metadata.loc?.pageNumber || 1
              }
            }))

            console.log(`STORE DOCS FOR ${c.name}`)
            await unifiedStore.addChunks({
              vectors: allChunkVectors,
              chunks
            })
            console.log(`STORED DOCS IN UNIFIED LANCEDB FOR ${c.name}`)
            await unifiedStore.updateDocumentImportStatus(c.id, 2)
            event.sender.send('document-list-refresh')
            console.log(`✅ [INGEST-FILES] DONE FOR ${c.name}`)
          } catch (error: any) {
            console.error('❌ [INGEST-FILES] ERROR:', error)
            await unifiedStore.updateDocumentImportStatus(c.id, 3)
            event.sender.send('document-list-refresh')
          }
        }
      })()
      return { success: true, created: created.length }
    } catch (error: any) {
      console.error('❌ [INGEST-FILES] ERROR:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(
    'ingest-web',
    async (
      event,
      payload: { url: string; includeSelectors?: string[]; excludeSelectors?: string[] }
    ) => {
      let documentId: string = ''
      try {
        const url = String(payload?.url || '').trim()
        if (!url) throw new Error('URL 不能为空')
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http/https URL')

        documentId = uuidv4()
        await unifiedStore.addDocument({
          id: documentId,
          name: url,
          source_type: 'web',
          file_path: url,
          created_at: Date.now(),
          import_status: 1
        })
        event.sender.send('document-list-refresh')

        const splitDocs = await ingestionService.processWebUrl({
          url,
          includeSelectors: payload.includeSelectors,
          excludeSelectors: payload.excludeSelectors
        })
        const documentName = splitDocs.title?.trim() || url
        if (documentName !== url) {
          await unifiedStore.updateDocumentById(documentId, { name: documentName })
        }

        const allSplitDocs = [...splitDocs.bigSplitDocs, ...splitDocs.miniSplitDocs]
        const allChunkVectors: Float32Array[] = []
        for (const doc of allSplitDocs) {
          const { data: vector } = await embeddingService.embed(doc.pageContent)
          allChunkVectors.push(vector)
        }

        const chunks = allChunkVectors.map((_, i) => ({
          text: allSplitDocs[i].pageContent,
          id: uuidv4(),
          document_id: documentId,
          document_name: documentName,
          source_type: 'web',
          metadata: {
            page: 1
          }
        }))

        await unifiedStore.addChunks({
          vectors: allChunkVectors,
          chunks
        })
        await unifiedStore.updateDocumentImportStatus(documentId, 2)
        event.sender.send('document-list-refresh')
        return { success: true, count: chunks.length }
      } catch (error: any) {
        console.error('❌ [INGEST-WEB] ERROR:', error)
        if (documentId) {
          await unifiedStore.updateDocumentImportStatus(documentId, 3).catch(() => {})
          event.sender.send('document-list-refresh')
        }
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle(
    'ingest-webs',
    async (
      event,
      payload: Array<{ url: string; includeSelectors?: string[]; excludeSelectors?: string[] }>
    ) => {
      try {
        const items = Array.isArray(payload) ? payload : []
        const created: Array<{
          id: string
          url: string
          includeSelectors?: string[]
          excludeSelectors?: string[]
        }> = []

        for (const item of items) {
          const url = String(item?.url || '').trim()
          if (!url) continue
          const parsed = new URL(url)
          if (!['http:', 'https:'].includes(parsed.protocol)) continue

          const documentId = uuidv4()
          await unifiedStore.addDocument({
            id: documentId,
            name: url,
            source_type: 'web',
            file_path: url,
            created_at: Date.now(),
            import_status: 1
          })
          created.push({
            id: documentId,
            url,
            includeSelectors: item.includeSelectors,
            excludeSelectors: item.excludeSelectors
          })
        }

        event.sender.send('document-list-refresh')

        const concurrency = Math.max(1, WEB_INGEST_CONCURRENCY)
        ;(async () => {
          let index = 0
          const runOne = async () => {
            for (;;) {
              const current = created[index++]
              if (!current) return
              try {
                const splitDocs = await ingestionService.processWebUrl({
                  url: current.url,
                  includeSelectors: current.includeSelectors,
                  excludeSelectors: current.excludeSelectors
                })
                const documentName = splitDocs.title?.trim() || current.url
                if (documentName !== current.url) {
                  await unifiedStore.updateDocumentById(current.id, { name: documentName })
                }

                const allSplitDocs = [...splitDocs.bigSplitDocs, ...splitDocs.miniSplitDocs]
                const allChunkVectors: Float32Array[] = []
                for (const doc of allSplitDocs) {
                  const { data: vector } = await embeddingService.embed(doc.pageContent)
                  allChunkVectors.push(vector)
                }

                const chunks = allChunkVectors.map((_, i) => ({
                  text: allSplitDocs[i].pageContent,
                  id: uuidv4(),
                  document_id: current.id,
                  document_name: documentName,
                  source_type: 'web',
                  metadata: {
                    page: 1
                  }
                }))

                await unifiedStore.addChunks({
                  vectors: allChunkVectors,
                  chunks
                })
                await unifiedStore.updateDocumentImportStatus(current.id, 2)
                event.sender.send('document-list-refresh')
              } catch (e: any) {
                console.error('❌ [INGEST-WEBS] ERROR:', e)
                await unifiedStore.updateDocumentImportStatus(current.id, 3).catch(() => {})
                event.sender.send('document-list-refresh')
              }
            }
          }

          await Promise.all(Array.from({ length: concurrency }, () => runOne()))
        })()

        return { success: true, created: created.length }
      } catch (error: any) {
        console.error('❌ [INGEST-WEBS] ERROR:', error)
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('open-external', async (_event, url: string) => {
    try {
      const parsed = new URL(String(url))
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { success: false, error: '仅支持 http/https URL' }
      }
      await shell.openExternal(parsed.toString())
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('search', async (_event, query: string, sourceType?: 'all' | 'file' | 'web') => {
    try {
      const { data: queryVector } = await embeddingService.embed(query)
      const filter = sourceType && sourceType !== 'all' ? sourceType : undefined
      const results = await unifiedStore.search(queryVector, query, 5, filter)

      const tokens = jieba.cutForSearch(query, true)

      const finalResults = results.map(normalizeForIpc)

      return {
        results: finalResults,
        tokens
      }
    } catch (error: any) {
      console.error('❌ [SEARCH] ERROR:', error)
      throw error
    }
  })

  ipcMain.handle(
    'fts-search',
    async (_event, query: string, sourceType?: 'all' | 'file' | 'web'): Promise<SearchResult[]> => {
      try {
        const filter = sourceType && sourceType !== 'all' ? sourceType : undefined
        const results = await unifiedStore.ftsSearch(query, 20, filter)
        const normalized = results.map(normalizeForIpc)
        // console.log('🔎 [FTS-SEARCH] RESULTS:', normalized)
        return normalized
      } catch (error: any) {
        console.error('❌ [FTS-SEARCH] ERROR:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'vector-search',
    async (_event, query: string, sourceType?: 'all' | 'file' | 'web'): Promise<SearchResult[]> => {
      try {
        const { data: queryVector } = await embeddingService.embed(query)
        const filter = sourceType && sourceType !== 'all' ? sourceType : undefined
        const results = await unifiedStore.vectorSearch(queryVector, 20, filter)
        const normalized = results.map(normalizeForIpc)
        console.log('🔎 [VECTOR-SEARCH] RESULTS:', normalized)
        return normalized
      } catch (error: any) {
        console.error('❌ [VECTOR-SEARCH] ERROR:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'hybrid-search',
    async (_event, query: string, sourceType?: 'all' | 'file' | 'web'): Promise<SearchResult[]> => {
      try {
        const { data: queryVector } = await embeddingService.embed(query)
        const filter = sourceType && sourceType !== 'all' ? sourceType : undefined
        const results = await unifiedStore.hybridSearch(queryVector, query, 20, filter)
        const normalized = results.map(normalizeForIpc)
        console.log('🔎 [HYBRID-SEARCH] RESULTS:', normalized)
        return normalized
      } catch (error: any) {
        console.error('❌ [HYBRID-SEARCH] ERROR:', error)
        return []
      }
    }
  )

  ipcMain.handle(
    'list-documents',
    async (
      _event,
      payload: { keyword?: string; page: number; pageSize: number }
    ): Promise<DocumentListResponse> => {
      try {
        const { keyword, page, pageSize } = payload
        const res = await unifiedStore.listDocuments({ keyword, page, pageSize })
        return res
      } catch (error: any) {
        console.error('❌ [LIST-DOCUMENTS] ERROR:', error)
        return { items: [], total: 0 }
      }
    }
  )

  ipcMain.handle(
    'list-chunks',
    async (
      _event,
      payload: { keyword?: string; page: number; pageSize: number }
    ): Promise<ChunkListResponse> => {
      try {
        const { keyword, page, pageSize } = payload
        const res = await unifiedStore.listChunks({ keyword, page, pageSize })
        const normalized = res.items.map(normalizeForIpc)
        return { items: normalized, total: res.total }
      } catch (error: any) {
        console.error('❌ [LIST-CHUNKS] ERROR:', error)
        return { items: [], total: 0 }
      }
    }
  )

  ipcMain.handle('drop-documents-table', async () => {
    try {
      const result = await unifiedStore.dropDocumentsTable()
      console.log('🗑️ [DROP-DOCUMENTS] DONE:', result)
      return { success: true, existed: result.existed }
    } catch (error: any) {
      console.error('❌ [DROP-DOCUMENTS] ERROR:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('delete-documents', async (event, ids: string[]) => {
    try {
      console.log('🗑️ [DELETE-DOCUMENTS] REQUEST:', ids)
      const res = await unifiedStore.deleteDocumentsByIds(ids || [])
      console.log('🗑️ [DELETE-DOCUMENTS] DONE:', res)
      event.sender.send('document-list-refresh')
      return res
    } catch (error: any) {
      console.error('❌ [DELETE-DOCUMENTS] ERROR:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }
      const buffer = fs.readFileSync(filePath)
      return buffer
    } catch (error: any) {
      console.error('❌ [READ-FILE] ERROR:', error)
      throw error
    }
  })

  ipcMain.handle('download-model', async (event, repoId: string) => {
    try {
      const result = await modelService.downloadModel(repoId, event.sender)
      // After successful download, re-initialize embedding service
      await embeddingService.initialize()
      return result
    } catch (error: any) {
      console.error('❌ [DOWNLOAD-MODEL] ERROR:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-models', async () => {
    try {
      return modelService.getModels()
    } catch (error: any) {
      console.error('❌ [GET-MODELS] ERROR:', error)
      return []
    }
  })

  ipcMain.handle('get-embedding-status', () => {
    return embeddingService.getStatus()
  })

  // === Writing Workspace & Writing Workflow ===

  ipcMain.handle('writing-folder-list', async (): Promise<WritingFolderRecord[]> => {
    try {
      return await unifiedStore.listWritingFolders()
    } catch (e: any) {
      console.error('[WRITING-FOLDER-LIST] Error:', e)
      return []
    }
  })

  ipcMain.handle('writing-folder-save', async (_event, folder: WritingFolderRecord) => {
    try {
      await unifiedStore.saveWritingFolder(folder)
      return { success: true }
    } catch (e: any) {
      console.error('[WRITING-FOLDER-SAVE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('writing-folder-delete', async (_event, id: string) => {
    try {
      await unifiedStore.deleteWritingFolder(id)
      return { success: true }
    } catch (e: any) {
      console.error('[WRITING-FOLDER-DELETE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(
    'writing-document-list',
    async (_event, payload: { folderId?: string }): Promise<WritingDocumentRecord[]> => {
      try {
        return await unifiedStore.listWritingDocuments(payload?.folderId)
      } catch (e: any) {
        console.error('[WRITING-DOCUMENT-LIST] Error:', e)
        return []
      }
    }
  )

  ipcMain.handle('writing-document-get', async (_event, id: string) => {
    try {
      const doc = await unifiedStore.getWritingDocument(id)
      return { success: true, doc }
    } catch (e: any) {
      console.error('[WRITING-DOCUMENT-GET] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('writing-document-save', async (_event, doc: WritingDocumentRecord) => {
    try {
      await unifiedStore.saveWritingDocument(doc)
      return { success: true }
    } catch (e: any) {
      console.error('[WRITING-DOCUMENT-SAVE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('writing-document-delete', async (_event, id: string) => {
    try {
      await unifiedStore.deleteWritingDocument(id)
      return { success: true }
    } catch (e: any) {
      console.error('[WRITING-DOCUMENT-DELETE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(
    'writing-mention-documents',
    async (_event, payload: { keyword?: string; limit?: number }): Promise<DocumentRecord[]> => {
      try {
        const limit = Math.max(1, Math.min(50, Number(payload?.limit || 20)))
        const res = await unifiedStore.listDocuments({
          keyword: payload?.keyword,
          page: 1,
          pageSize: limit
        })
        return res.items
      } catch (e: any) {
        console.error('[WRITING-MENTION-DOCUMENTS] Error:', e)
        return []
      }
    }
  )

  ipcMain.handle(
    'writing-retrieve',
    async (
      _event,
      payload: { query: string; selectedDocumentIds?: string[] }
    ): Promise<SearchResult[]> => {
      try {
        const query = String(payload?.query || '').trim()
        if (!query) return []
        const { data: queryVector } = await embeddingService.embed(query)
        const docIds = Array.isArray(payload?.selectedDocumentIds)
          ? payload!.selectedDocumentIds!.filter(Boolean)
          : undefined
        const results = await unifiedStore.hybridSearch(queryVector, query, 20, undefined, docIds)
        return results.map(normalizeForIpc)
      } catch (e: any) {
        console.error('[WRITING-RETRIEVE] Error:', e)
        return []
      }
    }
  )

  ipcMain.handle(
    'writing-workflow-run-get',
    async (_event, id: string): Promise<WritingWorkflowRunRecord | null> => {
      try {
        return await unifiedStore.getWritingWorkflowRun(id)
      } catch (e: any) {
        console.error('[WRITING-WORKFLOW-RUN-GET] Error:', e)
        return null
      }
    }
  )

  ipcMain.handle(
    'writing-workflow-start',
    async (
      event,
      payload: { input: string; selectedDocumentIds?: string[]; writingDocumentId?: string }
    ) => {
      const runId = uuidv4()
      activeWritingRuns.set(runId, { cancelled: false, senderId: event.sender.id })
      ;(async () => {
        const sendEvent = (evt: any) => {
          if (event.sender.isDestroyed()) return
          event.sender.send('writing-workflow-event', evt)
        }
        try {
          await WritingWorkflowService.getInstance().run(
            {
              runId,
              input: String(payload?.input || ''),
              selectedDocumentIds: payload?.selectedDocumentIds,
              writingDocumentId: payload?.writingDocumentId
            },
            {
              unifiedStore,
              embeddingService,
              sendEvent,
              isCancelled: () => Boolean(activeWritingRuns.get(runId)?.cancelled)
            }
          )
        } finally {
          activeWritingRuns.delete(runId)
        }
      })()

      return { success: true, runId }
    }
  )

  ipcMain.handle('writing-workflow-cancel', async (_event, runId: string) => {
    const entry = activeWritingRuns.get(runId)
    if (!entry) return { success: false, error: 'run not found' }
    entry.cancelled = true
    return { success: true }
  })

  // === Chat & LLM Handlers ===

  ipcMain.handle('chat-session-list', async () => {
    try {
      return await unifiedStore.getChatSessions()
    } catch (e: any) {
      console.error('[CHAT-SESSION-LIST] Error:', e)
      return []
    }
  })

  ipcMain.handle('chat-session-save', async (_event, session: ChatSession) => {
    try {
      await unifiedStore.saveChatSession(session)
      return { success: true }
    } catch (e: any) {
      console.error('[CHAT-SESSION-SAVE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('chat-session-delete', async (_event, id: string) => {
    try {
      await unifiedStore.deleteChatSession(id)
      return { success: true }
    } catch (e: any) {
      console.error('[CHAT-SESSION-DELETE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('chat-message-list', async (_event, sessionId: string) => {
    try {
      return await unifiedStore.getChatMessages(sessionId)
    } catch (e: any) {
      console.error('[CHAT-MESSAGE-LIST] Error:', e)
      return []
    }
  })

  ipcMain.handle('chat-message-save', async (_event, message: ChatMessage) => {
    try {
      await unifiedStore.saveChatMessage(message)
      return { success: true }
    } catch (e: any) {
      console.error('[CHAT-MESSAGE-SAVE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('llm-config-list', async () => {
    try {
      return await unifiedStore.getLLMConfigs()
    } catch (e: any) {
      console.error('[LLM-CONFIG-LIST] Error:', e)
      return []
    }
  })

  ipcMain.handle('llm-config-save', async (_event, config: LLMConfig) => {
    try {
      await unifiedStore.saveLLMConfig(config)
      return { success: true }
    } catch (e: any) {
      console.error('[LLM-CONFIG-SAVE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('llm-config-delete', async (_event, id: string) => {
    try {
      await unifiedStore.deleteLLMConfig(id)
      return { success: true }
    } catch (e: any) {
      console.error('[LLM-CONFIG-DELETE] Error:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('llm-config-set-active', async (_event, id: string) => {
    try {
      await unifiedStore.setLLMConfigActive(id)
      return { success: true }
    } catch (e: any) {
      console.error('[LLM-CONFIG-SET-ACTIVE] Error:', e)
      return { success: false, error: e.message }
    }
  })
}
