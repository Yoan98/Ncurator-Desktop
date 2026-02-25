import type { WritingState, WritingWorkflowContext } from '../types'

export const validateInputNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('validate_input')
  const input = String(state.input || '').trim()
  if (!input) throw new Error('请输入写作需求')
  const selectedDocumentIds = Array.isArray(state.selectedDocumentIds)
    ? state.selectedDocumentIds.filter(Boolean)
    : []
  await ctx.writeRun({
    status: 'running',
    updated_at: Date.now()
  })
  ctx.stageOutput('validate_input', { input, selectedDocumentIds })
  ctx.stageCompleted('validate_input')
  return { input, selectedDocumentIds }
}
