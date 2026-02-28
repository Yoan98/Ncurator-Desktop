# NCurator-Desktop（Codex 项目规则）

> 说明：本文件用于让 Codex 在后续生成/修改代码时遵循本项目的约束与约定。

## 1. 技术栈与版本

请严格遵守以下核心库及其版本进行开发，以确保代码兼容性：

### 核心环境

- **Runtime**: Electron **v39**
- **Language**: TypeScript **v5**
- **Build**: Electron-Vite **v5**
- **Package Manager**: pnpm

### 前端 (Renderer)

- **Framework**: React **v19**
- **Routing**: React Router DOM **v7**
- **UI Kit**: Ant Design **v5**
- **Styling**: Tailwind CSS **v4** + Less

### 后端逻辑 (Main Process)

- **Orchestration**: LangChain JS (Core/Community/TextSplitters) + LangGraph JS
- **Embedding**: @huggingface/transformers **v3** (本地运行)
- **Vector DB**: LanceDB **v0.23** (兼作向量搜索与全文搜索)
- **Search Engine**: LanceDB FTS (Native Full-Text Search)
- **Storage**: LanceDB (基于 Apache Arrow)
- **Parsers**: `pdf-parse` (PDF), `mammoth` (DOCX)
- **Tokenization**: `@node-rs/jieba` (中文分词)

## 2. 核心架构

- **本地优先**: 所有文档处理（解析、嵌入、搜索）均在本地完成，不依赖云端 API。
- **混合搜索**:
  1. **召回**: 同时利用 LanceDB 的向量搜索和 FTS 全文搜索。
  2. **排序**: 使用 **RRF (Reciprocal Rank Fusion)** 算法融合结果。
- **进程模型**:
  - **Main**: 负责繁重的计算（解析、嵌入、数据库操作）。
  - **Renderer**: 仅负责 UI 展示，通过 IPC 通信。

## 3. 文档引用

当涉及到数据库时，请阅读 `doc/database.md`  
当涉及到 AI 架构（LangGraph 运行图、能力节点、事件流、工作区沙箱）时，请阅读 `doc/ai-architecture.md`  
当涉及到 UI 样式时，请阅读 `doc/ui-style.md`

### 数据库操作约束（Main Process）

- 数据库表结构与索引以 `src/main/services/storage/core/LanceDbCore.ts` 的 `getTableConfigs()` 为准
- 业务代码不要直接操作 LanceDB 连接/表；新增/修改数据库行为优先通过 `src/main/services/storage/StorageService.ts` 暴露的各 `*Store`

## 4. TypeScript `any` 使用规范

- 默认禁止使用 `any`，优先使用明确接口、联合类型、泛型和 `unknown + type guard`。
- IPC 边界、模型输出、外部库动态数据优先先收敛为 `unknown`，再在适配层中窄化。
- 仅当确实无法避免时，允许局部使用 `any`，但必须满足：
  1. 作用域最小化（仅限单个适配函数/局部变量）。
  2. 在同一代码块内完成显式窄化，不得把 `any` 扩散到业务层。
  3. 添加简短注释说明原因与后续可替换方向。

## 5. UI/UX 注意事项

- **禁用 Modal.confirm**: 由于兼容性问题，项目中禁止使用 `Modal.confirm`、`Modal.info` 等静态方法。请使用 ContextHolder 方式或者自定义组件替代。
- **全局提示**: 涉及全局状态（如模型下载提示）的通知，应使用全局组件（如悬浮组件）在 `App.tsx` 或 `MainLayout` 中统一处理，避免在每个页面重复逻辑。
