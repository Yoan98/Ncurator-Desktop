## ADDED Requirements

### Requirement: User can select citation scope using "@" document mentions
The system MUST allow the user to select one or more local documents as the citation scope using "@" mentions in the writing input.

#### Scenario: Select multiple documents
- **WHEN** the user types "@" in the writing input and selects multiple documents from the suggestion list
- **THEN** the system MUST include the selected document identifiers in the workflow input state

### Requirement: Default citation scope is the entire knowledge base
The system MUST default the citation scope to the entire knowledge base when the user selects no documents.

#### Scenario: Run without explicit selection
- **WHEN** the user starts a writing run without selecting any documents
- **THEN** the system MUST retrieve sources from the full knowledge base

### Requirement: Selected documents constrain retrieval results
The system MUST constrain retrieval so that only chunks belonging to selected documents are eligible for citation when a selection is provided.

#### Scenario: Retrieval is filtered by selected documents
- **WHEN** the user starts a writing run with selected documents
- **THEN** the system MUST only retrieve and cite chunks whose document identifier is in the selected document set

### Requirement: UI shows the active citation scope
The system MUST display which documents are currently selected as citation scope for a writing run.

#### Scenario: Display selected scope before running
- **WHEN** the user has selected one or more documents via "@" mentions
- **THEN** the system MUST show the selected documents in the input area prior to starting generation
