import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, Card, message, Collapse, Avatar, Tooltip, Space } from 'antd'
import {
  HiArrowUp,
  HiPlus,
  HiTrash,
  HiUser,
  HiSparkles,
  HiBookOpen
} from 'react-icons/hi2'
import { LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { LLMConfig, getActiveConfig, streamCompletion, ChatMessage } from '../services/llmService'
import type { SearchResult } from '../../../shared/types'
import { parseIpcResult } from '../utils/serialization'
import FileRender, { FileRenderDocument } from '../components/fileRenders'
import MarkdownRenderer from '../components/MarkdownRenderer'

const { TextArea } = Input
const { Panel } = Collapse

interface ChatMessageWithSource extends ChatMessage {
  id: string
  timestamp: number
  sources?: SearchResult[]
  error?: boolean
}

interface ChatSession {
  id: string
  title: string
  createdAt: number
  messages: ChatMessageWithSource[]
}

const STORAGE_KEY_SESSIONS = 'ncurator_chat_sessions'

const ChatPage: React.FC = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Preview state
  const [previewVisible, setPreviewVisible] = useState(false)
  const [currentPreviewDoc, setCurrentPreviewDoc] = useState<SearchResult | null>(null)

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const saveSessions = (newSessions: ChatSession[]) => {
    setSessions(newSessions)
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(newSessions))
  }

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: '新对话',
      createdAt: Date.now(),
      messages: []
    }
    const newSessions = [newSession, ...sessions]
    saveSessions(newSessions)
    setCurrentSessionId(newSession.id)
    return newSession
  }

  const loadSessions = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSIONS)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSessions(parsed)
        if (parsed.length > 0 && !currentSessionId) {
          setCurrentSessionId(parsed[0].id)
        }
      }
    } catch (e) {
      console.error('Failed to load sessions', e)
    }
  }

  useEffect(() => {
    loadSessions()
    const activeConfig = getActiveConfig()
    setConfig(activeConfig)

    // 如果没有会话，创建一个新的
    const stored = localStorage.getItem(STORAGE_KEY_SESSIONS)
    if (!stored || JSON.parse(stored).length === 0) {
      createNewSession()
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages, currentSessionId])

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const newSessions = sessions.filter((s) => s.id !== id)
    saveSessions(newSessions)
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions[0]?.id || null)
    }
    if (newSessions.length === 0) {
      createNewSession()
    }
  }

  const updateSessionMessages = (sessionId: string, messages: ChatMessageWithSource[]) => {
    setSessions((prev) => {
      const newSessions = prev.map((s) => {
        if (s.id === sessionId) {
          // Update title if it's the first user message
          let title = s.title
          if (s.messages.length === 0 && messages.length > 0) {
            const firstMsg = messages[0]
            if (firstMsg.role === 'user') {
              title = firstMsg.content.slice(0, 20)
            }
          }
          return { ...s, title, messages }
        }
        return s
      })
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(newSessions))
      return newSessions
    })
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
    const userMsg: ChatMessageWithSource = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userQuery,
      timestamp
    }

    const updatedMessages = [...(currentSession?.messages || []), userMsg]
    updateSessionMessages(currentSessionId, updatedMessages)

    try {
      // 2. Search for Context
      let searchResults: SearchResult[] = []
      try {
        const res = await window.api.search(userQuery)
        searchResults = res.results.slice(0, 5).map(parseIpcResult) // Take top 5

        // Update user message with sources
        const messagesWithSource = updatedMessages.map((m) =>
          m.id === userMsg.id ? { ...m, sources: searchResults } : m
        )
        updateSessionMessages(currentSessionId, messagesWithSource)

        // Update local ref for next steps
        userMsg.sources = searchResults
      } catch (e) {
        console.error('Search failed', e)
      }

      // 3. Construct Prompt
      const contextText = searchResults
        .map((c, i) => `[${i + 1}] 文档: ${c.document_name}\n内容: ${c.text}`)
        .join('\n\n')

      const systemPrompt = `你是一个智能助手。请严格基于以下提供的上下文信息回答用户的问题。如果上下文中没有答案，请诚实告知“未找到相关信息”。
请使用中文回答。

上下文信息：
${contextText}`

      const messagesPayload: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        // Add recent history (last 6 messages to save tokens)
        ...updatedMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
      ]

      // 4. Create Assistant Message Placeholder
      const assistantMsgId = crypto.randomUUID()
      const assistantTimestamp = new Date().getTime()
      const assistantMsg: ChatMessageWithSource = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: assistantTimestamp
      }

      let currentContent = ''

      // Update UI with empty assistant message
      updateSessionMessages(currentSessionId, [...updatedMessages, assistantMsg])

      // 5. Stream LLM Response
      await streamCompletion(
        messagesPayload,
        config,
        (chunk) => {
          currentContent += chunk
          updateSessionMessages(currentSessionId, [
            ...updatedMessages,
            { ...assistantMsg, content: currentContent }
          ])
          scrollToBottom()
        },
        (err) => {
          console.error(err)
          message.error('AI 回答出错: ' + err.message)
          updateSessionMessages(currentSessionId, [
            ...updatedMessages,
            { ...assistantMsg, content: currentContent + '\n\n[出错: 连接中断]', error: true }
          ])
        },
        () => {
          setLoading(false)
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

  const renderMessage = (msg: ChatMessageWithSource) => {
    const isUser = msg.role === 'user'
    return (
      <div key={msg.id} className={`flex gap-4 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <Avatar
          icon={isUser ? <HiUser /> : <HiSparkles />}
          className={`flex-shrink-0 flex items-center justify-center ${
            isUser ? 'bg-[#E5E5E4] text-[#1F1F1F]' : 'bg-[#D97757] text-white'
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
          {isUser && msg.sources && msg.sources.length > 0 && (
            <Collapse
              ghost
              size="small"
              className="mt-2 w-full max-w-lg [&_.ant-collapse-header]:!px-0 [&_.ant-collapse-content-box]:!px-0"
            >
              <Panel
                header={
                  <Space className="text-xs text-[#999999]">
                    <HiBookOpen />
                    <span>参考了 {msg.sources.length} 个文档</span>
                  </Space>
                }
                key="1"
              >
                <div className="flex flex-col gap-2">
                  {msg.sources.map((source, idx) => (
                    <Card
                      key={idx}
                      size="small"
                      className="bg-[#F5F5F4] border-[#E5E5E4] cursor-pointer hover:border-[#D97757] transition-colors"
                      onClick={() => openPreview(source)}
                    >
                      <div className="text-xs font-bold text-[#666666] mb-1 truncate">
                        {idx + 1}. {source.document_name}
                      </div>
                      <div className="text-xs text-[#999999] line-clamp-2">{source.text}</div>
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
                {new Date(session.createdAt).toLocaleDateString()}
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
          {currentSession?.messages.length === 0 ? (
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
            currentSession?.messages.map(renderMessage)
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
