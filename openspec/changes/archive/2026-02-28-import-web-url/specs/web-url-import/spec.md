## ADDED Requirements

### Requirement: 支持以 URL 作为导入数据源
系统 MUST 允许用户在导入流程中提供一个或多个网页地址（URL），并将每个 URL 作为一个可导入的数据源处理。

#### Scenario: 导入一个网页地址
- **WHEN** 用户在导入界面填写一个合法的网页 URL 并开始导入
- **THEN** 系统 MUST 创建一个网页类型的导入任务并开始抓取该 URL 的内容

### Requirement: 使用 CheerioWebBaseLoader 抓取并生成可索引文本
系统 MUST 在主进程使用 `@langchain/community` 的 `CheerioWebBaseLoader` 从 URL 抓取页面内容，并将抓取结果转换为可用于分段、嵌入与全文索引的纯文本内容。

#### Scenario: 抓取并生成文本
- **WHEN** 系统开始处理一个网页 URL 导入任务
- **THEN** 系统 MUST 使用 CheerioWebBaseLoader 抓取页面并产出正文文本用于后续导入管线

### Requirement: 过滤无用标签与噪声内容
系统 MUST 在将网页内容进入分段与索引前，过滤掉非正文或噪声信息，至少包含：`script`、`style`、`noscript`、`nav`、`header`、`footer`、`aside`、`form` 等区域的内容。

#### Scenario: 页面包含脚本与导航栏
- **WHEN** 抓取到的 HTML 同时包含 `script`、`style` 与 `nav` 等非正文区域
- **THEN** 系统 MUST 在产出正文文本时排除这些区域的文本内容

### Requirement: 支持配置包含/排除选择器以控制正文提取
系统 MUST 支持为网页导入配置正文提取规则，至少包含：包含选择器（include selectors）与排除选择器（exclude selectors），以便在不同站点结构下获得更稳定的正文文本。

#### Scenario: 指定只抓取文章主体
- **WHEN** 用户为某个 URL 配置包含选择器用于定位文章正文
- **THEN** 系统 MUST 仅使用匹配包含选择器的内容生成正文文本，并继续应用排除选择器过滤噪声

### Requirement: 记录网页文档的来源元数据
系统 MUST 为网页类型导入的文档记录来源元数据，至少包含：`url`、`title`（可为空）、`sourceType=web`、`fetchedAt`。

#### Scenario: 导入后可查看网页来源信息
- **WHEN** 一个网页 URL 导入成功并产生文档记录
- **THEN** 文档元数据 MUST 包含 url、sourceType=web 与 fetchedAt，且 title 可用于 UI 展示

### Requirement: 导入失败时返回明确错误
系统 MUST 在 URL 非法、抓取失败、解析失败或超出限制（如超时、内容过大）时，将失败原因记录并返回给导入流程，用于 UI 呈现与重试。

#### Scenario: URL 无法访问
- **WHEN** 系统抓取网页 URL 时发生网络错误或返回不可用响应
- **THEN** 系统 MUST 将导入任务标记为失败并提供可读的失败原因
