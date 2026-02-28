# chat-history-memory-v1 Specification

## Purpose
TBD - created by archiving change langgraph-chat-ai-architecture. Update Purpose after archive.
## Requirements
### Requirement: Load bounded recent turns per run
For each run, the host context builder MUST load a bounded number of recent turns from session history.

#### Scenario: Recent-turn limit is enforced
- **WHEN** session message count exceeds configured limit
- **THEN** only the newest bounded turns are included in host context

### Requirement: Maintain compact bounded session summary
The system MUST maintain a compact session summary suitable for inclusion in run prompts.

#### Scenario: Summary participates in host decisions
- **WHEN** host begins analysis for a run
- **THEN** host receives both bounded summary and bounded recent turns

### Requirement: Persist structured memory with generic linked ids
Session memory MUST persist structured fields including summary, open tasks, user preferences, pinned facts, and generic linked document/file ids.

#### Scenario: Memory update persists linked targets
- **WHEN** memory is updated after run completion
- **THEN** linked ids are stored as generic target references rather than writing-document-only ids

### Requirement: Exclude secrets from memory
The system MUST NOT persist API keys, tokens, or credentials in session memory fields.

#### Scenario: Sensitive values are filtered
- **WHEN** memory is generated from run context
- **THEN** sensitive values are excluded from persisted memory

