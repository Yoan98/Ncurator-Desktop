## Context

The app is a local-first knowledge base on Electron. The Main process performs heavy compute and IO (ingestion, embeddings, LanceDB operations) and exposes capabilities through IPC. The Renderer focuses on UI and triggers operations via IPC.

Current relevant capabilities:

- Knowledge base search: Main process provides `search` (hybrid search with RRF), `fts-search`, `vector-search`, plus `list-documents` and `list-chunks`. Results are chunk-level and can be mapped to document metadata.
- AI answer generation exists in the Renderer (OpenAI-compatible streaming) for chat/search Q&A, but there is no dedicated long-form writing workflow, no transparent multi-step progress, and no persisted writing workspace.

This change introduces a guided, knowledge-grounded article writing workflow that:

- Generates an outline first and a retrieval plan (queries/keywords) to maximize recall from the local KB
- Retrieves context from either (a) selected documents or (b) the entire KB by default
- Produces markdown output with traceable citations (documents and chunks)
- Persists generated content into a basic writing workspace and supports export to DOCX/PDF via BlockNote

The workflow orchestration MUST use LangGraph JS to enable explicit stage modeling, streaming progress events, cancellation, and persistence of intermediate artifacts (outline, retrieval queries, retrieved chunks, citations).

Constraints:

- Local-first: no cloud storage of user content or KB artifacts
- The UI must communicate the process clearly, including which stage is running and what was cited
- Avoid Modal static APIs in UI flows; use context-based antd patterns or custom components

## Goals / Non-Goals

**Goals:**

- Provide a LangGraph-orchestrated, multi-step writing workflow: outline -> retrieval plan -> retrieval -> draft generation (markdown)
- Allow users to scope citations by selecting multiple local documents via "@" mentions; when none selected, search across the whole KB
- Stream structured progress to the UI and show retrieved sources (documents + chunk excerpts) during generation
- Persist writing documents in a minimal workspace (folder tree + document list + editor)
- Use BlockNote as the editor solution and enable exporting to DOCX and PDF

**Non-Goals:**

- Building a full Notion clone (permissions, collaboration, database tables, complex blocks, templates, sharing)
- Advanced retrieval tuning (custom rerankers beyond existing RRF, per-user learned ranking, online evaluation)
- Automatic citation verification beyond source traceability (e.g., factual consistency checks) in the first iteration
- Multi-knowledge-base management (this design assumes the current single local KB)

## Decisions

### Use LangGraph JS for workflow orchestration

Decision: Implement the writing pipeline as a LangGraph JS graph running in the Main process.

Rationale:

- Stage-first modeling fits the product requirement to show real-time progress and intermediate artifacts.
- Graph execution provides a natural place for cancellation, retries, and checkpointing intermediate results.
- Centralizing the workflow in Main aligns with the app's process model (heavy compute, DB access, retrieval).

Alternatives considered:

- Ad-hoc sequential functions in Renderer: simplest but hard to maintain, weak observability, harder to stream structured progress, and not aligned with Main/Renderer split.
- LangChain chains without LangGraph: workable for linear flows but less explicit for state, branching, and resumability.

### Workflow graph structure and state

Decision: Define a single graph with explicit nodes and a shared typed state that is serializable for persistence.

Proposed nodes:

- `validate_input`: normalize user request, selected document IDs, and generation settings
- `generate_outline`: produce outline + section goals based on user request
- `generate_retrieval_plan`: output search queries, keywords, and filters derived from the request + outline
- `retrieve_context`: run retrieval against LanceDB (scoped by selected documents or full KB)
- `select_citations`: choose a limited, diverse set of chunks per outline section and build a citation map
- `generate_markdown_draft`: generate markdown draft with required citation markers bound to the citation map

State shape (conceptual):

- `runId`, `createdAt`, `status`
- `input`: user request, language/length preferences, selectedDocumentIds
- `outline`: title, sections (id, heading, bullet points, target length)
- `retrievalPlan`: queries[], keywords[], perSectionQueries?, sourceScope
- `retrieved`: chunks[] (chunkId, documentId, documentName, text, metadata, scores)
- `citations`: entries[] (citationId, chunkId, documentId, label)
- `draft`: markdown string, citationAnchors[], warnings[]
- `telemetry`: timings, token counts (best-effort)

