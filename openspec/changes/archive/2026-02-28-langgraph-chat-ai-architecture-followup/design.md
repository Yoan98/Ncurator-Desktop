## Context

`langgraph-chat-ai-architecture` established the target direction (capability-based host runtime), but several implementation remnants still dilute that architecture:

- Legacy writing surfaces still exist in runtime-adjacent code paths (renderer integration points, IPC handlers, writing workflow service/store references).
- Type contracts in AI/runtime/UI boundaries still include broad `any` usage, reducing safety of refactors and event evolution.
- There is no single authoritative AI architecture document under `doc/`, and no workflow rule that enforces reading it during architecture-related work.

Project constraints that shape this design:

- Local-first architecture remains unchanged (Electron Main handles heavy compute and storage).
- Database operations must follow `StorageService` / domain-store layering; business code should not directly manipulate LanceDB connection primitives.
- Legacy writing tables may still exist physically; however, active Chat AI runtime must not depend on them.

## Goals / Non-Goals

**Goals:**

- Remove residual legacy writing workflow and write-UI code from active architecture paths.
- Replace `any` in AI-related and shared boundary code with explicit, named TypeScript contracts.
- Introduce an enforceable `any` governance rule in agent guidance and lint policy.
- Add a canonical AI architecture doc in `doc/` and a matching skill trigger so AI architecture tasks consistently reference it.
- Keep migration safe: no accidental data-loss behavior for legacy writing data.

**Non-Goals:**

- Reintroducing or modernizing the legacy writing workflow.
- Dropping legacy writing tables in this change.
- Achieving zero-`any` across the entire repository in one pass; this change focuses on AI-related and active architecture boundaries first.

## Decisions

### 1) Legacy write decommissioning is code-path removal, not data destruction

Residual writing workflow paths will be removed from supported runtime execution (IPC/preload/renderer/main flow), while legacy tables remain physically present for compatibility and optional offline migration.

Rationale:

- Matches active architecture intent without destructive database operations.
- Avoids user-data loss while still preventing new dependencies on writing tables/workflow.

Alternatives considered:

- Hard-delete writing tables now: rejected due to migration risk and rollback complexity.
- Keep handlers but return deprecation errors forever: rejected because dead surfaces continue to add maintenance and typing burden.

### 2) Type boundary-first refactor strategy

`any` remediation will prioritize boundary modules first, then internals:

- IPC contracts (`preload` declarations, handler payload/result types)
- AI runtime/tool event payloads
- Storage row mapping return types used by active architecture
- Renderer consumers for AI event stream and task traces

Pattern rules:

- Use `unknown` + narrowers/type guards for untrusted JSON and dynamic payloads.
- Use discriminated unions for run events/tool events.
- Use explicit interfaces/types for tool args/results and store mapping outputs.
- For unavoidable dynamic values, isolate them behind a typed adapter function.

Rationale:

- Boundary-first typing gives immediate safety on cross-process contracts.
- Reduces regressions during later internal cleanup.

Alternatives considered:

- Big-bang full repository typing sweep: rejected due to high merge risk and low iteration speed.

### 3) Enforce "no `any` by default" via lint + agent rules

Governance has two layers:

- **Lint policy**: enable `@typescript-eslint/no-explicit-any` as error (or strict warning gate, depending on current CI tolerance) for active code paths.
- **Agent rule** in `AGENTS.md`: default prohibition on `any`; exceptions require explicit justification comment and narrow scope.

Exception policy:

- Allowed only at clearly documented interop boundaries.
- Must include why a stricter type is currently infeasible and where narrowing occurs.

Rationale:

- Lint catches violations mechanically.
- Agent rule prevents regression during AI-assisted edits.

### 4) AI architecture doc + skill as mandatory knowledge source

Add `doc/ai-architecture.md` as the canonical architecture reference for current LangGraph chat runtime, including:

- Runtime graph and capability boundaries
- Main/Renderer responsibilities and IPC contracts
- Workspace/sandbox/approval flow
- Extension principles for new capabilities
- Explicit decommission status of legacy writing workflow

Add a dedicated skill (parallel to `Database`) that instructs: when work涉及 AI architecture, read `doc/ai-architecture.md` first.

Update `AGENTS.md` to include the same trigger rule.

Rationale:

- Reduces architectural drift and repeated oral context.
- Makes architecture decisions auditable and reusable.

### 5) Storage compatibility posture for legacy writing tables

Active runtime code must not depend on `writing_folder`, `writing_document`, or `writing_workflow_run`.

However, storage schema compatibility is preserved in this phase:

- Existing tables may remain in `LanceDbCore` config until explicit removal plan.
- Runtime and UI flows stop consuming writing-domain stores in active architecture.

Rationale:

- Aligns with current database migration guidance and minimizes operational risk.

## Risks / Trade-offs

- [Risk] Removing legacy write handlers may break hidden/internal flows that still call deprecated channels. -> Mitigation: add targeted grep-based callsite audit and runtime smoke tests before final removal.
- [Risk] Tightening `no-explicit-any` may surface many existing violations. -> Mitigation: apply scope-based rollout (AI/runtime boundaries first), with explicit backlog for remaining files.
- [Risk] New AI architecture doc may become stale. -> Mitigation: require doc update in future AI architecture changes as a checklist item in tasks.
- [Risk] Keeping legacy tables can create confusion about active vs. legacy paths. -> Mitigation: clearly mark table status in docs and ensure runtime code has zero references in active flows.

## Migration Plan

1. Audit and enumerate all legacy writing workflow references across renderer/preload/main/storage.
2. Remove active legacy write UI/IPC/runtime paths; keep behavior explicitly unsupported.
3. Refactor boundary types to eliminate `any` in prioritized AI/runtime files.
4. Enable/enforce `no-explicit-any` policy for targeted scope and update `AGENTS.md` usage rules.
5. Add `doc/ai-architecture.md`, add new AI architecture skill, and document trigger rule in `AGENTS.md`.
6. Validate with typecheck/lint and smoke tests for chat run flow, retrieval flow, and terminal/docx capability routing.
7. Publish migration note clarifying: legacy writing data may still exist physically but is not used by active Chat AI runtime.

## Open Questions

- Should `no-explicit-any` be enforced as repo-wide error immediately, or staged by directory to reduce churn?
- Do we fully remove `WritingStore` exports now, or keep them isolated but unreachable for one release window?
- Should the new AI architecture skill be placed under `.codex/skills/ai-architecture/` or a project-specific naming convention aligned with existing local skills?
