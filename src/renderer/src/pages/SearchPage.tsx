import React, { useState } from 'react'
import { Input, List, Card, Modal, Empty, Typography, Tag, Button } from 'antd'
import { SearchOutlined, FileTextOutlined, FilePdfOutlined } from '@ant-design/icons'
import { Document, Page, pdfjs } from 'react-pdf'
import DocViewer, { DocViewerRenderers } from 'react-doc-viewer'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import type { SearchResult } from '../types/global'

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const { Search } = Input
const { Title, Paragraph } = Typography

const SearchPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [tokens, setTokens] = useState<string[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<SearchResult | null>(null)

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

  const highlightText = (text: string, tokens: string[]) => {
    if (!tokens.length) return text

    // Create a regex from tokens, sorting by length descending to match longest first
    const sortedTokens = [...tokens].sort((a, b) => b.length - a.length)
    // Escape special regex chars in tokens
    const escapedTokens = sortedTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi')

    const parts = text.split(regex)

    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-200 text-black rounded px-0.5 mx-0.5 font-medium">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    )
  }

  const openPreview = (item: SearchResult) => {
    setCurrentDoc(item)
    setPreviewVisible(true)
  }

  const renderPreview = () => {
    if (!currentDoc || !currentDoc.document?.filePath) return <Empty description="Document not found" />

    const filePath = currentDoc.document.filePath
    // In Electron, we might need to use 'file://' protocol or handle it via a custom protocol if needed.
    // Usually local paths work if webSecurity is disabled or via `file://`.
    // Since we are in Electron renderer with nodeIntegration: false (default in electron-toolkit),
    // we might need to convert path to URL.
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
    <div className="min-h-screen bg-white text-black p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12 text-center">
          <Title level={2} className="mb-8 font-light tracking-tight">
            Knowledge Base
          </Title>
          <Search
            placeholder="Search documents..."
            allowClear
            enterButton={<Button type="primary" size="large" icon={<SearchOutlined />}>Search</Button>}
            size="large"
            onSearch={handleSearch}
            loading={loading}
            className="max-w-2xl mx-auto custom-search"
          />
        </div>

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
                      {item.sourceType === 'file' ? <FileTextOutlined /> : <FilePdfOutlined />}
                      <span className="font-medium text-black">{item.documentName}</span>
                    </div>
                    {item.metadata?.page && (
                      <Tag color="default">Page {item.metadata.page}</Tag>
                    )}
                  </div>
                  <Paragraph className="text-gray-600 mb-0" ellipsis={{ rows: 3, expandable: false }}>
                    {highlightText(item.text, tokens)}
                  </Paragraph>
                </div>
              </Card>
            </List.Item>
          )}
        />

        <Modal
          title={currentDoc?.documentName}
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          width="90%"
          style={{ top: 20 }}
          bodyStyle={{ height: '80vh', overflow: 'hidden', padding: 0 }}
          footer={null}
        >
          {renderPreview()}
        </Modal>
      </div>
    </div>
  )
}

export default SearchPage
