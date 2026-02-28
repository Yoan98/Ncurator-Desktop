## ADDED Requirements

### Requirement: Emit explicit probe lifecycle events
The runtime MUST emit dedicated probe lifecycle events for start, completion, and skip paths, with run-level correlation metadata.

#### Scenario: Probe stage executes
- **WHEN** runtime enters and exits `context_probe`
- **THEN** event stream includes probe lifecycle events in order with `runId`, timestamps, and stage outcome

### Requirement: Publish structured probe evidence summaries
Probe result events MUST include structured evidence summaries rather than free-form-only text so downstream consumers can reason deterministically.

#### Scenario: Probe completes with mixed evidence
- **WHEN** probe gathers retrieval hits and workspace observations
- **THEN** completion payload includes normalized evidence entries with source type, compact summary, and bounded preview fields

### Requirement: Include confidence and unresolved gaps in probe outcomes
Probe completion payloads MUST include confidence and unresolved information gaps for planning and UI transparency.

#### Scenario: Probe confidence is low
- **WHEN** probe cannot gather enough evidence within configured bounds
- **THEN** completion payload includes low-confidence marker and explicit unresolved gaps list

### Requirement: Expose planning basis in run events
After probe decision, runtime MUST expose whether planning used history-only context or probe-enriched context.

#### Scenario: Plan creation after probe decision
- **WHEN** host starts planning
- **THEN** run events/state include planning basis value of `history_only` or `probe_enriched`

### Requirement: Keep probe event extension backward compatible
Probe event failures or unsupported event handling in Renderer MUST NOT fail the run execution path.

#### Scenario: Renderer does not yet consume probe events
- **WHEN** probe events are emitted to an older consumer
- **THEN** runtime execution still completes and existing run/task/tool event semantics remain intact
