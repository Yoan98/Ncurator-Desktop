## ADDED Requirements

### Requirement: The system records cited documents and chunks for each run
The system MUST record which documents and chunks were used as citations for each writing workflow run.

#### Scenario: Persist citation trace after generation
- **WHEN** a writing run completes successfully
- **THEN** the system MUST persist a citation trace that includes document identifiers and chunk identifiers

### Requirement: The UI can display cited sources during generation
The system MUST make retrieved sources available to the UI during generation, including document metadata and chunk excerpts.

#### Scenario: Show retrieved sources in real time
- **WHEN** the workflow completes retrieval
- **THEN** the system MUST stream a list of retrieved chunks with associated document information to the UI

### Requirement: Generated markdown references citations by stable identifiers
The system MUST represent citations in the generated markdown using stable citation identifiers that map to recorded chunk references.

#### Scenario: Draft contains citation markers
- **WHEN** the system produces a markdown draft
- **THEN** the draft MUST include citation markers that reference citation identifiers present in the persisted citation trace

### Requirement: User can inspect a citation's source content
The system MUST allow the user to inspect the underlying chunk content for a citation from within the writing UI.

#### Scenario: Open citation details
- **WHEN** the user selects a citation marker or a source entry in the sources panel
- **THEN** the system MUST display the referenced document name and the chunk excerpt content
