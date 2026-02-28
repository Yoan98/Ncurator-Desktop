# writing-workflow-modularization Specification

## Purpose
TBD - created by archiving change refactor-writing-workflow. Update Purpose after archive.
## Requirements
### Requirement: Workflow implementation is modular by stage
The system SHALL implement the writing workflow as a composition of stage node modules, where each stage is defined in a dedicated module and can be referenced by the workflow graph builder.

#### Scenario: Adding a new stage node
- **WHEN** a developer adds a new workflow stage
- **THEN** the stage node implementation can be created in a dedicated module without modifying unrelated stage implementations

### Requirement: Cross-cutting workflow utilities are centralized
The system SHALL provide a shared workflow runtime/context that centralizes cancellation checks, stage lifecycle event emission, persistence updates, and LLM/JSON helper utilities used by stage nodes.

#### Scenario: A stage emits lifecycle events
- **WHEN** a stage node starts, produces output, or completes
- **THEN** the runtime emits standardized `WritingWorkflowEvent` messages with the correct stage ID and payload

### Requirement: Stage IDs and event semantics remain consistent
The system SHALL preserve the existing set of `WritingWorkflowStageId` values and keep the renderer-observed workflow event semantics consistent across the refactor.

#### Scenario: Renderer continues to consume stage output
- **WHEN** a workflow run emits `stage_output` events for existing stage IDs
- **THEN** the renderer can update its UI state using the same stage IDs and payload shapes as before

