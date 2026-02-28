## ADDED Requirements

### Requirement: Orchestrate host-led loops with explicit capabilities
The system MUST orchestrate runs with host-led control and capability nodes including `local_kb_retrieval`, `terminal_exec`, and extensible future capabilities.

#### Scenario: Host loops over retrieval
- **WHEN** host determines context is insufficient
- **THEN** it dispatches `local_kb_retrieval` and re-enters analysis until stop conditions are met

### Requirement: Let host choose direct response vs execution plan
The host MUST decide whether to answer directly or create an execution plan after retrieval context is sufficient.

#### Scenario: Informational request
- **WHEN** no executable action is needed
- **THEN** host streams direct response without dispatching execution capabilities

#### Scenario: Action request
- **WHEN** local actions are needed
- **THEN** host emits plan tasks and dispatches capability execution

### Requirement: Require workspace binding for executable runs
The runtime MUST require valid workspace context before executing `terminal_exec` or file-action capabilities.

#### Scenario: Missing workspace for action request
- **WHEN** host attempts to dispatch executable capability without workspace binding
- **THEN** runtime blocks execution and emits explicit workspace-required signal

### Requirement: Use capability registry dispatch and fail fast on unknown kinds
Task dispatch MUST resolve through capability registry and unknown capability kinds MUST fail with explicit errors.

#### Scenario: Unknown task kind
- **WHEN** a plan task references unregistered capability kind
- **THEN** runtime marks task failed with unsupported-capability reason

### Requirement: Host owns final response streaming
The runtime MUST stream final user-facing output from host finalization logic.

#### Scenario: Run completion
- **WHEN** run reaches terminal state
- **THEN** host emits ordered response tokens and response completion event

### Requirement: Support cancellation and fail-fast routing
The runtime MUST stop further execution on cancellation or unrecoverable task failure.

#### Scenario: User cancels active run
- **WHEN** cancel signal arrives during retrieval or capability execution
- **THEN** runtime stops remaining work and emits run-cancelled event
