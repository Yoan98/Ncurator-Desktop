# writing-workflow Specification

## Purpose
TBD - created by archiving change langgraph-chat-ai-architecture. Update Purpose after archive.
## Requirements
### Requirement: Remove legacy writing-workflow interactions from active product flow
The system MUST remove writing-workflow execution from supported chat architecture, MUST not route chat file operations through legacy writing workflow, and MUST not keep residual UI/runtime coupling to legacy writing flow.

#### Scenario: Chat action request does not use legacy workflow
- **WHEN** user requests file editing or generation in chat mode
- **THEN** runtime uses capability nodes (for example `docx`) and does not invoke legacy writing workflow services or run APIs

### Requirement: Remove writing-workflow IPC APIs from supported interface
Legacy writing-workflow IPC endpoints MUST be removed from supported client/preload surface, and direct low-level invocation attempts MUST return explicit unsupported errors without side effects.

#### Scenario: Legacy endpoint is called after decommissioning
- **WHEN** a caller invokes deprecated writing-workflow start/cancel/get channels
- **THEN** the system returns explicit unsupported-legacy-interface failure and no workflow run or event subscription is created

### Requirement: Remove writing-domain persistence from active architecture
Active runtime architecture MUST not depend on `writing_folder`, `writing_document`, or `writing_workflow_run` persistence tables for any chat execution path.

#### Scenario: Runtime dependencies are validated
- **WHEN** AI runtime executes retrieval or file-action tasks
- **THEN** no active runtime path reads from or writes to writing-domain stores/tables

### Requirement: Define migration/cleanup policy for existing writing data
The system MUST define deterministic migration behavior for existing writing-domain data, while keeping active runtime completely detached from legacy writing execution.

#### Scenario: Existing install upgrade
- **WHEN** application upgrades to the new architecture
- **THEN** writing-domain tables remain data-preserving but inactive, and legacy writing workflow stays unavailable in active runtime

#### Scenario: Future cleanup execution
- **WHEN** product decides to remove legacy writing data permanently
- **THEN** cleanup follows explicit release-note policy (export first, then drop `writing_*` tables) instead of implicit runtime deletion

