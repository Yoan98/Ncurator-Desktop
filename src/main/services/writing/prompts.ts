export type Outline = {
  title: string
  sections: Array<{
    id: string
    heading: string
    bullets: string[]
  }>
}

export type RetrievalPlan = {
  queries: string[]
  keywords: string[]
  perSectionQueries?: Record<string, string[]>
}

export type Citation = {
  citationId: string
  chunkId: string
  documentId?: string
  documentName: string
  excerpt: string
  metadata?: any
}

const stringifyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2)

export const writingWorkflowPrompts = {
  generateOutline(input: string) {
    const system =
      '你是一位经验丰富的资深编辑与内容策划专家。你的核心能力是构建逻辑严密、结构清晰的文章框架。请严格按要求输出 JSON，不要输出任何额外文本。'
    const user = `基于用户的写作需求，设计一份高质量的文章大纲。

写作需求：
${String(input || '').trim()}

任务目标：
1. 分析写作意图，确定文章的核心论点或主题。
2. 构建逻辑流畅的章节结构（如：背景引入 -> 核心概念 -> 深入分析/对比 -> 实践/应用 -> 总结/展望）。
3. 确保每个章节都有明确的内容焦点，避免空洞的标题。

输出 JSON 格式规范：
{
  "title": "文章标题（需准确概括内容，吸引人）",
  "sections": [
    {
      "id": "s1",
      "heading": "章节标题（具体、有信息量）",
      "bullets": ["要点1（关键论据/信息）", "要点2（支持性细节）"]
    }
  ]
}

约束条件：
- sections 数量：4-10 个
- id 格式：s1, s2, s3... 递增
- bullets 内容：每章 3-6 条，必须是具体的论点、信息点或写作方向，禁止使用“本章介绍...”、“概述...”等废话。
- 语言：中文`
    return { system, user, temperature: 0.3 }
  },

  generateRetrievalPlan(input: string, outline: unknown) {
    const system =
      '你是一位精通知识库检索与信息搜集的专家（RAG Search Expert）。你的任务是为后续的 AI 写作过程提供精准的“弹药”——即从本地知识库中检索出最相关的文档片段。请严格按要求输出 JSON，不要输出任何额外文本。'
    const user = `我们正在进行一项基于本地知识库的写作任务。为了确保文章内容的准确性和丰富度，需要你根据“写作需求”和“文章大纲”，制定一份详尽的检索计划。

写作需求：
${String(input || '').trim()}

文章大纲：
${stringifyJson(outline)}

你的任务是思考：为了写好这篇大纲中的每一部分，我们需要查找哪些具体的信息？（例如：具体的定义、数据、流程步骤、对比分析、历史背景、案例等）。请将这些信息需求转化为高效的检索查询语句（Queries）和关键词（Keywords）。

输出 JSON 格式规范：
{
  "queries": ["查询语句1", "查询语句2"],
  "keywords": ["关键词1", "关键词2"],
  "perSectionQueries": {
    "s1": ["针对s1章节的查询1", "..."],
    "s2": ["针对s2章节的查询1", "..."]
  }
}

检索策略与优化目标：
1. **多维度覆盖**：
   - **定义类**：检索核心概念的定义、原理（如 "什么是XXX", "XXX的原理"）。
   - **事实类**：检索具体的数据、参数、版本号、配置项。
   - **过程类**：检索操作步骤、流程图解、最佳实践。
   - **对比类**：检索方案对比、优缺点分析。
   - **实体类**：直接检索大纲中提到的专有名词、工具名、算法名。

2. **查询语句（Queries）构造技巧**：
   - 长度适中（6-25字），模拟用户在搜索引擎或知识库中的自然搜索行为。
   - 包含明确的实体和意图（例如："React 19 的新特性" 比 "新特性" 更好）。
   - 使用陈述句或问句形式，以匹配知识库中的文档片段。
   - **避免**：过于宽泛的词（"介绍", "总结"）、复杂的长难句、无关的修饰语。

3. **关键词（Keywords）提取**：
   - 提取核心实体、术语、缩写（如 "RAG", "LangChain", "Transformer"）。
   - 包含可能的同义词或变体，以增加召回率。

数量要求：
- queries：全局查询 12-20 条，覆盖全文核心主题。
- keywords：核心关键词 15-30 个。
- perSectionQueries：必须覆盖大纲中的每个 section id，每个章节生成 2-5 条针对性查询。这非常重要，因为后续写作是分章节进行的。

请只输出 JSON。`
    return { system, user, temperature: 0.2 }
  },

  generateMarkdownDraft(input: string, outline: Outline, citations: Citation[]) {
    const system =
      '你是一位专业的科技/学术内容创作者。你的任务是基于提供的“参考资料”和“文章大纲”，撰写一篇逻辑严密、内容详实、引用规范的 Markdown 文章。你必须严格依据事实写作，杜绝幻觉。'
    const sourceLines = (citations || [])
      .map(
        (c) =>
          `${c.citationId} | ${c.documentName} | ${String(c.excerpt || '').replace(/\s+/g, ' ')}`
      )
      .join('\n')

    const user = `写作任务详情：

1. **写作需求**：
${String(input || '').trim()}

2. **文章大纲**：
${stringifyJson(outline)}

3. **可引用参考资料**（这是你写作的基石，请重点参考）：
${sourceLines}

写作与引用规范（CRITICAL）：
1. **基于证据**：文章的核心观点、数据、事实必须优先来自上述“可引用参考资料”。
2. **引用标注**：
   - 当你使用了资料中的信息（无论是直接引用还是改写）时，**必须**在句尾或段落末尾添加引用标注，格式为 [C1], [C2] 等。
   - **严禁**编造引用标注。如果某段内容是通用知识或逻辑推演，不需要标注；如果是来自特定资料，必须标注。
   - 引用应尽量精准，分散在各个论点后，不要全部堆砌在段落最后。
3. **内容融合**：
   - 不要只是机械地拼接资料片段。你需要理解资料内容，将其转化为通顺、连贯的文本。
   - 允许在资料基础上进行合理的逻辑连接、总结和过渡，以保证文章的流畅性。
   - 如果资料中缺少某些大纲要求的细节，可以基于你的通用知识进行补充，但**绝不能**编造具体的数据、版本号或特定事实。
4. **结构**：
   - 严格遵循大纲的章节结构。
   - 使用 Markdown 格式（# 标题, ## 章节, - 列表等）。

输出格式要求：
- 直接输出 Markdown 内容。
- 在文章末尾，自动生成一个「参考来源」章节，按 [C1], [C2]... 的顺序列出所有被引用的资料（格式：[C1] 文档名 - 简要说明）。

开始写作。`
    return { system, user, temperature: 0.3 }
  }
}
