## Context

UnifiedStore is currently both:

- A LanceDB infrastructure component (connection lifecycle, table schema/index creation, shared query helpers), and
- A domain/business API (documents/chunks ingestion and search, chat session/message storage, LLM config management, writing folders/documents/workflow runs).

This results in duplicated patterns across many methods (readiness checks, table existence checks, ad-hoc `where` strings, escaping), and makes it difficult to evolve storage behavior safely without touching business logic. The main-process initialization model is currently “best effort background init” (the app does not await store initialization before registering IPC handlers).

Constraints:

- Main process only (Electron v39); storage is local (LanceDB).
- No user-visible behavior changes are intended in this change.
- Avoid schema changes and data migrations unless strictly required.
- Callers (IPC handlers and services) currently depend on the UnifiedStore API surface; minimizing churn is preferred.

## Goals / Non-Goals

**Goals:**

- Introduce a clear separation between a low-level LanceDB access layer and domain-facing storage operations.
- Centralize readiness checking, table existence checks, `openTable`, and `where`/escaping helpers in the low-level layer.
- Allow storage API redesign where it improves clarity; update call sites accordingly.
- Reduce future refactor cost by making storage-backed domain logic easier to test and reason about (without adding new tests in this change).

**Non-Goals:**

- Changing table schemas, adding migrations, or altering persisted data layout.
- Redesigning IPC contracts or introducing new IPC endpoints.
- Introducing new storage technologies or external services.
- Optimizing performance beyond low-risk structural improvements.

## Decisions

### 1) Prefer explicit layered APIs over preserving the current facade

**Decision:** Introduce explicit layered APIs (DB core + domain services). The existing `UnifiedStore` facade MAY be removed or reduced to a thin bootstrap-only component. Call sites will be updated to depend on the new domain services.

**Rationale:** Backward compatibility is not a constraint for this refactor. Optimizing for clear boundaries and simpler mental models is preferred over preserving legacy method shapes.

**Alternatives considered:**

- Keep UnifiedStore as the primary facade: reduces churn but preserves legacy coupling pressures.
- Move code without changing APIs: does not establish strong internal contracts for new code.

### 2) Introduce a dedicated low-level LanceDB access class

**Decision:** Create a low-level class (e.g., `LanceDbStoreCore`) responsible for:

- Connecting/closing and caching the `lancedb.Connection`
- Managing status/readiness (uninitialized/initializing/ready/error)
- Ensuring tables and indices exist (current `getTableConfigs` + `ensureTable`)
- Providing safe helpers:
  - `escapeSqlString`
  - `buildInClause`
  - `combineWhere`
  - A single `openTable(name)` that asserts readiness and handles existence checks consistently

**Rationale:** Centralizing the primitives prevents every business method from having to re-implement defensive checks and string escaping, and establishes a stable internal contract for all domain code.

**Alternatives considered:**

- Keep DB primitives inside UnifiedStore as private helpers: still mixes responsibilities and encourages new methods to continue the pattern.

### 3) Model domain operations as repositories/services grouped by bounded context

**Decision:** Implement domain-facing classes that depend only on the low-level DB layer, grouped by the current tables/usage:

- Documents/chunks: document metadata CRUD, chunk storage, hybrid search (vector + FTS + rerank), list/pagination, bulk delete.
- Chat: session/message CRUD, cascaded deletes.
- LLM config: CRUD + “active config” rule.
- Writing: folder/document/workflow-run CRUD with current created_at preservation semantics.

**Rationale:** Each group has distinct business rules and invariants (e.g., cascaded deletes, “active” switching, created_at retention) that should not live in the DB layer. Grouping also improves discoverability and reduces file size.

**Alternatives considered:**

- One large “domain store” class: smaller surface change but recreates the same maintainability issues.
- One repository per table only: may scatter business rules that span multiple tables (e.g., document delete touching both document and chunk tables).

### 4) Preserve current initialization semantics but make it explicit internally

**Decision:** Keep background initialization behavior at the app level, but ensure:

- The facade methods have consistent readiness behavior (either throw “not ready” or return safe empty defaults where they already do).
- The low-level layer provides a single readiness gate used by all domain operations.

**Rationale:** Changing initialization semantics is cross-cutting and risky for user experience. This design focuses on structural improvements without behavior changes.

## Risks / Trade-offs

- **[Risk] Accidental behavior changes in `where` string building/escaping** → Mitigation: preserve existing filtering logic and only centralize escaping; audit all `where` construction paths during refactor.
- **[Risk] Partial migration leads to mixed patterns temporarily** → Mitigation: migrate by bounded context (documents, chat, LLM config, writing) and remove old code as each context is completed.
- **[Risk] Bulk delete semantics differ (best-effort vs strict)** → Mitigation: keep current error handling contracts; if a method currently catches and returns `{ success: false }`, keep it in domain layer.
- **[Trade-off] More files/classes** → Mitigation: keep names and module boundaries aligned to existing tables and callers; avoid unnecessary abstractions.

## Migration Plan

1. Create the low-level DB layer and move the following from UnifiedStore into it: status management, connect/close, table configs, ensureTable, shared query helpers.
2. Create domain repositories/services per bounded context and migrate methods context-by-context:
   - Documents/chunks (including search + pagination + bulk delete)
   - Chat
   - LLM config
   - Writing (folders/documents/workflow runs)
3. Update main-process callers (IPC handlers and services) to use the new domain services and remove or shrink the UnifiedStore facade.
4. Remove legacy UnifiedStore methods and duplicated query logic once migration is complete.
5. Validate by running the project’s existing lint/typecheck commands and doing a basic manual flow check in the app (ingest, search, chat, writing, LLM config).

Rollback strategy:

- Keep the old UnifiedStore implementation available in version control during the change; if required, revert to the previous file/module structure. No data migration is expected, so rollback is code-only.

## Open Questions

- Should the low-level `openTable` always validate table existence, or assume tables exist after initialization (and fail fast otherwise)?
- Should we introduce a small internal error type taxonomy (e.g., NotReadyError) to standardize readiness behavior, or keep plain `Error` strings to avoid caller changes?
- Should bulk operations (e.g., deleteDocumentsByIds) be optimized to avoid per-id loops, or kept as-is for behavior stability in this refactor?
