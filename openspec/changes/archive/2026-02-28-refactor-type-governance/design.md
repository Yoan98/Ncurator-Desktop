## Context

The current type system has three structural issues:

- Shared contracts are duplicated across layers (for example, AI contract types in both `shared` and `main`), creating drift risk.
- IPC API signatures are maintained in multiple places (`preload` and renderer `global.d.ts`) without a strict single source of truth.
- Dynamic boundary data (LanceDB rows, parsed JSON, model output) is often narrowed ad hoc in business code, with broad `unknown`/`any` usage in critical files.

Constraints and guardrails:

- Keep local-first Electron architecture unchanged (Main heavy logic, Renderer UI only).
- Respect existing storage layering and avoid direct business access to raw LanceDB primitives.
- Minimize behavior changes; this change is governance + type architecture, not feature redesign.
- Keep rollout incremental to avoid blocking active development.

## Goals / Non-Goals

**Goals:**

- Define enforceable type ownership by layer (shared/main/renderer/preload/boundary adapters).
- Remove duplicated contract types and establish a single source of truth for cross-process contracts.
- Constrain `unknown` to boundary adapters and require immediate narrowing before domain logic.
- Reduce avoidable `any` in high-impact files first, then expand governance coverage.
- Align project governance docs and lint policy with the same rules.

**Non-Goals:**

- Full repository-wide zero-`any` cleanup in one pass.
- Changing runtime behavior, data schema, or IPC business semantics.
- Introducing a heavy runtime validation dependency in every module by default.

## Decisions

### 1) Use layered type ownership with explicit boundaries

Decision:

- `src/shared/*`: cross-process contracts only (IPC payloads, events, shared entities).
- `src/main/**/types.ts`: main-internal runtime/orchestration types only.
- `src/renderer/src/**/types.ts`: renderer-only view/state types.
- Boundary decode modules (`adapters/codec/decoder` style): own all narrowing from dynamic input.

Rationale:

- Prevents drift from parallel type definitions.
- Makes ownership obvious during code review.
- Keeps untrusted input handling out of domain logic.

Alternatives considered:

- Keep current “local types near usage” pattern: lower short-term friction, but continues inconsistency and drift.
- Move all types into one global file: creates a monolith and mixes boundary/view/runtime concerns.

### 2) Establish single-source IPC API typing through preload

Decision:

- Treat preload-exported API types as the canonical source for `window.api`.
- Renderer `global.d.ts` references preload API types instead of re-declaring endpoint signatures.

Rationale:

- Eliminates dual maintenance of identical API method signatures.
- Reduces breakage when IPC contracts evolve.

Alternatives considered:

- Keep duplicate declarations and enforce sync manually: fragile and error-prone.

### 3) Standardize boundary decoding and narrowing

Decision:

- Keep dynamic input as `unknown` only at adapter entry points.
- Decode to explicit domain types before entering services/stores/UI logic.
- Ban undocumented `as unknown as` as a default pattern.

Rationale:

- Makes unsafe points auditable and testable.
- Improves confidence during refactors in stores, IPC handlers, and AI event pipelines.

Alternatives considered:

- Continue opportunistic inline narrowing in each call site: duplicates logic and increases inconsistency.

### 4) Roll out strictness in phases with measurable checkpoints

Decision:

- Phase 1 (high-impact): shared contracts, preload/global API boundary, IPC handlers, storage row mapping, AI runtime event/tool typing.
- Phase 2: expand `no-explicit-any` strict scope to remaining active renderer/main modules.
- Track progress with simple metrics (`any` count, `unknown` outside adapters count, `as unknown as` count).

Rationale:

- Maintains delivery speed while converging to strict governance.
- Focuses first on modules with highest cross-boundary risk.

Alternatives considered:

- Big-bang strict enforcement repo-wide: high merge conflict risk and low execution reliability.

## Risks / Trade-offs

- [Risk] Stricter linting may initially increase local build friction. -> Mitigation: staged scope expansion with clear target directories per phase.
- [Risk] Refactors that remove duplicate types may trigger broad import churn. -> Mitigation: apply per-domain migration and keep naming stable when possible.
- [Risk] Decoder introduction can add boilerplate. -> Mitigation: provide lightweight reusable helpers and keep adapters close to domain boundaries.
- [Trade-off] Some temporary mixed patterns will exist during migration. -> Mitigation: define completion criteria for each phase and remove legacy patterns immediately after migration.

## Migration Plan

1. Baseline and inventory:
   - enumerate duplicate contracts, `any`, `unknown`, and `as unknown as` hotspots.
2. Contract consolidation:
   - unify shared contract types; remove duplicated definitions in main where shared ownership applies.
3. IPC typing unification:
   - set preload as canonical API type source; update renderer global declarations to reference it.
4. Boundary decoder rollout:
   - introduce decoder utilities in storage/IPC/AI boundaries and replace ad hoc narrowing.
5. Governance enforcement:
   - align `AGENTS.md` and ESLint scope with phased strictness policy.
6. Verification:
   - run typecheck/lint and targeted smoke flows (ingest/search/chat/settings).

Rollback strategy:

- This change is code-structure and typing only; rollback is code-level revert of affected modules/config.

## Open Questions

- Should boundary decoding use a schema library (for example zod) everywhere, or only for high-risk boundaries while using manual guards elsewhere?
- Do we enforce `no-explicit-any` repository-wide immediately after Phase 1 or keep a temporary exception list with deadline?
- Should shared types be split into domain files now (`src/shared/types/*`) or remain in one file until duplication cleanup is complete?
