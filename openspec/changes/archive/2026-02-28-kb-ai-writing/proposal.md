## Why

Users need a way to produce long-form articles and structured documents that are grounded in their local knowledge base and can be exported as DOCX/PDF. Today the app can search and generate short answers, but it lacks a guided workflow for outline-first writing, controllable citation scope, transparent citation traceability, and a dedicated writing workspace for saving and editing AI outputs.

## What Changes

- Add a knowledge-base-grounded writing workflow that generates an outline first, then derives retrieval queries/keywords to search local content, and finally produces a markdown draft with explicit citations
- Orchestrate the writing workflow using LangGraph JS so each stage can stream structured progress events and intermediate artifacts to the UI
- Let users constrain citations by selecting one or more local documents via an editor input using "@" mentions; if no documents are selected, retrieval defaults to the entire knowledge base
- Provide a step-by-step progress experience that shows which stage is running and what sources were retrieved, including the specific documents and chunks used for generation
- Introduce a basic writing workspace (folder tree + document list + editor) to persist AI-written articles and allow iterative editing
- Use BlockNote as the editor solution so content can be exported to DOCX and PDF

## Capabilities

### New Capabilities

- `kb-writing-workflow`: Multi-step writing pipeline (outline -> retrieval plan -> retrieval -> markdown draft) grounded in the local knowledge base, orchestrated with LangGraph JS
- `kb-writing-source-selection`: "@" mention-based multi-select of local documents to scope retrieval and citations, with a sensible default of searching the full knowledge base
- `kb-writing-citation-trace`: Capture, display, and persist which documents/chunks were used, and expose them in the UI for transparency and trust
- `writing-workspace`: Minimal Notion-like writing space with folder tree, document list, and saved documents lifecycle (create/rename/move/delete)
- `blocknote-export`: BlockNote-based editor integration for editing generated markdown and exporting to DOCX/PDF

### Modified Capabilities

<!-- none -->

## Impact

- Renderer: new writing workspace screens (folder tree + document list + editor), workflow progress UI, document "@" selector, and citation display UX
- Main process (IPC): implement the workflow as a LangGraph JS graph and expose endpoints to (a) plan retrieval queries/keywords from user intent and outline, (b) retrieve scoped context (all docs or selected docs), and (c) return traceable document/chunk references alongside generated text
- Storage: persist writing documents, folder structure, workflow runs, and citation metadata (document IDs and chunk IDs) while keeping content local-first
- Search: extend existing hybrid search to support document-scoped retrieval without degrading current global search behavior
