## ADDED Requirements

### Requirement: Emit run lifecycle events
The system MUST emit run lifecycle events for start, completion, failure, and cancellation.

#### Scenario: Run lifecycle visibility
- **WHEN** a run starts and completes
- **THEN** the stream includes correlated lifecycle events for the same run id

### Requirement: Emit plan and task progression events
The system MUST emit events for plan creation and task state transitions.

#### Scenario: Task state transitions
- **WHEN** tasks start/complete/fail
- **THEN** stream includes task lifecycle events with task ids

### Requirement: Emit tool and terminal step events
The system MUST emit step-level events for capability tool calls and terminal command steps.

#### Scenario: Terminal command step execution
- **WHEN** `terminal_exec` runs a command step
- **THEN** stream includes command-step started/result/error events with safe previews

### Requirement: Emit UI-friendly activity events
The system MUST emit normalized activity events that describe user-visible AI actions for inline assistant-side rendering.

#### Scenario: Activity feed rendering
- **WHEN** runtime performs meaningful actions (read docs, run command, create/delete files, etc.)
- **THEN** stream includes activity events with status, action type, and concise human-readable summary

### Requirement: Emit workspace/approval gating events
The system MUST emit explicit events when workspace binding or approval is required for continued execution.

#### Scenario: Workspace is required
- **WHEN** executable task is planned without workspace binding
- **THEN** stream includes workspace-required event before execution is blocked

#### Scenario: Approval is required
- **WHEN** policy classifies a command/action as approval-gated
- **THEN** stream includes approval-required event and later approval-decision event

### Requirement: Emit final response stream events
The system MUST emit incremental final response tokens and completion signal for host-finalized output.

#### Scenario: Final response streaming
- **WHEN** host emits final user-facing response
- **THEN** token and completion events are emitted in order

### Requirement: Emit file artifact events
The system MUST emit file artifact metadata events for created/updated local outputs.

#### Scenario: Artifact produced
- **WHEN** terminal/docx capability writes output artifact
- **THEN** stream includes artifact metadata for UI linking and open actions

### Requirement: Keep event correlation stable
All events MUST include fields required to correlate by run and related task/step/artifact entities.

#### Scenario: UI grouping
- **WHEN** UI receives mixed run events
- **THEN** it can deterministically group and render execution trace without heuristic matching
