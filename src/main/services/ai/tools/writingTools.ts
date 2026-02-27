import { tool } from '@langchain/core/tools'
import { z } from 'zod/v4'
import { v4 as uuidv4 } from 'uuid'
import type { AiRunContext } from '../types'

const previewText = (text: string, max = 240) => {
  const t = String(text || '')
  if (t.length <= max) return t
  return t.slice(0, max)
}

const findAllOccurrences = (text: string, needle: string) => {
  const matches: number[] = []
  if (!needle) return matches
  let idx = 0
  for (;;) {
    const found = text.indexOf(needle, idx)
    if (found === -1) break
    matches.push(found)
    idx = found + Math.max(1, needle.length)
  }
  return matches
}

export const buildWritingTools = (input: {
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

  const writingCreateDocument = tool(
    async (args) => {
      const toolName = 'writing_create_document'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const now = Date.now()
        const id = uuidv4()
        const title = String(args.title || '').trim() || '未命名文档'
        const folderId = args.folderId ? String(args.folderId).trim() : undefined
        const initialMarkdown = args.initialMarkdown ? String(args.initialMarkdown) : ''

        const doc = {
          id,
          title,
          folder_id: folderId || undefined,
          content: '[]',
          markdown: initialMarkdown,
          created_at: now,
          updated_at: now
        }
        await ctx.writingStore.saveDocument(doc as any)
        emitResult(toolName, toolCallId, { id, title, folderId, updated_at: now })
        return doc
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, null, msg)
        throw e
      }
    },
    {
      name: 'writing_create_document',
      description: 'Create a new writing workspace document.',
      schema: z.object({
        folderId: z.string().optional(),
        title: z.string(),
        initialMarkdown: z.string().optional()
      })
    }
  )

  const writingUpdateDocument = tool(
    async (args) => {
      const toolName = 'writing_update_document'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const docId = String(args.docId || '').trim()
        const doc = await ctx.writingStore.getDocument(docId)
        if (!doc) throw new Error('document not found')
        const now = Date.now()
        const title = args.title != null ? String(args.title).trim() : undefined
        const folderId = args.folderId != null ? String(args.folderId).trim() : undefined

        const next = {
          ...doc,
          title: title && title.length > 0 ? title : doc.title,
          folder_id: folderId && folderId.length > 0 ? folderId : folderId === '' ? undefined : doc.folder_id,
          updated_at: now
        }
        await ctx.writingStore.saveDocument(next as any)
        emitResult(toolName, toolCallId, { id: next.id, title: next.title, folderId: next.folder_id, updated_at: now })
        return next
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, null, msg)
        throw e
      }
    },
    {
      name: 'writing_update_document',
      description: 'Update writing document metadata (title/folder).',
      schema: z.object({
        docId: z.string(),
        title: z.string().optional(),
        folderId: z.string().optional()
      })
    }
  )

  const writingApplySearchReplace = tool(
    async (args) => {
      const toolName = 'writing_apply_search_replace'
      const toolCallId = emitStarted(toolName, args)
      try {
        ctx.checkCancelled()
        const docId = String(args.docId || '').trim()
        const before = String(args.before || '')
        const target = String(args.target || '')
        const after = String(args.after || '')
        const replacement = String(args.replacement || '')

        const doc = await ctx.writingStore.getDocument(docId)
        if (!doc) throw new Error('document not found')
        const baseText = String(doc.markdown ?? '')
        const pattern = before + target + after
        if (!pattern) throw new Error('invalid pattern')

        const occurrences = findAllOccurrences(baseText, pattern)
        if (occurrences.length === 0) {
          throw new Error('0 matches for (before+target+after)')
        }
        if (occurrences.length > 1) {
          throw new Error('multiple matches for (before+target+after)')
        }

        const idx = occurrences[0]
        const nextText = baseText.slice(0, idx) + before + replacement + after + baseText.slice(idx + pattern.length)
        const now = Date.now()
        const next = { ...doc, markdown: nextText, updated_at: now }
        await ctx.writingStore.saveDocument(next as any)

        emitResult(toolName, toolCallId, {
          id: next.id,
          updated_at: now,
          preview: previewText(nextText)
        })
        return next
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        emitResult(toolName, toolCallId, null, msg)
        throw e
      }
    },
    {
      name: 'writing_apply_search_replace',
      description: 'Apply a safe search&replace edit requiring a single unique match.',
      schema: z.object({
        docId: z.string(),
        before: z.string(),
        target: z.string(),
        after: z.string(),
        replacement: z.string()
      })
    }
  )

  return [writingCreateDocument, writingUpdateDocument, writingApplySearchReplace]
}
