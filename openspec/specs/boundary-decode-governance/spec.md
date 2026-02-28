# boundary-decode-governance Specification

## Purpose
TBD - created by archiving change refactor-type-governance. Update Purpose after archive.
## Requirements
### Requirement: Untrusted dynamic input SHALL enter through typed boundary decoders
The system MUST accept untrusted dynamic values (`unknown`) only at boundary adapter entry points (such as IPC ingress, database raw rows, model outputs, and JSON parse results), and MUST decode them to explicit domain types before business logic usage.

#### Scenario: Database query returns a raw row object
- **WHEN** a storage domain method receives raw row data from the database client
- **THEN** the method MUST pass the raw value through a boundary decoder and return a typed domain object to callers

### Requirement: Unknown values SHALL be narrowed within local adapter scope
The system MUST require narrowing of `unknown` within the same adapter/module scope where it is introduced, and MUST NOT propagate unconstrained `unknown` into domain services or UI state models.

#### Scenario: JSON payload is parsed from text
- **WHEN** code parses JSON from a string at a process boundary
- **THEN** the parsed value MUST be narrowed in that adapter scope before it is returned or forwarded to domain logic

### Requirement: Explicit any SHALL require documented exception handling
The system MUST prohibit `any` by default and SHALL allow it only when stricter typing is infeasible, with mandatory local justification and immediate narrowing in the same code block.

#### Scenario: Third-party library exposes non-typable payload
- **WHEN** a boundary adapter must temporarily use `any` for a third-party dynamic payload
- **THEN** code MUST include a concise justification comment, constrain scope to that adapter block, and convert to explicit typed structures before exiting the block

### Requirement: Undocumented double assertions SHALL be disallowed
The system MUST disallow undocumented `as unknown as` double assertions in active code paths, and any unavoidable use MUST include rationale and a tracked replacement direction.

#### Scenario: Double assertion appears in a storage mapper
- **WHEN** code review or lint checks detect `as unknown as` without justification
- **THEN** the change MUST be rejected until the assertion is replaced with decoder-based narrowing or documented under the exception policy

