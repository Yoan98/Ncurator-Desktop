import { writingWorkflowPrompts, type RetrievalPlan } from '../../prompts'
import type { WritingState, WritingWorkflowContext } from '../types'

export const generateRetrievalPlanNode = async (
  ctx: WritingWorkflowContext,
  state: WritingState
): Promise<Partial<WritingState>> => {
  ctx.stageStarted('generate_retrieval_plan')
  ctx.checkCancelled()
  const prompt = writingWorkflowPrompts.generateRetrievalPlan(state.input, state.outline || {})
  const text = await ctx.chatComplete(prompt)
  const plan = ctx.parseJsonObject(text) as RetrievalPlan
  await ctx.writeRun({
    retrieval_plan: JSON.stringify(plan),
    updated_at: Date.now()
  })
  ctx.stageOutput('generate_retrieval_plan', plan)
  ctx.stageCompleted('generate_retrieval_plan')
  return { retrievalPlan: plan }
}
