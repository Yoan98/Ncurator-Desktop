## ADDED Requirements

### Requirement: Disallow explicit `any` in active AI architecture paths
The system MUST prohibit explicit `any` in active AI architecture code paths, including AI runtime, IPC contracts, capability tooling, and chat execution UI consumers.

#### Scenario: New code in governed path uses explicit any
- **WHEN** a change introduces `any` in a governed file
- **THEN** lint/type policy fails the check and the change is blocked until the type is replaced or approved as an exception

### Requirement: Define controlled exception policy for unavoidable dynamic values
The system MUST allow `any` only at explicitly documented interop boundaries and MUST require narrow scope plus justification.

#### Scenario: Boundary exception is needed
- **WHEN** a developer cannot type an external dynamic payload directly
- **THEN** the code records a local justification comment, limits `any` to adapter scope, and narrows to concrete types before business logic usage

### Requirement: Enforce typed cross-process and event contracts
The system MUST define explicit TypeScript interfaces/unions for preload APIs, IPC handler payloads/results, and AI run/tool event payloads.

#### Scenario: IPC or event shape changes
- **WHEN** a contract field is added, renamed, or removed
- **THEN** compile-time checks fail dependent call sites until all producers and consumers are updated to the new typed contract
