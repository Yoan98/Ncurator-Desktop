## 1. 主进程网页导入与抓取

- [x] 1.1 新增网页导入 IPC（ingest-web / ingest-webs）与事件通知
- [x] 1.2 新增网页抓取与正文提取服务（使用 CheerioWebBaseLoader）
- [x] 1.3 实现默认噪声过滤与 include/exclude selectors 配置
- [x] 1.4 为网页导入加入超时、大小上限与并发限制
- [x] 1.5 将网页文本接入现有分段与嵌入流程并写入 chunk 表
- [x] 1.6 写入网页 document 元数据（source_type=web，file_path=URL，name=title/URL）
- [x] 1.7 完善失败处理（错误原因、import_status 更新、可重试）

## 2. 搜索与过滤能力

- [x] 2.1 扩展搜索 IPC 支持来源类型过滤参数（all/file/web）
- [x] 2.2 在混合搜索召回阶段按 source_type 过滤 chunk 候选
- [x] 2.3 确保搜索结果关联的 document 信息可用于网页打开链接

## 3. Preload API 与类型对齐

- [x] 3.1 在 preload 暴露 ingestWeb 与 openExternal（或 openUrl）等接口
- [x] 3.2 更新 shared types 支持网页导入请求与可选 selectors 配置（如需要）

## 4. Renderer 导入 UI

- [ ] 4.1 在导入页新增“网页 URL 导入”入口（支持多行/批量）
- [ ] 4.2 提供 selectors 高级配置（include/exclude）与基础校验（URL 合法性）
- [ ] 4.3 导入状态与文档列表刷新复用现有机制，并展示网页 URL 信息

## 5. Renderer 搜索与预览交互

- [ ] 5.1 在搜索页增加按类型过滤（all/file/web）
- [ ] 5.2 网页类型搜索结果提供“打开链接”交互并避免走文件预览
- [ ] 5.3 文件类型搜索结果保持现有预览流程

## 6. 回归检查

- [ ] 6.1 验证网页导入后可在文档列表看到 web 类型与 URL
- [ ] 6.2 验证网页内容可被混合搜索召回且结果类型标识正确
- [ ] 6.3 验证错误场景（不可访问/超时/解析失败）可见且不影响后续导入
