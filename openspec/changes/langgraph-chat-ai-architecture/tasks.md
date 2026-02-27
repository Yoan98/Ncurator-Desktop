## 1. Main-process AI Runtime

- [ ] 1.1 Add `@langchain/openai` dependency and centralize LLM client creation
- [ ] 1.2 Define AI run state model (plan, tasks, tool steps, memory)
- [ ] 1.3 Implement LangGraph state machine (host, retrieval, writer, answer)
- [ ] 1.4 Add cancellation handling and fail-fast routing to answer

## 2. AI Event Stream & IPC

- [ ] 2.1 Define `ai-run-event` type union in shared types
- [ ] 2.2 Implement main-process event emitter with stable correlation ids
- [ ] 2.3 Add IPC handlers for `ai-run-start` and `ai-run-cancel`
- [ ] 2.4 Add renderer preload APIs and subscription helpers for `ai-run-event`

## 3. Chat History Memory V1

- [ ] 3.1 Add persistence for session memory (summary + structured fields)
- [ ] 3.2 Implement recent-turn loading with bounded limits
- [ ] 3.3 Implement summary generation and update on run completion
- [ ] 3.4 Enforce prompt budget limits for history inputs to host

## 4. Retrieval Tools

- [ ] 4.1 Implement KB chunk tools: hybrid, vector, and FTS search
- [ ] 4.2 Implement KB document listing tool with keyword filtering
- [ ] 4.3 Implement writing workspace discovery tools: list, search, get document
- [ ] 4.4 Emit tool call started/result events with safe previews

## 5. Writing Tools

- [ ] 5.1 Implement create document tool for writing workspace
- [ ] 5.2 Implement update document metadata tool
- [ ] 5.3 Implement safe search-and-replace tool with uniqueness enforcement
- [ ] 5.4 Ensure writing tools cannot modify knowledge base documents

## 6. Deprecate Legacy Writing Workflow

- [ ] 6.1 Disable legacy writing workflow start endpoint by default
- [ ] 6.2 Remove or stop persisting legacy workflow run records
- [ ] 6.3 Update writing-from-chat flows to use the new writer node tools

## 7. Chat UI Rebuild

- [ ] 7.1 Remove existing chat page and add new event-driven chat page skeleton
- [ ] 7.2 Implement left trace view for plan/tasks/tool steps with collapsible groups
- [ ] 7.3 Implement chat input with `@` mention limited to writing documents
- [ ] 7.4 Implement right panel: retrieval results list component
- [ ] 7.5 Implement right panel: writing component (document list + active editor)
- [ ] 7.6 Wire chat persistence to existing session/message storage

## 8. Validation & Hardening

- [ ] 8.1 Run typecheck and lint for main and renderer
- [ ] 8.2 Validate cancellation, retry limits, and failure routing in manual flows
- [ ] 8.3 Verify no model credentials are used in the renderer process
