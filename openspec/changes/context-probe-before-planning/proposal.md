## Why

The current AI runtime creates a plan before collecting task-specific evidence, so planning decisions are often made from user input and chat history only. We need a pre-planning context probe stage now to improve plan quality, reduce unnecessary execution steps, and make runtime behavior more auditable.

## What Changes

- Add a host-controlled context probe phase before plan creation in the LangGraph runtime flow.
- Introduce explicit probe outcomes (sufficient context vs insufficient context) that gate whether planning should run.
- Add probe-safe retrieval and read-only sandbox gathering behavior so the runtime can collect evidence without performing mutating actions.
- Add typed run-state and event contracts for probe lifecycle, evidence summaries, and planning basis metadata.
- Update runtime documentation and UI-facing event expectations to reflect the new `intake -> probe -> plan -> execute -> finalize` sequence.

## Capabilities

### New Capabilities

- `ai-context-probe-orchestration`: Host-side pre-planning probe stage, probe gating logic, and transitions into planning/execution.
- `ai-context-probe-evidence-events`: Standard event and state contracts for probe lifecycle, evidence summary, confidence, and planning basis.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `src/main/services/ai/graph.ts` (graph flow, host routing, probe node integration)
  - `src/main/services/ai/types.ts` (run state additions for probe/evidence/planning basis)
  - `src/shared/types.ts` (new AI run event types and payload contracts)
  - `src/main/services/ai/tools/*` (probe-safe retrieval/read-only sandbox adapters as needed)
  - Renderer run-event consumers (plan/probe timeline display and state transitions)
- Affected behavior:
  - Planning no longer runs as the first decision step when context is insufficient.
  - The runtime can explicitly skip planning for already-sufficient informational requests, or proceed with a better-informed plan.
- Dependencies/systems:
  - No cloud dependency changes; local-first constraints remain.
  - Workspace/policy boundaries remain enforced; probe stage is read-only by design for sandbox commands.
