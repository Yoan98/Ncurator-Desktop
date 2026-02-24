import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Spin,
  Steps,
  Tag,
  Tooltip,
  message
} from 'antd'
import type { TreeDataNode } from 'antd'
import { Tree } from 'antd'
import {
  HiArrowDownTray,
  HiPlus,
  HiPencil,
  HiTrash,
  HiSparkles,
  HiOutlineFolderPlus
} from 'react-icons/hi2'
import type {
  DocumentRecord,
  WritingDocumentRecord,
  WritingFolderRecord,
  WritingWorkflowEvent,
  WritingWorkflowStageId
} from '../../../shared/types'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { DOCXExporter, docxDefaultSchemaMappings } from '@blocknote/xl-docx-exporter'
import { Packer } from 'docx'
import { PDFExporter, pdfDefaultSchemaMappings } from '@blocknote/xl-pdf-exporter'
import { pdf } from '@react-pdf/renderer'

const { TextArea } = Input

const STAGES: Array<{ id: WritingWorkflowStageId; title: string }> = [
  { id: 'validate_input', title: '校验需求' },
  { id: 'generate_outline', title: '生成大纲' },
  { id: 'generate_retrieval_plan', title: '生成检索计划' },
  { id: 'retrieve_context', title: '检索资料' },
  { id: 'select_citations', title: '整理引用' },
  { id: 'generate_markdown_draft', title: '生成草稿' }
]

function safeFilename(name: string) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return 'untitled'
  return trimmed.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function buildFolderTree(
  folders: WritingFolderRecord[],
  parentId?: string
): Array<TreeDataNode & { folderId?: string }> {
  return folders
    .filter((f) => (parentId ? f.parent_id === parentId : !f.parent_id))
    .sort((a, b) => a.created_at - b.created_at)
    .map((f) => ({
      key: f.id,
      title: f.name,
      folderId: f.id,
      children: buildFolderTree(folders, f.id)
    }))
}

type EditorApi = {
  document: any[]
  schema: any
  replaceBlocks: (oldBlocks: any[], newBlocks: any[]) => void
  tryParseMarkdownToBlocks: (markdown: string) => Promise<any[]>
  blocksToMarkdownLossy: (blocks?: any[]) => Promise<string>
}

