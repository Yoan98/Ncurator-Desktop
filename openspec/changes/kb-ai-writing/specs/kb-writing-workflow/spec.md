## ADDED Requirements

### Requirement: User can run a knowledge-grounded writing workflow
The system MUST allow the user to start an AI writing run that is grounded in the local knowledge base and produces a markdown draft suitable for editing and export.

#### Scenario: Start a workflow run
- **WHEN** the user submits a writing request from the writing workspace
- **THEN** the system MUST create a new workflow run and begin execution

### Requirement: The writing workflow is orchestrated with LangGraph JS
The system MUST orchestrate the writing workflow using LangGraph JS, with explicit stages and a shared execution state.

#### Scenario: Execute stages deterministically
- **WHEN** a workflow run is executed
- **THEN** the system MUST execute the stages in a defined order: outline generation, retrieval plan generation, retrieval, and markdown draft generation

### Requirement: The workflow produces intermediate artifacts for user review
The system MUST produce intermediate artifacts including an outline and a retrieval plan that are available to the UI during the run.

#### Scenario: Outline and retrieval plan are available during execution
- **WHEN** the workflow completes outline generation and retrieval plan generation
- **THEN** the system MUST provide the outline and retrieval plan to the UI before draft generation completes

### Requirement: The workflow provides structured progress events
The system MUST stream structured progress events that indicate the current stage and allow the UI to show real-time workflow progress.

#### Scenario: UI receives stage progress
- **WHEN** the workflow transitions between stages or produces stage outputs
- **THEN** the system MUST emit progress events that include the run identifier and stage identifier

### Requirement: User can cancel a running workflow
The system MUST allow the user to cancel an in-progress workflow run and stop further generation steps.

#### Scenario: Cancel an active run
- **WHEN** the user requests cancellation for a running workflow
- **THEN** the system MUST stop execution as soon as possible and report the run as cancelled
