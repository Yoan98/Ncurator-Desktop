# NCurator-Desktop 项目规则与指南

## 1. 项目概述
NCurator-Desktop 是一个基于 Electron-Vite 构建的本地知识库搜索应用程序。它专注于隐私和离线能力，通过本地处理文档。
- **目标文件**: PDF (`.pdf`), Word (`.docx`)。
- **核心功能**: 摄入、索引和混合搜索（向量 + 关键词）。

## 2. 技术栈

### 核心 & 桌面
- **运行时**: Electron (主进程负责逻辑，渲染进程负责 UI)。
- **语言**: TypeScript。
- **构建工具**: Electron-Vite。
- **包管理**: pnpm。

### 前端 (渲染器)
- **框架**: React。
- **UI 库**: Ant Design (antd)。
- **样式**: Tailwind CSS + LESS。
- **状态管理**: React Hooks / Context (或用户首选)。

### 后端 / 逻辑 (Node.js / 主进程)
- **文档解析**: `langchain` (JS 版本) 用于解析 PDF 和 DOCX。
- **文本分片**: `langchain` 分片器。
- **向量化**: `@xenova/transformers` (Transformers.js) 用于本地嵌入生成。
- **向量数据库**: `lancedb` 用于本地向量存储。
- **关键词搜索**: `flexsearch` 用于倒排索引和关键词匹配。
- **重排序**: 自定义实现的 RRF (Reciprocal Rank Fusion) 算法。

## 3. 架构与实现流程

### 3.1 数据摄入管道
1.  **解析**: 使用 LangChain JS 加载器从 `.pdf` 和 `.docx` 文件中提取文本。
2.  **分片**: 使用 LangChain 文本分片器将文本分割成可管理的块。
3.  **向量化**:
    - 使用 Transformers.js 为文本块生成嵌入。
    - **模型**:
        - 中文内容: `jinaai/jina-embeddings-v2-base-zh`
        - 英文内容: `nomic-ai/nomic-embed-text-v1`
4.  **存储**:
    - **向量存储**: 将向量和元数据保存到 LanceDB。
    - **倒排索引**: 将文本块索引到 FlexSearch 以进行关键词检索。

### 3.2 搜索管道
1.  **召回 (混合)**:
    - **关键词搜索**: 查询 FlexSearch -> 获取 Top 50 结果。
    - **向量搜索**: 查询 LanceDB (Bi-Encoder) -> 获取 Top 50 结果。
2.  **粗排 (融合)**:
    - 应用 **RRF (Reciprocal Rank Fusion)** 算法对来自两个来源的结果进行合并和排序。
3.  **重排 (未来/优化)**:
    - *注: 目前推迟，但架构应允许实现。*
    - 从 RRF 结果中选择 Top 10-20。
    - 使用 Cross-Encoder (`Xenova/bge-reranker-base`) 进行精细打分。

## 4. 用户配置
- 用户必须能够在设置中选择模型。
- 默认为上述指定的中文/英文推荐模型。

## 5. 编码规范
- **语言**: 始终使用 TypeScript。
- **异步/等待**: 对文件 I/O 和模型推理使用现代异步模式。
- **IPC**: 使用 `ipcMain` and `ipcRenderer` (通过 `preload`) 在 UI 和主进程中的繁重处理逻辑之间进行通信。
- **模块化**: 将解析、索引和搜索逻辑与 UI 组件分离。
- **注释**: 注释复杂的逻辑，特别是 RRF 算法和模型加载步骤。
- **类型**: 禁止使用 `any` 类型，必须使用明确的类型注解。

## 6. AI 交互规则
- 生成代码时，优先考虑技术栈中列出的库。
- 除非明确要求，否则不要建议基于云的 API (OpenAI 等)；专注于本地执行。
- 确保所有繁重的计算（解析、嵌入）都卸载到主进程或 Worker，而不是渲染线程，以保持 UI 响应。
