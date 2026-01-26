import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, Card, message, Collapse, Avatar, Tooltip, Space } from 'antd'
import {
  HiArrowUp,
  HiPlus,
  HiTrash,
  HiUser,
  HiSparkles,
  HiBookOpen,
  HiCog6Tooth
} from 'react-icons/hi2'
import { LoadingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { LLMConfig, getActiveConfig, streamCompletion, ChatMessage } from '../services/llmService'
import type { SearchResult } from '../../../shared/types'
import { parseIpcResult } from '../utils/serialization'

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
            className={`rounded-2xl px-5 py-3 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap border ${
              isUser
                ? 'bg-white border-[#E5E5E4] text-[#1F1F1F] rounded-br-sm'
                : 'bg-[#FBF5F2] border-[#F4E5DF] text-[#1F1F1F] rounded-bl-sm'
            }`}
          >
            {msg.content || (loading && msg.role === 'assistant' ? <LoadingOutlined /> : '')}
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
                    <Card key={idx} size="small" className="bg-[#F5F5F4] border-[#E5E5E4]">
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

  return (
    <div className="flex h-full bg-[#F5F5F4]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-[#E5E5E4] flex flex-col h-[calc(100vh-64px)]">
        <div className="p-4 border-b border-[#E5E5E4]">
          <Button
            type="primary"
            block
            icon={<HiPlus className="w-4 h-4" />}
            onClick={createNewSession}
            className="h-10 rounded-lg !bg-[#D97757] hover:!bg-[#C66A4A] shadow-sm border-none"
          >
            新对话
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`group flex items-center justify-between p-3 mb-1 rounded-lg cursor-pointer transition-all ${
                currentSessionId === session.id
                  ? 'bg-[#FBF5F2] text-[#D97757] font-medium'
                  : 'text-[#666666] hover:bg-[#F5F5F4]'
              }`}
            >
              <div className="truncate flex-1 text-sm pr-2">{session.title || '新对话'}</div>
              <Button
                type="text"
                size="small"
                icon={<HiTrash />}
                className={`opacity-0 group-hover:opacity-100 text-[#999999] hover:text-red-500 ${
                  currentSessionId === session.id ? 'opacity-100' : ''
                }`}
                onClick={(e) => deleteSession(e, session.id)}
              />
            </div>
          ))}
        </div>

        {/* Config Status */}
        <div className="p-4 border-t border-[#E5E5E4] bg-[#F5F5F4]">
          <div className="flex items-center justify-between text-xs text-[#999999]">
            <div className="flex items-center gap-1.5 truncate max-w-[150px]">
              <div className={`w-2 h-2 rounded-full ${config ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="truncate">{config ? config.name : '未配置模型'}</span>
            </div>
            <Tooltip title="配置模型">
              <Button
                type="text"
                size="small"
                icon={<HiCog6Tooth />}
                onClick={() => navigate('/settings')}
              />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-[calc(100vh-64px)] relative">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {currentSession && currentSession.messages.length > 0 ? (
            <div className="max-w-3xl mx-auto pb-4">
              {currentSession.messages.map(renderMessage)}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#999999]">
              <div className="w-16 h-16 bg-white border border-[#E5E5E4] rounded-2xl flex items-center justify-center mb-4 text-3xl text-[#D97757]">
                <HiSparkles />
              </div>
              <p>开始一个新的对话吧</p>
              {!config && (
                <Button
                  type="link"
                  onClick={() => navigate('/settings')}
                  className="!text-[#D97757]"
                >
                  去配置模型
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 pt-2 bg-gradient-to-t from-[#F5F5F4] via-[#F5F5F4] to-transparent">
          <div className="max-w-3xl mx-auto relative bg-white rounded-2xl shadow-lg border border-[#E5E5E4] p-2 focus-within:ring-2 focus-within:ring-[#F4E5DF] transition-all">
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={config ? '输入问题，Shift+Enter 换行...' : '请先配置模型...'}
              disabled={!config}
              autoSize={{ minRows: 1, maxRows: 6 }}
              bordered={false}
              className="!resize-none text-base !mb-10 text-[#1F1F1F] placeholder:text-[#999999]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className="text-xs text-[#999999] mr-2 hidden sm:inline">
                基于本地知识库回答
              </span>
              <Button
                type="primary"
                shape="circle"
                icon={<HiArrowUp className="w-5 h-5" />}
                disabled={!input.trim() || loading || !config}
                loading={loading}
                onClick={handleSend}
                className={`flex items-center justify-center border-none shadow-none ${
                  input.trim() && !loading && config
                    ? '!bg-[#D97757] hover:!bg-[#C66A4A]'
                    : '!bg-[#E5E5E4] !text-white'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
