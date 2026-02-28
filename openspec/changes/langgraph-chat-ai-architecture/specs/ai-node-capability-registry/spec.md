## ADDED Requirements

### Requirement: Provide registry-based capability dispatch
The runtime MUST use a capability registry to map plan task kinds to executable handlers.

#### Scenario: Registered capability dispatch
- **WHEN** host emits a task for `local_kb_retrieval` or `terminal_exec`
- **THEN** runtime dispatches to the corresponding registered handler

### Requirement: Support placeholder capabilities
The registry MUST support placeholder capabilities (for example `docx` before implementation) with explicit structured placeholder results.

#### Scenario: Placeholder capability selected
- **WHEN** host dispatches `docx` before concrete implementation is available
- **THEN** runtime returns explicit `not_implemented` task result instead of silent success/failure

### Requirement: Keep registry open for future node families
Capability registration MUST allow adding capabilities like `excel` without rewriting host loop control.

#### Scenario: New capability added
- **WHEN** engineering registers a new capability kind
- **THEN** runtime can execute that kind via registry wiring only

### Requirement: Fail fast on unknown capabilities
Unknown capability kinds MUST fail with explicit structured errors.

#### Scenario: Unregistered kind in plan
- **WHEN** task kind has no registry binding
- **THEN** runtime marks task failed and emits failure reason
