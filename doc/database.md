# NCurator-Desktop 数据库设计

## 存储与检索

- 存储引擎: LanceDB v0.23
- 全文检索: FTS 基于 `text` 列，Tokenizer 使用 ngram (min:2, max:3)

## 表定义

### 表: chunk（文档切片表）

存储文档被切分后的片段及其向量表示。

| 字段名        | 类型                         | 描述                          |
| :------------ | :--------------------------- | :---------------------------- |
| vector        | FixedSizeList (768, Float32) | 文本向量 (Embedding)          |
| text          | Utf8                         | 切片文本内容（建立 FTS 索引） |
| id            | Utf8                         | 切片唯一标识                  |
| document_id   | Utf8                         | 关联的文档 ID                 |
| document_name | Utf8                         | 文档名称快照                  |
| source_type   | Utf8                         | 来源类型（如 'file', 'web'）  |
| metadata      | Struct                       | 元数据（如页码等）            |
| created_at    | Int64                        | 创建时间戳                    |

索引配置:

- FTS: 列 `text`，Tokenizer: ngram，min:2，max:3

### 表: document（文档元数据表）

存储原始文档的信息。

| 字段名        | 类型             | 描述                                         |
| :------------ | :--------------- | :------------------------------------------- |
| id            | Utf8             | 文档唯一标识                                 |
| name          | Utf8             | 文件名                                       |
| source_type   | Utf8             | 来源类型（如 'file', 'web'）                 |
| file_path     | Utf8（Nullable） | 原始文件路径                                 |
| created_at    | Int64            | 创建时间戳                                   |
| import_status | Int32            | 导入状态（1 导入中，2 导入成功，3 导入失败） |

导入状态取值:

- 1: 导入中
- 2: 导入成功
- 3: 导入失败

### 表: chat_session（对话会话表）

存储用户的对话会话列表。

| 字段名     | 类型  | 描述         |
| :--------- | :---- | :----------- |
| id         | Utf8  | 会话唯一标识 |
| title      | Utf8  | 会话标题     |
| created_at | Int64 | 创建时间戳   |

### 表: chat_message（对话消息表）

存储会话中的每一条消息记录。

| 字段名     | 类型             | 描述                                     |
| :--------- | :--------------- | :--------------------------------------- |
| id         | Utf8             | 消息唯一标识                             |
| session_id | Utf8             | 关联的会话 ID                            |
| role       | Utf8             | 角色（'user', 'assistant', 'system'）    |
| content    | Utf8             | 消息内容                                 |
| timestamp  | Int64            | 消息时间戳                               |
| sources    | Utf8（Nullable） | 引用来源（SearchResult[] 的 JSON 字符串） |
| error      | Boolean          | 是否出错                                 |

### 表: llm_config（大模型配置表）

存储用户配置的 LLM API 信息。

| 字段名     | 类型    | 描述                                       |
| :--------- | :------ | :----------------------------------------- |
| id         | Utf8    | 配置唯一标识                               |
| name       | Utf8    | 配置名称                                   |
| base_url   | Utf8    | API Base URL                               |
| model_name | Utf8    | 模型名称                                   |
| api_key    | Utf8    | API Key                                    |
| is_active  | Boolean | 是否为当前激活配置（通常只有一个为 True）  |

### 表: writing_folder（写作空间文件夹表）

存储写作空间中的文件夹树结构。

| 字段名     | 类型             | 描述                 |
| :--------- | :--------------- | :------------------- |
| id         | Utf8             | 文件夹唯一标识       |
| name       | Utf8             | 文件夹名称           |
| parent_id  | Utf8（Nullable） | 父文件夹 ID（根为空）|
| created_at | Int64            | 创建时间戳           |
| updated_at | Int64            | 更新时间戳           |

### 表: writing_document（写作空间文档表）

存储写作空间中的文档内容与编辑态快照。

| 字段名     | 类型             | 描述                             |
| :--------- | :--------------- | :------------------------------- |
| id         | Utf8             | 文档唯一标识                     |
| title      | Utf8             | 文档标题                         |
| folder_id  | Utf8（Nullable） | 所属文件夹 ID（根目录为空）      |
| content    | Utf8             | 编辑器内容（BlockNote JSON 字符串） |
| markdown   | Utf8（Nullable） | 可选的 Markdown 快照             |
| created_at | Int64            | 创建时间戳                       |
| updated_at | Int64            | 更新时间戳                       |

### 表: writing_workflow_run（写作工作流运行记录表）

存储一次 AI 写作运行的输入、阶段产物与状态。部分字段使用 JSON 字符串持久化结构化数据。

| 字段名              | 类型             | 描述                                     |
| :------------------ | :--------------- | :--------------------------------------- |
| id                  | Utf8             | 运行唯一标识（runId）                    |
| writing_document_id | Utf8（Nullable） | 关联的写作空间文档 ID（可为空）          |
| status              | Utf8             | 运行状态（running/completed/failed/cancelled） |
| input               | Utf8             | 用户输入的写作需求                       |
| outline             | Utf8（Nullable） | 大纲（JSON 字符串）                      |
| retrieval_plan      | Utf8（Nullable） | 检索计划（JSON 字符串）                  |
| retrieved           | Utf8（Nullable） | 检索到的片段列表（JSON 字符串）          |
| citations           | Utf8（Nullable） | 选择的引用列表（JSON 字符串）            |
| draft_markdown      | Utf8（Nullable） | 生成的草稿 Markdown                      |
| error               | Utf8（Nullable） | 失败或取消原因                           |
| created_at          | Int64            | 创建时间戳                               |
| updated_at          | Int64            | 更新时间戳                               |
