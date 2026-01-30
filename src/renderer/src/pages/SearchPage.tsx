import React, { useState, useEffect } from 'react'
import { Input, List, Card, Empty, Typography, Button, Switch } from 'antd'
import { HiArrowUp, HiOutlineDocumentText } from 'react-icons/hi2'
import type { SearchResult } from '../../../shared/types'
import TextHighlighter from '../components/TextHighlighter'
import { parseIpcResult } from '../utils/serialization'
import FileRender, { FileRenderDocument } from '../components/fileRenders'
import { getActiveConfig, streamCompletion, ChatMessage } from '../services/llmService'
import MarkdownRenderer from '../components/MarkdownRenderer'

const { TextArea } = Input

const SearchPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [tokens, setTokens] = useState<string[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<SearchResult | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [aiAnswerEnabled, setAiAnswerEnabled] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<string>('')
  const [aiGenerating, setAiGenerating] = useState(false)

  useEffect(() => {
    // Check if model is ready when component mounts
  }, [])

  const generateAiAnswer = async (query: string, docs: SearchResult[]) => {
    const config = getActiveConfig()
    if (!config) {
      setAiAnswer('请先在设置页配置 AI 模型参数')
      return
    }

    if (docs.length === 0) {
      setAiAnswer('未找到相关文档，无法生成回答。')
      return
    }

    setAiGenerating(true)
    setAiAnswer('')

    const contextText = docs
      .slice(0, 5)
      .map((c, i) => `[${i + 1}] 文档: ${c.document_name}\n内容: ${c.text}`)
      .join('\n\n')

    const systemPrompt = `你是一个智能助手。请严格基于以下提供的上下文信息回答用户的问题。如果上下文中没有答案，请诚实告知“未找到相关信息”。
请使用中文回答。
请使用 Markdown 格式回答。

上下文信息：
${contextText}`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ]

    await streamCompletion(
      messages,
      config,
      (chunk) => {
        setAiAnswer((prev) => prev + chunk)
      },
      (error) => {
        console.error('AI generation error:', error)
        setAiAnswer('AI 回答生成失败: ' + error.message)
        setAiGenerating(false)
      },
      () => {
        setAiGenerating(false)
      }
    )
  }

  const handleSearch = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    // Clear previous AI answer if new search
    setAiAnswer('')

    try {
      const response = await window.api.search(value)
      const parsedResults = response.results.map(parseIpcResult)
      console.log('Search results:', parsedResults)
      setResults(parsedResults)
      setTokens(response.tokens)

      if (aiAnswerEnabled) {
        generateAiAnswer(value, parsedResults)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAiSwitchChange = (checked: boolean) => {
    if (checked) {
      const config = getActiveConfig()
      if (!config) {
        window.dispatchEvent(new Event('check-llm-config'))
        return
      }
    }
    setAiAnswerEnabled(checked)
    if (checked && results.length > 0 && searchValue.trim()) {
      generateAiAnswer(searchValue, results)
    }
  }

  const openPreview = (item: SearchResult) => {
    setCurrentDoc(item)
    setPreviewVisible(true)
  }

  const previewDocuments: FileRenderDocument[] =
    currentDoc && currentDoc.document?.file_path
      ? [
          {
            uri: '', // Will be generated from filePath
            filePath: currentDoc.document.file_path,
            fileName: currentDoc.document_name,
            metadata: {
              pageNumber: (currentDoc.metadata as any)?.page || 1
            }
          }
        ]
      : []

  return (
    <div className="min-h-full p-6 font-sans max-w-4xl mx-auto">
      <div className="pt-8">
        {/* Search Box */}
        <div className="bg-white border border-[#E5E5E4] rounded-2xl p-3 shadow-sm mb-6 focus-within:ring-4 focus-within:ring-[#F4E5DF] focus-within:border-[#D97757] transition-all duration-300 relative group">
          <TextArea
            placeholder="基于您的资源搜索..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            bordered={false}
            className="text-lg bg-transparent mb-2 placeholder:text-[#999999] !px-1 text-[#1F1F1F] min-h-[60px]"
            style={{ resize: 'none' }}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSearch(searchValue)
              }
            }}
          />
          <div className="flex justify-between items-center px-1">
            <div className="text-xs text-[#999999] font-medium">Enter 发送，Shift + Enter 换行</div>
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<HiArrowUp className="w-5 h-5" />}
              className={`border-none shadow-none flex items-center justify-center transition-all duration-300 ${
                searchValue.trim()
                  ? '!bg-[#D97757] hover:!bg-[#C66A4A] scale-100'
                  : '!bg-[#E5E5E4] !text-white scale-95'
              }`}
              onClick={() => handleSearch(searchValue)}
              loading={loading}
              disabled={!searchValue.trim()}
            />
          </div>
        </div>

        {/* AI Answer Section */}
        <div
          className={`bg-white border border-[#E5E5E4] rounded-2xl shadow-sm mb-8 p-6 transition-all duration-500 ${aiAnswerEnabled ? 'opacity-100 translate-y-0' : 'opacity-80'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#D97757] flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="font-bold text-base text-[#1F1F1F]">智能回答</span>
            </div>
            <Switch
              checked={aiAnswerEnabled}
              onChange={handleAiSwitchChange}
              className="bg-[#E5E5E4] hover:bg-[#D4D4D3] [&.ant-switch-checked]:!bg-[#D97757]"
            />
          </div>

          {aiAnswerEnabled && (
            <div className="pt-2">
              {aiGenerating ? (
                <div className="flex items-center gap-2 text-[#D97757]">
                  <span className="loading loading-dots loading-sm"></span>
                  <span>AI 思考中...</span>
                </div>
              ) : aiAnswer ? (
                <MarkdownRenderer content={aiAnswer} />
              ) : (
                <span className="text-[#999999] italic">等待提问...</span>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          <div className="min-h-[200px]">
            {results.length > 0 ? (
              <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={results}
                loading={loading}
                split={false}
                renderItem={(item) => (
                  <List.Item className="!mb-4">
                    <Card
                      hoverable
                      bordered={false}
                      className="group bg-white border border-[#E5E5E4] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-xl overflow-hidden"
                      bodyStyle={{ padding: '20px' }}
                      onClick={() => openPreview(item)}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="p-1.5 rounded-lg bg-[#FBF5F2] border border-[#F4E5DF] group-hover:bg-[#F4E5DF] transition-colors">
                              <HiOutlineDocumentText className="w-4 h-4 text-[#D97757]" />
                            </div>
                            <span className="font-semibold text-[#1F1F1F] truncate text-[15px] group-hover:text-[#D97757] transition-colors">
                              {item.document_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#999999]">
                            {item.source_type === 'file' ? (
                              <span className="bg-[#F5F5F4] px-1.5 py-0.5 rounded text-[#666666] font-medium">
                                FILE
                              </span>
                            ) : (
                              <span className="bg-[#FBF5F2] px-1.5 py-0.5 rounded text-[#D97757] font-medium">
                                WEB
                              </span>
                            )}
                            <span>•</span>
                            <span>ID: {item.document_id?.substring(0, 6)}</span>
                          </div>
                        </div>
                        <Typography.Paragraph
                          ellipsis={{ rows: 3, expandable: false }}
                          className="!mb-0 text-[#666666] !text-[14px] leading-relaxed"
                        >
                          <TextHighlighter
                            text={item.text}
                            keywords={tokens}
                            className="text-[#666666]"
                          />
                        </Typography.Paragraph>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              !loading && (
                <div className="flex items-center justify-center py-20">
                  <Empty description="暂无数据" />
                </div>
              )
            )}
            {loading && <div className="text-center py-10 text-[#999999]">Searching...</div>}
          </div>
        </div>

        <FileRender
          open={previewVisible}
          documents={previewDocuments}
          onCancel={() => setPreviewVisible(false)}
        />
      </div>
    </div>
  )
}

export default SearchPage
