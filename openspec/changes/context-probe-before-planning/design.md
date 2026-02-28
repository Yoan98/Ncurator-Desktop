## Context

The current runtime in `src/main/services/ai/graph.ts` enters planning first (`ensurePlan`) and only gathers retrieval evidence after plan tasks are dispatched. This causes plan quality issues for requests that require environment-specific context (local KB evidence or workspace inspection) before deciding execution strategy. The change must preserve local-first constraints, Main/Renderer responsibility boundaries, and workspace safety gates.

## Goals / Non-Goals

**Goals:**

- Introduce a pre-planning context probe stage in the host-led graph.
- Ensure planning decisions can be based on probe evidence instead of history-only context.
- Keep probe behavior auditable through typed events and explicit run-state fields.
- Preserve existing capability registry model and safety controls.

**Non-Goals:**

- Rebuilding the entire runtime into a new planner architecture.
- Enabling mutating sandbox commands during context probing.
- Removing existing capability nodes (`local_kb_retrieval`, `terminal_exec`, `docx`) in this change.

## Decisions

### 1) Add a distinct `context_probe` stage before planning

Decision:

- Evolve runtime flow to `intake -> context_probe -> host_plan -> capability_loop -> finalize`.
- Host decides whether probe is needed; if not, planning can proceed immediately.

Rationale:

- Separates "collect evidence" from "commit to task plan".
- Aligns with requirement intent: planning quality should improve when context is uncertain.

Alternatives considered:

- Keep current single-step planning and rely on plan heuristics only: rejected, still context-blind.
- Full dynamic re-planning from day one: deferred due to higher state complexity and regression risk.

### 2) Probe stage uses retrieval plus read-only sandbox observation only

Decision:

- Probe stage may use local KB retrieval tools and optional workspace observation commands.
- Probe commands are restricted to read-only allowlist patterns (for example: `pwd`, `ls`, `find`, `rg`, `cat`, `git status`).
- No write-side commands (`rm`, `mv`, redirection, chmod/chown, package install, etc.) are allowed in probe.

Rationale:

- Allows evidence gathering from both knowledge base and workspace context.
- Preserves safety and approval semantics by keeping probe non-mutating.

Alternatives considered:

- Reuse `terminal_exec` directly in probe: rejected because its objective is action execution, not safe observation-only probing.
- Retrieval-only probe without workspace observation: rejected as insufficient for repo-state questions.

### 3) Introduce explicit probe state and evidence contracts

Decision:

- Extend `AiRunState` with probe metadata, including:
  - whether probing was needed,
  - probe status,
  - compact evidence summary,
  - confidence,
  - unresolved gaps,
  - planning basis (`history_only` or `probe_enriched`).
- Add run events for probe lifecycle and outcomes so Renderer can display probe progress independently from task execution.

Rationale:

- Prevents implicit/hidden probe behavior.
- Improves debugging and user trust through observable state transitions.

Alternatives considered:

- Store probe notes only in `outputText`: rejected due to weak typing and poor UI traceability.

### 4) Keep compatibility with existing capability loop

Decision:

- Do not change capability registry contract in this phase.
- `host_plan` still produces `AiPlanTask[]`, and dispatch remains through existing registry.
- Existing run/task/tool events remain valid; probe events are additive.

Rationale:

- Limits migration risk and avoids broad renderer breakage.
- Enables incremental rollout with small integration surface.

Alternatives considered:

- Replace registry with planner-owned tool loop: rejected for scope and timeline reasons.

## Risks / Trade-offs

- [Risk] Probe adds latency before planning. -> Mitigation: short probe budget (step/time caps) and early-exit when confidence is already high.
- [Risk] Read-only command classification may miss edge cases. -> Mitigation: strict deny-first parser plus explicit allowlist and boundary checks.
- [Risk] Event model expansion may break renderer assumptions. -> Mitigation: additive union events and backward-compatible UI fallback for unknown event types.
- [Risk] Evidence summaries may become too verbose/noisy. -> Mitigation: enforce compact summary schema and capped preview lengths.

## Migration Plan

1. Add new run-state fields and shared event types for probe lifecycle and planning basis.
2. Insert `context_probe` node and routing logic in `graph.ts` ahead of plan creation.
3. Implement probe executors/adapters:
   - retrieval evidence collector,
   - read-only workspace observer with existing boundary checks.
4. Update host planning prompt/input to consume probe evidence and gaps.
5. Update renderer event handling to surface probe timeline and outcomes.
6. Validate with focused runtime tests:
   - probe skipped path,
   - probe-enriched planning path,
   - safety rejection for non-read-only probe command.
7. Roll out behind a runtime flag if needed; fallback to previous flow for rollback.

Rollback strategy:

- Disable probe route flag and restore planning-first flow while keeping additive types/events inert.

## Open Questions

- Should probe evidence be persisted to chat memory or remain run-ephemeral only?
- What is the exact read-only command allowlist for cross-platform behavior in Electron Main?
- Do we need a second-phase re-plan loop when execution reveals new context gaps?
