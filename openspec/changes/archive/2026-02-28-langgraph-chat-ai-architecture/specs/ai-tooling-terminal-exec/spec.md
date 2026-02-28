## ADDED Requirements

### Requirement: Accept raw command strings for terminal capability tasks
`terminal_exec` MUST accept raw command strings as task input from host planning.

#### Scenario: Raw command task input
- **WHEN** host dispatches a terminal task with command text
- **THEN** terminal capability executes using that raw command input under sandbox policy

### Requirement: Run capability-local command loops
`terminal_exec` MUST be able to execute multiple iterative command steps within a single task until done or bounded limits are reached.

#### Scenario: Multi-step terminal objective
- **WHEN** one command output indicates additional command steps are required
- **THEN** terminal capability continues its internal loop within configured limits

### Requirement: Enforce bounded loop controls
`terminal_exec` MUST enforce max-step, timeout, and output-size limits.

#### Scenario: Loop exceeds max steps
- **WHEN** internal command loop reaches configured step limit
- **THEN** terminal task fails with explicit loop-limit reason

### Requirement: Enforce sandbox risk policy and approvals
`terminal_exec` MUST classify command risk and require approval for policy-protected operations.

#### Scenario: High-risk command detected
- **WHEN** command classification requires approval
- **THEN** terminal capability emits approval-required signal and does not execute until approved

### Requirement: Emit terminal step trace events
`terminal_exec` MUST emit structured per-step events for command start/result/error.

#### Scenario: Terminal step trace
- **WHEN** command step executes
- **THEN** event stream includes correlated step events with safe output preview
