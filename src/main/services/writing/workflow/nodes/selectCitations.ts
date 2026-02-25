import type { Citation } from '../../prompts'
import type { RetrievedChunk, WritingState, WritingWorkflowContext } from '../types'

export const selectCitationsNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('select_citations')
  ctx.checkCancelled()
  const retrieved: RetrievedChunk[] = Array.isArray(state.retrieved) ? state.retrieved : []
  const max = Math.min(12, Math.max(6, retrieved.length))

  const citations: Citation[] = []
  for (let i = 0; i < Math.min(max, retrieved.length); i++) {
    const r = retrieved[i]
    const citationId = `C${i + 1}`
    citations.push({
      citationId,
      chunkId: r.chunkId,
      documentId: r.documentId,
      documentName: r.documentName,
      excerpt: r.text,
      metadata: r.metadata
    })
  }

  await ctx.writeRun({
    citations: JSON.stringify(citations),
    updated_at: Date.now()
  })
  ctx.stageOutput('select_citations', { citations })
  ctx.stageCompleted('select_citations')
  return { citations }
}
