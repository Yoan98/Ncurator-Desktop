import type { SearchResult } from '../../../../types/store'
import type { RetrievedChunk, WritingState, WritingWorkflowContext } from '../types'

export const retrieveContextNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('retrieve_context')
  ctx.checkCancelled()
  const plan = state.retrievalPlan
  const queries = Array.isArray(plan?.queries) ? plan!.queries.filter(Boolean) : []
  const selectedDocumentIds = Array.isArray(state.selectedDocumentIds)
    ? state.selectedDocumentIds
    : []

  const all: SearchResult[] = []
  for (const q of queries.slice(0, 12)) {
    ctx.checkCancelled()
    const { data: vec } = await ctx.embeddingService.embed(q)
    const rows = await ctx.documentsStore.search(vec, q, 8, undefined, selectedDocumentIds)
    all.push(...rows)
  }

  const seen = new Set<string>()
  const deduped = all.filter((r) => {
    const id = String((r as any).id || '')
    if (!id) return false
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  const top = deduped.slice(0, 30)
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
