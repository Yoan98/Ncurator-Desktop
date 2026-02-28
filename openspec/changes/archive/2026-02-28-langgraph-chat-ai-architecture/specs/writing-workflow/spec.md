## ADDED Requirements

### Requirement: Remove legacy writing-workflow interactions from active product flow
The system MUST remove writing-workflow execution from supported chat architecture and MUST not route chat file operations through legacy writing workflow.

#### Scenario: Chat action request does not use legacy workflow
- **WHEN** user requests file editing or generation in chat mode
- **THEN** runtime uses capability nodes (for example `docx`) and does not invoke legacy writing workflow run APIs

### Requirement: Remove writing-workflow IPC APIs from supported interface
Legacy writing-workflow IPC endpoints MUST be removed from supported client surface or hard-disabled with explicit deprecation errors during transition.

#### Scenario: Legacy endpoint is called during transition
- **WHEN** client calls deprecated writing-workflow start/cancel APIs
- **THEN** system returns explicit deprecation failure and no workflow run is created

### Requirement: Remove writing-domain persistence from active architecture
Active runtime architecture MUST not depend on `writing_folder`, `writing_document`, or `writing_workflow_run` persistence tables.

#### Scenario: Runtime dependencies are validated
- **WHEN** AI runtime executes retrieval or file-action tasks
- **THEN** no active runtime path requires writing-domain tables or writing-domain store operations

### Requirement: Define migration/cleanup policy for existing writing data
The system MUST define deterministic migration behavior for existing writing-domain data when decommissioning the subsystem.

#### Scenario: Existing install upgrade
- **WHEN** application upgrades to the new architecture
- **THEN** writing-domain tables are retained but unused by default, and legacy workflow access remains hard-disabled unless explicitly enabled via `ENABLE_LEGACY_WRITING_WORKFLOW=1`

#### Scenario: Future cleanup execution
- **WHEN** product decides to fully remove legacy writing data
- **THEN** cleanup follows explicit release-note policy (export first, then drop `writing_*` tables) instead of implicit runtime deletion
