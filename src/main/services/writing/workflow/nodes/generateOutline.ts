import { writingWorkflowPrompts, type Outline } from '../../prompts'
import type { WritingState, WritingWorkflowContext } from '../types'

export const generateOutlineNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('generate_outline')
  ctx.checkCancelled()
  const prompt = writingWorkflowPrompts.generateOutline(state.input)
  const text = await ctx.chatComplete(prompt)
  const outline = ctx.parseJsonObject(text) as Outline
  await ctx.writeRun({
    outline: JSON.stringify(outline),
    updated_at: Date.now()
  })
  ctx.stageOutput('generate_outline', outline)
  ctx.stageCompleted('generate_outline')
  return { outline }
}
