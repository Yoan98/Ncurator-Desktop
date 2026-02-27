## ADDED Requirements

### Requirement: Deprecate the legacy writing workflow pipeline
The system MUST deprecate the legacy writing workflow pipeline and MUST route writing-related operations initiated from chat through the new AI runtime.

#### Scenario: Writing request uses new runtime
- **WHEN** the user requests to create or modify a writing document in chat mode
- **THEN** the system executes the writer node tools in the new runtime and does not start the legacy pipeline

### Requirement: Preserve writing workspace persistence
The system MUST preserve `writing_folder` and `writing_document` as the persistence layer for writing workspace content.

#### Scenario: Existing writing documents remain accessible
- **WHEN** the user opens the writing workspace after migration
- **THEN** existing folders and documents are available without data loss

### Requirement: Provide a migration-safe behavior for legacy workflow endpoints
If legacy writing workflow IPC endpoints remain present during rollout, they MUST be disabled by default and MUST return an explicit deprecation error.

#### Scenario: Legacy workflow start is called
- **WHEN** a client calls the legacy workflow start endpoint while it is disabled
- **THEN** the system returns an explicit deprecation error instructing clients to use the new runtime
