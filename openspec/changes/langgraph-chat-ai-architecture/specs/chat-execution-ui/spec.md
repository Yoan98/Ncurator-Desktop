## ADDED Requirements

### Requirement: Provide a single chat input with writing document mentions
The chat UI MUST provide a single input field and MUST support `@` mention selection limited to writing workspace documents.

#### Scenario: Mention is restricted to writing documents
- **WHEN** the user types `@` in the chat input
- **THEN** the UI suggests only writing workspace documents and never suggests knowledge base documents

### Requirement: Visualize plan, tasks, and tool steps in chat
The chat UI MUST render the execution trace including the plan, per-task status, and per-tool call steps.

#### Scenario: Task steps are visible during execution
- **WHEN** the runtime emits plan, task, and tool call events
- **THEN** the UI renders a task list with nested tool steps as they occur

### Requirement: Support collapsible task groups with live state
The chat UI MUST allow task groups to be collapsed and MUST show live progress state for running and completed tasks.

#### Scenario: User collapses completed tasks
- **WHEN** tasks complete and the user collapses a task group
- **THEN** the UI preserves the ability to expand and review tool steps for that task

### Requirement: Render a right-side context panel driven by run state
The chat UI MUST render a right-side panel that switches between retrieval results and writing workspace views based on runtime state updates.

#### Scenario: Retrieval results are displayed
- **WHEN** the runtime emits retrieval tool results or state patches with result lists
- **THEN** the right panel displays a retrieval results list component

#### Scenario: Writing operations are displayed
- **WHEN** the runtime emits writer tool events indicating a create or edit operation
- **THEN** the right panel displays a writing component that can show document lists and the active document editor
