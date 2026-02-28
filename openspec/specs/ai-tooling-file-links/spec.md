# ai-tooling-file-links Specification

## Purpose
TBD - created by archiving change langgraph-chat-ai-architecture. Update Purpose after archive.
## Requirements
### Requirement: Emit local file artifact metadata
File-operation nodes MUST emit artifact metadata for created/updated local files.

#### Scenario: Artifact metadata emitted after save
- **WHEN** a file-operation task writes output
- **THEN** runtime emits artifact metadata including local path and operation summary

### Requirement: Provide main-process local file open actions
The system MUST provide IPC actions to open local file artifacts using system capabilities.

#### Scenario: Open default app
- **WHEN** user chooses open action on an artifact
- **THEN** main process opens the file with the system default app

#### Scenario: Reveal in folder
- **WHEN** user chooses reveal action on an artifact
- **THEN** main process reveals file location in system file manager

### Requirement: Handle open-with behavior as platform-dependent
The system SHOULD expose open-with chooser behavior where platform support exists and MUST fail gracefully where it does not.

#### Scenario: Unsupported open-with platform
- **WHEN** user requests open-with on unsupported platform/runtime
- **THEN** system returns explicit unsupported-action error without crashing the run or UI

