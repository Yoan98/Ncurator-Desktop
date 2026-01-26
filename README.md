# NCurator-Desktop

**NCurator-Desktop** 是一个本地优先、注重隐私的知识库搜索应用程序。它允许您使用先进的混合搜索技术对 PDF 和 Word 文档进行索引和搜索——所有操作均在本地机器上运行，无需将数据上传到云端。

## 主要功能

- **本地处理**: 所有文档解析、向量化和存储都在本地进行。您的数据永远不会离开您的设备。
- **格式支持**: 支持索引 PDF (`.pdf`) 和 Word (`.docx`) 文档。
- **混合搜索**: 结合了关键词搜索 (FlexSearch) 的精确性和向量搜索 (LanceDB) 的语义理解能力。
- **高级排序**: 使用 **RRF (Reciprocal Rank Fusion)** 融合来自不同搜索算法的结果，以获得更高的准确性。
- **模型选择**: 在不同语言下选择不同的嵌入模型以获得最佳性能。

## 技术栈

本项目使用：

- **核心**: Electron, Node.js
- **前端**: React, TypeScript, Ant Design, Tailwind CSS
- **AI & 数据**:
  - **解析**: LangChain.js
  - **嵌入**: Transformers.js (`@xenova/transformers`)
  - **向量数据库**: LanceDB
  - **关键词搜索**: FlexSearch
  - **重排序**: RRF 算法 (未来支持 Cross-Encoders)

## 架构概览

### 数据摄入

1.  **解析**: 使用 LangChain 提取文件文本。
2.  **分片**: 将文本分割成语义块。
3.  **向量化**: 使用本地模型 (`jina-embeddings-v2-base-zh` 或 `nomic-embed-text-v1`) 将文本块转换为向量。
4.  **存储**: 将向量保存到 LanceDB，并使用 FlexSearch 建立倒排索引。

### 搜索流程

1.  **召回**: 从向量搜索和关键词搜索中分别检索前 50 个结果。
2.  **融合**: 使用倒帕累托等级融合 (RRF) 合并结果。
3.  **展示**: 向用户展示最相关的文本块。
    _(未来: 使用 `bge-reranker-base` 对前几名结果进行重排)_

## 快速开始

### 先决条件

- Node.js (推荐 v18+)
- pnpm 或 npm

### 安装

```bash
# 安装依赖
npm install
# 或者
pnpm install
```

### 开发

```bash
# 运行开发模式
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run build
```

## 配置

应用程序支持为不同语言配置不同的模型：

- **中文**: `jinaai/jina-embeddings-v2-base-zh`
- **英文**: `nomic-ai/nomic-embed-text-v1`
- **重排序**: `Xenova/bge-reranker-base` (计划中)

## 许可证

[MIT](LICENSE)
