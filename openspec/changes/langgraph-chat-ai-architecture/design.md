## Context

The current migration is incomplete for the new target architecture:

- Runtime still carries writing-era assumptions (`writer` task shape, legacy writing paths).
- Retrieval node naming and semantics do not clearly distinguish local KB retrieval.
- There is no dedicated terminal execution capability that the host can invoke for local operations.
- Execution lacks an explicit workspace-first gate and unified sandbox policy model.
- `docx` support is needed as an architectural capability, but concrete implementation should come later.

The intended architecture is:

1. Host-led context building via `local_kb_retrieval` loops.
2. Host decision: direct response vs. execution plan.
3. Capability execution through extensible nodes (`terminal_exec`, `docx`, future `excel`).
4. Mandatory workspace binding for executable operations.
5. Policy-controlled sandbox + approval gating for risky commands/actions.

## Goals / Non-Goals

**Goals**

- Establish canonical node/capability set: `host`, `local_kb_retrieval`, `terminal_exec`, `docx` (placeholder), and future `excel`.
- Make `terminal_exec` accept raw command strings and run its own bounded internal loop.
- Require workspace selection before executable runs and enforce workspace-root boundaries.
- Introduce explicit sandbox and approval policies integrated into runtime events.
- Provide clear execution transparency in chat with inline activities and plan visualization.
- Reserve `docx` extension points with Node.js-first constraints, without implementing docx editing now.
- Remove writing-workflow interactions and writing-domain persistence from active runtime architecture.

**Non-Goals**

- Implementing concrete docx editing behavior in this change.
- Implementing excel operations in this change.
- Supporting arbitrary unrestricted shell execution outside workspace policy.
- Preserving long-term backward compatibility for deprecated writing workflow APIs.

## Decisions

### 1) Runtime shape: host-centric orchestration with named capabilities

**Decision**

Runtime orchestration centers on host decisions and capability dispatch:

- `host` analyzes request and current context.
- `local_kb_retrieval` performs local KB retrieval operations.
- `terminal_exec` handles raw command execution tasks.
- `docx` is registered as capability placeholder (not implemented in this change).
- future `excel` uses same registry model.

Flow:

- Host may iterate with `local_kb_retrieval` until context is sufficient.
- Host then either:
  - streams direct response, or
  - emits execution plan and dispatches capability tasks.

There is no separate mandatory answer node responsibility.

### 2) Retrieval node semantics: `local_kb_retrieval`

**Decision**

Rename retrieval capability/node semantics to `local_kb_retrieval` to clarify scope and avoid confusion with file-system search through terminal commands.

**Rationale**

- Keeps KB retrieval intent explicit.
- Allows terminal capability to independently perform file-system searches when needed by host plan.

### 3) `terminal_exec` capability: raw command input + internal loop

**Decision**

`terminal_exec` accepts raw command strings as task input and executes through internal loop logic:

- evaluate command request
- policy check (sandbox + risk classification)
- execute command
- inspect output
- decide next command or finish

Guardrails:

- bounded command count per task
- per-command timeout/output limits
- policy classification (read-only / write / delete / external/network-sensitive)
- approval gate for non-trivial-risk operations

**Rationale**

- Matches desired flexibility for practical local automation.
- Keeps orchestration simple: host delegates a terminal objective, capability node handles iterative command execution.

### 4) Workspace-first execution model

**Decision**

Executable runs must bind a user-selected workspace before `terminal_exec` or file-operation capabilities can run.

Workspace contract includes at least:

- `workspaceId`
- `rootPath`
- policy profile (risk defaults / allowed capabilities)

Rules:

- command execution cwd must be workspace root or approved subpath.
- path operations must remain within normalized workspace boundary.
- missing workspace => runtime emits required-input signal and blocks execution path.

**Rationale**

- Prevents accidental system-wide command impact.
- Gives users explicit control over action scope and output location.

### 5) Sandbox + approval policy

**Decision**

Sandbox policy is enforced by capability runtime (especially `terminal_exec`) and surfaced in events:

- low-risk commands can auto-run by policy.
- medium/high risk commands require approval.
- denied approvals fail task with explicit reason.

Event additions include approval request/decision and terminal step trace.

### 6) Docx capability positioning (Node.js-first, deferred implementation)

**Decision**

`docx` is included as capability interface/contract only in this change:

- registered in capability map
- can be planned/selected by host
- returns structured `not_implemented` until implementation lands

Implementation constraints for next phase:

- Node.js ecosystem only
- no Python runtime or user-side extra toolchain requirement
- reuse same workspace/sandbox/approval framework

**Rationale**

- Preserves architecture continuity for future file nodes.
- Avoids blocking current architecture refactor on complex docx implementation details.

### 7) Decommission writing-workflow surfaces

**Decision**

Remove writing-workflow interactions and writing-domain persistence from active architecture:

- no active runtime dependency on writing workflow/store paths
- no supported chat path through writing workflow endpoints
- database/docs updated to reflect decommissioned writing-domain usage

### 8) Execution transparency UX contract

**Decision**

Execution visibility is represented in two coordinated UI layers:

- **Inline activity feed** attached to assistant-side chat content to answer "what AI did" in plain language.
- **Plan panel** showing task progress and expandable step-level trace details.

The event protocol exposes raw trace events and UI-friendly activity events so renderer can render both layers without brittle inference.

**Rationale**

- Improves user trust and comprehension for command-heavy runs.
- Preserves deep observability for debugging while keeping casual UX readable.

## Risks / Trade-offs

- **Raw terminal commands increase risk surface**
  - Mitigation: strict workspace boundary, risk policy, approval gate, bounded loops/timeouts.
- **User friction from mandatory workspace selection**
  - Mitigation: remember last workspace per session and support quick workspace switch.
- **Deferred docx implementation may confuse expectations**
  - Mitigation: explicit capability status events and clear UI messaging (`not implemented yet`).
- **Policy tuning complexity**
  - Mitigation: start conservative; allow profile-based iteration.

## Migration Plan

1) Introduce updated capability taxonomy (`local_kb_retrieval`, `terminal_exec`, `docx` placeholder).
2) Add workspace binding requirements to run-start contract and UI flow.
3) Add sandbox + approval policy engine and terminal capability event traces.
4) Refactor runtime orchestration to host-led retrieval loops + capability dispatch.
5) Remove writing-workflow active paths and writing-domain runtime dependencies.
6) Validate end-to-end with workspace-gated execution scenarios.

## Open Questions

- Should workspace be mandatory for all runs, or only when host predicts execution beyond pure KB Q&A?
- Which command categories are auto-allowed in v1 policy profile?
- Should terminal loop allow host mid-course intervention, or remain fully capability-local per task?
