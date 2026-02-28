## 1. Baseline and Migration Scope

- [x] 1.1 Inventory duplicated contract types across `src/shared`, `src/main`, and `src/renderer`.
- [x] 1.2 Inventory high-risk `any`, `unknown`, and undocumented `as unknown as` hotspots in active paths.
- [x] 1.3 Define phase-1 target files and acceptance checkpoints for type-governance rollout.

## 2. Shared Contract Consolidation

- [x] 2.1 Remove duplicated cross-process AI contract types from main-local type modules and reference shared contracts.
- [x] 2.2 Normalize shared contract exports so IPC payload/result/event types have one canonical source.
- [x] 2.3 Update dependent imports in main and renderer to use consolidated shared contract types.

## 3. Preload-Canonical API Typing

- [x] 3.1 Export a canonical preload API type for `window.api`.
- [x] 3.2 Refactor renderer global declaration to reference preload API typing instead of duplicating endpoint signatures.
- [x] 3.3 Verify IPC signature changes propagate via compile-time checks from the single preload source.

## 4. Boundary Decoder Rollout

- [x] 4.1 Introduce boundary decoder helpers for dynamic data ingress (database rows, parsed JSON, model/tool payloads).
- [x] 4.2 Refactor storage domain mappers to use decoder-based narrowing and remove undocumented double assertions.
- [x] 4.3 Refactor AI/runtime boundary parsing paths to narrow `unknown` before entering domain logic.

## 5. Any and Unknown Remediation in High-Impact Modules

- [x] 5.1 Replace avoidable `any` in `src/main/ipc/handlers.ts` with typed payload/result handling and safe error narrowing.
- [x] 5.2 Replace avoidable `any` in active main and renderer hotspots with explicit interfaces, unions, or scoped adapters.
- [x] 5.3 Ensure remaining `any` exceptions are boundary-local, documented, and narrowed in the same code block.
- [x] 5.4 Ensure `unknown` usage remains in boundary adapters only and is not propagated into business/UI layers.

## 6. Governance and Lint Enforcement

- [x] 6.1 Align lint scope with phase-1 governance targets for `@typescript-eslint/no-explicit-any`.
- [x] 6.2 Add guardrails for undocumented double assertions in governed paths (lint rule or review gate).
- [x] 6.3 Verify `AGENTS.md` type-location and `any`/`unknown` policies match implemented enforcement behavior.

## 7. Validation and Regression Checks

- [x] 7.1 Run project lint and typecheck and resolve violations introduced by the refactor.
- [ ] 7.2 Smoke-test critical flows (ingest, search, chat run, settings/config) after typing changes.
- [x] 7.3 Recompute governance metrics (`any`, `unknown`, `as unknown as`) and confirm phase-1 reduction targets are met.
