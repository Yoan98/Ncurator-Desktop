import { END, START, StateGraph, StateSchema } from '@langchain/langgraph'
import { z } from 'zod/v4'
import { generateMarkdownDraftNode } from './nodes/generateMarkdownDraft'
import { generateOutlineNode } from './nodes/generateOutline'
import { generateRetrievalPlanNode } from './nodes/generateRetrievalPlan'
import { retrieveContextNode } from './nodes/retrieveContext'
import { selectCitationsNode } from './nodes/selectCitations'
import { validateInputNode } from './nodes/validateInput'
import type { WritingState, WritingWorkflowContext } from './types'

const createWritingStateSchema = () =>
  new StateSchema({
    runId: z.string(),
    status: z.enum(['running', 'completed', 'failed', 'cancelled']).default('running'),
    writingDocumentId: z.string().optional(),
    input: z.string(),
    selectedDocumentIds: z.array(z.string()).default(() => []),
    outline: z.any().optional(),
    retrievalPlan: z.any().optional(),
    retrieved: z.any().optional(),
    citations: z.any().optional(),
    draftMarkdown: z.string().optional(),
    error: z.string().optional()
  })

export const buildWritingWorkflowGraph = (ctx: WritingWorkflowContext) => {
  const State = createWritingStateSchema()
  return new StateGraph(State)
    .addNode('validate_input', (state: WritingState) => validateInputNode(ctx, state))
    .addNode('generate_outline', (state: WritingState) => generateOutlineNode(ctx, state))
    .addNode('generate_retrieval_plan', (state: WritingState) =>
      generateRetrievalPlanNode(ctx, state)
    )
    .addNode('retrieve_context', (state: WritingState) => retrieveContextNode(ctx, state))
    .addNode('select_citations', (state: WritingState) => selectCitationsNode(ctx, state))
    .addNode('generate_markdown_draft', (state: WritingState) =>
      generateMarkdownDraftNode(ctx, state)
    )
    .addEdge(START, 'validate_input')
    .addEdge('validate_input', 'generate_outline')
    .addEdge('generate_outline', 'generate_retrieval_plan')
    .addEdge('generate_retrieval_plan', 'retrieve_context')
    .addEdge('retrieve_context', 'select_citations')
    .addEdge('select_citations', 'generate_markdown_draft')
    .addEdge('generate_markdown_draft', END)
    .compile()
}
