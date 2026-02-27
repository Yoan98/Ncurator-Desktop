## ADDED Requirements

### Requirement: Emit run lifecycle events
The system MUST emit an execution event stream for each run with start, completion, failure, and cancellation signals.

#### Scenario: Run completes successfully
- **WHEN** the run reaches a successful end state
- **THEN** the system emits a run completed event for the run id

#### Scenario: Run fails
- **WHEN** any task is marked failed with a failure reason
- **THEN** the system emits a run failed event including the failure reason

### Requirement: Emit plan and task progress events
The system MUST emit a structured plan event and MUST emit task lifecycle events as tasks start, complete, or fail.

#### Scenario: Plan is created
- **WHEN** the host node finalizes a plan for the run
- **THEN** the system emits a plan created event containing the plan structure

#### Scenario: Task progress is visible
- **WHEN** a task starts and later completes
- **THEN** the system emits task started and task completed events with the task identifier

### Requirement: Emit tool call step events
The system MUST emit tool call started and tool call result events for each tool invocation executed by the runtime.

#### Scenario: Tool call is executed
- **WHEN** a node invokes a tool with inputs
- **THEN** the system emits a tool call started event and later emits a tool call result event with a safe preview of the output

### Requirement: Stream answer tokens as events
The system MUST stream final answer text as incremental tokens and MUST signal completion of the answer stream.

#### Scenario: Answer streaming for UI rendering
- **WHEN** the answer node generates the final response
- **THEN** the system emits answer token events in order and emits an answer completed event at the end

### Requirement: Correlate events to runs and steps
Every event MUST include the run identifier and MUST include sufficient fields to associate the event to a plan step, task, or tool call when applicable.

#### Scenario: UI can group events by task
- **WHEN** the UI receives events for a run
- **THEN** it can group tool call events under the active task using the provided identifiers
