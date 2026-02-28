## 1. Shared Contracts and Run-State Extensions

- [ ] 1.1 Extend `AiRunState` in `src/main/services/ai/types.ts` with probe metadata (`needed`, `status`, `evidence`, `confidence`, `gaps`, `planningBasis`).
- [ ] 1.2 Add probe lifecycle and probe-result event unions in `src/shared/types.ts` with typed payloads and timestamps.
- [ ] 1.3 Update Main/Preload/Renderer type consumers to compile against additive probe event unions without introducing `any`.

## 2. Graph Flow Refactor for Pre-Planning Probe

- [ ] 2.1 Refactor `src/main/services/ai/graph.ts` host routing to support `intake -> context_probe -> host_plan -> capability_loop -> finalize`.
- [ ] 2.2 Ensure planning (`ensurePlan`/equivalent) consumes probe output when available and sets planning basis to `probe_enriched`.
- [ ] 2.3 Keep capability registry dispatch contract unchanged while integrating pre-planning probe transition logic.

## 3. Context Sufficiency Decision and Probe Outcome Modeling

- [ ] 3.1 Implement host-side context sufficiency evaluation that can explicitly skip probe when existing context is enough.
- [ ] 3.2 Implement deterministic probe outcomes (`skipped`, `completed_with_confidence`, `completed_with_gaps`) with bounded metadata.
- [ ] 3.3 Ensure low-confidence or gap-heavy probe completion still proceeds to planning with explicit unresolved gaps.

## 4. Probe Execution Tools and Safety Boundaries

- [ ] 4.1 Implement retrieval-backed probe evidence collection using existing local KB tools/stores and bounded preview output.
- [ ] 4.2 Implement read-only workspace observation path for probe with strict allowlist and deny-first command validation.
- [ ] 4.3 Reuse workspace boundary checks to block out-of-root or mutating probe commands and emit probe-safe failure/gap signals.

## 5. Probe Event Emission and Correlation

- [ ] 5.1 Emit ordered probe lifecycle events (`started`, `skipped`, `completed`) with run correlation fields.
- [ ] 5.2 Emit structured probe evidence summaries with normalized source type, compact summary, and capped preview fields.
- [ ] 5.3 Emit confidence and unresolved gap payloads and propagate planning basis metadata to downstream run events/state.

## 6. Renderer Integration and Backward Compatibility

- [ ] 6.1 Update Renderer run-event handling to display probe timeline and outcomes independently from task execution timeline.
- [ ] 6.2 Add backward-compatible fallback handling so unknown/new probe events do not break existing chat execution rendering.
- [ ] 6.3 Validate mixed event ordering behavior so probe, task, tool, and terminal events remain correlated and legible.

## 7. Validation and Regression Coverage

- [ ] 7.1 Add/adjust tests for probe-skip path where planning runs with `history_only` basis.
- [ ] 7.2 Add/adjust tests for probe-enriched planning path, including evidence injection into planning input.
- [ ] 7.3 Add/adjust tests for read-only probe safety enforcement (mutating command rejection and workspace boundary rejection).
- [ ] 7.4 Add/adjust tests for probe event contracts and backward-compatible handling in Renderer/Main boundaries.
- [ ] 7.5 Run `pnpm lint` and `pnpm typecheck` to verify contract consistency after probe-stage integration.

## 8. Documentation and Architecture Guidance

- [ ] 8.1 Update `doc/ai-architecture.md` runtime flow and capability notes to include pre-planning context probe behavior.
- [ ] 8.2 Update any related skill/agent guidance references if event names or runtime extension rules change.
