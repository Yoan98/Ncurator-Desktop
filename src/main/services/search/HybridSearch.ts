import { UnifiedStore } from '../storage/UnifiedStore'
import { EmbeddingService } from '../vector/EmbeddingService'

interface SearchResult {
  id: string
  score: number
  content: string
  metadata?: any
}

export class HybridSearch {
  private static instance: HybridSearch
  private unifiedStore: UnifiedStore
  private embeddingService: EmbeddingService

  private constructor() {
    this.unifiedStore = UnifiedStore.getInstance()
    this.embeddingService = EmbeddingService.getInstance()
  }

  public static getInstance(): HybridSearch {
    if (!HybridSearch.instance) {
      HybridSearch.instance = new HybridSearch()
    }
    return HybridSearch.instance
  }

  public async search(query: string, limit = 20): Promise<SearchResult[]> {
    // 1. Generate embedding
    const { data: queryVector } = await this.embeddingService.embed(query)

    // 2. Parallel search
    const [vectorResults, keywordResults] = await Promise.all([
      this.unifiedStore.search(queryVector, 50),
      this.unifiedStore.ftsSearch(query, 50)
    ])

    // 3. RRF Fusion
    const fusedResults = this.rrf(vectorResults, keywordResults)

    // 4. Return top N
    return fusedResults.slice(0, limit)
  }

  private rrf(vectorResults: any[], keywordResults: any[], k = 60): SearchResult[] {
    const scores = new Map<string, number>()
    const docMap = new Map<string, any>()

    // Process Vector Results
    vectorResults.forEach((res, rank) => {
      // LanceDB returns { id, vector, ...rest }
      // Ensure we have ID
      const id = res.id
      docMap.set(id, res)
      const score = 1 / (k + rank + 1)
      scores.set(id, (scores.get(id) || 0) + score)
    })

    // Process Keyword Results
    keywordResults.forEach((res, rank) => {
      const id = res.id
      if (!docMap.has(id)) {
        docMap.set(id, res)
      }
      const score = 1 / (k + rank + 1)
      scores.set(id, (scores.get(id) || 0) + score)
    })

    // Sort by score
    const sortedIds = Array.from(scores.keys()).sort((a, b) => {
      return (scores.get(b) || 0) - (scores.get(a) || 0)
    })

    return sortedIds.map((id) => {
      const doc = docMap.get(id)
      return {
        id: doc.id,
        score: scores.get(id) || 0,
        content: doc.content || doc.text, // Handle different field names
        metadata: doc
      }
    })
  }
}
