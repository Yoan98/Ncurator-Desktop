## Why

The current writing workflow implementation is difficult to extend and maintain because workflow nodes, orchestration, persistence, and LLM utilities are tightly coupled in a single service method. Refactoring now reduces future change cost and enables faster iteration on new stages and branching flows.

## What Changes

- Split the writing workflow implementation into dedicated modules: runtime/context, graph construction, and individual node implementations.
- Introduce a shared workflow context that centralizes cancellation checks, event emission, persistence updates, and LLM/JSON utilities.
- Make node boundaries explicit (one file per stage) to simplify future additions, reordering, and partial reuse.
- Keep existing stage IDs and event semantics stable while improving internal structure (no user-visible feature changes intended).

## Capabilities

### New Capabilities
- `writing-workflow-modularization`: Modular, stage-based writing workflow architecture with reusable runtime/context and per-stage node modules.

### Modified Capabilities
- (none)

## Impact

- Main process code: refactors `src/main/services/writing/WritingWorkflowService.ts` and introduces new workflow modules under `src/main/services/writing/`.
- IPC and renderer: no intended changes to `writing-workflow-*` IPC handlers or `WritingWorkflowEvent` consumption.
- Dependencies: no new external runtime dependencies expected.
