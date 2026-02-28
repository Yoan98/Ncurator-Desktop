## Why

UnifiedStore currently mixes LanceDB infrastructure concerns (connection lifecycle, table schemas/indices, query helpers) with domain/business operations (documents/chunks, chat, LLM config, writing data). This coupling makes the storage layer hard to evolve safely, increases duplicated and inconsistent query logic, and raises the cost/risk of adding new storage-backed features.

## What Changes

- Split storage into two layers: a low-level LanceDB access layer and a domain-facing business layer.
- Move database primitives into the low-level layer: connect/close, readiness checks, ensureTable, openTable, table existence checks, shared query/where helpers, and consistent escaping.
- Move business rules and domain-specific operations into a separate class (or set of classes) that depends on the low-level layer (e.g., document/chunk operations, chat session/message operations, LLM config operations, writing folder/document/workflow-run operations).
- Allow breaking internal API changes where beneficial for clarity and separation of concerns; update call sites accordingly.

## Capabilities

### New Capabilities

- `layered-storage-api`: Introduce a clear boundary between a LanceDB access layer and domain repositories/services, defining stable initialization semantics, safe filtering/query helpers, and supported multi-table operations while preserving existing behavior.

### Modified Capabilities

- None.

## Impact

- Affected code: main-process storage modules, especially UnifiedStore and its callers.
- Primary integration points: IPC handlers and main services that currently call UnifiedStore directly (documents/chunks, search, chat, LLM config, writing data).
- Dependencies/systems: LanceDB usage stays the same; no expected schema changes, but internal file/module layout and call graph will change.
