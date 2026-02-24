import OpenAI from 'openai'
import { START, END, StateGraph, StateSchema } from '@langchain/langgraph'
import { z } from 'zod/v4'
import type {
  SearchResult,
  WritingWorkflowEvent,
  WritingWorkflowRunRecord,
  WritingWorkflowRunStatus,
  WritingWorkflowStageId
} from '../../types/store'
import type { UnifiedStore } from '../storage/UnifiedStore'
import type { EmbeddingService } from '../vector/EmbeddingService'
import { normalizeForIpc } from '../../utils/serialization'
import { writingWorkflowPrompts, type Citation, type Outline, type RetrievalPlan } from './prompts'

type SendEvent = (event: WritingWorkflowEvent) => void

export interface WritingWorkflowStartPayload {
  runId: string
  input: string
  selectedDocumentIds?: string[]
  writingDocumentId?: string
}

type RetrievedChunk = {
  chunkId: string
  documentId?: string
  documentName: string
  text: string
  metadata?: any
  score?: number
}

type WritingState = {
  runId: string
  status: WritingWorkflowRunStatus
  writingDocumentId?: string
  input: string
  selectedDocumentIds: string[]
  outline?: Outline
  retrievalPlan?: RetrievalPlan
  retrieved?: RetrievedChunk[]
  citations?: Citation[]
  draftMarkdown?: string
  error?: string
}

export class WritingWorkflowService {
  private static instance: WritingWorkflowService

  private constructor() {}

  public static getInstance(): WritingWorkflowService {
    if (!WritingWorkflowService.instance) {
      WritingWorkflowService.instance = new WritingWorkflowService()
    }
    return WritingWorkflowService.instance
  }

  public async run(
    payload: WritingWorkflowStartPayload,
    deps: {
      unifiedStore: UnifiedStore
      embeddingService: EmbeddingService
      sendEvent: SendEvent
      isCancelled: () => boolean
    }
  ): Promise<void> {
    const { unifiedStore, embeddingService, sendEvent, isCancelled } = deps

    const State = new StateSchema({
      runId: z.string(),
      status: z.enum(['running', 'completed', 'failed', 'cancelled']).default('running'),
      writingDocumentId: z.string().optional(),
      input: z.string(),
      selectedDocumentIds: z.array(z.string()).default(() => []),
      outline: z.any().optional(),
      retrievalPlan: z.any().optional(),
      retrieved: z.any().optional(),
      citations: z.any().optional(),
      draftMarkdown: z.string().optional(),
      error: z.string().optional()
    })

    const checkCancelled = () => {
      if (isCancelled()) {
        const e: any = new Error('cancelled')
        e.code = 'CANCELLED'
        throw e
      }
    }

    const stageStarted = (runId: string, stageId: WritingWorkflowStageId) => {
      sendEvent({ type: 'stage_started', runId, stageId })
    }

    const stageOutput = (runId: string, stageId: WritingWorkflowStageId, payload: any) => {
      sendEvent({ type: 'stage_output', runId, stageId, payload })
    }

    const stageCompleted = (runId: string, stageId: WritingWorkflowStageId) => {
      sendEvent({ type: 'stage_completed', runId, stageId })
    }

    const writeRun = async (partial: Partial<WritingWorkflowRunRecord>) => {
      const existing = await unifiedStore.getWritingWorkflowRun(payload.runId)
      const now = Date.now()
      const merged: WritingWorkflowRunRecord = {
        id: payload.runId,
        writing_document_id: payload.writingDocumentId,
        status: 'running',
        input: payload.input,
        created_at: existing?.created_at || now,
        updated_at: now,
        outline: existing?.outline,
        retrieval_plan: existing?.retrieval_plan,
        retrieved: existing?.retrieved,
        citations: existing?.citations,
        draft_markdown: existing?.draft_markdown,
        error: existing?.error,
        ...partial
      }
      await unifiedStore.saveWritingWorkflowRun(merged)
    }

    const getActiveConfig = async () => {
      const config = await unifiedStore.getActiveLLMConfig()
      if (!config) throw new Error('未配置可用的大模型，请先在「大模型配置」中设置并启用一个模型')
      return config
    }

    const normalizeBaseURL = (baseURL: string) => {
      let url = String(baseURL || '').trim()
      if (url.endsWith('/chat/completions')) url = url.replace(/\/chat\/completions\/?$/, '')
      if (url.endsWith('/v1/chat/completions')) url = url.replace(/\/chat\/completions\/?$/, '')
      url = url.replace(/\/$/, '')
      return url
    }

    const chatComplete = async ({
      system,
      user,
      temperature
    }: {
      system: string
      user: string
      temperature: number
    }) => {
      checkCancelled()
      const cfg = await getActiveConfig()
      const client = new OpenAI({
        baseURL: normalizeBaseURL(cfg.base_url),
        apiKey: cfg.api_key
      })
      const res = await client.chat.completions.create({
        model: cfg.model_name,
        temperature,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ] as any
      })
      const content = res.choices?.[0]?.message?.content
      if (!content) throw new Error('大模型返回为空')
      return content
    }

