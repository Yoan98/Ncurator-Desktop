import type { AiRunContext } from '../../types'
import type { AiRunEvent } from '../../../../../shared/types'

type CreateMockContextInput = {
  workspaceRootPath: string
  onApproval?: (request: { command: string; riskLevel: 'medium' | 'high' }) => {
    approved: boolean
    reason?: string
  }
}

export const createMockAiContext = (input: CreateMockContextInput): {
  ctx: AiRunContext
  events: AiRunEvent[]
} => {
  const events: AiRunEvent[] = []

  const ctx: AiRunContext = {
    runId: 'run-test',
    sessionId: 'session-test',
    selectedDocumentIds: undefined,
    workspace: {
      workspaceId: 'workspace-test',
      rootPath: input.workspaceRootPath,
      policyProfile: 'default'
    },
    checkCancelled: () => {},
    chatJson: async () => {
      throw new Error('chatJson should not be called in tool unit tests')
    },
    sendEvent: (event) => {
      events.push(event)
    },
    requestApproval: async (request) => {
      const decision = input.onApproval?.({
        command: request.command,
        riskLevel: request.riskLevel
      })
      return decision || { approved: true }
    },
    loadHistory: async () => ({
      recentTurnsText: '',
      sessionSummaryText: ''
    }),
    getModelConfig: async () => ({
      id: 'model-test',
      name: 'test-model',
      base_url: 'http://localhost',
      model_name: 'test',
      api_key: 'test',
      is_active: true
    }),
    documentsStore: {} as AiRunContext['documentsStore'],
    embeddingService: {} as AiRunContext['embeddingService']
  }

  return { ctx, events }
}
