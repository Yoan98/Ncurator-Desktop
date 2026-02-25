import { writingWorkflowPrompts, type Citation, type Outline } from '../../prompts'
import type { WritingState, WritingWorkflowContext } from '../types'

export const generateMarkdownDraftNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('generate_markdown_draft')
  ctx.checkCancelled()
  const outline: Outline = state.outline!
  const citations: Citation[] = Array.isArray(state.citations) ? state.citations : []
  const prompt = writingWorkflowPrompts.generateMarkdownDraft(state.input, outline, citations)
  const markdown = await ctx.chatComplete(prompt)
  await ctx.writeRun({
    draft_markdown: markdown,
    status: 'completed',
    updated_at: Date.now()
  })
  ctx.stageOutput('generate_markdown_draft', { markdown })
  ctx.stageCompleted('generate_markdown_draft')
  return { draftMarkdown: markdown, status: 'completed' }
}
