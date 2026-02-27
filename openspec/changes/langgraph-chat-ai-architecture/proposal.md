## Why

The current chat experience is a single-step “search + prompt + stream” flow in the renderer, which cannot transparently execute multi-step plans (retrieve, write, update documents) and exposes model credentials to the UI layer. The existing writing workflow is a separate fixed pipeline and does not integrate with chat-driven tasks or a unified execution trace.

## What Changes

- Introduce a new LangGraph-based AI runtime for chat mode with four nodes: host, retrieval, writer, and answer.
- Add a structured execution event stream so the UI can render plan, tasks, and tool steps, plus a final streamed answer.
- Move all LLM calls to the main process and standardize on `@langchain/openai` for model invocation.
- Replace the existing writing workflow with the new AI runtime for all writing-related operations.
- Restrict `@` mentions to writing workspace documents only (no knowledge-base document mentions via `@`).
- Provide local retrieval tools (hybrid / vector / FTS / document list) and writing tools (create/update/search&replace) as LangGraph ToolNodes.
- Implement chat history loading V1 to avoid prompt bloat:
  - Load recent turns (bounded) for continuity
  - Maintain a compact per-session summary (bounded) for long-term context
- **BREAKING**: Remove or deprecate the existing writing workflow run pipeline and its related persistence/events.
- Rebuild the chat page UI to match the new execution model:
  - Left: chat + plan/task/tool-step trace (collapsible)
  - Right: retrieval results list or writing workspace panel (document list + editor)

## Capabilities

### New Capabilities

- `ai-runner`: LangGraph chat runtime orchestration (host/retrieval/writer/answer), failure routing, and cancellation.
- `ai-run-event-stream`: A stable event protocol for plan/tasks/tool calls and streamed answer tokens.
- `ai-tooling-retrieval`: Retrieval ToolNodes for local knowledge base search (hybrid/vector/FTS), document table search, and writing document search.
- `ai-tooling-writing`: Writing ToolNodes for creating/updating writing documents and safe search&replace edits with uniqueness guarantees.
- `chat-history-memory-v1`: Bounded recent-turn loading plus compact per-session summary generation and updates.
- `chat-execution-ui`: Chat UI that visualizes plan execution and renders retrieval/writing side panels.

### Modified Capabilities

- `writing-workflow`: Replace the existing writing workflow pipeline with the new LangGraph chat runtime (**BREAKING**).

## Impact

- Main process:
  - New LangGraph runtime for chat mode, ToolNodes, and streaming event emission over IPC.
  - Standardize LLM calls via `@langchain/openai` using the existing `llm_config` storage.
  - Update writing workspace operations to route through the new writer tools when initiated from chat.
- Database:
  - Keep `writing_document` and `writing_folder` as the writing workspace persistence layer.
  - Deprecate/remove `writing_workflow_run` data and related usage.
  - Add minimal storage for chat history memory V1 (e.g., session summary fields or a small companion table).
- Renderer:
  - Remove the current chat page implementation and rebuild interactions to follow the new event stream.
  - Stop using the browser-side OpenAI SDK for chat; consume the main-process stream/events instead.
- IPC/API surface:
  - New `ai-run-start`/`ai-run-cancel` handlers and `ai-run-event` channel.
  - Adjust `@` mention endpoints to only query writing workspace documents.
