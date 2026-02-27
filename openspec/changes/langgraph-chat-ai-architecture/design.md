## Context

The app currently provides:

- A chat page that performs “search → build prompt → stream completion” in the renderer process, including direct model invocation via the OpenAI SDK.
- A separate writing workflow implemented as a fixed LangGraph pipeline that emits stage events (validate/outline/retrieve/draft) and persists run state.
- Local retrieval capabilities backed by LanceDB, including vector search, FTS, and hybrid RRF reranking for chunk-level retrieval.
- A writing workspace backed by two core tables: `writing_folder` and `writing_document`, accessed via the main-process storage service.

This change introduces a unified, tool-driven AI runtime for chat mode that can:

- Plan and execute multi-step tasks across retrieval and writing operations.
- Emit a structured execution trace so the UI can visualize plans, tasks, and tool steps.
- Keep prompts bounded via chat history memory V1 (recent turns + compact session summary).

Constraints:

- Use LangGraph JS (including ToolNode) for orchestration.
- Use `@langchain/openai` for LLM calls and keep model credentials in the main process.
- All heavy compute and storage access remain in the main process; the renderer consumes IPC events and renders UI.
- `@` mentions in chat must only reference writing workspace documents (not knowledge base documents).

Stakeholders:

- End users: need transparent multi-step execution and controllable edits to writing documents.
- Product: want a single AI mode that covers knowledge-base Q&A and document writing/editing.
- Engineering: need a stable event protocol and bounded prompts for reliability and debuggability.

## Goals / Non-Goals

**Goals:**

- Provide a LangGraph-based chat runtime with four nodes: host, retrieval, writer, answer.
- Implement a stable execution event stream for:
  - Plan creation and per-task progress
  - Tool call start/result
  - Final answer token streaming
  - Run completion/failure/cancellation
- Implement chat history memory V1:
  - Load bounded recent turns per request
  - Maintain bounded per-session summary, updated periodically
- Replace the existing writing workflow pipeline with the new runtime for writing-related operations initiated from chat.
- Rebuild the chat UI to visualize plan execution and render a context-aware right panel (retrieval results or writing panel).

**Non-Goals:**

- History memory V2/V3 (history search, FTS memory, vector memory) beyond V1.
- Reworking knowledge-base ingestion, embeddings, or LanceDB index configuration (except as needed for new tools).
- A fully collaborative editor or complex multi-document merge mechanics.
- Per-user permissions, multi-tenant security, or cloud execution.

## Decisions

### 1) Orchestration model: Host-driven state machine over monolithic agent

**Decision:** Implement the runtime as a host-driven state machine in LangGraph:

- `host` produces/updates a structured plan and decides the next step.
- `retrieval` executes retrieval tasks via ToolNode, with bounded self-check loops.
- `writer` executes writing tasks via ToolNode, with bounded self-check loops.
- `answer` always runs at the end (success or failure), streaming final output tokens.

**Rationale:** This structure guarantees:

- Deterministic failure routing (any node failure short-circuits to `answer` with a failure reason).
- Explicit step visibility for UI (host plan and per-tool steps).
- Bounded retries for retrieval (≤3) and writing (≤5) without leaking complexity into a single prompt.

**Alternatives considered:**

- A single tool-calling agent handling everything: simpler initially, but weak guarantees for failure routing, difficult to bound loops, and poor step-level UI visibility.

### 2) Execution trace protocol: “AI Run Events” as the UI contract

**Decision:** Define a new IPC event channel (e.g., `ai-run-event`) with a stable union of event types.

Minimum event set:

- Run lifecycle: `run_started`, `run_completed`, `run_failed`, `run_cancelled`
- Planning: `plan_created` (structured plan)
- Task lifecycle: `task_started`, `task_completed`, `task_failed`
- Tool lifecycle: `tool_call_started`, `tool_call_result`
- Answer streaming: `answer_token`, `answer_completed`
- Optional state patching: `state_patch` (for right panel updates)

**Rationale:** The renderer becomes a pure consumer of events, enabling:

- A left “trace view” (plan → tasks → tool steps) with collapsible groups.
- A right “context panel” driven by state patches (retrieval results, writing docs, active doc preview).
- Debuggability and reproducibility of runs.

**Alternatives considered:**

- Reusing the existing writing workflow stage events: insufficient for multi-task planning, tool-level details, and chat answer streaming.

### 3) Tooling: Retrieval and writing operations are explicit ToolNodes

**Decision:** Expose each retrieval and writing capability as a dedicated ToolNode callable by the `retrieval` or `writer` agent.

Retrieval tool set (initial):

- Knowledge base:
  - `kb_hybrid_search_chunks(queryText, limit, sourceType?, documentIds?)`
  - `kb_vector_search_chunks(queryText, limit, sourceType?, documentIds?)`
  - `kb_fts_search_chunks(queryText, limit, sourceType?, documentIds?)`
  - `kb_list_documents(keyword, page, pageSize)`
