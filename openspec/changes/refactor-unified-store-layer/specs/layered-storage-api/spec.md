## ADDED Requirements

### Requirement: Storage API can be redesigned for clear layering
The system MAY introduce breaking changes to the storage API to achieve a clear separation between the DB access layer and domain/business storage operations. Call sites MUST be updated to use the new API surface.

#### Scenario: Call sites are migrated to the new API
- **WHEN** storage method names or call patterns change as part of the refactor
- **THEN** all main-process callers are updated to compile and run against the new API surface

### Requirement: Centralized readiness gate for storage operations
The system MUST enforce a single readiness gate for all storage operations. If the storage subsystem is not ready, operations MUST behave consistently with their pre-change semantics (either throwing an error or returning an empty/default value where that was previously the behavior).

#### Scenario: Operation invoked before initialization completes
- **WHEN** a storage operation is invoked while the storage subsystem is not ready
- **THEN** the operation follows the same not-ready behavior as the corresponding pre-change method

### Requirement: LanceDB access is encapsulated behind an internal DB layer
The system SHALL encapsulate LanceDB connection lifecycle and table access behind a dedicated internal DB access layer. Domain/business storage operations MUST NOT perform direct LanceDB connection/table management outside that layer.

#### Scenario: Domain operation performs table access
- **WHEN** a domain storage operation needs to read or write data
- **THEN** it performs table access via the internal DB layer rather than directly managing LanceDB connections or tables

### Requirement: Required tables and indices are ensured on initialization
On initialization, the system SHALL ensure that all required tables exist and that required indices are created for those tables, matching the current application’s expected schemas and index configurations.

#### Scenario: Fresh database path initialization
- **WHEN** the application initializes storage on a fresh database path
- **THEN** the required tables and indices are created and subsequent domain operations can execute against them

### Requirement: Consistent and safe query filtering support
The system SHALL provide consistent helpers for building and combining filter conditions, including safe escaping of user-provided values used in SQL-like predicates. The system MUST preserve any existing behavior that treats certain keyword inputs as raw filter expressions.

#### Scenario: Keyword filtering is applied
- **WHEN** a caller requests a list/search operation with a keyword filter
- **THEN** the system applies the filter using consistent escaping rules and preserves any pre-existing raw-filter behavior

### Requirement: Multi-table document deletion removes related chunks
When deleting documents by ID, the system MUST remove the corresponding document records and MUST also remove related chunk records that reference those document IDs, preserving the pre-change success/error contract.

#### Scenario: Deleting a document removes its chunks
- **WHEN** a caller deletes a document by ID
- **THEN** the associated document record and all related chunk records are removed and the method returns results consistent with the pre-change contract
