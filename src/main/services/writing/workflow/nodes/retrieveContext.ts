import type { SearchResult } from '../../../../types/store'
import type { RetrievedChunk, WritingState, WritingWorkflowContext } from '../types'

export const retrieveContextNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('retrieve_context')
  ctx.checkCancelled()
  const plan = state.retrievalPlan
  const selectedDocumentIds = Array.isArray(state.selectedDocumentIds)
    ? state.selectedDocumentIds
    : []

  const all: SearchResult[] = []

  // 1. Global Queries (Hybrid Search)
  const globalQueries = Array.isArray(plan?.queries) ? plan!.queries.filter(Boolean) : []
  for (const q of globalQueries.slice(0, 5)) {
    ctx.checkCancelled()
    try {
      const { data: vec } = await ctx.embeddingService.embed(q)
      const rows = await ctx.documentsStore.search(vec, q, 6, undefined, selectedDocumentIds)
      all.push(...rows)
    } catch (e) {
      console.error(`[Retrieve] Error searching global query "${q}":`, e)
    }
  }

  // 2. Section Queries (Hybrid Search)
  const sectionQueriesMap = plan?.perSectionQueries || {}
  const sectionQueries = Object.values(sectionQueriesMap)
    .map((qs: any) => (Array.isArray(qs) ? qs[0] : null))
    .filter(Boolean) as string[]

  for (const q of sectionQueries) {
    ctx.checkCancelled()
    try {
      const { data: vec } = await ctx.embeddingService.embed(q)
      const rows = await ctx.documentsStore.search(vec, q, 4, undefined, selectedDocumentIds)
      all.push(...rows)
    } catch (e) {
      console.error(`[Retrieve] Error searching section query "${q}":`, e)
    }
  }

  // 3. Keywords (FTS Search)
  const keywords = Array.isArray(plan?.keywords) ? plan!.keywords.filter(Boolean) : []
  for (const k of keywords.slice(0, 8)) {
    ctx.checkCancelled()
    try {
      const rows = await ctx.documentsStore.ftsSearch(k, 4, undefined, selectedDocumentIds)
      all.push(...rows)
    } catch (e) {
      console.error(`[Retrieve] Error searching keyword "${k}":`, e)
    }
  }

  const seen = new Set<string>()
  const deduped = all.filter((r) => {
    const id = String((r as any).id || '')
    if (!id) return false
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  const top = deduped.slice(0, 50)
  const retrieved: RetrievedChunk[] = top.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    documentName: r.document_name,
    text: r.text,
    metadata: r.metadata,
    score: r._relevance_score || r._score || undefined
  }))

  await ctx.writeRun({
    retrieved: JSON.stringify(retrieved),
    updated_at: Date.now()
  })
  ctx.stageOutput('retrieve_context', { items: retrieved })
  ctx.stageCompleted('retrieve_context')
  return { retrieved }
}
