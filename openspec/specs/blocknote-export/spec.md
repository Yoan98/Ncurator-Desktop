# blocknote-export Specification

## Purpose
TBD - created by archiving change kb-ai-writing. Update Purpose after archive.
## Requirements
### Requirement: Writing editor uses BlockNote for content editing
The system MUST provide a BlockNote-based editor for writing documents in the writing workspace.

#### Scenario: Edit document content
- **WHEN** the user opens a writing document
- **THEN** the system MUST render the document content in the BlockNote editor and allow editing

### Requirement: Editor supports exporting to DOCX
The system MUST allow the user to export a writing document to DOCX format from the editor.

#### Scenario: Export to DOCX
- **WHEN** the user triggers "Export DOCX" for the current writing document
- **THEN** the system MUST generate and save a DOCX file representing the current editor content

### Requirement: Editor supports exporting to PDF
The system MUST allow the user to export a writing document to PDF format from the editor.

#### Scenario: Export to PDF
- **WHEN** the user triggers "Export PDF" for the current writing document
- **THEN** the system MUST generate and save a PDF file representing the current editor content

### Requirement: Export reflects the current editor state
The system MUST export the latest editor content, including changes not present in the original AI draft.

#### Scenario: Export after edits
- **WHEN** the user edits content and then exports to DOCX or PDF
- **THEN** the exported file MUST reflect the current editor content at the time of export

