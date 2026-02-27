## ADDED Requirements

### Requirement: Restrict writing tools to writing workspace documents
Writing tools MUST only operate on writing workspace persistence (`writing_document` and `writing_folder`) and MUST NOT modify knowledge base documents.

#### Scenario: Attempted modification outside writing workspace
- **WHEN** a writing tool is invoked with a target that is not a writing workspace document
- **THEN** the tool refuses the operation and returns an explicit error

### Requirement: Create writing documents
The system MUST provide a tool to create a new writing document with title, optional folder assignment, and initial content.

#### Scenario: Create a new document
- **WHEN** the writer node invokes the create document tool with a title
- **THEN** the system persists a new writing document and returns its identifier

### Requirement: Update writing document metadata
The system MUST provide a tool to update a writing document title and folder assignment.

#### Scenario: Rename a document
- **WHEN** the writer node invokes the update document tool with a new title
- **THEN** the system updates the document metadata and updates its updated-at timestamp

### Requirement: Apply safe search and replace edits with uniqueness enforcement
The system MUST provide a search-and-replace tool that applies edits only when a single unique match can be located using the provided contextual boundaries.

#### Scenario: Unique match replacement succeeds
- **WHEN** the writer node invokes search-and-replace with before, target, after, and replacement text that match exactly once
- **THEN** the system applies the replacement and returns the updated document content or revision summary

#### Scenario: Match is ambiguous
- **WHEN** the provided context matches multiple locations in the document
- **THEN** the tool returns an explicit error indicating multiple matches and performs no changes

#### Scenario: Match is missing
- **WHEN** the provided context matches zero locations in the document
- **THEN** the tool returns an explicit error indicating no matches and performs no changes
