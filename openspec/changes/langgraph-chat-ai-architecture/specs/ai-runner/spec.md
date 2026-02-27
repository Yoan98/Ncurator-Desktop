## ADDED Requirements

### Requirement: Orchestrate host, retrieval, writer, and answer nodes
The system MUST execute chat runs using a LangGraph state machine with four nodes: host, retrieval, writer, and answer.

#### Scenario: Successful multi-step run
- **WHEN** a user submits a message in chat mode
- **THEN** the system runs host to produce a plan, executes required retrieval and/or writer steps, and finally runs answer

### Requirement: Enforce bounded retry loops per node
The system MUST bound iterative execution loops to prevent unbounded tool calling.

#### Scenario: Retrieval retry limit reached
- **WHEN** the retrieval node evaluates its results as insufficient three times for the same task
- **THEN** the retrieval node reports task failure to the host and the run transitions to answer

#### Scenario: Writer retry limit reached
- **WHEN** the writer node evaluates its output as insufficient five times for the same task
- **THEN** the writer node reports task failure to the host and the run transitions to answer

### Requirement: Fail-fast routing to answer
The system MUST interrupt the remaining plan steps and transition to the answer node when any task is marked as failed.

#### Scenario: Tool execution error
- **WHEN** a tool call throws an execution error during a run
- **THEN** the system marks the active task as failed and runs answer with the failure reason

### Requirement: Support run cancellation
The system MUST allow a run to be cancelled and MUST stop additional tool calls and node execution after cancellation.

#### Scenario: User cancels an active run
- **WHEN** the user triggers cancel for the active run
- **THEN** the system stops execution and emits a cancellation completion signal

### Requirement: Load chat history context for each run
The host node MUST load bounded chat history context (recent turns and session summary) prior to plan generation.

#### Scenario: Host prepares context for planning
- **WHEN** the host node starts a run
- **THEN** it loads recent turns and the session summary and uses them to generate a plan
