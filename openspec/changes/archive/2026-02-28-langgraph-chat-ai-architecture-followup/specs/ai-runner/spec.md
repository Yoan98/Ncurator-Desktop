## MODIFIED Requirements

### Requirement: Orchestrate host-led loops with explicit capabilities
The system MUST orchestrate runs with host-led control and capability nodes including `local_kb_retrieval`, `terminal_exec`, and extensible future capabilities, and MUST exclude legacy writing-workflow task models from active dispatch.

#### Scenario: Host loops over retrieval
- **WHEN** host determines context is insufficient
- **THEN** it dispatches `local_kb_retrieval` and re-enters analysis until stop conditions are met

#### Scenario: Legacy writing task shape appears in plan
- **WHEN** plan parsing encounters legacy writing-workflow task kind or payload shape
- **THEN** runtime rejects the task as unsupported legacy capability and continues only with valid capability-based tasks

### Requirement: Require workspace binding for executable runs
The runtime MUST require valid workspace context before executing `terminal_exec` or file-action capabilities and MUST keep this gate independent from any legacy writing-workflow state.

#### Scenario: Missing workspace for action request
- **WHEN** host attempts to dispatch executable capability without workspace binding
- **THEN** runtime blocks execution and emits explicit workspace-required signal

### Requirement: Use capability registry dispatch and fail fast on unknown kinds
Task dispatch MUST resolve through capability registry, unknown capability kinds MUST fail with explicit errors, and deprecated legacy writing kinds MUST be treated as unsupported.

#### Scenario: Unknown task kind
- **WHEN** a plan task references unregistered capability kind
- **THEN** runtime marks task failed with unsupported-capability reason

#### Scenario: Deprecated writer kind
- **WHEN** a plan task references legacy writer-oriented kind
- **THEN** runtime marks task failed with unsupported-legacy-capability reason and does not invoke writing-domain runtime paths
