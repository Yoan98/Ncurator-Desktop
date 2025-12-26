---
trigger: always_on
---

---
trigger: always_on
---

# NCurator-Desktop 开发指南

## 1. 技术栈与版本
请严格遵守以下核心库及其版本，保持技术栈的统一与精简：

### 核心环境
- **Runtime**: Electron **v39**
- **Language**: TypeScript **v5**
- **Build**: Electron-Vite **v5**
- **Package Manager**: pnpm

### 前端 (Renderer)
- **Framework**: React **v19**
- **UI Kit**: Ant Design **v5**
- **Styling**: Tailwind CSS **v4** + Less

### 后端逻辑 (Main Process)
- **Orchestration**: LangChain JS
- **Embedding**: @huggingface/transformers **v3** (本地运行)
- **Unified Storage**: LanceDB **v0.23**
  - **功能**: 承担向量存储、全文检索(FTS/Inverted Index)、结构化元数据存储。
  - **注意**: **已移除** SQLite 和 FlexSearch，**严禁**再次引入。
- **Parsers**: `pdf-parse` (PDF), `mammoth` (DOCX)

## 2. 核心架构
- **Local First (本地优先)**:
  - 所有数据处理（解析、Embedding、索引）与存储均在本地完成。
  - 确保完全离线可用，不依赖外部 API。

- **Unified Storage Strategy (统一存储策略)**:
  - **Single Source of Truth**: 所有应用数据（文档内容、Embedding、元数据）均存储于 LanceDB。
  - **Hybrid Search**: 利用 LanceDB 同时进行语义搜索 (Vector) 和 关键词搜索 (FTS)，并在检索层进行结果融合 (如 RRF)。

- **Process Model (进程模型)**:
  - **Main Process**: 处理重计算任务（File I/O, NLP, LanceDB 操作）。
  - **Renderer Process**: 专注于 UI/UX，禁止直接进行数据库或文件系统操作。
  - **IPC**: 使用 `ipcMain.handle` 和 `contextBridge` 进行类型安全的双向通信。

## 3. 编码规范 (AI 提示)
- **Type Safety**: 必须为所有数据结构定义 TypeScript 接口，禁止显式 `any`。
- **Async/Await**: 所有数据库与文件操作必须异步。
- **Error Handling**: 后端错误需捕获并转化为前端可读的格式。
- **Dependency Discipline**: 严格限制依赖，所有存储与检索需求仅使用 LanceDB 实现。