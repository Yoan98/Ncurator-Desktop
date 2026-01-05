import { ipcMain } from 'electron'
import { IngestionService } from '../services/ingestion/FileLoader'
import { EmbeddingService } from '../services/vector/EmbeddingService'
import { UnifiedStore } from '../services/storage/UnifiedStore'
import { v4 as uuidv4 } from 'uuid'

export function registerHandlers(services: {
  ingestionService: IngestionService
  embeddingService: EmbeddingService
  unifiedStore: UnifiedStore
}) {
  const { ingestionService, embeddingService, unifiedStore } = services

  ipcMain.handle('ingest-file', async (_event, filePath: string, filename: string) => {
    try {
      console.log('📄 [INGEST-FILE] FILENAME:', filename)

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
        filename: filename
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

      const results = await unifiedStore.hybridSearch(queryVector, query, 5)

      const noVectorResults = results.map((item) => {
        const newItem = {
          ...item
        }
        delete newItem.vector
        return newItem
      })
      console.log('🔎 [SEARCH] RESULTS:', noVectorResults)
      return noVectorResults
    } catch (error: any) {
      console.error('❌ [SEARCH] ERROR:', error)
      return []
    }
  })
}
