## ADDED Requirements

### Requirement: Load bounded recent turns per run
For each run, the system MUST load a bounded number of recent user/assistant turns from the session message history and include them in the host planning context.

#### Scenario: History loading stays bounded
- **WHEN** a session contains more messages than the configured recent-turn limit
- **THEN** the system loads only the most recent turns up to the limit

### Requirement: Maintain a compact session summary
The system MUST maintain a compact per-session summary that is bounded in size and suitable for inclusion in every run prompt.

#### Scenario: Summary is used for planning
- **WHEN** the host node constructs its planning context
- **THEN** it includes the current session summary and recent turns

### Requirement: Update summary after successful runs
The system MUST update the session summary after a run completes successfully.

#### Scenario: Summary is refreshed on completion
- **WHEN** a run completes
- **THEN** the system generates and stores an updated compact summary for the session

### Requirement: Store structured memory fields
The system MUST store the session memory as structured fields including summary text, open tasks, user preferences, pinned facts, and linked writing document identifiers.

#### Scenario: Memory fields are persisted
- **WHEN** the session memory is updated
- **THEN** the system persists the structured memory object associated with the session id

### Requirement: Exclude secrets from stored memory
The system MUST NOT store secrets or model credentials in session memory.

#### Scenario: Sensitive fields are not persisted
- **WHEN** the system updates session memory
- **THEN** it excludes API keys, tokens, and other secrets from persisted memory fields