const WritingEditor: React.FC<{
  doc: WritingDocumentRecord
  onEditorReady: (editor: EditorApi) => void
  onTouched: () => void
}> = ({ doc, onEditorReady, onTouched }) => {
  const initialBlocks = useMemo(() => {
    try {
      const parsed = JSON.parse(doc.content || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [doc.content])

  const editor = useCreateBlockNote({ initialContent: initialBlocks })

  useEffect(() => {
    onEditorReady(editor as any)
  }, [editor, onEditorReady])

  useEditorChange(() => {
    onTouched()
  }, editor)

  return (
    <div className="h-full w-full">
      <BlockNoteView editor={editor as any} className="h-full" />
    </div>
  )
}

const WritingWorkspacePage: React.FC = () => {
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(false)

  const [folders, setFolders] = useState<WritingFolderRecord[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined)

  const [docs, setDocs] = useState<WritingDocumentRecord[]>([])
  const [activeDocId, setActiveDocId] = useState<string | undefined>(undefined)
  const [activeDoc, setActiveDoc] = useState<WritingDocumentRecord | null>(null)

  const editorRef = useRef<EditorApi | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)

  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [folderModalName, setFolderModalName] = useState('')
  const [folderEditing, setFolderEditing] = useState<WritingFolderRecord | null>(null)

  const [docModalOpen, setDocModalOpen] = useState(false)
  const [docModalTitle, setDocModalTitle] = useState('')
  const [docEditing, setDocEditing] = useState<WritingDocumentRecord | null>(null)

  const [docMoveOpen, setDocMoveOpen] = useState(false)
  const [docMoveTargetFolderId, setDocMoveTargetFolderId] = useState<string | undefined>(undefined)

  const [docDeleteOpen, setDocDeleteOpen] = useState(false)
  const [docDeleteTarget, setDocDeleteTarget] = useState<WritingDocumentRecord | null>(null)

  const [aiInput, setAiInput] = useState('')
  const [mentionOptions, setMentionOptions] = useState<DocumentRecord[]>([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [aiRunning, setAiRunning] = useState(false)
  const [aiRunId, setAiRunId] = useState<string | null>(null)
  const [aiCurrentStage, setAiCurrentStage] = useState<WritingWorkflowStageId | undefined>(
    undefined
  )
  const [aiOutline, setAiOutline] = useState<any>(null)
  const [aiRetrievalPlan, setAiRetrievalPlan] = useState<any>(null)
  const [aiRetrieved, setAiRetrieved] = useState<any[]>([])
  const [aiCitations, setAiCitations] = useState<any[]>([])
  const [aiDraftMarkdown, setAiDraftMarkdown] = useState<string>('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [citationDrawerOpen, setCitationDrawerOpen] = useState(false)
  const [citationDrawerItem, setCitationDrawerItem] = useState<any | null>(null)

  const stageIndex = useMemo(() => {
    if (!aiCurrentStage) return 0
    const idx = STAGES.findIndex((s) => s.id === aiCurrentStage)
    return Math.max(0, idx)
  }, [aiCurrentStage])

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true)
    try {
      const list = await window.api.writingFolderList()
      setFolders(list)
    } catch (e: any) {
      message.error(e?.message || '加载文件夹失败')
    } finally {
      setLoadingFolders(false)
    }
  }, [])

  const loadDocs = useCallback(
    async (folderId?: string) => {
      setLoadingDocs(true)
      try {
        const list = await window.api.writingDocumentList({ folderId })
        const sorted = [...list].sort((a, b) => b.updated_at - a.updated_at)
        setDocs(sorted)
      } catch (e: any) {
        message.error(e?.message || '加载文档失败')
      } finally {
        setLoadingDocs(false)
      }
    },
    [setDocs]
  )

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    loadDocs(activeFolderId)
  }, [activeFolderId, loadDocs])

  useEffect(() => {
    if (!activeDocId) {
      setActiveDoc(null)
      return
    }
    const doc = docs.find((d) => d.id === activeDocId) || null
    setActiveDoc(doc)
  }, [activeDocId, docs])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      window.api.removeWritingWorkflowEventListeners()
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (!activeDoc) return
    if (!editorRef.current) return
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(async () => {
      const editor = editorRef.current
      const current = activeDoc
      if (!editor || !current) return
      try {
        setSaving(true)
        const content = JSON.stringify(editor.document || [])
        const markdown = await editor.blocksToMarkdownLossy(editor.document || [])
        const now = Date.now()
        const next: WritingDocumentRecord = {
          ...current,
          content,
          markdown,
          updated_at: now
        }
        setActiveDoc(next)
        setDocs((prev) => prev.map((d) => (d.id === next.id ? next : d)))
        const res = await window.api.writingDocumentSave(next)
        if (!res.success) {
          message.error(res.error || '保存失败')
        }
      } catch (e: any) {
        message.error(e?.message || '保存失败')
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [activeDoc])

  const createFolder = useCallback(() => {
    setFolderEditing(null)
    setFolderModalName('')
    setFolderModalOpen(true)
  }, [])

  const editFolder = useCallback((folder: WritingFolderRecord) => {
    setFolderEditing(folder)
    setFolderModalName(folder.name)
    setFolderModalOpen(true)
  }, [])

  const deleteFolder = useCallback(
    async (folder: WritingFolderRecord) => {
      try {
        const res = await window.api.writingFolderDelete(folder.id)
        if (!res.success) {
          message.error(res.error || '删除失败')
          return
        }
        if (activeFolderId === folder.id) setActiveFolderId(undefined)
        await loadFolders()
        await loadDocs(activeFolderId)
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    },
    [activeFolderId, loadDocs, loadFolders]
  )

  const saveFolderModal = useCallback(async () => {
    const name = folderModalName.trim()
    if (!name) {
      message.warning('请输入文件夹名称')
      return
    }
    try {
      const now = Date.now()
      const record: WritingFolderRecord = folderEditing
        ? { ...folderEditing, name, updated_at: now }
        : {
            id: crypto.randomUUID(),
            name,
            parent_id: activeFolderId,
            created_at: now,
            updated_at: now
          }
      const res = await window.api.writingFolderSave(record)
      if (!res.success) {
        message.error(res.error || '保存失败')
        return
      }
      setFolderModalOpen(false)
      await loadFolders()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }, [activeFolderId, folderEditing, folderModalName, loadFolders])

  const createDoc = useCallback(async () => {
    const now = Date.now()
    const doc: WritingDocumentRecord = {
      id: crypto.randomUUID(),
      title: '未命名文档',
      folder_id: activeFolderId,
      content: '[]',
      markdown: '',
      created_at: now,
      updated_at: now
    }
    try {
      const res = await window.api.writingDocumentSave(doc)
      if (!res.success) {
        message.error(res.error || '创建失败')
        return
      }
      await loadDocs(activeFolderId)
      setActiveDocId(doc.id)
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    }
  }, [activeFolderId, loadDocs])

  const openRenameDoc = useCallback((doc: WritingDocumentRecord) => {
    setDocEditing(doc)
    setDocModalTitle(doc.title)
    setDocModalOpen(true)
  }, [])

  const saveRenameDoc = useCallback(async () => {
    const title = docModalTitle.trim()
    if (!docEditing) return
    if (!title) {
      message.warning('请输入标题')
      return
    }
    try {
      const next: WritingDocumentRecord = { ...docEditing, title, updated_at: Date.now() }
      const res = await window.api.writingDocumentSave(next)
      if (!res.success) {
        message.error(res.error || '保存失败')
        return
      }
      setDocs((prev) => prev.map((d) => (d.id === next.id ? next : d)))
      if (activeDocId === next.id) setActiveDoc(next)
      setDocModalOpen(false)
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }, [activeDocId, docEditing, docModalTitle])

  const openMoveDoc = useCallback((doc: WritingDocumentRecord) => {
    setDocEditing(doc)
    setDocMoveTargetFolderId(doc.folder_id)
    setDocMoveOpen(true)
  }, [])

  const saveMoveDoc = useCallback(async () => {
    if (!docEditing) return
    try {
      const next: WritingDocumentRecord = {
        ...docEditing,
        folder_id: docMoveTargetFolderId,
        updated_at: Date.now()
      }
      const res = await window.api.writingDocumentSave(next)
      if (!res.success) {
        message.error(res.error || '移动失败')
        return
      }
      setDocMoveOpen(false)
      await loadDocs(activeFolderId)
      if (activeDocId === next.id) setActiveDoc(next)
    } catch (e: any) {
      message.error(e?.message || '移动失败')
    }
  }, [activeDocId, activeFolderId, docEditing, docMoveTargetFolderId, loadDocs])

  const openDeleteDoc = useCallback((doc: WritingDocumentRecord) => {
    setDocDeleteTarget(doc)
    setDocDeleteOpen(true)
  }, [])

  const confirmDeleteDoc = useCallback(async () => {
    if (!docDeleteTarget) return
    try {
      const res = await window.api.writingDocumentDelete(docDeleteTarget.id)
      if (!res.success) {
        message.error(res.error || '删除失败')
        return
      }
      if (activeDocId === docDeleteTarget.id) {
        setActiveDocId(undefined)
      }
      setDocDeleteOpen(false)
      await loadDocs(activeFolderId)
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }, [activeDocId, activeFolderId, docDeleteTarget, loadDocs])

  const exportDocx = useCallback(async () => {
    if (!activeDoc || !editorRef.current) return
    try {
      const exporter = new DOCXExporter(editorRef.current.schema, docxDefaultSchemaMappings as any)
      const docxDocument = await exporter.toDocxJsDocument(editorRef.current.document as any)
      const buffer = await Packer.toBuffer(docxDocument as any)
      const bytes = new Uint8Array(buffer as any)
      const arrayBuffer = (bytes.buffer as ArrayBuffer).slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      )
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      downloadBlob(blob, `${safeFilename(activeDoc.title)}.docx`)
    } catch (e: any) {
      message.error(e?.message || '导出 DOCX 失败')
    }
  }, [activeDoc])

  const exportPdf = useCallback(async () => {
    if (!activeDoc || !editorRef.current) return
    try {
      const exporter = new PDFExporter(editorRef.current.schema, pdfDefaultSchemaMappings as any)
      const pdfDoc = await exporter.toReactPDFDocument(editorRef.current.document as any)
      const blob = await pdf(pdfDoc as any).toBlob()
      downloadBlob(blob, `${safeFilename(activeDoc.title)}.pdf`)
    } catch (e: any) {
      message.error(e?.message || '导出 PDF 失败')
    }
  }, [activeDoc])

  const resetRunState = useCallback(() => {
    setAiRunning(false)
    setAiRunId(null)
    setAiCurrentStage(undefined)
    setAiOutline(null)
    setAiRetrievalPlan(null)
    setAiRetrieved([])
    setAiCitations([])
    setAiDraftMarkdown('')
    setAiError(null)
  }, [])

  const handleWorkflowEvent = useCallback(
    async (evt: WritingWorkflowEvent) => {
      if (!aiRunId || evt.runId !== aiRunId) return
      if (evt.type === 'stage_started') {
        setAiCurrentStage(evt.stageId)
        return
      }
      if (evt.type === 'stage_output') {
        if (evt.stageId === 'generate_outline') setAiOutline(evt.payload)
        if (evt.stageId === 'generate_retrieval_plan') setAiRetrievalPlan(evt.payload)
        if (evt.stageId === 'retrieve_context') setAiRetrieved(evt.payload?.items || [])
        if (evt.stageId === 'select_citations') setAiCitations(evt.payload?.citations || [])
        if (evt.stageId === 'generate_markdown_draft') {
          const md = String(evt.payload?.markdown || '')
          setAiDraftMarkdown(md)
          if (editorRef.current && md) {
            try {
              const blocks = await editorRef.current.tryParseMarkdownToBlocks(md)
              editorRef.current.replaceBlocks(editorRef.current.document, blocks)
              scheduleSave()
            } catch (e: any) {
              message.warning(e?.message || '草稿已生成，但导入编辑器失败')
            }
          }
        }
        return
      }
      if (evt.type === 'run_completed') {
        setAiRunning(false)
        return
      }
      if (evt.type === 'run_failed') {
        setAiRunning(false)
        setAiError(evt.error)
        message.error(evt.error || '写作失败')
        return
      }
      if (evt.type === 'run_cancelled') {
        setAiRunning(false)
        setAiError('已取消')
        return
      }
    },
    [aiRunId, scheduleSave]
  )

  useEffect(() => {
    if (!aiRunId) return
    window.api.removeWritingWorkflowEventListeners()
    window.api.onWritingWorkflowEvent(handleWorkflowEvent)
    return () => window.api.removeWritingWorkflowEventListeners()
  }, [aiRunId, handleWorkflowEvent])

  const startAiWriting = useCallback(async () => {
    const input = aiInput.trim()
    if (!input) {
      message.warning('请输入写作需求')
      return
    }
    if (!activeDoc) {
      message.warning('请先选择或新建一个文档')
      return
    }
    try {
      resetRunState()
      setAiRunning(true)
      const res = await window.api.writingWorkflowStart({
        input,
        selectedDocumentIds: selectedDocumentIds.length ? selectedDocumentIds : undefined,
        writingDocumentId: activeDoc.id
      })
      if (!res.success || !res.runId) {
        setAiRunning(false)
        message.error(res.error || '启动失败')
        return
      }
      setAiRunId(res.runId)
    } catch (e: any) {
      setAiRunning(false)
      message.error(e?.message || '启动失败')
    }
  }, [activeDoc, aiInput, resetRunState, selectedDocumentIds])

  const cancelAiWriting = useCallback(async () => {
    if (!aiRunId) return
    try {
      const res = await window.api.writingWorkflowCancel(aiRunId)
      if (!res.success) message.error(res.error || '取消失败')
    } catch (e: any) {
      message.error(e?.message || '取消失败')
    }
  }, [aiRunId])

  const searchMentionDocs = useCallback(async (keyword: string) => {
    const raw = String(keyword || '').trim()
    const k = raw.startsWith('@') ? raw.slice(1) : raw
    try {
      const list = await window.api.writingMentionDocuments({
        keyword: k || undefined,
        limit: 20
      })
      setMentionOptions(list || [])
    } catch (e: any) {
      void e
    }
  }, [])

  const folderTreeData = useMemo(() => {
    const children = buildFolderTree(folders)
    const root: TreeDataNode & { folderId?: string } = {
      key: '__all__',
      title: '全部文档',
      folderId: undefined,
      children
    }
    return [root]
  }, [folders])

  return (
    <div className="min-h-full p-6 font-sans max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FBF5F2] flex items-center justify-center text-[#D97757]">
            <HiSparkles className="text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1F1F1F]">写作空间</div>
            <div className="text-sm text-[#999999] mt-1">本地资料检索 + AI 写作 + 编辑导出</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<HiOutlineFolderPlus className="w-5 h-5" />}
            onClick={createFolder}
            className="border-[#E5E5E4] text-[#666666] hover:text-[#D97757] hover:border-[#F4E5DF] hover:bg-[#FBF5F2]"
          >
            新建文件夹
          </Button>
          <Button
            type="primary"
            icon={<HiPlus className="w-5 h-5" />}
            onClick={createDoc}
            className="!bg-[#D97757] hover:!bg-[#C66A4A] border-none rounded-lg shadow-sm hover:shadow-md transition-all"
          >
            新建文档
          </Button>
          <Tooltip title="导出为 DOCX">
            <Button
              icon={<HiArrowDownTray className="w-5 h-5" />}
              disabled={!activeDoc}
              onClick={exportDocx}
              className="border-[#E5E5E4] text-[#666666] hover:text-[#D97757] hover:border-[#F4E5DF] hover:bg-[#FBF5F2]"
            />
          </Tooltip>
          <Tooltip title="导出为 PDF">
            <Button
              icon={<HiArrowDownTray className="w-5 h-5" />}
              disabled={!activeDoc}
              onClick={exportPdf}
              className="border-[#E5E5E4] text-[#666666] hover:text-[#D97757] hover:border-[#F4E5DF] hover:bg-[#FBF5F2]"
            />
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-64px-24px-24px-72px)] min-h-[680px]">
        <Card
          className="col-span-3 bg-white border border-[#E5E5E4] rounded-xl shadow-sm overflow-hidden"
          styles={{ body: { padding: 16, height: '100%' } }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[#1F1F1F]">文件夹</div>
            {saving ? <span className="text-xs text-[#999999]">保存中…</span> : null}
          </div>
          <div className="h-[calc(100%-28px)] overflow-auto">
            {loadingFolders ? (
              <div className="h-full flex items-center justify-center">
                <Spin />
              </div>
            ) : (
              <Tree
                defaultExpandAll
                selectedKeys={[activeFolderId || '__all__']}
                treeData={folderTreeData}
                onSelect={(keys) => {
                  const key = String(keys?.[0] || '')
                  if (key === '__all__') setActiveFolderId(undefined)
                  else setActiveFolderId(key)
                }}
                titleRender={(node: any) => {
                  const folderId = node.folderId as string | undefined
                  const folder = folderId ? folders.find((f) => f.id === folderId) : null
                  return (
                    <div className="flex items-center justify-between gap-2 pr-2">
                      <span className="truncate">{String(node.title || '')}</span>
                      {folder ? (
                        <span className="flex items-center gap-1">
                          <Button
                            type="text"
                            size="small"
                            icon={<HiPencil className="w-4 h-4" />}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              editFolder(folder)
                            }}
                            className="text-[#999999] hover:text-[#D97757]"
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<HiTrash className="w-4 h-4" />}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              deleteFolder(folder)
                            }}
                            className="text-[#999999] hover:text-red-500"
                          />
                        </span>
                      ) : null}
                    </div>
                  )
                }}
              />
            )}
          </div>
        </Card>

        <Card
          className="col-span-3 bg-white border border-[#E5E5E4] rounded-xl shadow-sm overflow-hidden"
          styles={{ body: { padding: 16, height: '100%' } }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-[#1F1F1F]">文档</div>
            <div className="text-xs text-[#999999]">{docs.length} 篇</div>
          </div>
          <div className="h-[calc(100%-28px)] overflow-auto">
            {loadingDocs ? (
              <div className="h-full flex items-center justify-center">
                <Spin />
              </div>
            ) : docs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Empty description="暂无文档" />
              </div>
            ) : (
              <List
                dataSource={docs}
                split={false}
                renderItem={(item) => {
                  const active = item.id === activeDocId
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveDocId(item.id)}
                      className={`group cursor-pointer rounded-lg border px-3 py-2 mb-2 transition-all ${
                        active
                          ? 'bg-[#FBF5F2] border-[#F4E5DF]'
                          : 'bg-white border-[#E5E5E4] hover:bg-[#F0F0EF]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-[#1F1F1F] truncate">{item.title}</div>
                          <div className="text-xs text-[#999999] mt-1">
                            {new Date(item.updated_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            type="text"
                            size="small"
                            icon={<HiPencil className="w-4 h-4" />}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              openRenameDoc(item)
                            }}
                            className="text-[#999999] hover:text-[#D97757]"
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<HiArrowDownTray className="w-4 h-4" />}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              openMoveDoc(item)
                            }}
                            className="text-[#999999] hover:text-[#D97757]"
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<HiTrash className="w-4 h-4" />}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              openDeleteDoc(item)
                            }}
                            className="text-[#999999] hover:text-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
            )}
          </div>
        </Card>

        <div className="col-span-6 flex flex-col gap-6 h-full min-h-0">
          <Card
            className="bg-white border border-[#E5E5E4] rounded-xl shadow-sm"
            styles={{ body: { padding: 16 } }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold text-[#1F1F1F] flex items-center gap-2">
                <HiSparkles className="w-5 h-5 text-[#D97757]" />
                AI 写作
              </div>
              <div className="flex items-center gap-2">
                {aiRunning ? (
                  <Button onClick={cancelAiWriting} className="border-[#E5E5E4]">
                    取消
                  </Button>
                ) : null}
                <Button
                  type="primary"
                  onClick={startAiWriting}
                  loading={aiRunning}
                  className="!bg-[#D97757] hover:!bg-[#C66A4A] border-none rounded-lg"
                >
                  开始生成
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <TextArea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  placeholder="写作需求（例如：写一篇关于……，需要……风格，篇幅……）"
                  className="!rounded-lg"
                />
              </div>
              <div className="col-span-4">
                <div className="text-sm text-[#666666] mb-2">引用范围（可选）</div>
                <Select
                  mode="multiple"
                  value={selectedDocumentIds}
                  onChange={(vals) => setSelectedDocumentIds(vals)}
                  onSearch={searchMentionDocs}
                  filterOption={false}
                  options={mentionOptions.map((d) => ({ label: d.name, value: d.id }))}
                  placeholder="输入 @ 搜索文档"
                  className="w-full"
                />
                <div className="text-xs text-[#999999] mt-2">不选择则默认使用知识库全范围检索</div>
              </div>
            </div>

            <div className="mt-4">
              <Steps
                current={stageIndex}
                items={STAGES.map((s) => ({ title: s.title }))}
                size="small"
              />
              {aiError ? <div className="text-sm text-red-500 mt-2">{aiError}</div> : null}
            </div>

            <div className="mt-4 grid grid-cols-12 gap-4">
              <Card
                className="col-span-6 bg-[#FBF5F2] border border-[#F4E5DF] rounded-xl shadow-sm"
                styles={{ body: { padding: 14 } }}
              >
                <div className="font-medium text-[#1F1F1F] mb-2">大纲</div>
                <div className="text-sm text-[#666666] whitespace-pre-wrap">
                  {aiOutline ? JSON.stringify(aiOutline, null, 2) : '等待生成…'}
                </div>
              </Card>
              <Card
                className="col-span-6 bg-[#FBF5F2] border border-[#F4E5DF] rounded-xl shadow-sm"
                styles={{ body: { padding: 14 } }}
              >
                <div className="font-medium text-[#1F1F1F] mb-2">检索计划</div>
                <div className="text-sm text-[#666666] whitespace-pre-wrap">
                  {aiRetrievalPlan ? JSON.stringify(aiRetrievalPlan, null, 2) : '等待生成…'}
                </div>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-12 gap-4">
              <Card
                className="col-span-7 bg-white border border-[#E5E5E4] rounded-xl shadow-sm"
                styles={{ body: { padding: 14 } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-[#1F1F1F]">引用与来源</div>
                  <div className="text-xs text-[#999999]">
                    {aiCitations.length ? `${aiCitations.length} 条引用` : ''}
                  </div>
                </div>
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {aiCitations.length ? (
                    aiCitations.map((c) => (
                      <div
                        key={c.citationId}
                        className="rounded-lg border border-[#E5E5E4] bg-white px-3 py-2 hover:bg-[#F0F0EF] cursor-pointer transition-all"
                        onClick={() => {
                          setCitationDrawerItem(c)
                          setCitationDrawerOpen(true)
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Tag color="#D97757" className="!m-0">
                              {c.citationId}
                            </Tag>
                            <span className="ml-2 text-sm text-[#1F1F1F]">{c.documentName}</span>
                          </div>
                        </div>
                        <div className="text-xs text-[#666666] mt-2 line-clamp-2">
                          {String(c.excerpt || '')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[#999999]">等待整理引用…</div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-[#1F1F1F]">检索片段</div>
                    <div className="text-xs text-[#999999]">
                      {aiRetrieved.length ? `${aiRetrieved.length} 条` : ''}
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {aiRetrieved.length ? (
                      aiRetrieved.slice(0, 10).map((r: any) => (
                        <div
                          key={r.chunkId}
                          className="rounded-lg border border-[#E5E5E4] bg-white px-3 py-2"
                        >
                          <div className="text-sm text-[#1F1F1F] truncate">{r.documentName}</div>
                          <div className="text-xs text-[#666666] mt-2 line-clamp-2">
                            {String(r.text || '')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[#999999]">等待检索资料…</div>
                    )}
                  </div>
                </div>
              </Card>
              <Card
                className="col-span-5 bg-white border border-[#E5E5E4] rounded-xl shadow-sm"
                styles={{ body: { padding: 14 } }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-[#1F1F1F]">草稿预览</div>
                  <div className="text-xs text-[#999999]">
                    {aiDraftMarkdown ? '已生成（已自动导入编辑器）' : ''}
                  </div>
                </div>
                <div className="max-h-44 overflow-auto pr-1 bg-[#FBF5F2] border border-[#F4E5DF] rounded-lg p-3">
                  {aiDraftMarkdown ? (
                    <MarkdownRenderer content={aiDraftMarkdown} />
                  ) : (
                    <div className="text-sm text-[#999999]">等待生成草稿…</div>
                  )}
                </div>
              </Card>
            </div>
          </Card>

          <Card
            className="bg-white border border-[#E5E5E4] rounded-xl shadow-sm flex-1 min-h-0 overflow-hidden"
            styles={{ body: { padding: 0, height: '100%' } }}
          >
            {!activeDoc ? (
              <div className="h-full flex items-center justify-center">
                <Empty description="请选择或新建一个文档开始编辑" />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="border-b border-[#E5E5E4] bg-white px-4 py-3 flex items-center justify-between gap-3">
                  <Input
                    value={activeDoc.title}
                    onChange={(e) => {
                      const title = e.target.value
                      setActiveDoc((prev) => (prev ? { ...prev, title } : prev))
                      setDocs((prev) =>
                        prev.map((d) => (d.id === activeDoc.id ? { ...d, title } : d))
                      )
                      scheduleSave()
                    }}
                    placeholder="文档标题"
                    className="!rounded-lg"
                  />
                  <div className="text-xs text-[#999999] whitespace-nowrap">
                    {saving ? '保存中…' : '已保存'}
                  </div>
                </div>
                <div className="flex-1 min-h-0 bg-white p-4 overflow-auto">
                  <div className="min-h-[500px] border border-[#E5E5E4] rounded-xl shadow-sm overflow-hidden">
                    <WritingEditor
                      key={activeDoc.id}
                      doc={activeDoc}
                      onEditorReady={(ed) => {
                        editorRef.current = ed
                      }}
                      onTouched={scheduleSave}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={folderModalOpen}
        title={folderEditing ? '重命名文件夹' : '新建文件夹'}
        onCancel={() => setFolderModalOpen(false)}
        onOk={saveFolderModal}
        okButtonProps={{ className: '!bg-[#D97757] hover:!bg-[#C66A4A] border-none' }}
        cancelButtonProps={{ className: 'border-[#E5E5E4]' }}
      >
        <Input
          value={folderModalName}
          onChange={(e) => setFolderModalName(e.target.value)}
          placeholder="文件夹名称"
        />
      </Modal>

      <Modal
        open={docModalOpen}
        title="重命名文档"
        onCancel={() => setDocModalOpen(false)}
        onOk={saveRenameDoc}
        okButtonProps={{ className: '!bg-[#D97757] hover:!bg-[#C66A4A] border-none' }}
        cancelButtonProps={{ className: 'border-[#E5E5E4]' }}
      >
        <Input value={docModalTitle} onChange={(e) => setDocModalTitle(e.target.value)} />
      </Modal>

      <Modal
        open={docMoveOpen}
        title="移动文档"
        onCancel={() => setDocMoveOpen(false)}
        onOk={saveMoveDoc}
        okButtonProps={{ className: '!bg-[#D97757] hover:!bg-[#C66A4A] border-none' }}
        cancelButtonProps={{ className: 'border-[#E5E5E4]' }}
      >
        <div className="text-sm text-[#666666] mb-2">移动到：</div>
        <Select
          value={docMoveTargetFolderId}
          onChange={(v) => setDocMoveTargetFolderId(v)}
          allowClear
          placeholder="选择文件夹（留空表示不在任何文件夹）"
          options={folders.map((f) => ({ label: f.name, value: f.id }))}
          className="w-full"
        />
      </Modal>

      <Modal
        open={docDeleteOpen}
        title="删除文档"
        onCancel={() => setDocDeleteOpen(false)}
        onOk={confirmDeleteDoc}
        okButtonProps={{ danger: true }}
      >
        <div className="text-sm text-[#666666]">确认删除「{docDeleteTarget?.title || ''}」？</div>
      </Modal>

      <Drawer
        open={citationDrawerOpen}
        onClose={() => setCitationDrawerOpen(false)}
        title={
          citationDrawerItem ? (
            <div className="flex items-center gap-2">
              <Tag color="#D97757" className="!m-0">
                {citationDrawerItem.citationId}
              </Tag>
              <span className="text-[#1F1F1F]">{citationDrawerItem.documentName}</span>
            </div>
          ) : (
            '引用'
          )
        }
        width={520}
      >
        {citationDrawerItem ? (
          <div className="space-y-4">
            <Card
              className="bg-white border border-[#E5E5E4] rounded-xl shadow-sm"
              styles={{ body: { padding: 16 } }}
            >
              <div className="text-sm text-[#666666] whitespace-pre-wrap">
                {String(citationDrawerItem.excerpt || '')}
              </div>
            </Card>
            {citationDrawerItem.metadata ? (
              <Card
                className="bg-white border border-[#E5E5E4] rounded-xl shadow-sm"
                styles={{ body: { padding: 16 } }}
              >
                <div className="text-sm text-[#1F1F1F] font-medium mb-2">元数据</div>
                <pre className="text-xs text-[#666666] whitespace-pre-wrap">
                  {typeof citationDrawerItem.metadata === 'string'
                    ? citationDrawerItem.metadata
                    : JSON.stringify(citationDrawerItem.metadata, null, 2)}
                </pre>
              </Card>
            ) : null}
          </div>
        ) : (
          <Empty description="暂无内容" />
        )}
      </Drawer>
    </div>
  )
}

export default WritingWorkspacePage
