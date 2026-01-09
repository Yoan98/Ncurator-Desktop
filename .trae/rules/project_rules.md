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
- **Routing**: React Router DOM **v7**
- **UI Kit**: Ant Design **v5**
- **Styling**: Tailwind CSS **v4** + Less
- **UI Design**:
  - **风格**: 极简黑白灰（单色调），主色调为 `#404040`。
  - **排版**: 清晰的无衬线字体（Inter 或 System UI），注重可读性。
  - **布局**: 宽敞的卡片式布局，用于展示搜索结果。
  - **元素**: 
    - 高对比度的边框和按钮。
    - 微妙的阴影以增加深度感。
    - 原生桌面应用的感觉。
  - **主题**: 默认浅色模式，支持深色模式（可选但推荐）。
  - **目标**: 精致、专业的本地知识库美学。

### 后端逻辑 (Main Process)
- **Orchestration**: LangChain JS (Core/Community/TextSplitters)
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

## 3. 数据库设计 (LanceDB)

### Table: `chunk` (文档切片表)
存储文档被切分后的片段及其向量表示。

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `vector` | FixedSizeList (768, Float32) | 文本向量 (Embedding) |
| `text` | Utf8 | 切片文本内容 (建立 FTS 索引) |
| `id` | Utf8 | 切片唯一标识 |
| `document_id` | Utf8 | 关联的文档 ID |
| `document_name` | Utf8 | 文档名称快照 |
| `createdAt` | Int64 | 创建时间戳 |

*索引配置*:
- FTS Index: column `text` (Tokenizer: ngram, min:2, max:3)

### Table: `document` (文档元数据表)
存储原始文档的信息。

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | Utf8 | 文档唯一标识 |
| `name` | Utf8 | 文件名 |
| `sourceType` | Utf8 | 来源类型 (如 'file', 'web') |
| `filePath` | Utf8 (Nullable) | 原始文件路径 |
| `createdAt` | Int64 | 创建时间戳 |

## 4. 编码规范
- **类型安全**: 严禁使用 `any`，必须定义完整的 TypeScript 接口。
- **异步处理**: 文件 I/O 和模型推理必须使用 `async/await`。
- **IPC 通信**: 使用 `ipcMain` / `ipcRenderer` 进行前后端交互。
- **库的使用**: 优先使用上述指定版本的库，避免引入不必要的第三方依赖。
