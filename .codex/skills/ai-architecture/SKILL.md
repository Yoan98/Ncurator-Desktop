---
name: AI-Architecture
description: 当任务涉及AI架构时必须阅读该文档并遵循运行时边界约束
---

当任务涉及以下任一内容时，必须先阅读 `doc/ai-architecture.md`：

实现时必须遵守该文档中的进程职责、能力边界与扩展规则，尤其是：

- `terminal_exec` 必须是 tool-driven objective loop（`terminal_run_command` / `terminal_finish`），禁止回退到 capability 外部直接执行命令。
- `docx` 必须是 Node.js-first tool-driven loop（`docx_inspect` / `docx_apply_edits` / `docx_save_output` / `docx_finish`），覆盖写入审批与边界约束。
- 发生文件写入时应优先发出 `file_artifact` 事件，Renderer 需以结构化字段消费，不能依赖文本正则兜底作为主路径。
