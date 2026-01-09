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

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const { TextArea } = Input
const { Title } = Typography

const SearchPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [tokens, setTokens] = useState<string[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<SearchResult | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [aiAnswerEnabled, setAiAnswerEnabled] = useState(false)

  const handleSearch = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    try {
      const response = await window.api.search(value)
      setResults(response.results)
      setTokens(response.tokens)
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
    if (!currentDoc || !currentDoc.document?.filePath) return <Empty description="Document not found" />

    const filePath = currentDoc.document.filePath
    const fileUrl = `file://${filePath}`

    const isPdf = filePath.toLowerCase().endsWith('.pdf')
    const pageNum = currentDoc.metadata?.page || 1

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
    <div className="min-h-screen bg-[#fafafa] text-black p-4 font-sans">
      <div className="max-w-3xl mx-auto pt-8">
        {/* Search Box */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6 focus-within:ring-2 focus-within:ring-black/5 transition-all">
          <TextArea 
             placeholder="基于您的资源搜索..." 
             autoSize={{ minRows: 2, maxRows: 6 }}
             bordered={false}
             className="text-lg bg-transparent mb-4 placeholder:text-gray-400 !px-0 text-center"
             style={{ resize: 'none' }}
             value={searchValue}
             onChange={e => setSearchValue(e.target.value)}
             onKeyDown={e => {
               if(e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 handleSearch(searchValue);
               }
             }}
          />
          <div className="flex justify-center items-center">
            <Button 
              type="primary" 
              shape="circle" 
              icon={<SendOutlined />} 
              size="large"
              className="bg-black hover:bg-gray-800 border-none shadow-none flex items-center justify-center"
              onClick={() => handleSearch(searchValue)}
              loading={loading}
            />
          </div>
        </div>

        {/* AI Answer Toggle */}
        <div className="border border-gray-200 rounded-lg p-4 mb-8 flex items-center justify-between shadow-sm">
          <span className="font-bold text-base">AI 回答</span>
          <Switch checked={aiAnswerEnabled} onChange={setAiAnswerEnabled} />
        </div>

        {/* Results */}
        <div>
          <Title level={5} className="mb-3 !text-base !font-semibold text-[#404040]">搜索结果</Title>
          <div className="min-h-[200px]">
             {results.length > 0 ? (
                <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={results}
                loading={loading}
                renderItem={(item) => (
                    <List.Item>
                    <Card
                        hoverable
                        className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        onClick={() => openPreview(item)}
                    >
                        <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <img src={brandIcon} alt="icon" className="w-4 h-4" />
                            <span className="font-medium text-black">{item.documentName}</span>
                            </div>
                            {item.metadata?.page && (
                            <Tag color="default">Page {item.metadata.page}</Tag>
                            )}
                        </div>
                        <TextHighlighter text={item.text} keywords={tokens} className="text-gray-600 mb-0 line-clamp-3" />
                        </div>
                    </Card>
                    </List.Item>
                )}
                />
             ) : (
               !loading && (
                 <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                        <img src={brandIcon} alt="icon" className="w-12 h-12 opacity-50" />
                    </div>
                    <span className="text-gray-400">暂无数据</span>
                 </div>
               )
             )}
             {loading && <div className="text-center py-10">Searching...</div>}
          </div>
        </div>

        <Modal
          title={currentDoc?.documentName}
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