    const tryParseJsonObject = (text: string): any => {
      const trimmed = String(text || '').trim()
      try {
        return JSON.parse(trimmed)
      } catch (err) {
        void err
      }
      const start = trimmed.indexOf('{')
      const end = trimmed.lastIndexOf('}')
      if (start >= 0 && end > start) {
        const slice = trimmed.slice(start, end + 1)
        return JSON.parse(slice)
      }
      throw new Error('无法解析 JSON 输出')
    }

    const validateInput = async (state: any) => {
      stageStarted(state.runId, 'validate_input')
      const input = String(state.input || '').trim()
      if (!input) throw new Error('请输入写作需求')
      const selectedDocumentIds = Array.isArray(state.selectedDocumentIds)
        ? state.selectedDocumentIds.filter(Boolean)
        : []
      await writeRun({
        status: 'running',
        updated_at: Date.now()
      })
      stageOutput(state.runId, 'validate_input', { input, selectedDocumentIds })
      stageCompleted(state.runId, 'validate_input')
      return { input, selectedDocumentIds }
    }

    const generateOutline = async (state: any) => {
      stageStarted(state.runId, 'generate_outline')
      checkCancelled()
      const prompt = writingWorkflowPrompts.generateOutline(state.input)
      const text = await chatComplete(prompt)
      const outline = tryParseJsonObject(text) as Outline
      await writeRun({
        outline: JSON.stringify(outline),
        updated_at: Date.now()
      })
      stageOutput(state.runId, 'generate_outline', outline)
      stageCompleted(state.runId, 'generate_outline')
      return { outline }
    }

    const generateRetrievalPlan = async (state: any) => {
      stageStarted(state.runId, 'generate_retrieval_plan')
      checkCancelled()
      const prompt = writingWorkflowPrompts.generateRetrievalPlan(state.input, state.outline || {})
      const text = await chatComplete(prompt)
      const plan = tryParseJsonObject(text) as RetrievalPlan
      await writeRun({
        retrieval_plan: JSON.stringify(plan),
        updated_at: Date.now()
      })
      stageOutput(state.runId, 'generate_retrieval_plan', plan)
      stageCompleted(state.runId, 'generate_retrieval_plan')
      return { retrievalPlan: plan }
    }

    const retrieveContext = async (state: any) => {
      stageStarted(state.runId, 'retrieve_context')
      checkCancelled()
      const plan: RetrievalPlan | undefined = state.retrievalPlan
      const queries = Array.isArray(plan?.queries) ? plan!.queries.filter(Boolean) : []
      const selectedDocumentIds = Array.isArray(state.selectedDocumentIds)
        ? state.selectedDocumentIds
        : []

      const all: SearchResult[] = []
      for (const q of queries.slice(0, 12)) {
        checkCancelled()
        const { data: vec } = await embeddingService.embed(q)
        const rows = await unifiedStore.search(vec, q, 8, undefined, selectedDocumentIds)
        all.push(...rows)
      }

      const seen = new Set<string>()
      const deduped = all.filter((r) => {
        const id = String((r as any).id || '')
        if (!id) return false
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })

      const top = deduped.slice(0, 30).map((r) => normalizeForIpc(r)) as any[]
      const retrieved: RetrievedChunk[] = top.map((r) => ({
        chunkId: r.id,
        documentId: r.document_id,
        documentName: r.document_name,
        text: r.text,
        metadata: r.metadata,
        score: r._relevance_score || r._score || undefined
      }))

      await writeRun({
        retrieved: JSON.stringify(retrieved),
        updated_at: Date.now()
      })
      stageOutput(state.runId, 'retrieve_context', { items: retrieved })
      stageCompleted(state.runId, 'retrieve_context')
      return { retrieved }
    }

