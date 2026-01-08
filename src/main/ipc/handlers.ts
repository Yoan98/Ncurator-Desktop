import { ipcMain } from 'electron'
import { IngestionService } from '../services/ingestion/FileLoader'
import { EmbeddingService } from '../services/vector/EmbeddingService'
import { UnifiedStore } from '../services/storage/UnifiedStore'
import { v4 as uuidv4 } from 'uuid'
import type { SearchResult, DocumentListResponse } from '../types/store'
import path from 'path'
import fs from 'fs'
import { DOCUMENTS_PATH } from '../utils/paths'
import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict'

const jieba = Jieba.withDict(dict)

export function registerHandlers(services: {
  ingestionService: IngestionService
  embeddingService: EmbeddingService
  unifiedStore: UnifiedStore
}) {
  const { ingestionService, embeddingService, unifiedStore } = services

  ipcMain.handle('ingest-file', async (_event, filePath: string, filename: string) => {
    try {
      console.log('📄 [INGEST-FILE] FILENAME:', filename)

      const documentId = uuidv4()
      const docsDir = DOCUMENTS_PATH
      // Ensure directory exists
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true })
      }

      // Generate saved file path (using ID to avoid collisions, or keeping filename)
      // Strategy: documentId_filename to ensure uniqueness while keeping readability
      const savedFileName = `${filename}_${documentId}`
      const savedFilePath = path.join(docsDir, savedFileName)

      console.log('💾 [INGEST-FILE] COPYING FILE TO:', savedFilePath)
      fs.copyFileSync(filePath, savedFilePath)

      console.log('📝 [INGEST-FILE] ADDING DOCUMENT RECORD')
      await unifiedStore.addDocument({
        id: documentId,
        name: filename,
        sourceType: 'file',
        filePath: savedFilePath,
        createdAt: Date.now()
      })

      console.log('🔧 [INGEST-FILE] STEP 1: SPLIT DOCS')
      // 1. Load and Split
      const splitDocs = await ingestionService.processFile(filePath)

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
        documentId: documentId,
        documentName: filename,
        sourceType: 'file',
        metadata: {
          page: allSplitDocs[i].metadata.loc?.pageNumber || 1
        }
      }))

      await unifiedStore.addChunks({
        vectors: allChunkVectors,
        chunks
      })
      console.log('✅ [INGEST-FILE] STORED DOCS IN UNIFIED LANCEDB')

      return { success: true, count: chunks.length }
    } catch (error: any) {
      console.error('❌ [INGEST-FILE] ERROR:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('search', async (_event, query: string) => {
    try {
      const { data: queryVector } = await embeddingService.embed(query)

      const results = await unifiedStore.search(queryVector, query, 5)

      const tokens = jieba.cutForSearch(query, true)

      const finalResults = results.map((item) => {
        // Only keep serializable data
        const newItem = { ...item }
        delete newItem.vector
        return newItem
      })

      return {
        results: finalResults,
        tokens
      }
    } catch (error: any) {
      console.error('❌ [SEARCH] ERROR:', error)
      throw error
    }
  })

  ipcMain.handle('fts-search', async (_event, query: string): Promise<SearchResult[]> => {
    try {
      const results = await unifiedStore.ftsSearch(query, 20)
      const normalized = results.map((item) => {
        const newItem = { ...item }
        delete (newItem as any).vector
        return newItem as unknown as SearchResult
      })
      // console.log('🔎 [FTS-SEARCH] RESULTS:', normalized)
      return normalized
    } catch (error: any) {
      console.error('❌ [FTS-SEARCH] ERROR:', error)
      return []
    }
  })

  ipcMain.handle('vector-search', async (_event, query: string): Promise<SearchResult[]> => {
    try {
      const { data: queryVector } = await embeddingService.embed(query)
      const results = await unifiedStore.vectorSearch(queryVector, 20)
      const normalized = results.map((item) => {
        const newItem = { ...item }
        delete (newItem as any).vector
        return newItem as unknown as SearchResult
      })
      console.log('🔎 [VECTOR-SEARCH] RESULTS:', normalized)
      return normalized
    } catch (error: any) {
      console.error('❌ [VECTOR-SEARCH] ERROR:', error)
      return []
    }
  })

  ipcMain.handle('hybrid-search', async (_event, query: string): Promise<SearchResult[]> => {
    try {
      const { data: queryVector } = await embeddingService.embed(query)
      const results = await unifiedStore.hybridSearch(queryVector, query, 20)
      const normalized = results.map((item) => {
        const newItem = { ...item }
        delete (newItem as any).vector
        return newItem as unknown as SearchResult
      })
      console.log('🔎 [HYBRID-SEARCH] RESULTS:', normalized)
      return normalized
    } catch (error: any) {
      console.error('❌ [HYBRID-SEARCH] ERROR:', error)
      return []
    }
  })

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
}
