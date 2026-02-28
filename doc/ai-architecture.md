# NCurator-Desktop AI Architecture

## Overview

The active AI runtime in NCurator-Desktop is a capability-based LangGraph architecture.

- Entry point: `ai-run-start` IPC in Main process.
- Orchestration: Host-led graph in `src/main/services/ai/graph.ts`.
- Capability nodes: `local_kb_retrieval`, `terminal_exec`, `docx`.
- Event stream: `ai-run-event` IPC channel to Renderer.
- Execution scope: workspace-bound for executable tasks.

The legacy writing workflow is decommissioned and is not part of the active architecture.

## Process Responsibilities

### Main Process

- Owns runtime orchestration, retrieval, storage access, and model calls.
- Executes capability tasks and emits structured run events.
- Enforces workspace boundary checks and approval gates for risky terminal commands.

### Renderer Process

- Sends run request payloads (`sessionId`, `input`, optional document scope, optional workspace).
- Renders plan progress, activity feed, tool traces, and terminal traces from events.
- Does not run heavy retrieval or orchestration logic.

## Runtime Flow

1. Renderer calls `ai-run-start`.
2. Main creates run context and starts LangGraph.
3. Host plans capability tasks.
4. Runtime dispatches tasks through capability registry.
5. Capabilities emit lifecycle/tool/terminal/activity/file-artifact events.
6. Host produces final answer and run completes/cancels/fails.

## Capability Contracts

### `local_kb_retrieval`

- Uses local KB tools (hybrid/vector/fts/list).
- Supports document-id scoping from run context.
- Must be bounded by retry/loop limits.

### `terminal_exec`

- Accepts natural-language objective text (host no longer needs raw shell command bootstrap).
- Runs an internal tool loop with `terminal_run_command` and `terminal_finish`.
- Requires workspace binding (`workspaceId`, `rootPath`).
- Enforces per-command boundary checks and risk classification inside tool execution.
- Requests approval for medium/high risk commands before execution.
- Emits terminal step traces and file artifact metadata when command output creates/updates files.
- Must stop on bounded loop limits (`max steps` / `timeout`) with explicit failure result.

### `docx`

- Implemented as Node.js-first tool-driven capability (no Python/system-tool baseline requirement).
- Uses structured tools: `docx_inspect`, `docx_apply_edits`, `docx_save_output`, `docx_finish`.
- Applies workspace-bound path checks and overwrite approval gating for destructive writes.
- Emits inspect/apply/save activity traces and file artifact metadata for saved outputs.
- Must stop on bounded loop limits (`max steps` / `timeout`) with explicit failure result.

## Event Model

Core event families:

- Run lifecycle: `run_started`, `run_completed`, `run_failed`, `run_cancelled`
- Plan/task lifecycle: `plan_created`, `task_started`, `task_completed`, `task_failed`, `task_result`
- Tool traces: `tool_call_started`, `tool_call_result`
- Terminal traces: `terminal_step_started`, `terminal_step_result`, `terminal_step_error`
- UI-facing activities: `activity`
- File artifacts: `file_artifact`
- Gating events: `workspace_required`, `approval_required`, `approval_decision`
- Answer streaming: `answer_token`, `answer_completed`

## Storage Boundaries

- Active AI runtime uses document/chat/llm stores via `StorageService`.
- Business code must not bypass store layer to access LanceDB internals.
- Writing-domain storage is not used by active runtime.

## Extension Rules

When adding a new capability node:

1. Add capability kind and typed task contract.
2. Register executor in capability registry.
3. Emit standard lifecycle and trace events.
4. Keep workspace/policy enforcement consistent for executable actions.
5. Emit `file_artifact` events for capability-owned file outputs when applicable.
6. Update this document and corresponding agent/skill guidance in the same change.

## Non-Goals

- Re-introducing legacy writing-workflow runtime.
- Allowing unrestricted shell execution outside workspace boundary.
