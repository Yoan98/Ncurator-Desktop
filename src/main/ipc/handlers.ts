import { ipcMain } from 'electron'
import { IngestionService } from '../services/ingestion/FileLoader'
import { EmbeddingService } from '../services/vector/EmbeddingService'
import { VectorStore } from '../services/vector/VectorStore'
import { KeywordSearch } from '../services/search/KeywordSearch'
import { HybridSearch } from '../services/search/HybridSearch'
import { v4 as uuidv4 } from 'uuid'

export function registerHandlers() {
  ipcMain.handle('ingest-file', async (_event, filePath: string) => {
    try {
      console.log('Ingesting file:', filePath)

      // 1. Load and Split
      const ingestionService = IngestionService.getInstance()
      const chunks = await ingestionService.processFile(filePath)

      console.log(`Split into ${chunks.length} chunks`)

      // 2. Embed
      const embeddingService = EmbeddingService.getInstance()
      const texts = chunks.map((c) => c.pageContent)

      // Embed in batches if needed, but for now simple loop or all at once (transformers.js might handle batching or single)
      // Transformers.js pipe usually takes string or array of strings.
      // But our embed method takes string. Let's do parallel or sequential.

      const vectors: number[][] = []
      for (const text of texts) {
        const vector = await embeddingService.embed(text)
        vectors.push(vector)
      }

      // 3. Store in LanceDB
      const vectorStore = VectorStore.getInstance()
      const ids = chunks.map(() => uuidv4())
      const metadatas = chunks.map((c) => ({
        content: c.pageContent,
        ...c.metadata
      }))

      await vectorStore.addDocuments(vectors, metadatas, ids)

      // 4. Index in FlexSearch
      const keywordSearch = KeywordSearch.getInstance()
      const searchDocs = chunks.map((c, i) => ({
        id: ids[i],
        content: c.pageContent,
        ...c.metadata
      }))
      await keywordSearch.addDocuments(searchDocs)

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
