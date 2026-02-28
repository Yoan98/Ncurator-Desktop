# ai-workspace-sandbox Specification

## Purpose
TBD - created by archiving change langgraph-chat-ai-architecture. Update Purpose after archive.
## Requirements
### Requirement: Require workspace binding for executable actions
Executable runs MUST bind to a user-selected workspace before terminal or file-action capabilities can run.

#### Scenario: Workspace missing
- **WHEN** run requires execution capability and workspace is absent
- **THEN** runtime emits workspace-required signal and blocks execution

### Requirement: Enforce workspace root boundaries
Sandbox execution MUST constrain command cwd and file paths within workspace root boundaries.

#### Scenario: Path escape attempt
- **WHEN** command or file action attempts to access path outside workspace root
- **THEN** runtime rejects the step with explicit sandbox-boundary error

### Requirement: Provide policy-based approval gating
Sandbox policy MUST support risk tiers and approval-required actions.

#### Scenario: Protected action requires user approval
- **WHEN** command/action matches medium/high-risk policy
- **THEN** runtime emits approval-required event and waits for decision

### Requirement: Persist/resolve workspace metadata for runs
The system MUST provide workspace metadata required for runtime validation (at minimum id and root path).

#### Scenario: Run start with workspace id
- **WHEN** run-start request contains workspace id
- **THEN** runtime resolves workspace metadata before task execution

