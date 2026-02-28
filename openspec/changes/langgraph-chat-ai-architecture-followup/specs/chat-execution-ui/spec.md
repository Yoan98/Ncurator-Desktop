## MODIFIED Requirements

### Requirement: Require workspace selection for executable runs
The chat UI MUST collect/select workspace context before starting runs that require terminal or file-execution capabilities, and MUST not fall back to legacy writing-workflow UI paths.

#### Scenario: Workspace missing on action request
- **WHEN** user sends prompt that requires execution and no workspace is selected
- **THEN** UI presents workspace selection flow before execution continues

### Requirement: Render explicit plan UI with progress
The chat UI MUST render a dedicated capability-based plan view showing plan steps, current step, and progress state, without any legacy writing-workflow stage visualization.

#### Scenario: Plan progress updates
- **WHEN** runtime emits plan and task lifecycle events
- **THEN** UI updates plan progress indicators and active/completed/failed step states in real time

### Requirement: Support expandable step details
The plan UI MUST allow users to expand/collapse per-step details including tool/terminal traces and outputs, using typed event payloads from active architecture contracts.

#### Scenario: User expands completed step
- **WHEN** user opens a completed step in plan UI
- **THEN** UI shows associated detailed traces without losing summary visibility

## ADDED Requirements

### Requirement: Remove legacy writing entry points from chat execution surface
The chat execution surface MUST not expose legacy writing-workflow actions, buttons, or IPC-triggering affordances.

#### Scenario: Chat page renders execution controls
- **WHEN** user opens chat execution UI
- **THEN** only active capability-based controls are shown and no legacy writing workflow action is available
