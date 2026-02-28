## 1. Runtime Capability Model Refactor

- [x] 1.1 Replace fixed writer-oriented task kinds with capability-based kinds (`local_kb_retrieval`, `terminal_exec`, `docx` placeholder).
- [x] 1.2 Refactor graph control to host-led retrieval loop and host final response ownership.
- [x] 1.3 Remove dedicated answer-node dependency from active runtime flow.
- [x] 1.4 Preserve cancellation and fail-fast behavior across loop and execution phases.

## 2. `local_kb_retrieval` Capability

- [x] 2.1 Rename retrieval node semantics to `local_kb_retrieval` in shared/runtime contracts.
- [x] 2.2 Keep local KB retrieval tooling (hybrid/vector/FTS/document list) with bounded outputs.
- [x] 2.3 Support imported-document id scoping from run context.
- [x] 2.4 Ensure retrieval loop stop conditions are host-controlled and bounded.

## 3. `terminal_exec` Capability (Raw Command Loop)

- [x] 3.1 Add `terminal_exec` capability contracts and runtime wiring.
- [x] 3.2 Accept raw command strings as task input and run internal capability-local command loops.
- [x] 3.3 Enforce bounded loop controls (max steps, timeout, output size).
- [x] 3.4 Emit detailed terminal step events (`started/result/error`) with safe previews.
- [x] 3.5 Emit normalized activity events for assistant-side inline feed.

## 4. Workspace Binding & Sandbox Policy

- [x] 4.1 Extend run-start payload with required workspace binding fields.
- [x] 4.2 Add runtime preflight that blocks executable tasks when workspace is missing.
- [x] 4.3 Enforce workspace-root path boundary checks for terminal/file actions.
- [x] 4.4 Add risk policy + approval gate for medium/high-risk commands/actions.
- [x] 4.5 Add approval request/decision events and renderer handling.

## 5. `docx` Capability Placeholder (Node.js-first)

- [x] 5.1 Register `docx` capability in registry with structured placeholder behavior.
- [x] 5.2 Return explicit `not_implemented` results when `docx` capability is planned/executed.
- [x] 5.3 Define Node.js-first docx implementation constraints in specs (no Python requirement).
- [x] 5.4 Ensure future `excel` capability can be added via same registry path.

## 6. Chat UI & Run Input Updates

- [x] 6.1 Keep imported-document `@` selection and include selected ids in run-start payload.
- [x] 6.2 Add workspace selection/required UX before executable runs.
- [x] 6.3 Render inline AI activity feed on assistant side ("what AI did").
- [x] 6.4 Render explicit plan UI with progress and active step indicators.
- [x] 6.5 Support expand/collapse step details (tool + terminal traces).
- [x] 6.6 Keep artifact links + system open actions with approval/error feedback.

## 7. Remove Writing Subsystem from Active Architecture

- [x] 7.1 Remove writing-workflow IPC endpoints from supported flow and eliminate chat-side dependencies.
- [x] 7.2 Remove writing-domain runtime dependencies from orchestration paths.
- [x] 7.3 Remove/deprecate `WRITING_*` table configuration from active architecture docs/specs.
- [x] 7.4 Clean obsolete writing-related shared event/type contracts.
- [x] 7.5 Define migration/cleanup behavior for existing writing-domain data.

## 8. Validation & Hardening

- [x] 8.1 Run typecheck/lint after contract and runtime refactor.
- [x] 8.2 Validate retrieval-loop and host decision flows (Q&A vs execution plan).
- [x] 8.3 Validate terminal loop controls, sandbox boundary checks, and approval gating.
- [x] 8.4 Validate workspace-required behavior and failure messaging.
- [x] 8.5 Validate inline activity feed and plan UI consistency with event stream.
- [x] 8.6 Verify no active chat path depends on writing workflow or writing-domain stores.
