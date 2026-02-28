## ADDED Requirements

### Requirement: Provide local knowledge-base retrieval tools for `local_kb_retrieval`
The system MUST provide retrieval tools for local KB search (hybrid/vector/FTS/document listing) used by `local_kb_retrieval`.

#### Scenario: Retrieval strategy selection
- **WHEN** host dispatches `local_kb_retrieval`
- **THEN** the capability can use hybrid/vector/FTS retrieval tools and return bounded evidence

### Requirement: Support imported-document scoping
Retrieval tools MUST support filtering by user-selected imported document ids when provided.

#### Scenario: Scoped retrieval
- **WHEN** run context contains selected document ids
- **THEN** retrieval results are constrained to selected documents by default policy

### Requirement: Keep retrieval and terminal file search concerns separate
`local_kb_retrieval` tooling MUST focus on KB storage retrieval and MUST NOT be required to implement shell-based filesystem search behaviors.

#### Scenario: Host needs filesystem command search
- **WHEN** host decides shell/file-system search is required
- **THEN** host dispatches `terminal_exec` capability rather than overloading KB retrieval tools

### Requirement: Return bounded, safe payloads for model and UI
Retrieval tools MUST return bounded counts and safe preview fields.

#### Scenario: Large match set
- **WHEN** matches exceed configured limits
- **THEN** tool returns capped results and preview-safe payloads
