import { ipcMain } from 'electron'
import { IngestionService } from '../services/ingestion/FileLoader'
import { EmbeddingService } from '../services/vector/EmbeddingService'
import { VectorStore } from '../services/storage/VectorStore'
import { FullTextStore } from '../services/storage/FullTextStore'
import { HybridSearch } from '../services/search/HybridSearch'
import { v4 as uuidv4 } from 'uuid'

export function registerHandlers() {
  ipcMain.handle('ingest-file', async (_event, filePath: string) => {
    try {
      console.log('Ingesting file:', filePath)

      // 1. Load and Split
      const ingestionService = IngestionService.getInstance()
      const splitDocs = await ingestionService.processFile(filePath)

      console.log(
        `Split into ${splitDocs.bigSplitDocs.length} big chunks and ${splitDocs.miniSplitDocs.length} mini chunks`
      )

      // 2. Embed
      const embeddingService = EmbeddingService.getInstance()
      const bigChunkTexts = splitDocs.bigSplitDocs.map((c) => c.pageContent)
      const miniChunkTexts = splitDocs.miniSplitDocs.map((c) => c.pageContent)
      const allChunkTexts = [...bigChunkTexts, ...miniChunkTexts]

      // Embed in batches if needed, but for now simple loop or all at once (transformers.js might handle batching or single)
      // Transformers.js pipe usually takes string or array of strings.
      // But our embed method takes string. Let's do parallel or sequential.

      const allChunkVectors: number[][] = []
      for (const text of allChunkTexts) {
        const vector = await embeddingService.embed(text)
        allChunkVectors.push(vector)
      }

      // 3. Store in LanceDB
      const vectorStore = VectorStore.getInstance()
      const chunks = allChunkVectors.map((vector, i) => ({
        text: allChunkTexts[i],
        id: uuidv4()
      }))

      await vectorStore.addDocuments({
        vectors: allChunkVectors,
        chunks
      })

      // 4. Index in FlexSearch
      const fullTextStore = FullTextStore.getInstance()
      await fullTextStore.addDocuments(chunks)

      return { success: true, count: chunks.length }
    } catch (error: any) {
      console.error('Ingestion error:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('search', async (_event, query: string) => {
    try {
      const hybridSearch = HybridSearch.getInstance()
      const results = await hybridSearch.search(query)
      return results
    } catch (error: any) {
      console.error('Search error:', error)
      return []
    }
  })
}
