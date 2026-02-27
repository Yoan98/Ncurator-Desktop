import { tool } from '@langchain/core/tools'
import { z } from 'zod/v4'
import { v4 as uuidv4 } from 'uuid'
import type { AiRunContext } from '../types'
import { normalizeForIpc } from '../../../utils/serialization'

const previewArray = (rows: any[], max = 3) => {
  const list = Array.isArray(rows) ? rows : []
  return list.slice(0, Math.max(0, max))
}

export const buildRetrievalTools = (input: {
  ctx: AiRunContext
  runId: string
  taskId?: string
}) => {
  const { ctx, runId, taskId } = input

  const emitStarted = (toolName: string, args: any) => {
    const toolCallId = uuidv4()
    ctx.sendEvent({
      type: 'tool_call_started',
      runId,
      taskId,
      toolCallId,
      toolName,
      input: args,
      createdAt: Date.now()
    })
    return toolCallId
  }

  const emitResult = (toolName: string, toolCallId: string, outputPreview: any, error?: string) => {
    ctx.sendEvent({
      type: 'tool_call_result',
      runId,
      taskId,
      toolCallId,
      toolName,
      outputPreview,
      completedAt: Date.now(),
      error
    })
  }

  const kbHybridSearchChunks = tool(
    async (args) => {
      const toolName = 'kb_hybrid_search_chunks'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const queryText = String(args.queryText || '').trim()
        const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10)))
        const filter = args.sourceType && args.sourceType !== 'all' ? String(args.sourceType) : undefined
        const documentIds = Array.isArray(args.documentIds) ? args.documentIds.map(String).filter(Boolean) : undefined
        const { data: vec } = await ctx.embeddingService.embed(queryText)
        const rows = await ctx.documentsStore.hybridSearch(vec, queryText, limit, filter, documentIds)
        const normalized = rows.map(normalizeForIpc)
        emitResult(toolName, toolCallId, previewArray(normalized))
        return normalized
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, [], msg)
        throw e
      }
    },
    {
      name: 'kb_hybrid_search_chunks',
      description: 'Hybrid search over local knowledge base chunks (FTS + vector + RRF rerank).',
      schema: z.object({
        queryText: z.string(),
        limit: z.number().optional(),
        sourceType: z.enum(['all', 'file', 'web']).optional(),
        documentIds: z.array(z.string()).optional()
      })
    }
  )

  const kbVectorSearchChunks = tool(
    async (args) => {
      const toolName = 'kb_vector_search_chunks'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const queryText = String(args.queryText || '').trim()
        const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10)))
        const filter = args.sourceType && args.sourceType !== 'all' ? String(args.sourceType) : undefined
        const documentIds = Array.isArray(args.documentIds) ? args.documentIds.map(String).filter(Boolean) : undefined
        const { data: vec } = await ctx.embeddingService.embed(queryText)
        const rows = await ctx.documentsStore.vectorSearch(vec, limit, filter, documentIds)
        const normalized = rows.map(normalizeForIpc)
        emitResult(toolName, toolCallId, previewArray(normalized))
        return normalized
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, [], msg)
        throw e
      }
    },
    {
      name: 'kb_vector_search_chunks',
      description: 'Vector-only search over local knowledge base chunks.',
      schema: z.object({
        queryText: z.string(),
        limit: z.number().optional(),
        sourceType: z.enum(['all', 'file', 'web']).optional(),
        documentIds: z.array(z.string()).optional()
      })
    }
  )

  const kbFtsSearchChunks = tool(
    async (args) => {
      const toolName = 'kb_fts_search_chunks'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const queryText = String(args.queryText || '').trim()
        const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10)))
        const filter = args.sourceType && args.sourceType !== 'all' ? String(args.sourceType) : undefined
        const documentIds = Array.isArray(args.documentIds) ? args.documentIds.map(String).filter(Boolean) : undefined
        const rows = await ctx.documentsStore.ftsSearch(queryText, limit, filter, documentIds)
        const normalized = rows.map(normalizeForIpc)
        emitResult(toolName, toolCallId, previewArray(normalized))
        return normalized
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, [], msg)
        throw e
      }
    },
    {
      name: 'kb_fts_search_chunks',
      description: 'FTS-only search over local knowledge base chunks.',
      schema: z.object({
        queryText: z.string(),
        limit: z.number().optional(),
        sourceType: z.enum(['all', 'file', 'web']).optional(),
        documentIds: z.array(z.string()).optional()
      })
    }
  )

  const kbListDocuments = tool(
    async (args) => {
      const toolName = 'kb_list_documents'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const keyword = String(args.keyword || '').trim() || undefined
        const page = Math.max(1, Number(args.page ?? 1))
        const pageSize = Math.max(1, Math.min(50, Number(args.pageSize ?? 20)))
        const res = await ctx.documentsStore.listDocuments({ keyword, page, pageSize })
        emitResult(toolName, toolCallId, previewArray(res.items))
        return res
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, { items: [], total: 0 }, msg)
        throw e
      }
    },
    {
      name: 'kb_list_documents',
      description: 'List local knowledge base documents by keyword (document table).',
      schema: z.object({
        keyword: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional()
      })
    }
  )

  const writingListDocuments = tool(
    async (args) => {
      const toolName = 'writing_list_documents'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const folderId = args.folderId ? String(args.folderId) : undefined
        const rows = await ctx.writingStore.listDocuments(folderId)
        const preview = previewArray(rows.map((d) => ({ id: d.id, title: d.title, updated_at: d.updated_at })))
        emitResult(toolName, toolCallId, preview)
        return rows
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, [], msg)
        throw e
      }
    },
    {
      name: 'writing_list_documents',
      description: 'List writing workspace documents (optionally within a folder).',
      schema: z.object({
        folderId: z.string().optional()
      })
    }
  )

  const writingSearchDocuments = tool(
    async (args) => {
      const toolName = 'writing_search_documents'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const keyword = String(args.keyword || '').trim()
        const limit = Math.max(1, Math.min(50, Number(args.limit ?? 20)))
        const rows = await ctx.writingStore.searchDocuments(keyword, limit)
        const preview = previewArray(rows.map((d) => ({ id: d.id, title: d.title, updated_at: d.updated_at })))
        emitResult(toolName, toolCallId, preview)
        return rows
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, [], msg)
        throw e
      }
    },
    {
      name: 'writing_search_documents',
      description: 'Search writing workspace documents by keyword (title/markdown).',
      schema: z.object({
        keyword: z.string(),
        limit: z.number().optional()
      })
    }
  )

  const writingGetDocument = tool(
    async (args) => {
      const toolName = 'writing_get_document'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const docId = String(args.docId || '').trim()
        const doc = await ctx.writingStore.getDocument(docId)
        emitResult(toolName, toolCallId, doc ? { id: doc.id, title: doc.title, updated_at: doc.updated_at } : null)
        return doc
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, null, msg)
        throw e
      }
    },
    {
      name: 'writing_get_document',
      description: 'Get a writing workspace document by id.',
      schema: z.object({
        docId: z.string()
      })
    }
  )

  return [
    kbHybridSearchChunks,
    kbVectorSearchChunks,
    kbFtsSearchChunks,
    kbListDocuments,
    writingListDocuments,
    writingSearchDocuments,
    writingGetDocument
  ]
}
