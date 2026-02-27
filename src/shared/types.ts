export type DocumentSourceType = 'file' | 'web'
export type DocumentImportStatus = 1 | 2 | 3
export type SearchSourceFilter = 'all' | DocumentSourceType

export interface WebIngestPayload {
  url: string
  includeSelectors?: string[]
  excludeSelectors?: string[]
}

export interface DocumentRecord {
  id: string
  name: string
  source_type: DocumentSourceType
  file_path?: string
  created_at: number
  import_status: DocumentImportStatus
}

export interface SearchResult {
  id: string
  text: string
  document_name: string
  document_id?: string
  source_type?: string
  // IPC 传输时为 JSON string，后端存储时为对象
  metadata?:
    | string
    | {
        page: number
      }
  _distance?: number
  created_at?: number
  _score?: number
  _relevance_score?: number
  document?: DocumentRecord
}

export interface SearchResponse {
  results: SearchResult[]
  tokens: string[]
}

export interface ChunkListItem {
  id: string
  text: string
  document_name: string
  document_id?: string
  source_type?: string
  // IPC 传输时为 JSON string，后端存储时为对象
  metadata?:
    | string
    | {
        page: number
      }
  created_at?: number
  vector?: number[]
}

export interface ChunkListResponse {
  items: ChunkListItem[]
  total: number
}

// Deprecated: kept for backward compatibility if needed, but should be removed eventually
export interface DocumentListItem extends ChunkListItem {}

export interface DocumentListResponse {
  items: DocumentRecord[]
  total: number
}

// Chat & LLM Types

export interface LLMConfig {
  id: string
  name: string
  base_url: string
  model_name: string
  api_key: string
  is_active: boolean
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  // JSON string of SearchResult[]
  sources?: string
  error?: boolean
}

export interface ChatSession {
  id: string
  title: string
  created_at: number
}

export interface WritingFolderRecord {
  id: string
  name: string
  parent_id?: string
  created_at: number
  updated_at: number
}

export interface WritingDocumentRecord {
  id: string
  title: string
  folder_id?: string
  content: string
  markdown?: string
  created_at: number
  updated_at: number
}

export type WritingWorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface WritingWorkflowRunRecord {
  id: string
  writing_document_id?: string
  status: WritingWorkflowRunStatus
  input: string
  outline?: string
  retrieval_plan?: string
  retrieved?: string
  citations?: string
  draft_markdown?: string
  error?: string
  created_at: number
  updated_at: number
}

export type WritingWorkflowStageId =
  | 'validate_input'
  | 'generate_outline'
  | 'generate_retrieval_plan'
  | 'retrieve_context'
  | 'select_citations'
  | 'generate_markdown_draft'

export type WritingWorkflowEvent =
  | {
      type: 'run_started'
      runId: string
      createdAt: number
    }
  | {
      type: 'stage_started'
      runId: string
      stageId: WritingWorkflowStageId
    }
  | {
      type: 'stage_output'
      runId: string
      stageId: WritingWorkflowStageId
      payload: any
    }
  | {
      type: 'stage_completed'
      runId: string
      stageId: WritingWorkflowStageId
    }
  | {
      type: 'run_completed'
      runId: string
    }
  | {
      type: 'run_failed'
      runId: string
      error: string
      stageId?: WritingWorkflowStageId
    }
  | {
      type: 'run_cancelled'
      runId: string
    }

export type AiTaskKind = 'retrieval' | 'writer'
export type AiTaskStatus = 'pending' | 'running' | 'completed' | 'failed'
export type AiRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export type AiPlanTask = {
  id: string
  title: string
  kind: AiTaskKind
  status: AiTaskStatus
  attempts: number
  error?: string
}

export type AiRunStartRequest = {
  sessionId: string
  input: string
}

export type AiRunStartResponse = {
  success: boolean
  runId?: string
  error?: string
}

export type AiRunCancelResponse = {
  success: boolean
  error?: string
}

export type AiRunEvent =
  | {
      type: 'run_started'
      runId: string
      sessionId: string
      createdAt: number
      input: string
    }
  | {
      type: 'plan_created'
      runId: string
      plan: AiPlanTask[]
    }
  | {
      type: 'task_started'
      runId: string
      taskId: string
    }
  | {
      type: 'task_completed'
      runId: string
      taskId: string
    }
  | {
      type: 'task_failed'
      runId: string
      taskId: string
      error: string
    }
  | {
      type: 'tool_call_started'
      runId: string
      taskId?: string
      toolCallId: string
      toolName: string
      input: any
      createdAt: number
    }
  | {
      type: 'tool_call_result'
      runId: string
      taskId?: string
      toolCallId: string
      toolName: string
      outputPreview: any
      completedAt: number
      error?: string
    }
  | {
      type: 'answer_token'
      runId: string
      token: string
    }
  | {
      type: 'answer_completed'
      runId: string
      text: string
    }
  | {
      type: 'run_completed'
      runId: string
    }
  | {
      type: 'run_failed'
      runId: string
      error: string
    }
  | {
      type: 'run_cancelled'
      runId: string
    }

export type ChatSessionMemory = {
  summary: string
  openTasks: string[]
  userPrefs: string[]
  pinnedFacts: string[]
  linkedWritingDocumentIds: string[]
}

export type ChatSessionMemoryRow = {
  session_id: string
  memory_json: string
  updated_at: number
}
