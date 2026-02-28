## ADDED Requirements

### Requirement: Evaluate whether pre-planning probing is required
The host runtime MUST evaluate context sufficiency before plan creation and MUST explicitly decide whether to skip or run the context probe stage.

#### Scenario: Context is already sufficient
- **WHEN** user intent can be resolved from input, session history, and currently available run context
- **THEN** runtime marks probe as skipped and proceeds directly to planning/finalization without entering probe execution

### Requirement: Run context probe before creating execution plan
When context is insufficient, the runtime MUST execute a dedicated `context_probe` stage before creating `AiPlanTask[]`.

#### Scenario: Probe is required for uncertain request
- **WHEN** host determines additional evidence is required to choose execution strategy
- **THEN** runtime enters `context_probe`, collects probe outputs, and only then performs plan creation

### Requirement: Restrict probe operations to safe read-only actions
The `context_probe` stage MUST allow retrieval calls and read-only workspace observation only, and MUST reject mutating or boundary-escaping commands.

#### Scenario: Probe proposes a mutating workspace command
- **WHEN** probe execution attempts a command classified as write-side, destructive, or outside workspace boundary
- **THEN** runtime blocks that command, records a probe gap/error, and continues without performing the unsafe action

### Requirement: Keep probing bounded and deterministic
The `context_probe` stage MUST enforce bounded retries/steps/time and MUST terminate with a deterministic probe outcome.

#### Scenario: Probe reaches configured limits before high confidence
- **WHEN** probe budget is exhausted without reaching sufficient confidence
- **THEN** runtime completes probe with unresolved gaps metadata and proceeds to planning using bounded probe output

### Requirement: Use probe-enriched input when generating plan
If probe runs, host planning MUST consume probe evidence and MUST tag planning basis as probe-enriched.

#### Scenario: Planning after successful probe
- **WHEN** probe returns evidence summaries and confidence metadata
- **THEN** host planning prompt/input includes that evidence and sets planning basis to `probe_enriched`
