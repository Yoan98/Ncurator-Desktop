---
name: local-database
description: 当涉及到分析本地数据库时需要阅读该文档对数据库的设计规则
---

# NCurator-Desktop 数据库设计

## 存储与检索
- 存储引擎: LanceDB v0.23
- 全文检索: FTS 基于 `text` 列，Tokenizer 使用 ngram (min:2, max:3)

## 表定义

### 表: chunk（文档切片表）
存储文档被切分后的片段及其向量表示。

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| vector | FixedSizeList (768, Float32) | 文本向量 (Embedding) |
| text | Utf8 | 切片文本内容（建立 FTS 索引） |
| id | Utf8 | 切片唯一标识 |
| document_id | Utf8 | 关联的文档 ID |
| document_name | Utf8 | 文档名称快照 |
| createdAt | Int64 | 创建时间戳 |

索引配置:
- FTS: 列 `text`，Tokenizer: ngram，min:2，max:3

### 表: document（文档元数据表）
存储原始文档的信息。

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| id | Utf8 | 文档唯一标识 |
| name | Utf8 | 文件名 |
| sourceType | Utf8 | 来源类型（如 'file', 'web'） |
| filePath | Utf8（Nullable） | 原始文件路径 |
| createdAt | Int64 | 创建时间戳 |
| importStatus | Int32 | 导入状态（1 导入中，2 导入成功，3 导入失败） |

导入状态取值:
- 1: 导入中
- 2: 导入成功
- 3: 导入失败