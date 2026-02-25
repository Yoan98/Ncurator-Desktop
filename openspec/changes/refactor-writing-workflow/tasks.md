## 1. Workflow Module Structure

- [x] 1.1 Create workflow module directory layout under writing service
- [x] 1.2 Define workflow internal types and shared context interface

## 2. Runtime and Node Extraction

- [x] 2.1 Implement workflow runtime/context utilities (events, cancellation, persistence, LLM, JSON parsing)
- [x] 2.2 Extract each workflow stage into a dedicated node module
- [x] 2.3 Ensure node outputs and persisted fields match current behavior

## 3. Graph Wiring and Service Integration

- [x] 3.1 Implement graph builder module that registers nodes and edges
- [x] 3.2 Refactor WritingWorkflowService to invoke the graph builder and runtime
- [x] 3.3 Verify IPC handler and renderer continue to function without changes

## 4. Verification

- [x] 4.1 Run lint and typecheck and fix any introduced issues
