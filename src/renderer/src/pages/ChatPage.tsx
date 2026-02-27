import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, Card, message, Collapse, Avatar, Tooltip, Space } from 'antd'
import { HiArrowUp, HiPlus, HiTrash, HiUser, HiSparkles, HiBookOpen } from 'react-icons/hi2'
import { LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type {
  AiPlanTask,
  AiRunEvent,
  DocumentRecord,
  SearchResult,
  ChatSession,
  ChatMessage
} from '../../../shared/types'
import { parseIpcResult } from '../utils/serialization'
import FileRender, { FileRenderDocument } from '../components/fileRenders'
import MarkdownRenderer from '../components/MarkdownRenderer'

const { TextArea } = Input
const { Panel } = Collapse

const safeText = (v: any) => String(v ?? '').trim()

const ChatPage: React.FC = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiRunId, setAiRunId] = useState<string | null>(null)
  const [aiEvents, setAiEvents] = useState<AiRunEvent[]>([])
  const [aiPlan, setAiPlan] = useState<AiPlanTask[]>([])
  const [rightPanel, setRightPanel] = useState<null | {
    title: string
    kind: 'chunks' | 'docs' | 'writing_docs' | 'writing_action' | 'json'
    data: any
  }>(null)
  const assistantMsgIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Preview state
  const [previewVisible, setPreviewVisible] = useState(false)
  const [currentPreviewDoc, setCurrentPreviewDoc] = useState<SearchResult | null>(null)

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const loadSessions = async () => {
    try {
      const list = await window.api.chatSessionList()
      setSessions(list)
      if (list.length > 0 && !currentSessionId) {
        setCurrentSessionId(list[0].id)
      } else if (list.length === 0) {
        createNewSession()
      }
    } catch (e) {
      console.error('Failed to load sessions', e)
    }
  }

  const loadMessages = async (sessionId: string) => {
    try {
      const msgs = await window.api.chatMessageList(sessionId)
      setCurrentMessages(msgs)
      scrollToBottom()
    } catch (e) {
      console.error('Failed to load messages', e)
    }
  }

  const createNewSession = async () => {
    try {
      const timestamp = new Date().getTime()
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: '新对话',
        created_at: timestamp
      }
      await window.api.chatSessionSave(newSession)
      await loadSessions()
      setCurrentSessionId(newSession.id)
    } catch (e) {
      console.error(e)
      message.error('创建会话失败')
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId)
      setLoading(false)
      setAiRunId(null)
      setAiEvents([])
      setAiPlan([])
      setRightPanel(null)
    } else {
      setCurrentMessages([])
    }
  }, [currentSessionId])

  useEffect(() => {
    scrollToBottom()
  }, [currentMessages])

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await window.api.chatSessionDelete(id)
      if (currentSessionId === id) {
        setCurrentSessionId(null)
      }
      await loadSessions()
    } catch (err) {
      console.error(err)
      message.error('删除会话失败')
    }
  }

  useEffect(() => {
    if (!aiRunId) return
    window.api.removeAiRunEventListeners()
    window.api.onAiRunEvent((evt) => {
      if (evt.runId !== aiRunId) return
      setAiEvents((prev) => [...prev, evt])

      if (evt.type === 'tool_call_result') {
        const toolName = evt.toolName
        if (
          toolName === 'kb_hybrid_search_chunks' ||
          toolName === 'kb_vector_search_chunks' ||
          toolName === 'kb_fts_search_chunks'
        ) {
          setRightPanel({
            title: `检索结果 · ${toolName}`,
            kind: 'chunks',
            data: Array.isArray(evt.outputPreview) ? evt.outputPreview : []
          })
          return
        }
        if (toolName === 'kb_list_documents') {
          setRightPanel({
            title: `文档列表 · ${toolName}`,
            kind: 'docs',
            data: Array.isArray(evt.outputPreview) ? evt.outputPreview : []
          })
          return
        }
        if (toolName === 'writing_list_documents' || toolName === 'writing_search_documents') {
          setRightPanel({
            title: `写作空间 · ${toolName}`,
            kind: 'writing_docs',
            data: Array.isArray(evt.outputPreview) ? evt.outputPreview : []
          })
          return
        }
        if (
          toolName === 'writing_create_document' ||
          toolName === 'writing_update_document' ||
          toolName === 'writing_apply_search_replace'
        ) {
          setRightPanel({
            title: `写作操作 · ${toolName}`,
            kind: 'writing_action',
            data: evt.outputPreview
          })
          return
        }
        setRightPanel({
          title: `工具输出 · ${toolName}`,
          kind: 'json',
          data: evt.outputPreview
        })
        return
      }

      if (evt.type === 'plan_created') {
        setAiPlan(evt.plan)
        return
      }

      if (evt.type === 'task_started') {
        setAiPlan((prev) =>
          prev.map((t) => (t.id === evt.taskId ? { ...t, status: 'running' } : t))
        )
        return
      }

      if (evt.type === 'task_completed') {
        setAiPlan((prev) =>
          prev.map((t) => (t.id === evt.taskId ? { ...t, status: 'completed' } : t))
        )
        return
      }

      if (evt.type === 'task_failed') {
        setAiPlan((prev) =>
          prev.map((t) => (t.id === evt.taskId ? { ...t, status: 'failed', error: evt.error } : t))
        )
        return
      }

      if (evt.type === 'answer_token') {
        const msgId = assistantMsgIdRef.current
        if (!msgId) return
        setCurrentMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: (m.content || '') + evt.token } : m))
        )
        scrollToBottom()
        return
      }

      if (evt.type === 'answer_completed') {
        const msgId = assistantMsgIdRef.current
        if (!msgId || !currentSessionId) return
        setCurrentMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: evt.text } : m))
        )
        const assistantMsg = {
          id: msgId,
          session_id: currentSessionId,
          role: 'assistant' as const,
          content: evt.text,
          timestamp: Date.now()
        }
        window.api.chatMessageSave(assistantMsg).catch(console.error)
        return
      }

      if (evt.type === 'run_failed') {
        setLoading(false)
        const msgId = assistantMsgIdRef.current
        if (msgId) {
          setCurrentMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? { ...m, error: true, content: (m.content || '') + `\n\n[失败] ${evt.error}` }
                : m
            )
          )
        }
        message.error(evt.error || '运行失败')
        return
      }

      if (evt.type === 'run_cancelled') {
        setLoading(false)
        message.info('已取消')
        return
      }

      if (evt.type === 'run_completed') {
        setLoading(false)
      }
    })
    return () => {
      window.api.removeAiRunEventListeners()
    }
  }, [aiRunId, currentSessionId])

  const handleSend = async () => {
    if (!input.trim() || !currentSessionId || loading) return

    const userQuery = input.trim()
    setInput('')
    setLoading(true)
    setAiEvents([])
    setAiPlan([])
    setRightPanel(null)
    assistantMsgIdRef.current = null

    // 1. Create User Message
    const timestamp = new Date().getTime()
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: currentSessionId,
      role: 'user',
      content: userQuery,
      timestamp,
      sources: undefined,
      error: false
    }

    const newMessages = [...currentMessages, userMsg]
    setCurrentMessages(newMessages)
    // Save user message async
    window.api.chatMessageSave(userMsg).catch(console.error)

    // Update session title if first message
    if (currentMessages.length === 0) {
      const session = sessions.find((s) => s.id === currentSessionId)
      if (session) {
        const newTitle = userQuery.slice(0, 20)
        await window.api.chatSessionSave({ ...session, title: newTitle })
        loadSessions() // Refresh sidebar
      }
    }

    try {
      const assistantMsgId = crypto.randomUUID()
      assistantMsgIdRef.current = assistantMsgId
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        session_id: currentSessionId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
      setCurrentMessages((prev) => [...prev, assistantMsg])

      const res = await window.api.aiRunStart({ sessionId: currentSessionId, input: userQuery })
      if (!res.success || !res.runId) {
        setLoading(false)
        message.error(res.error || '启动失败')
        return
      }
      setAiRunId(res.runId)

      // 2. Optional quick inline context for preview (no impact on model execution)
      try {
        const s = await window.api.search(userQuery)
        const parsed = s.results.map(parseIpcResult)
        const unique: SearchResult[] = []
        const seenIds = new Set<string>()
        for (const r of parsed) {
          if (r.document_id && !seenIds.has(r.document_id)) {
            seenIds.add(r.document_id)
            unique.push(r)
          }
        }
        userMsg.sources = JSON.stringify(unique.slice(0, 5))
        setCurrentMessages((prev) => prev.map((m) => (m.id === userMsg.id ? userMsg : m)))
        window.api.chatMessageSave(userMsg).catch(console.error)
      } catch (e) {
        void e
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
      message.error('发送失败')
    }
  }

  const handleCancel = async () => {
    if (!aiRunId) return
    try {
      const res = await window.api.aiRunCancel(aiRunId)
      if (!res.success) message.error(res.error || '取消失败')
    } catch (e: any) {
      message.error(e?.message || '取消失败')
    }
  }

  const renderTrace = () => {
    if (!aiRunId) return null

    const toolCalls = aiEvents.filter(
      (e) => e.type === 'tool_call_started' || e.type === 'tool_call_result'
    ) as Array<any>

    const byTask: Record<string, Array<any>> = {}
    for (const evt of toolCalls) {
      const key = String(evt.taskId || '__no_task__')
      if (!byTask[key]) byTask[key] = []
      byTask[key].push(evt)
    }

    const taskPanels = aiPlan.map((t) => {
      const items = byTask[t.id] || []
      return (
        <Panel
          key={t.id}
          header={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#1F1F1F]">{t.title}</span>
                <span className="text-xs text-[#999999]">{t.kind}</span>
              </div>
              <span className="text-xs text-[#666666]">{t.status}</span>
            </div>
          }
        >
          {items.length === 0 ? (
            <div className="text-xs text-[#999999]">暂无工具步骤</div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((evt, idx) => (
                <div
                  key={`${evt.toolCallId}-${idx}`}
                  className="border border-[#E5E5E4] rounded-lg bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-[#1F1F1F]">{evt.toolName}</div>
                    <div className="text-[11px] text-[#999999]">{evt.type}</div>
                  </div>
                  {evt.type === 'tool_call_started' ? (
                    <div className="text-xs text-[#666666] mt-1 whitespace-pre-wrap">
                      {JSON.stringify(evt.input)}
                    </div>
                  ) : (
                    <div className="text-xs text-[#666666] mt-1 whitespace-pre-wrap">
                      {evt.error ? `[error] ${evt.error}` : JSON.stringify(evt.outputPreview)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )
    })

    return (
      <div className="px-6 pt-4">
        <Collapse
          defaultActiveKey={['plan']}
          size="small"
          className="bg-white border border-[#E5E5E4] rounded-xl overflow-hidden"
        >
          <Panel
            header={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <HiSparkles className="text-[#D97757]" />
                  <span className="text-sm font-medium text-[#1F1F1F]">执行轨迹</span>
                </div>
                <span className="text-xs text-[#999999]">{aiRunId.slice(0, 8)}</span>
              </div>
            }
            key="plan"
          >
            {aiPlan.length === 0 ? (
              <div className="text-xs text-[#999999]">等待计划生成…</div>
            ) : (
              <Collapse ghost size="small">
                {taskPanels}
              </Collapse>
            )}
          </Panel>
        </Collapse>
      </div>
    )
  }

  const renderRightPanel = () => {
    return (
      <div className="w-[380px] border-l border-[#E5E5E4] bg-[#F5F5F4] flex flex-col h-full">
        <div className="p-4">
          <Card
            className="bg-white border border-[#E5E5E4] rounded-xl shadow-sm"
            styles={{ body: { padding: 0 } }}
          >
            <div className="px-4 py-3 border-b border-[#E5E5E4] flex items-center justify-between">
              <div className="text-sm font-medium text-[#1F1F1F] truncate">
                {rightPanel?.title || '右侧面板'}
              </div>
              <div className="text-xs text-[#999999]">{aiRunId ? aiRunId.slice(0, 8) : ''}</div>
            </div>
            <div className="p-4 max-h-[calc(100vh-220px)] overflow-auto">
              {!rightPanel ? (
                <div className="text-sm text-[#999999]">等待工具输出…</div>
              ) : rightPanel.kind === 'chunks' ? (
                <div className="flex flex-col gap-3">
                  {(rightPanel.data as SearchResult[]).map((r, idx) => (
                    <div
                      key={`${r.id || idx}`}
                      className="border border-[#E5E5E4] rounded-xl p-3 bg-white hover:border-[#D97757] transition-colors cursor-pointer"
                      onClick={() => openPreview(r)}
                    >
                      <div className="text-xs font-semibold text-[#1F1F1F] truncate">
                        {idx + 1}. {r.document_name}
                      </div>
                      <div className="text-xs text-[#999999] mt-2 whitespace-pre-wrap line-clamp-5">
                        {r.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : rightPanel.kind === 'docs' ? (
                <div className="flex flex-col gap-2">
                  {(rightPanel.data as DocumentRecord[]).map((d, idx) => (
                    <div
                      key={`${d.id || idx}`}
                      className="border border-[#E5E5E4] rounded-lg px-3 py-2 bg-white"
                    >
                      <div className="text-xs font-semibold text-[#1F1F1F] truncate">
                        {idx + 1}. {d.name}
                      </div>
                      <div className="text-[11px] text-[#999999] mt-1 truncate">{d.id}</div>
                    </div>
                  ))}
                </div>
              ) : rightPanel.kind === 'writing_docs' ? (
                <div className="flex flex-col gap-2">
                  {(
                    rightPanel.data as Array<{ id: string; title: string; updated_at?: number }>
                  ).map((d, idx) => (
                    <div
                      key={`${d.id || idx}`}
                      className="border border-[#E5E5E4] rounded-lg px-3 py-2 bg-white"
                    >
                      <div className="text-xs font-semibold text-[#1F1F1F] truncate">
                        {idx + 1}. {d.title}
                      </div>
                      <div className="text-[11px] text-[#999999] mt-1 truncate">{d.id}</div>
                    </div>
                  ))}
                </div>
              ) : rightPanel.kind === 'writing_action' ? (
                <div className="flex flex-col gap-3">
                  <div className="border border-[#E5E5E4] rounded-xl p-3 bg-white">
                    <div className="text-xs font-semibold text-[#1F1F1F]">动作结果</div>
                    <div className="text-xs text-[#666666] mt-2 whitespace-pre-wrap">
                      {JSON.stringify(rightPanel.data)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        const docId =
                          safeText((rightPanel.data as any)?.id) ||
                          safeText((rightPanel.data as any)?.docId) ||
                          safeText((rightPanel.data as any)?.writing_document_id)
                        navigator.clipboard.writeText(docId || '').catch(() => {})
                        message.success('已复制文档 ID')
                      }}
                      className="border-[#E5E5E4]"
                    >
                      复制文档 ID
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => {
                        const docId =
                          safeText((rightPanel.data as any)?.id) ||
                          safeText((rightPanel.data as any)?.docId) ||
                          safeText((rightPanel.data as any)?.writing_document_id)
                        if (docId) {
                          navigate(`/writing?docId=${encodeURIComponent(docId)}`)
                          return
                        }
                        navigate('/writing')
                      }}
                      className="!bg-[#D97757] hover:!bg-[#C66A4A] border-none"
                    >
                      打开写作空间
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#666666] whitespace-pre-wrap">
                  {JSON.stringify(rightPanel.data)}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const openPreview = (item: SearchResult) => {
    setCurrentPreviewDoc(item)
    setPreviewVisible(true)
  }

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user'
    let sources: SearchResult[] = []
    try {
      if (msg.sources) {
        sources = JSON.parse(msg.sources)
      }
    } catch (e) {
      console.warn('Failed to parse sources', e)
    }

    return (
      <div key={msg.id} className={`flex gap-4 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <Avatar
          icon={isUser ? <HiUser /> : <HiSparkles />}
          className={`flex-shrink-0 flex items-center justify-center ${
            isUser ? 'bg-[#E5E5E4] text-[#1F1F1F]' : '!bg-[#FFF0E6] !text-[#D97757]'
          }`}
        />
        <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`rounded-2xl px-5 py-3 shadow-sm text-[15px] leading-relaxed border ${
              isUser
                ? 'bg-white border-[#E5E5E4] text-[#1F1F1F] rounded-br-sm whitespace-pre-wrap'
                : 'bg-[#FBF5F2] border-[#F4E5DF] text-[#1F1F1F] rounded-bl-sm w-full'
            }`}
          >
            {isUser ? (
              msg.content
            ) : (
              <MarkdownRenderer
                content={msg.content || (loading && msg.role === 'assistant' ? '...' : '')}
              />
            )}
            {loading && msg.role === 'assistant' && !msg.content && <LoadingOutlined />}
          </div>

          {/* Sources for User Message */}
          {isUser && sources && sources.length > 0 && (
            <Collapse
              ghost
              size="small"
              className="mt-2 w-full max-w-lg [&_.ant-collapse-header]:!px-0 [&_.ant-collapse-content-box]:!px-0"
            >
              <Panel
                header={
                  <Space className="text-xs text-[#999999]">
                    <HiBookOpen />
                    <span>参考了 {sources.length} 个文档</span>
                  </Space>
                }
                key="1"
              >
                <div className="flex flex-row overflow-x-auto gap-3 pb-2">
                  {sources.map((source, idx) => (
                    <Card
                      key={idx}
                      size="small"
                      className="flex-shrink-0 w-48 bg-[#F5F5F4] border-[#E5E5E4] cursor-pointer hover:border-[#D97757] transition-colors"
                      onClick={() => openPreview(source)}
                    >
                      <div
                        className="text-xs font-bold text-[#666666] mb-1 truncate"
                        title={source.document_name}
                      >
                        {idx + 1}. {source.document_name}
                      </div>
                      <div className="text-xs text-[#999999] line-clamp-2 h-8">{source.text}</div>
                    </Card>
                  ))}
                </div>
              </Panel>
            </Collapse>
          )}
        </div>
      </div>
    )
  }

  const previewDocuments: FileRenderDocument[] =
    currentPreviewDoc && currentPreviewDoc.document?.file_path
      ? [
          {
            uri: '', // Will be generated from filePath
            filePath: currentPreviewDoc.document.file_path,
            fileName: currentPreviewDoc.document_name,
            metadata: {
              pageNumber: (currentPreviewDoc.metadata as any)?.page || 1
            }
          }
        ]
      : []

  return (
    <div className="flex h-full bg-[#F5F5F4]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-[#E5E5E4] flex flex-col h-[calc(100vh-64px)]">
        <div className="p-4 border-b border-[#E5E5E4] flex items-center justify-between">
          <span className="font-semibold text-[#1F1F1F]">历史记录</span>
          <Button
            type="text"
            icon={<HiPlus />}
            className="text-[#D97757] hover:text-[#C66A4A] hover:bg-[#FBF5F2]"
            onClick={createNewSession}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-3 cursor-pointer border-b border-[#F5F5F4] transition-colors group relative ${
                currentSessionId === session.id
                  ? 'bg-[#FBF5F2] border-l-4 border-l-[#D97757]'
                  : 'hover:bg-[#F5F5F4] border-l-4 border-l-transparent'
              }`}
              onClick={() => setCurrentSessionId(session.id)}
            >
              <div className="text-sm font-medium text-[#1F1F1F] truncate pr-6">
                {session.title}
              </div>
              <div className="text-xs text-[#999999] mt-1">
                {new Date(session.created_at).toLocaleDateString()}
              </div>
              <Button
                type="text"
                size="small"
                icon={<HiTrash />}
                className="absolute right-2 top-3 text-[#999999] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => deleteSession(e, session.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-[calc(100vh-64px)] relative">
        {renderTrace()}

        <div className="flex-1 min-h-0 flex">
          {/* Messages */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 pb-32" ref={scrollRef}>
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#999999] gap-4">
                <div className="w-16 h-16 bg-[#F5F5F4] rounded-full flex items-center justify-center">
                  <HiSparkles className="w-8 h-8 text-[#D97757]" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-[#1F1F1F] mb-2">有什么可以帮您？</h3>
                  <p>你可以直接提问，系统会执行计划并展示过程</p>
                </div>
              </div>
            ) : (
              currentMessages.map(renderMessage)
            )}
          </div>

          {renderRightPanel()}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#F5F5F4] via-[#F5F5F4] to-transparent">
          <div className="bg-white border border-[#E5E5E4] rounded-2xl shadow-lg p-3 focus-within:ring-4 focus-within:ring-[#F4E5DF] focus-within:border-[#D97757] transition-all duration-300">
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入问题..."
              autoSize={{ minRows: 1, maxRows: 6 }}
              bordered={false}
              className="text-[15px] mb-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <div className="flex justify-between items-center">
              <div className="text-xs text-[#999999] flex items-center gap-2">
                <Tooltip title="由主进程执行计划并返回事件流">
                  <span className="flex items-center gap-1 bg-[#F5F5F4] px-2 py-1 rounded cursor-help">
                    <HiBookOpen className="text-[#D97757]" />
                    <span>AI Runner</span>
                  </span>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                {loading && aiRunId && (
                  <Button onClick={handleCancel} className="border-[#E5E5E4]">
                    取消
                  </Button>
                )}
                <Button
                  type="primary"
                  shape="circle"
                  icon={<HiArrowUp />}
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  loading={loading}
                  className={`${input.trim() ? '!bg-[#D97757]' : '!bg-[#E5E5E4] !text-white'} border-none shadow-none`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <FileRender
        open={previewVisible}
        documents={previewDocuments}
        onCancel={() => setPreviewVisible(false)}
      />
    </div>
  )
}

export default ChatPage
