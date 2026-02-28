## ADDED Requirements

### Requirement: Remove writing-workspace tools from active runtime surface
The active chat runtime MUST NOT expose or execute writing-workspace create/update/search-replace tools.

#### Scenario: Runtime receives file-operation task
- **WHEN** host dispatches a file-operation task in chat mode
- **THEN** runtime uses file-node tooling (for example `docx`) and does not invoke writing-workspace tools

### Requirement: Block legacy writing tool invocation attempts
If legacy writing tools remain in code during transition, invocation attempts from active runtime paths MUST fail with explicit deprecation errors.

#### Scenario: Legacy tool is called by mistake
- **WHEN** a deprecated writing tool is invoked through active runtime flow
- **THEN** system returns explicit deprecation failure and performs no data mutation
