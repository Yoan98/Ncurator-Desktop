## 1. Storage & Data Model

- [x] 1.1 Add workspace folder and writing document tables to storage layer
- [x] 1.2 Add workflow run table for outline, retrieval plan, citations, and status
- [x] 1.3 Implement CRUD methods for folders and writing documents in main storage
- [x] 1.4 Implement workflow run persistence and retrieval APIs in main storage

## 2. Main Process: Retrieval Scoping

- [x] 2.1 Extend chunk query layer to filter by document IDs
- [x] 2.2 Add IPC API to retrieve document list for "@" suggestions
- [x] 2.3 Add retrieval IPC that supports scoped (selected docs) and global modes
- [x] 2.4 Add serialization for workflow outputs (outline, citations, chunk refs)

## 3. Main Process: LangGraph Writing Workflow

- [x] 3.1 Define LangGraph state schema for writing runs
- [x] 3.2 Implement outline generation node with deterministic stage output
- [x] 3.3 Implement retrieval plan generation node (queries and keywords)
- [x] 3.4 Implement retrieval node using existing hybrid search and scoping
- [x] 3.5 Implement citation selection node and stable citation IDs
- [x] 3.6 Implement markdown draft generation node with citation markers
- [x] 3.7 Add cancellation handling and run registry for active runs
- [x] 3.8 Add IPC endpoints to start, stream progress events, cancel, and fetch run state

## 4. Renderer: Writing Workspace UI

- [x] 4.1 Add routes and navigation entry for the writing workspace
- [x] 4.2 Implement folder tree UI and folder CRUD interactions
- [x] 4.3 Implement document list UI scoped by selected folder
- [x] 4.4 Implement document lifecycle actions (create, rename, delete, move)

## 5. Renderer: Editor & Export

- [x] 5.1 Integrate BlockNote editor for writing documents
- [x] 5.2 Implement markdown import into editor for AI-generated drafts
- [x] 5.3 Add export actions for DOCX and PDF from the editor
- [x] 5.4 Ensure exports reflect the latest editor state and saved content

## 6. Renderer: AI Workflow Experience

- [x] 6.1 Implement writing input with "@" multi-select document suggestions
- [x] 6.2 Add workflow progress UI with stage indicators and streaming updates
- [x] 6.3 Add sources panel to show retrieved documents and chunk excerpts
- [x] 6.4 Add citation inspection UI linking markers to source chunks
- [x] 6.5 Implement error and cancellation UX for in-progress runs
