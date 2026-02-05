import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, Card, message, Collapse, Avatar, Tooltip, Space } from 'antd'
import { HiArrowUp, HiPlus, HiTrash, HiUser, HiSparkles, HiBookOpen } from 'react-icons/hi2'
import { LoadingOutlined } from '@ant-design/icons'
import { getActiveConfig, streamCompletion } from '../services/llmService'
import type { SearchResult, ChatSession, ChatMessage, LLMConfig } from '../../../shared/types'
import { parseIpcResult } from '../utils/serialization'
import FileRender, { FileRenderDocument } from '../components/fileRenders'
import MarkdownRenderer from '../components/MarkdownRenderer'

const { TextArea } = Input
const { Panel } = Collapse

const ChatPage: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<LLMConfig | null>(null)
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
    getActiveConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId)
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

  const handleSend = async () => {
    if (!input.trim() || !currentSessionId || loading) return

    if (!config) {
      message.error('请先在设置中配置模型参数')
      return
    }

    const userQuery = input.trim()
    setInput('')
    setLoading(true)

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
      // 2. Search for Context
      let searchResults: SearchResult[] = []
      try {
        const res = await window.api.search(userQuery)
        const parsedResults = res.results.map(parseIpcResult)

        // Deduplicate by document_id
        const uniqueResults: SearchResult[] = []
        const seenIds = new Set<string>()

        for (const result of parsedResults) {
          if (result.document_id && !seenIds.has(result.document_id)) {
            seenIds.add(result.document_id)
            uniqueResults.push(result)
          }
        }

        searchResults = uniqueResults.slice(0, 5) // Take top 5 unique documents

        // Update user message with sources
        userMsg.sources = JSON.stringify(searchResults)
        setCurrentMessages((prev) => prev.map((m) => (m.id === userMsg.id ? userMsg : m)))
        window.api.chatMessageSave(userMsg).catch(console.error)
      } catch (e) {
        console.error('Search failed', e)
      }

      // 3. Construct Prompt
      const contextText = searchResults
        .map((c, i) => `[${i + 1}] 文档: ${c.document_name}\n内容: ${c.text}`)
        .join('\n\n')

      const systemPrompt = `你是一个智能助手。请严格基于以下提供的上下文信息回答用户的问题。如果上下文中没有答案，请诚实告知“未找到相关信息”。
请使用中文回答。
请使用 Markdown 格式回答。

上下文信息：
${contextText}`

      const now = new Date().getTime()
      const messagesPayload: ChatMessage[] = [
        { 
          role: 'system', 
          content: systemPrompt, 
          id: 'system', 
          session_id: currentSessionId, 
          timestamp: now 
        },
        // Add recent history (last 6 messages to save tokens)
        ...currentMessages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
          id: m.id,
          session_id: m.session_id,
          timestamp: m.timestamp
        }))
      ]
      // Add current user msg
      messagesPayload.push(userMsg)

      // 4. Create Assistant Message Placeholder
      const assistantMsgId = crypto.randomUUID()
      const assistantTimestamp = new Date().getTime()
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        session_id: currentSessionId,
        role: 'assistant',
        content: '',
        timestamp: assistantTimestamp
      }

      let currentContent = ''

      // Update UI with empty assistant message
      setCurrentMessages((prev) => [...prev, assistantMsg])

      // 5. Stream LLM Response
      await streamCompletion(
        messagesPayload,
        config,
        (chunk) => {
          currentContent += chunk
          setCurrentMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: currentContent } : m))
          )
          scrollToBottom()
        },
        (err) => {
          console.error(err)
          message.error('AI 回答出错: ' + err.message)
          const errorMsg = {
            ...assistantMsg,
            content: currentContent + '\n\n[出错: 连接中断]',
            error: true
          }
          setCurrentMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? errorMsg : m)))
          window.api.chatMessageSave(errorMsg).catch(console.error)
        },
        () => {
          setLoading(false)
          // Save completed message
          window.api
            .chatMessageSave({ ...assistantMsg, content: currentContent })
            .catch(console.error)
        }
      )
    } catch (e) {
      console.error(e)
      setLoading(false)
      message.error('发送失败')
    }
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
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 pb-32" ref={scrollRef}>
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#999999] gap-4">
              <div className="w-16 h-16 bg-[#F5F5F4] rounded-full flex items-center justify-center">
                <HiSparkles className="w-8 h-8 text-[#D97757]" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-[#1F1F1F] mb-2">有什么可以帮您？</h3>
                <p>您可以询问关于文档库的任何问题</p>
              </div>
            </div>
          ) : (
            currentMessages.map(renderMessage)
          )}
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
                <Tooltip title="基于本地文档库回答">
                  <span className="flex items-center gap-1 bg-[#F5F5F4] px-2 py-1 rounded cursor-help">
                    <HiBookOpen className="text-[#D97757]" />
                    <span>本地知识库</span>
                  </span>
                </Tooltip>
              </div>
              <Button
                type="primary"
                shape="circle"
                icon={<HiArrowUp />}
                onClick={handleSend}
                disabled={!input.trim() || loading}
                loading={loading}
                className={`${
                  input.trim() ? '!bg-[#D97757]' : '!bg-[#E5E5E4] !text-white'
                } border-none shadow-none`}
              />
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
