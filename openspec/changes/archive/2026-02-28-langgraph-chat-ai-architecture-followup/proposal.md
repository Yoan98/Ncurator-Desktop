## Why

The previous `langgraph-chat-ai-architecture` change is marked complete, but the codebase still contains residual writing-era surfaces and loose typing that conflict with the intended architecture boundaries. A focused follow-up is needed now to fully decommission legacy write paths, enforce explicit TypeScript typing, and make AI architecture guidance discoverable and mandatory in daily development.

## What Changes

- Remove residual legacy write surfaces from active product code:
  - Remove legacy writing UI entry points and related renderer interaction paths.
  - Remove or hard-retire backend writing workflow runtime paths and deprecated IPC handlers.
  - Remove active dependencies on writing-domain persistence (`writing_*` tables/workflow records) from current AI runtime flow.
- Replace broad `any` usage in AI-related and affected shared code with explicit types/interfaces:
  - Define concrete domain types for IPC payloads, runtime events, tool inputs/outputs, and storage mapping results.
  - Add guardrail rules into the agent guidance so `any` is disallowed by default and only used with explicit, documented justification.
- Add an AI architecture reference document under `doc/` and wire it into development workflow:
  - Introduce a dedicated AI architecture doc for the current LangGraph-based chat architecture and capability boundaries.
  - Add a new skill (similar to `Database`) that requires reading this document when tasks involve AI architecture.
  - Update `AGENTS.md` to include the new “read AI architecture doc when AI architecture is involved” rule.

## Capabilities

### New Capabilities
- `type-safety-any-governance`: project-level policy and implementation rules that minimize `any` usage and require explicit typed contracts for AI-related modules.
- `ai-architecture-reference-doc`: centralized AI architecture documentation in `doc/` with a matching skill trigger for architecture-sensitive tasks.

### Modified Capabilities
- `writing-workflow`: tighten decommissioning from “unsupported/hard-disabled” intent to full removal of residual active code paths and runtime dependencies.
- `ai-runner`: enforce strict separation so active run execution does not reference legacy writing workflow models, payloads, or storage assumptions.
- `chat-execution-ui`: remove remaining legacy write UI couplings and ensure UI only reflects current capability-based execution model.

## Impact

- Main process:
  - Cleanup in writing-related services and IPC handlers to eliminate legacy workflow execution surface.
  - Type definition additions/refactors in AI runtime, tools, IPC contracts, and storage-domain mapping.
- Renderer:
  - Remove legacy write entry/UI logic that no longer belongs to active architecture.
  - Update related page/service types to avoid `any` in event/payload handling.
- Storage/database:
  - Ensure active architecture code no longer depends on `writing_folder`, `writing_document`, or `writing_workflow_run` runtime paths.
  - Keep migration strategy explicit if physical tables remain for compatibility.
- Documentation/agent workflow:
  - Add `doc/` AI architecture reference.
  - Add a dedicated skill and update `AGENTS.md` usage rules to require this doc for AI-architecture-related work.