    const selectCitations = async (state: any) => {
      stageStarted(state.runId, 'select_citations')
      checkCancelled()
      const retrieved: RetrievedChunk[] = Array.isArray(state.retrieved) ? state.retrieved : []
      const max = Math.min(12, Math.max(6, retrieved.length))

      const citations: Citation[] = []
      for (let i = 0; i < Math.min(max, retrieved.length); i++) {
        const r = retrieved[i]
        const citationId = `C${i + 1}`
        citations.push({
          citationId,
          chunkId: r.chunkId,
          documentId: r.documentId,
          documentName: r.documentName,
          excerpt: r.text.slice(0, 280),
          metadata: r.metadata
        })
      }

      await writeRun({
        citations: JSON.stringify(citations),
        updated_at: Date.now()
      })
      stageOutput(state.runId, 'select_citations', { citations })
      stageCompleted(state.runId, 'select_citations')
      return { citations }
    }

    const generateMarkdownDraft = async (state: any) => {
      stageStarted(state.runId, 'generate_markdown_draft')
      checkCancelled()
      const outline: Outline | undefined = state.outline
      const citations: Citation[] = Array.isArray(state.citations) ? state.citations : []
      const prompt = writingWorkflowPrompts.generateMarkdownDraft(
        state.input,
        outline || {},
        citations
      )
      const markdown = await chatComplete(prompt)
      await writeRun({
        draft_markdown: markdown,
        status: 'completed',
        updated_at: Date.now()
      })
      stageOutput(state.runId, 'generate_markdown_draft', { markdown })
      stageCompleted(state.runId, 'generate_markdown_draft')
      return { draftMarkdown: markdown, status: 'completed' }
    }

    const graph = new StateGraph(State)
      .addNode('validate_input', validateInput as any)
      .addNode('generate_outline', generateOutline as any)
      .addNode('generate_retrieval_plan', generateRetrievalPlan as any)
      .addNode('retrieve_context', retrieveContext as any)
      .addNode('select_citations', selectCitations as any)
      .addNode('generate_markdown_draft', generateMarkdownDraft as any)
      .addEdge(START, 'validate_input')
      .addEdge('validate_input', 'generate_outline')
      .addEdge('generate_outline', 'generate_retrieval_plan')
      .addEdge('generate_retrieval_plan', 'retrieve_context')
      .addEdge('retrieve_context', 'select_citations')
      .addEdge('select_citations', 'generate_markdown_draft')
      .addEdge('generate_markdown_draft', END)
      .compile()

    sendEvent({ type: 'run_started', runId: payload.runId, createdAt: Date.now() })
    try {
      await writeRun({
        status: 'running',
        input: payload.input,
        created_at: Date.now(),
        updated_at: Date.now(),
        error: undefined
      })
      await graph.invoke({
        runId: payload.runId,
        status: 'running',
        writingDocumentId: payload.writingDocumentId,
        input: payload.input,
        selectedDocumentIds: Array.isArray(payload.selectedDocumentIds)
          ? payload.selectedDocumentIds.filter(Boolean)
          : []
      } as WritingState)
      sendEvent({ type: 'run_completed', runId: payload.runId })
    } catch (e: any) {
      if (
        e?.code === 'CANCELLED' ||
        String(e?.message || '')
          .toLowerCase()
          .includes('cancel')
      ) {
        await writeRun({
          status: 'cancelled',
          error: 'cancelled',
          updated_at: Date.now()
        })
        sendEvent({ type: 'run_cancelled', runId: payload.runId })
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      await writeRun({
        status: 'failed',
        error: msg,
        updated_at: Date.now()
      })
      sendEvent({ type: 'run_failed', runId: payload.runId, error: msg })
    }
  }
}
