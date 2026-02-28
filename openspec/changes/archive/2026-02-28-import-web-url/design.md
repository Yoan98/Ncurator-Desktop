## Context

当前应用的数据摄入以“文件”为核心：Renderer 通过 IPC 调用主进程 `ingest-file / ingest-files`，主进程完成文件落盘、解析、分段、嵌入、写入 LanceDB（chunk 向量+FTS、document 元数据），并通过 `search / hybrid-search` 等 IPC 提供检索能力。搜索结果会在主进程侧把 chunk 结果关联 document 元数据以便 UI 展示。

现状约束与特点：

- 本地优先：抓取、解析、嵌入、索引均在本地完成
- 进程分工：Main 承担重计算/IO；Renderer 仅做展示与交互，通过 IPC 触发导入与搜索
- 数据模型：document 表包含 `id/name/source_type/file_path/created_at/import_status`；chunk 表包含 `text/vector/document_id/document_name/source_type/metadata(page)/created_at`
- UI 已具备 source_type 展示与过滤雏形（文件/网页），但缺少“网页导入入口”、缺少“网页结果打开链接”等完整链路

本变更需要补齐“网页 URL 导入 → 进入统一索引 → 搜索可召回 → UI 区分与交互”的闭环，并在抓取正文时尽量过滤无用标签/噪声内容。

## Goals / Non-Goals

**Goals:**

- 增加网页 URL 导入能力，主进程支持抓取网页并生成可索引的正文文本
- 在抓取逻辑中使用 `@langchain/community` 的 `CheerioWebBaseLoader` 作为网页加载器
- 提供“噪声过滤”能力：默认过滤常见无用区域，并支持按站点配置 include/exclude selectors 来稳定提取正文
- 网页内容进入与文件一致的分段、嵌入、向量索引与全文索引流程
- 搜索与文档列表在 UI 中区分网页/文件，并对网页提供“打开链接”交互
- 支持按来源类型过滤搜索结果（仅文件/仅网页/全部）

**Non-Goals:**

- 递归爬取整站、跟随链接、站点地图导入（v1 仅导入用户提供的 URL 列表）
- 渲染 JavaScript 后才出现内容的 SPA 抓取（不引入 headless browser）
- 需要登录/鉴权的网页抓取
- 去重/增量更新的内容级 diff（v1 以“重新导入刷新”为主）

## Decisions

### 1) 导入入口与 IPC 形态

新增独立 IPC：`ingest-web`（以及可选的批量 `ingest-webs`），由 Renderer 传入 URL 与可选的抓取规则（include/exclude selectors）。

与现有 `ingest-file(s)` 一致的行为约束：

- 先写入 document 记录并标记 `import_status = 1`
- 后台抓取、分段、嵌入、写入 chunks
- 成功后更新 `import_status = 2`；失败更新为 `3` 并返回可读错误
- 完成/失败均触发 document-list-refresh 以更新 UI

### 2) 网页抓取与正文提取（CheerioWebBaseLoader + 过滤策略）

主进程新增网页加载能力，核心流程：

1. 使用 `CheerioWebBaseLoader(url)` 抓取网页并产出初始 `Document[]`
2. 对抓取结果执行正文清洗：
   - 默认排除：`script/style/noscript/nav/header/footer/aside/form` 等噪声区域对应的文本
   - 支持配置：
     - include selectors：用于“只保留正文容器”（如 `article`, `main`, `.post-content`）
     - exclude selectors：用于在正文容器内进一步移除噪声节点（如目录、推荐、评论区）
   - 文本规范化：合并多余空白、去除重复空行、裁剪过短片段

实现上优先采用“选择正文容器（include）+ 清理噪声节点（exclude + 默认黑名单）+ 提取纯文本”的组合，避免仅靠分词/规则对纯文本做后处理导致噪声残留。

### 3) 与现有分段/嵌入/入库管线复用

为降低改动面，网页导入复用现有的 `IngestionService.splitDocuments`、`EmbeddingService.embed`、`UnifiedStore.addChunks`，使网页与文件进入同一检索表（chunk）并享受相同的混合检索与融合排序能力。

网页切片元数据处理：

- chunk 的 `metadata.page` 对网页固定为 `1`（与文件页码语义区分）
- `source_type` 在 document 与 chunk 均写入 `web`

### 4) 网页来源元数据的落库策略（避免 LanceDB schema 迁移）

目前 document 表 schema 已固化且初始化逻辑未实现自动迁移。为避免引入“表结构迁移/重建导致数据丢失”的复杂度，v1 采用“复用现有字段”的策略落库网页来源信息：

- `document.name`：优先使用网页标题（title），若不可得则回退为 URL
- `document.file_path`：对网页类型复用为 URL（对 file 类型仍为本地文件路径）
- `document.source_type`：`web`
- `created_at`：导入时间戳，可视作 `fetchedAt`

该映射保证：

- 搜索结果通过已存在的“chunk → document 关联”即可拿到 URL，用于 UI 打开链接
- 不需要立即修改 LanceDB 表 schema，即可满足“可搜索、可展示、可交互”的闭环

后续若需要严格区分 `file_path` 与 `url`，再引入 schema 迁移与显式字段（见 Open Questions）。

### 5) 搜索过滤（source_type）

在主进程搜索逻辑中增加可选的来源类型过滤参数：

- 当 filter=web/file 时，在 chunk 检索阶段优先通过 where 条件限制 `source_type`
- 当 filter=all 时保持现有行为

这样可保证过滤发生在召回前，减少无效候选并提升性能与一致性。

### 6) UI 区分与交互

Renderer 侧补齐两类能力：

- 导入：在导入页新增 URL 导入方式（单条/多条），并可配置 include/exclude selectors（可选高级配置）
- 展示：
  - 文档列表继续使用类型 Tag 区分 file/web；对 web 类型展示 URL（复用 document.file_path）并提供“打开链接”
  - 搜索结果保持 file/web 标签展示；点击 web 结果时改为打开链接（而不是打开文件预览），file 结果仍走现有预览逻辑

打开链接由主进程通过 `shell.openExternal(url)` 执行（Renderer 通过 IPC 请求），以符合 Electron 安全模型。

## Risks / Trade-offs

- [网页正文提取不稳定] → 默认黑名单 + include/exclude selectors 可配置，并允许用户针对站点微调
- [SPA/动态渲染页面抓不到正文] → 明确 v1 不支持；后续可引入 headless browser 作为可选实现
- [复用 file_path 存 URL 语义不完美] → 换取“无需 schema 迁移”的落地速度；后续可演进为显式 url 字段
- [抓取性能与资源占用] → 设置超时/内容大小上限/并发限制，并在 UI 展示失败原因便于重试

## Migration Plan

v1 不修改 LanceDB 表结构，不需要数据迁移：

- 对 `source_type=web` 的 document，`file_path` 存 URL，`name` 存 title/URL
- chunk 表结构不变，`metadata.page` 固定 1

若后续引入 `url/title/fetched_at` 等显式字段，需要新增表结构迁移策略（例如：新建 v2 表并复制旧数据，或提供“一键重建索引/重置数据库”入口）。

## Open Questions

- `CheerioWebBaseLoader` 的输出是否包含足够的信息用于按 selector 精确过滤？若仅产出纯文本，是否需要额外拉取 HTML 用于更精准的节点移除
- URL 导入的 UI 交互形态：简洁模式（仅 URL 列表）与高级模式（selectors 配置）的默认展示策略
- 过滤维度是否要扩展到“文档列表/搜索结果统一过滤组件”，以及是否要在 IPC 层统一 filter 参数命名与行为
