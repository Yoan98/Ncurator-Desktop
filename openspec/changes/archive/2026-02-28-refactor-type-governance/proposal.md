## Why

Type definitions in the project are currently scattered across shared, main, renderer, and ad-hoc local declarations, with duplicated AI contract types and repeated IPC/API signatures. This increases drift risk, weakens compile-time guarantees, and makes refactoring expensive. At the same time, broad `unknown`/`any` usage remains in key boundary and orchestration files where stronger, explicit typing is feasible now.

## What Changes

- Introduce a clear type ownership model by layer:
  - shared contract types for cross-process IPC and shared entities
  - main runtime/internal types for orchestration and service internals
  - renderer view-model types for UI-only state
- Remove duplicated type definitions across layers and enforce a single source of truth for shared contracts.
- Define a boundary-decoding pattern for external/dynamic data (LanceDB rows, model outputs, JSON parse results), so `unknown` stays at adapters and is narrowed before business logic.
- Replace avoidable `unknown` and `any` in high-impact files with explicit types, type guards, or schema-based decoding.
- Strengthen project governance in `AGENTS.md`:
  - explicit rules for where each class of type must live
  - explicit rule that `any`/`unknown` are only allowed when type definition is truly infeasible, with mandatory local narrowing and rationale

## Capabilities

### New Capabilities
- `type-ownership-layering`: establish and enforce layer-based ownership for shared contracts, main internal runtime types, renderer view types, and boundary adapter decoders.
- `boundary-decode-governance`: standardize boundary decoding so dynamic inputs are narrowed at adapters before entering domain/business logic.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/shared/types.ts` and potential split modules under `src/shared/types/*`
  - `src/main/services/ai/types.ts`, `src/main/types/store.d.ts`, storage domain mapping files, and IPC handler typings
  - `src/preload/index.ts` and `src/renderer/src/types/global.d.ts` API type ownership alignment
  - renderer pages/components with avoidable `any` or unchecked `unknown`
- Affected process/docs:
  - `AGENTS.md` gains stronger type-location and `any`/`unknown` governance rules
- Expected result:
  - lower type drift across process boundaries
  - reduced runtime shape errors from dynamic data
  - clearer, enforceable typing conventions for future changes
