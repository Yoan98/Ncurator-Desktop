## ADDED Requirements

### Requirement: Provide dedicated retrieval tools
The system MUST provide dedicated tools for local retrieval across the knowledge base and writing workspace.

#### Scenario: Retrieval agent selects a tool
- **WHEN** the retrieval node needs context to satisfy a plan step
- **THEN** it can invoke a tool for knowledge base chunk search, knowledge base document listing, or writing workspace document search

### Requirement: Support hybrid, vector, and FTS retrieval for knowledge base chunks
The system MUST provide tools that execute hybrid search, vector-only search, and FTS-only search over knowledge base chunks.

#### Scenario: Hybrid search returns ranked chunks
- **WHEN** the retrieval tool is called with a query text
- **THEN** the tool returns a bounded list of chunk results ranked by relevance

### Requirement: Support knowledge base document table search
The system MUST provide a tool to list knowledge base documents filtered by a keyword.

#### Scenario: User requests documents by name
- **WHEN** the retrieval node calls the document listing tool with a keyword
- **THEN** the tool returns documents whose names match the keyword

### Requirement: Support writing workspace document discovery and read access
The system MUST provide tools to list writing workspace documents, search writing workspace documents by keyword, and fetch a writing document by id.

#### Scenario: Resolve a writing document mention
- **WHEN** the host or retrieval node has a referenced writing document id
- **THEN** the tool returns the writing document record for downstream planning or editing

### Requirement: Return safe, bounded retrieval results
Retrieval tools MUST return bounded results and MUST provide fields suitable for both LLM consumption and UI rendering.

#### Scenario: Large result sets are constrained
- **WHEN** a retrieval tool could return more than the configured limit
- **THEN** it returns at most the configured limit and provides a preview suitable for UI display
