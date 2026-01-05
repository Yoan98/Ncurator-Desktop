import React, { useState } from 'react'
import type { RendererSearchResult } from './types/global'
import { Input, Button, Upload, message, List, Card, Typography } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

const { Paragraph } = Typography

function App(): React.JSX.Element {
  const [searchResults, setSearchResults] = useState<RendererSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    try {
      const results = await window.api.search(value)
      console.log('🔎 [SEARCH] RESULTS APP:', results)
      setSearchResults(results)
    } catch (error) {
      console.error(error)
      message.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File) => {
    if (!file) {
      message.error('Could not get file path')
      return Upload.LIST_IGNORE
    }

    try {
      message.loading({ content: 'Ingesting file...', key: 'ingest', duration: 0 })
      const result = await window.api.ingestFile(file)
      if (result.success) {
        message.success({ content: `Ingested ${result.count} chunks`, key: 'ingest' })
      } else {
        message.error({ content: `Ingestion failed: ${result.error}`, key: 'ingest' })
      }
    } catch (error) {
      console.error(error)
      message.error({ content: 'Ingestion error', key: 'ingest' })
    }
    return Upload.LIST_IGNORE // Prevent upload
  }

  return (
    <div className="p-8 max-w-4xl mx-auto h-screen flex flex-col">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">NCurator Local Search</h1>

      <div className="flex gap-4 mb-8">
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />}>Upload Document</Button>
        </Upload>

        <Input.Search
          placeholder="Search knowledge base..."
          enterButton="Search"
          size="large"
          onSearch={handleSearch}
          loading={loading}
          className="flex-1"
        />
      </div>

      <div className="flex-1 overflow-auto">
        <List
          dataSource={searchResults}
          renderItem={(item) => (
            <List.Item>
              <Card
                title={<span className="text-sm text-gray-800">{item.filename}</span>}
                className="w-full shadow-sm hover:shadow-md transition-shadow"
              >
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                  {item.text}
                </Paragraph>
                <div className="text-xs text-gray-500 mt-3 flex flex-wrap gap-4">
                  <span>ID: {item.id}</span>
                  <span>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</span>
                  <span>
                    _score: {typeof item._score === 'number' ? item._score.toFixed(6) : 'N/A'}
                  </span>
                  <span>
                    _relevance_score:{' '}
                    {typeof item._relevance_score === 'number'
                      ? item._relevance_score.toFixed(6)
                      : 'N/A'}
                  </span>
                </div>
              </Card>
            </List.Item>
          )}
        />
      </div>
    </div>
  )
}

export default App
