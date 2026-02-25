import { buildWritingWorkflowGraph } from './workflow/graph'
import { createWritingWorkflowContext } from './workflow/runtime'
import type { WorkflowDeps, WritingState, WritingWorkflowStartPayload } from './workflow/types'

export type { WritingWorkflowStartPayload } from './workflow/types'

export class WritingWorkflowService {
  private static instance: WritingWorkflowService

  private constructor() {}

  public static getInstance(): WritingWorkflowService {
    if (!WritingWorkflowService.instance) {
      WritingWorkflowService.instance = new WritingWorkflowService()
    }
    return WritingWorkflowService.instance
  }

  public async run(payload: WritingWorkflowStartPayload, deps: WorkflowDeps): Promise<void> {
    const ctx = createWritingWorkflowContext(payload, deps)
    const graph = buildWritingWorkflowGraph(ctx)

    deps.sendEvent({ type: 'run_started', runId: payload.runId, createdAt: Date.now() })
    try {
      await ctx.writeRun({
        status: 'running',
        input: payload.input,
        created_at: Date.now(),
        updated_at: Date.now(),
        error: undefined
      })
      await graph.invoke({
        runId: payload.runId,
        status: 'running',
        writingDocumentId: payload.writingDocumentId,
        input: payload.input,
        selectedDocumentIds: Array.isArray(payload.selectedDocumentIds)
          ? payload.selectedDocumentIds.filter(Boolean)
          : []
      } as WritingState)
      deps.sendEvent({ type: 'run_completed', runId: payload.runId })
    } catch (e: any) {
      if (
        e?.code === 'CANCELLED' ||
        String(e?.message || '')
          .toLowerCase()
          .includes('cancel')
      ) {
        await ctx.writeRun({
          status: 'cancelled',
          error: 'cancelled',
          updated_at: Date.now()
        })
        deps.sendEvent({ type: 'run_cancelled', runId: payload.runId })
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      await ctx.writeRun({
        status: 'failed',
        error: msg,
        updated_at: Date.now()
      })
      deps.sendEvent({ type: 'run_failed', runId: payload.runId, error: msg })
    }
  }
}