### Streaming progress events over IPC

Decision: Stream progress from Main to Renderer using a dedicated event channel keyed by `runId`.

Rationale:

- The UI requirement is to show step-by-step progress and display retrieved sources as soon as they are available.

Event schema (conceptual):

- `run_started`: includes runId and initial input snapshot
- `stage_started`: stageId, label
- `stage_output`: stageId, partial payload (outline, retrievalPlan, retrieved chunks, citations, partial markdown)
- `stage_completed`: stageId
- `run_completed`: final markdown + citation map summary
- `run_failed`: error message + stageId (if available)
- `run_cancelled`

Cancellation:

- Provide an IPC endpoint that marks a run as cancelled; the graph runner checks cancellation between nodes and aborts generation promptly.

### Retrieval scoping by selected documents

Decision: Extend the Main search layer to support an optional list of `documentIds` as a filter for chunk retrieval.

Rationale:

- The product requires "@" multi-select of local documents to constrain citations.
- The current search APIs filter only by `source_type`, which is insufficient for document-level scoping.

Approach:

- Add an optional `documentIds?: string[]` filter to the hybrid search path.
- Translate the filter into a LanceDB query condition on the chunk table: `document_id IN (...)`.
- Keep the default behavior unchanged when no documentIds are provided.

Alternatives considered:

- Post-filtering results in memory: simpler but can drop recall and wastes compute, especially when the KB grows.

### Editor and export strategy

Decision: Use BlockNote for editing and exporting, with markdown as the interchange format from the workflow.

Rationale:

- The workflow output is markdown; BlockNote can render and edit rich content while preserving export capabilities to DOCX/PDF.
- Keeps the first iteration focused: generate markdown -> import into editor -> user refines -> export.

Alternatives considered:

- Building a custom markdown editor: more control but higher implementation cost and weaker export story.

### Persistence model (minimal workspace)

Decision: Add separate storage for writing workspace entities distinct from the KB `document` table.

Entities (conceptual):

- Folder: `id`, `name`, `parentId`, `createdAt`, `updatedAt`
- Writing document: `id`, `title`, `folderId`, `content` (BlockNote JSON and/or markdown), `createdAt`, `updatedAt`
- Workflow run: `runId`, `writingDocumentId?`, `input`, `outline`, `retrievalPlan`, `citations`, `retrievedChunkRefs`, `status`, `createdAt`

Rationale:

- The KB `document` table represents ingested sources. Writing documents are user-authored artifacts and need independent lifecycle and organization.

## Risks / Trade-offs

- Citation hallucination (model cites sources not in retrieved set) -> Enforce a strict prompt contract to only cite from provided citation IDs; validate citations server-side before finalizing output.
- Context overflow and token limits -> Apply chunk caps, per-section chunk selection, and progressive generation (section-by-section) if needed.
- Retrieval quality varies across topics -> Use outline-derived retrieval plan to increase recall; show retrieved sources so users can adjust scope or add documents via "@".
- Streaming complexity and cancellation edge cases -> Use a run registry in Main with explicit states; ensure cancellation checks between graph nodes and before LLM calls.
- Export fidelity differences between markdown and DOCX/PDF -> Treat BlockNote content as the source of truth after import; document that final export matches editor content.

## Migration Plan

- Add new IPC endpoints for writing workflow runs (start, stream events, cancel, get run state).
- Extend search implementation to support optional documentId scoping for retrieval.
- Add storage tables for workspace folders, writing documents, and workflow runs.
- Add Renderer routes/pages for the writing workspace and integrate BlockNote editor.
- Ship behind a feature toggle until basic stability is confirmed; rollback by disabling the routes and IPC entry points (data remains local and can be ignored).

## Open Questions

- Should draft generation be section-by-section (better control and citations) or single-pass (simpler UX) for the first iteration?
- What is the minimal citation UX that balances trust and readability: inline markers only, or inline markers plus a dedicated “Sources” panel?
- Should workflow runs be resumable after app restart (requires checkpointing), or is restart a fresh run acceptable for v1?
