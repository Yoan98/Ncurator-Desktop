## 1. Shared Contracts and Event Extensions

- [ ] 1.1 Extend shared AI run contracts for tool-driven terminal/docx execution inputs and results.
- [ ] 1.2 Add typed file-artifact run event definitions in `src/shared/types.ts`.
- [ ] 1.3 Update Main/Preload/Renderer type consumers to compile against new event unions without `any`.

## 2. Terminal Tooling Foundation

- [ ] 2.1 Create terminal tool interfaces (`terminal_run_command`, `terminal_finish`) with zod-validated inputs.
- [ ] 2.2 Reuse existing workspace boundary, risk classification, and approval checks inside terminal command tool execution.
- [ ] 2.3 Emit terminal step and activity events from tool execution with stable run/task/step correlation.

## 3. Refactor `terminal_exec` Capability to Tool Loop

- [ ] 3.1 Replace direct raw-command bootstrapping in `executeTerminalExec` with objective-driven agent/tool loop.
- [ ] 3.2 Ensure capability loop enforces max-step and timeout boundaries and returns explicit success/failure task results.
- [ ] 3.3 Keep host/capability registry contract unchanged while switching executor internals to tool calls.

## 4. Docx Tooling Foundation

- [ ] 4.1 Implement Node.js-first docx adapters for inspect and deterministic edit application.
- [ ] 4.2 Add docx tools (`docx_inspect`, `docx_apply_edits`, `docx_save_output`, `docx_finish`) with typed schemas.
- [ ] 4.3 Enforce workspace binding and approval for overwrite/destructive docx write operations.

## 5. Replace Docx Placeholder Capability

- [ ] 5.1 Replace `executeDocxPlaceholder` with tool-driven docx executor in capability registry.
- [ ] 5.2 Return concrete docx task results for success/failure paths and remove `not_implemented` placeholder behavior.
- [ ] 5.3 Emit activity traces summarizing inspect/apply/save phases for UI observability.

## 6. File Artifact Event Integration

- [ ] 6.1 Emit artifact metadata events when terminal/docx capabilities create or update local files.
- [ ] 6.2 Update Renderer chat execution UI to display artifact entries with open/reveal actions.
- [ ] 6.3 Keep graceful fallback rendering when artifact events are missing or partially populated.

## 7. Validation and Regression Coverage

- [ ] 7.1 Add/adjust tests for terminal objective decomposition through tools, including approval-required and boundary-failure cases.
- [ ] 7.2 Add/adjust tests for docx capability execution (inspect/apply/save) and overwrite approval gating.
- [ ] 7.3 Add/adjust tests for artifact event emission and renderer consumption.
- [ ] 7.4 Run `pnpm lint` and `pnpm typecheck` to confirm end-to-end contract consistency.

## 8. Documentation Updates

- [ ] 8.1 Update `doc/ai-architecture.md` to describe tool-driven terminal/docx capability loops and artifact events.
- [ ] 8.2 Update skill/agent guidance if needed so future AI-architecture work follows the new terminal/docx capability contracts.
