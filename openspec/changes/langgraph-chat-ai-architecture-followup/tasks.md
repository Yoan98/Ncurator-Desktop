## 1. Baseline Audit and Decommission Plan

- [x] 1.1 Inventory all legacy writing workflow references across `src/main`, `src/preload`, and `src/renderer` (services, IPC channels, UI actions, shared types).
- [x] 1.2 Classify each reference as remove-now vs temporary-compatibility and document explicit removal targets for this change.
- [x] 1.3 Verify active chat run path does not require writing-domain tables and record remaining dependency gaps.

## 2. Remove Legacy Writing Runtime and IPC Surfaces

- [x] 2.1 Remove legacy writing workflow runtime entry points from active main-process orchestration paths.
- [x] 2.2 Remove or hard-retire deprecated writing-workflow IPC handlers so unsupported calls return explicit failures with no side effects.
- [x] 2.3 Remove corresponding preload bridge methods and renderer call sites tied to writing-workflow channels.
- [x] 2.4 Remove obsolete shared event/type contracts that only serve legacy writing workflow execution.

## 3. Remove Legacy Writing UI Coupling

- [x] 3.1 Remove legacy writing workflow actions/entry points from chat execution UI.
- [x] 3.2 Ensure plan/activity UI renders only capability-based execution semantics (no writing-workflow stage coupling).
- [x] 3.3 Validate chat execution controls do not expose any path that can trigger legacy writing workflow behavior.

## 4. Type-Safety Remediation for AI Architecture Boundaries

- [x] 4.1 Define explicit TypeScript contracts for AI run events, tool events, and capability task payloads/results.
- [x] 4.2 Replace `any` in preload IPC API declarations and main IPC handler payload/result boundaries with concrete types.
- [x] 4.3 Replace `any` in AI runtime/tooling modules with typed interfaces, discriminated unions, or `unknown` + type guards.
- [x] 4.4 Replace `any` in renderer chat execution event consumers with typed adapters and narrowed event models.
- [x] 4.5 Replace `any` in active storage mapping paths used by AI runtime/chat flow with explicit row/result types.

## 5. Enforce Any Governance Rules

- [x] 5.1 Enable and scope `@typescript-eslint/no-explicit-any` enforcement for active AI architecture paths.
- [x] 5.2 Add exception policy pattern (justification + narrow adapter scope) and apply it only where unavoidable.
- [x] 5.3 Add/update lint or CI checks so new explicit `any` usage in governed paths is blocked.

## 6. Add AI Architecture Documentation and Skill Integration

- [x] 6.1 Create `doc/ai-architecture.md` documenting current LangGraph chat architecture, capability boundaries, IPC responsibilities, and legacy writing decommission status.
- [x] 6.2 Add a new project skill for AI architecture tasks that requires reading `doc/ai-architecture.md` before design/implementation changes.
- [x] 6.3 Update `AGENTS.md` to include the AI architecture doc trigger rule, aligned with existing `Database`/`UI` instruction patterns.
- [x] 6.4 Ensure skill metadata/listing reflects the new AI architecture skill and is discoverable in session skill inventory.

## 7. Migration Notes and Compatibility Clarification

- [x] 7.1 Update database/architecture docs to clarify legacy writing tables are data-preserving but inactive for active Chat AI runtime.
- [x] 7.2 Add explicit migration note for future cleanup path (export-first then drop legacy `writing_*` tables) without runtime implicit deletion.
- [x] 7.3 Confirm no new code path reintroduces runtime dependency on `writing_folder`, `writing_document`, or `writing_workflow_run`.

## 8. Validation and Regression Checks

- [x] 8.1 Run typecheck and lint after decommissioning and type-contract refactors.
- [ ] 8.2 Smoke-test chat run flow (retrieval path, capability execution path, workspace-required path) to ensure no legacy writing invocation occurs.
- [x] 8.3 Validate deprecated writing-workflow IPC calls fail explicitly and do not create runs/events/state mutations.
- [ ] 8.4 Validate AI activity/plan UI behavior remains correct after typed event refactor.
- [x] 8.5 Validate documentation and skill trigger updates are consistent (`doc/ai-architecture.md`, skill file, `AGENTS.md`).