- Writing workspace:
  - `writing_list_documents(folderId?)`
  - `writing_search_documents(keyword, limit)` (V1: title/markdown LIKE; later: FTS)
  - `writing_get_document(docId)`

Writing tool set (initial):

- `writing_create_document(folderId?, title, initialContent?, initialMarkdown?)`
- `writing_update_document(docId, title?, folderId?)`
- `writing_apply_search_replace(docId, before, target, after, replacement)`

The `writing_apply_search_replace` tool must enforce uniqueness:

- Locate `(before + target + after)` within the current document content.
- If match count is not exactly 1, return a structured failure (`0 matches` or `multiple matches`) for the writer agent to refine context and retry.

**Rationale:** Explicit tools reduce hallucinated side effects and make each operation auditable in the event stream.

**Alternatives considered:**

- Letting the model emit freeform “edit instructions” without strict tool enforcement: too risky for document modification and difficult to guarantee correctness.

### 4) LLM invocation: main-process only, `@langchain/openai` aligned

**Decision:** Standardize model calls in the main process using `@langchain/openai`, configured from the existing `llm_config` storage.

**Rationale:** Avoids exposing API keys to the renderer and unifies invocation patterns across nodes and tools.

**Alternatives considered:**

- Keeping renderer-side streaming: simplest UI-wise, but violates security and makes it harder to guarantee consistent tool orchestration.

### 5) Chat history memory V1: bounded recent turns + compact session summary

**Decision:** Implement V1 history loading with two inputs to the host prompt:

- `recentTurns`: bounded recent turns (e.g., 8–16 turns) loaded from chat message storage.
- `sessionSummary`: bounded compact memory per session (target 200–600 tokens).

Summary update policy (V1):

- Update after `run_completed` (and optionally after long interactions exceeding a size threshold).
- Store a structured memory object that includes:
  - `summary`
  - `openTasks`
  - `userPrefs`
  - `pinnedFacts`
  - `linkedWritingDocumentIds`

Persistence decision (V1):

- Add a small companion table (e.g., `chat_session_memory`) keyed by `session_id` to store `memory_json` and `updated_at`.

**Rationale:** This avoids expanding the existing `chat_session` schema and allows incremental rollout without a destructive migration.

**Alternatives considered:**

- Adding columns to `chat_session`: straightforward, but risks schema migration complexity and requires coordinated changes across table creation and existing installs.

### 6) “@ mention” policy: writing documents only

**Decision:** The chat input `@` mention autocomplete and parsing only reference writing workspace documents, not knowledge-base documents.

**Rationale:** This enforces the user-facing rule that “@” is for writing operations and prevents ambiguous permissions and editing intents over knowledge-base assets.

## Risks / Trade-offs

- **[Event protocol churn]** → Define event types early and treat as a stable UI contract; add versioning if needed.
- **[Schema migration complexity]** → Prefer companion tables for new persistence (e.g., session memory) and avoid mutating existing tables in V1.
- **[Tool misuse or unsafe edits]** → Enforce strict schemas and uniqueness checks for search&replace; emit tool results with safe previews and explicit failure reasons.
- **[Prompt overflow despite V1]** → Hard cap `recentTurns` and `sessionSummary` length; enforce budget in the host context builder.
- **[Inconsistent state across retries]** → Centralize run state in a single LangGraph state object; emit `state_patch` after each significant step.
- **[Performance under heavy local retrieval]** → Limit default retrieval `limit`, dedupe results, and return previews for UI while keeping full results internal.

## Migration Plan

1) Introduce the new AI runtime behind new IPC endpoints (`ai-run-start`, `ai-run-cancel`, `ai-run-event`).
2) Add session memory V1 persistence (companion table) and implement bounded history loading in the host node.
3) Implement retrieval tools and writer tools as ToolNodes; integrate into the new graph.
4) Rebuild the chat UI to consume `ai-run-event` and render plan/tasks/tool steps with the right-side panels.
5) Deprecate the existing writing workflow pipeline and its events, routing writing-from-chat through the new writer node and tools.
6) Remove renderer-side direct model streaming for chat and ensure all model calls are main-process only.

Rollback strategy:

- Keep the existing chat page and writing workflow available behind a feature flag until the new runtime is stable.
- Preserve existing chat session/message storage; new session memory table can be ignored if rollback is required.

## Open Questions

- Should the execution trace be persisted (beyond UI rendering) for debugging and user audit, and if so, where (new table vs. file-based logs)?
- Do writing document search tools require FTS indexing on `writing_document.markdown` in V1, or is LIKE-based search acceptable?
- Should the answer node always cite which tools/results were used, or should citations be an optional UI-only feature?
