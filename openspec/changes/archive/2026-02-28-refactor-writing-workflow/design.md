## Context

The writing workflow in the main process is currently implemented as a single service method that defines all workflow nodes, utility functions (LLM calls, JSON parsing), persistence updates, cancellation checks, and graph wiring in one file. This coupling increases cognitive load, encourages copy/paste for new stages, and makes it harder to evolve the workflow into more complex shapes (branching, retries, per-section execution).

The workflow is executed from IPC handlers and streamed to the renderer via `WritingWorkflowEvent` stage events. Stage IDs are part of a shared union type and are consumed by the UI to drive progress and display intermediate artifacts.

## Goals / Non-Goals

**Goals:**
- Modularize the workflow implementation into separate modules: runtime/context, graph construction, and stage nodes.
- Centralize cross-cutting concerns (event emission, cancellation checks, persistence updates, LLM client creation, JSON parsing helpers).
- Keep the stage ID set and event semantics consistent so the UI can continue to react to stage transitions and outputs.
- Make it straightforward to add/reorder stages and to reuse utilities across nodes without duplicating code.

**Non-Goals:**
- Changing user-facing workflow behavior, stage semantics, or IPC API contracts.
- Redesigning prompt content or introducing new prompt storage locations.
- Introducing new external dependencies or changing the storage schema.

## Decisions

- Split the workflow into three layers:
  - Runtime/context: provides shared utilities and a consistent stage execution wrapper.
  - Graph builder: defines nodes and edges in a single place.
  - Nodes: one file per stage, focusing on stage-specific logic only.

- Standardize node signatures around `(ctx, state) => Partial<State>`:
  - The context owns cancellation checks and stage event lifecycles.
  - Nodes return partial state updates, enabling composition and clearer data flow.

- Keep shared types in the existing shared type system:
  - Stage IDs and events remain defined in shared types.
  - The internal workflow state shape is defined near the workflow runtime and is derived from shared types where appropriate.

## Risks / Trade-offs

- [Risk] Refactor introduces subtle behavior differences in stage ordering or payload shapes → Mitigation: keep stage IDs and output payload shapes unchanged and verify by running the application flow end-to-end.
- [Risk] Over-abstraction makes simple changes harder → Mitigation: keep the runtime minimal, avoid generic frameworks, and keep node files small and explicit.
- [Risk] Future branching flows complicate state typing → Mitigation: keep state updates as partial patches and evolve types incrementally as branching is introduced.
