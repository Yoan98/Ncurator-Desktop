## Why

The architecture direction has shifted from writing-workspace automation to a general AI-hosted local execution model:

- We need a host that loops on local KB retrieval before deciding response or execution.
- We need a dedicated terminal execution capability for practical local tasks.
- Terminal execution must be sandboxed and tied to an explicit user-selected workspace.
- File-operation nodes should be extensible (`docx` first, later `excel`), but `docx` implementation itself is deferred.
- `docx` must be designed for Node.js ecosystem execution (no Python/system dependency requirement for end users).
- Legacy writing-workflow interactions and persistence remain in the current architecture and must be removed from active flow.

## What Changes

- Refactor runtime orchestration to host-centric flow with named capabilities:
  - `host`
  - `local_kb_retrieval` (renamed retrieval node)
  - `terminal_exec`
  - `docx` (placeholder capability in this change)
  - `excel` (future extension placeholder)
- Keep retrieval-first behavior:
  - host emits retrieval intent
  - `local_kb_retrieval` returns evidence
  - host loops until context is sufficient
- Allow host to choose:
  - direct streamed response
  - or execution plan over capability nodes
- Add `terminal_exec` capability that accepts raw command strings and performs internal step loops.
- Add mandatory workspace binding for execution runs (user must choose workspace before file/terminal actions).
- Introduce sandbox policy + approval gate for terminal and file actions.
- Keep file artifact events and local open actions.
- Add dual-layer execution UX in chat:
  - inline AI activity feed in assistant side ("what AI did")
  - dedicated plan UI with task progress and expandable step details
- Remove writing-workflow interactions and writing-domain persistence from active runtime architecture.
- Keep `docx` as interface-first placeholder in this change; real editing implementation comes later.

## Capabilities

### New Capabilities

- `ai-tooling-terminal-exec`: raw command execution capability with internal loop and policy guards.
- `ai-workspace-sandbox`: workspace selection, sandbox boundaries, risk policy, and approval flow.
- `ai-node-capability-registry`: extensible capability dispatch for `docx`/`excel` and future nodes.
- `ai-tooling-docx`: Node.js-based docx capability contract placeholder (implementation deferred).

### Modified Capabilities

- `ai-runner`: move to host + `local_kb_retrieval` loop + optional plan execution with capability nodes.
- `ai-tooling-retrieval`: clarify local knowledge-base retrieval role and imported-document scoping.
- `chat-execution-ui`: add workspace selection gate and terminal execution trace visibility.
- `ai-run-event-stream`: add terminal step, approval-related, and UI-friendly activity event requirements.

### Removed Capabilities

- `writing-workflow`: remove legacy writing workflow from active product flow.
- `ai-tooling-writing`: remove writing-workspace runtime tooling from active chat architecture.

## Impact

- Main process:
  - Add `terminal_exec` capability runtime with raw command loop and sandbox checks.
  - Add workspace + approval policy enforcement.
  - Keep `docx` capability registration contract without implementing concrete operations yet.
  - Remove writing-workflow execution paths from active flow.
- Database/storage:
  - Add/maintain workspace metadata needed for run binding and policy checks.
  - Keep KB document/chunk storage as retrieval source of truth.
  - Remove writing-domain persistence from active architecture.
- Renderer:
  - Require workspace selection before executable runs.
  - Display terminal capability trace, approval prompts, and artifact actions.
  - Keep imported-document `@` targeting for retrieval/action scope.
- IPC/API surface:
  - Extend run-start payload with workspace context.
  - Add approval and terminal step event handling contract.
  - Remove writing-workflow endpoints from supported client flow.

## Breaking Changes

- `AiTaskKind` is capability-based (`local_kb_retrieval`, `terminal_exec`, `docx`, future kinds), no `writer`.
- Executable runs require explicit workspace binding.
- Writing-workflow IPC and writing-domain runtime paths are removed from supported architecture.
