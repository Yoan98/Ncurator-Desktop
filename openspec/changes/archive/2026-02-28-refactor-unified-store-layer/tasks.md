## 1. Low-level DB layer extraction

- [x] 1.1 Create internal DB core class to own connection and status
- [x] 1.2 Move table schema/index configuration into the DB core
- [x] 1.3 Implement unified readiness gate and consistent openTable helper
- [x] 1.4 Centralize filter helpers and escaping for SQL-like predicates
- [x] 1.5 Ensure initialization still creates required tables and indices

## 2. Domain storage layer refactor

- [x] 2.1 Introduce documents/chunks domain service using the DB core
- [x] 2.2 Migrate document and chunk CRUD methods to the domain service
- [x] 2.3 Migrate vector/FTS/hybrid search methods to the domain service
- [x] 2.4 Migrate multi-table document deletion to the domain service
- [x] 2.5 Introduce chat domain service and migrate session/message methods
- [x] 2.6 Introduce LLM config domain service and migrate config methods
- [x] 2.7 Introduce writing domain service and migrate folder/document/run methods

## 3. UnifiedStore facade migration

- [x] 3.1 Introduce new storage module exports for DB core and domain services
- [x] 3.2 Update IPC handlers to use the new domain services directly
- [x] 3.3 Update other main-process services to use the new storage APIs
- [x] 3.4 Remove or reduce UnifiedStore to a bootstrap-only component

## 4. Integration validation

- [x] 4.1 Validate IPC handlers compile after storage API migration
- [x] 4.2 Run project lint and typecheck commands and resolve issues
- [ ] 4.3 Manually sanity-check ingest, search, chat, writing, and LLM config flows
