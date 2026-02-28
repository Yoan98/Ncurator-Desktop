# type-ownership-layering Specification

## Purpose
TBD - created by archiving change refactor-type-governance. Update Purpose after archive.
## Requirements
### Requirement: Shared contracts SHALL have a single canonical ownership layer
The system MUST define all cross-process contracts (IPC requests/responses/events and shared domain entities) in the shared layer only, and MUST prevent duplicate business contract definitions in main or renderer layers.

#### Scenario: A cross-process contract is changed
- **WHEN** a shared contract field is added, removed, or renamed
- **THEN** producers and consumers MUST reference the shared contract definition and compile-time checks MUST surface any outdated local duplicates

### Requirement: Main and Renderer SHALL keep internal-only type boundaries
The system MUST allow main-internal runtime/orchestration types only in main type modules and renderer view-state types only in renderer type modules, and MUST NOT treat these as cross-process contract sources.

#### Scenario: Renderer introduces a local view model field
- **WHEN** a renderer component adds a UI-only state field
- **THEN** the field MUST remain in renderer-local type definitions and MUST NOT alter shared IPC contract types unless cross-process behavior changes

### Requirement: Preload API typing SHALL be single-source
The system MUST treat preload-exported API typing as the canonical source for `window.api`, and renderer global declarations MUST reference that source rather than duplicating endpoint signatures.

#### Scenario: IPC endpoint signature evolves
- **WHEN** preload API method parameters or return shape changes
- **THEN** renderer API typing MUST update through the shared preload type source and duplicate manual endpoint declarations MUST NOT be required

