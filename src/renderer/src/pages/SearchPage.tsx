import React, { useState } from 'react'
import { Input, List, Card, Modal, Empty, Typography, Tag, Button, Switch } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { Document, Page, pdfjs } from 'react-pdf'
import DocViewer, { DocViewerRenderers } from 'react-doc-viewer'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import type { SearchResult } from '../../../shared/types'
import TextHighlighter from '../components/TextHighlighter'
import brandIcon from '../../../../resources/icon.png'
import { parseIpcResult } from '../utils/serialization'

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

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

  const handleSearch = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    try {
      const response = await window.api.search(value)
      const parsedResults = response.results.map(parseIpcResult)
      setResults(parsedResults)
      setTokens(response.tokens)
      if (aiAnswerEnabled) {
        const snippet = parsedResults?.[0]?.text || ''
        setAiAnswer(snippet || 'AI 正在准备回答...')
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const openPreview = (item: SearchResult) => {
    setCurrentDoc(item)
    setPreviewVisible(true)
  }

  const renderPreview = () => {
    if (!currentDoc || !currentDoc.document?.file_path)
      return <Empty description="Document not found" />

    const filePath = currentDoc.document.file_path
    const fileUrl = `file://${filePath}`

    const isPdf = filePath.toLowerCase().endsWith('.pdf')
    const pageNum = (currentDoc.metadata as any)?.page || 1

    if (isPdf) {
      return (
        <div className="flex justify-center bg-gray-100 p-4 h-full overflow-auto">
          <Document
            file={fileUrl}
            onLoadError={(error) => console.error('Error loading PDF:', error)}
            loading={<div className="p-4">Loading PDF...</div>}
          >
            <Page
              pageNumber={pageNum}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={800}
            />
          </Document>
        </div>
      )
    } else {
      // DocViewer for other types
      const docs = [{ uri: fileUrl }]
      return (
        <DocViewer
          documents={docs}
          pluginRenderers={DocViewerRenderers}
          style={{ height: '100%' }}
        />
      )
    }
  }

  return (
    <div className="min-h-full p-6 font-sans max-w-4xl mx-auto">
      <div className="pt-8">
        {/* Search Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm mb-6 focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-300 transition-all duration-300 relative group">
          <TextArea
            placeholder="基于您的资源搜索..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            bordered={false}
            className="text-lg bg-transparent mb-2 placeholder:text-slate-400 !px-1 text-slate-800 min-h-[60px]"
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
            <div className="text-xs text-slate-400 font-medium">Enter 发送，Shift + Enter 换行</div>
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<SendOutlined />}
              className={`border-none shadow-none flex items-center justify-center transition-all duration-300 ${
                searchValue.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 scale-100'
                  : 'bg-slate-200 text-slate-400 scale-95'
              }`}
              onClick={() => handleSearch(searchValue)}
              loading={loading}
              disabled={!searchValue.trim()}
            />
          </div>
        </div>

        {/* AI Answer Section */}
        <div
          className={`bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 p-6 transition-all duration-500 ${aiAnswerEnabled ? 'opacity-100 translate-y-0' : 'opacity-80'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="font-bold text-base text-slate-800">智能回答</span>
            </div>
            <Switch
              checked={aiAnswerEnabled}
              onChange={setAiAnswerEnabled}
              className="bg-slate-200 hover:bg-slate-300 [&.ant-switch-checked]:bg-blue-600"
            />
          </div>

          {aiAnswerEnabled && (
            <div className="pt-2">
              <Typography.Paragraph
                className="text-slate-600 text-[15px] leading-relaxed mb-0"
                ellipsis={{
                  rows: 8,
                  expandable: true,
                  symbol: <span className="text-blue-600 font-medium ml-1">展开</span>
                }}
              >
                {aiAnswer || <span className="text-slate-400 italic">等待提问...</span>}
              </Typography.Paragraph>
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
                      className="group bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-xl overflow-hidden"
                      bodyStyle={{ padding: '20px' }}
                      onClick={() => openPreview(item)}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                              <img
                                src={brandIcon}
                                alt="icon"
                                className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
                              />
                            </div>
                            <span className="font-semibold text-slate-800 truncate text-[15px] group-hover:text-blue-700 transition-colors">
                              {item.document_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {item.source_type === 'file' ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">
                                FILE
                              </span>
                            ) : (
                              <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 font-medium">
                                WEB
                              </span>
                            )}
                            <span>•</span>
                            <span>ID: {item.document_id?.substring(0, 6)}</span>
                          </div>
                        </div>
                        <Typography.Paragraph
                          ellipsis={{ rows: 3, expandable: false }}
                          className="!mb-0 text-slate-600 !text-[14px] leading-relaxed"
                        >
                          <TextHighlighter
                            text={item.text}
                            keywords={tokens}
                            className="text-slate-600"
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
            {loading && <div className="text-center py-10">Searching...</div>}
          </div>
        </div>

        <Modal
          title={currentDoc?.document_name}
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          width="90%"
          style={{ top: 20 }}
          styles={{ body: { height: '80vh', overflow: 'hidden', padding: 0 } }}
          footer={null}
        >
          {renderPreview()}
        </Modal>
      </div>
    </div>
  )
}

export default SearchPage
