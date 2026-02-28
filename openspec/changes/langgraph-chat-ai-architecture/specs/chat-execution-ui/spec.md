## ADDED Requirements

### Requirement: Provide imported-document `@` targeting in chat
The chat UI MUST provide `@` selection from imported documents and send selected ids with run input.

#### Scenario: Mention suggestions
- **WHEN** user types `@` in chat input
- **THEN** suggestions come from imported KB documents

### Requirement: Require workspace selection for executable runs
The chat UI MUST collect/select workspace context before starting runs that require terminal or file-execution capabilities.

#### Scenario: Workspace missing on action request
- **WHEN** user sends prompt that requires execution and no workspace is selected
- **THEN** UI presents workspace selection flow before execution continues

### Requirement: Show inline AI activity feed in assistant side
The chat UI MUST show a user-readable inline activity feed under assistant content describing what AI did (for example read docs, ran commands, created/deleted files).

#### Scenario: Inline activity visibility
- **WHEN** runtime emits activity events during execution
- **THEN** assistant-side UI displays ordered activity items with status and short summaries

### Requirement: Render explicit plan UI with progress
The chat UI MUST render a dedicated plan view showing plan steps, current step, and progress state.

#### Scenario: Plan progress updates
- **WHEN** runtime emits plan and task lifecycle events
- **THEN** UI updates plan progress indicators and active/completed/failed step states in real time

### Requirement: Support expandable step details
The plan UI MUST allow users to expand/collapse per-step details including tool/terminal traces and outputs.

#### Scenario: User expands completed step
- **WHEN** user opens a completed step in plan UI
- **THEN** UI shows associated detailed traces without losing summary visibility

### Requirement: Support approval and workspace-required interaction events
The UI MUST render actionable prompts for approval-required and workspace-required events.

#### Scenario: Approval prompt shown
- **WHEN** runtime emits approval-required event
- **THEN** UI shows approve/deny actions and submits decision to runtime

### Requirement: Render retrieval and artifact panels
The right panel MUST show retrieval outputs and file artifact entries with open actions.

#### Scenario: Artifact interaction
- **WHEN** artifact events arrive
- **THEN** UI shows artifact links and supports open default/reveal/open-with actions with error feedback
