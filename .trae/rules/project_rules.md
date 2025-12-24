# NCurator-Desktop 开发指南

## 1. 技术栈与版本
请严格遵守以下核心库及其版本进行开发，以确保代码兼容性：

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
- **Orchestration**: LangChain JS (Core/Community/TextSplitters)
- **Embedding**: @huggingface/transformers **v3** (本地运行)
- **Vector DB**: LanceDB **v0.23**
- **Search Engine**: FlexSearch **v0.8**
- **Storage**: SQLite3 **v5**
- **Parsers**: `pdf-parse` (PDF), `mammoth` (DOCX)

## 2. 核心架构
- **本地优先**: 所有文档处理（解析、嵌入、搜索）均在本地完成，不依赖云端 API。
- **混合搜索**:
  1. **召回**: 同时查询 LanceDB (向量) 和 FlexSearch (关键词)。
  2. **排序**: 使用 **RRF (Reciprocal Rank Fusion)** 算法融合结果。
- **进程模型**:
  - **Main**: 负责繁重的计算（解析、嵌入、数据库操作）。
  - **Renderer**: 仅负责 UI 展示，通过 IPC 通信。

## 3. 编码规范
- **类型安全**: 严禁使用 `any`，必须定义完整的 TypeScript 接口。
- **异步处理**: 文件 I/O 和模型推理必须使用 `async/await`。
- **IPC 通信**: 使用 `ipcMain` / `ipcRenderer` 进行前后端交互。
- **库的使用**: 优先使用上述指定版本的库，避免引入不必要的第三方依赖。
