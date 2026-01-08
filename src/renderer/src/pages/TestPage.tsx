import React, { useEffect, useState } from 'react'
import type { RendererSearchResult, RendererDocumentItem } from '../types/global'
import { Input, Button, Upload, message, List, Card, Typography, Segmented, Table, Modal } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

const { Paragraph } = Typography

function TestPage(): React.JSX.Element {
  const [searchResults, setSearchResults] = useState<RendererSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'ftsSearch' | 'vectorSearch' | 'hybridSearch'>('hybridSearch')
  const [view, setView] = useState<'search' | 'data'>('search')
  const [dataItems, setDataItems] = useState<RendererDocumentItem[]>([])
  const [dataKeyword, setDataKeyword] = useState<string>('')
  const [dataPage, setDataPage] = useState<number>(1)
  const [dataPageSize, setDataPageSize] = useState<number>(10)
  const [dataTotal, setDataTotal] = useState<number>(0)
  const [dataLoading, setDataLoading] = useState<boolean>(false)
  const [detailOpen, setDetailOpen] = useState<boolean>(false)
  const [detailText, setDetailText] = useState<string>('')
  const [detailTitle, setDetailTitle] = useState<string>('')
  const [dropOpen, setDropOpen] = useState<boolean>(false)
  const [dropLoading, setDropLoading] = useState<boolean>(false)

  const handleDropDocuments = () => {
    setDropOpen(true)
  }

  const handleConfirmDrop = async () => {
    setDropLoading(true)
    try {
      const res = await window.api.dropDocumentsTable()
      if (res.success) {
        message.success('已删除 document 表')
        setSearchResults([])
        setDataItems([])
        setDataTotal(0)
        setDropOpen(false)
      } else {
        message.error(res.error || '删除失败')
      }
    } catch (error) {
      console.error(error)
      message.error('删除出错')
    } finally {
      setDropLoading(false)
    }
  }

  const openTextModal = (text: string, title?: string) => {
    setDetailText(text || '')
    setDetailTitle(title || '全文')
    setDetailOpen(true)
  }

  const handleSearch = async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    try {
      let results: RendererSearchResult[] = []
      if (mode === 'ftsSearch') {
        results = await window.api.ftsSearch(value)
      } else if (mode === 'vectorSearch') {
        results = await window.api.vectorSearch(value)
      } else {
        results = await window.api.hybridSearch(value)
      }
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

  const loadDocuments = async (page = dataPage, pageSize = dataPageSize, keyword = dataKeyword) => {
    setDataLoading(true)
    try {
      const res = await window.api.listDocuments({ keyword, page, pageSize })
      setDataItems(res.items)
      setDataTotal(res.total)
      setDataPage(page)
      setDataPageSize(pageSize)
    } catch (error) {
      console.error(error)
      message.error('Load documents failed')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    if (view === 'data') {
      loadDocuments(1, dataPageSize, dataKeyword)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  return (
    <div className="p-8 max-w-4xl mx-auto h-screen flex flex-col">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">NCurator Local Search</h1>

      <div className="flex gap-4 mb-8">
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />}>Upload Document</Button>
        </Upload>

        <Segmented
          options={[
            { label: 'Search', value: 'search' },
            { label: 'Data', value: 'data' }
          ]}
          value={view}
          onChange={(val) => setView(val as typeof view)}
        />

        <Segmented
          options={[
            { label: 'Hybrid', value: 'hybridSearch' },
            { label: 'FTS', value: 'ftsSearch' },
            { label: 'Vector', value: 'vectorSearch' }
          ]}
          value={mode}
          onChange={(val) => setMode(val as typeof mode)}
        />

        <Button danger onClick={handleDropDocuments}>删除 document 表</Button>

        {view === 'search' ? (
          <Input.Search
            placeholder="Search knowledge base..."
            enterButton="Search"
            size="large"
            onSearch={handleSearch}
            loading={loading}
            className="flex-1"
          />
        ) : (
          <Input.Search
            placeholder="Filter by keyword..."
            enterButton="Filter"
            size="large"
            onSearch={(v) => {
              setDataKeyword(v)
              loadDocuments(1, dataPageSize, v)
            }}
            loading={dataLoading}
            className="flex-1"
          />
        )}
      </div>

      {view === 'search' ? (
        <div className="flex-1 overflow-auto">
          <List
            dataSource={searchResults}
            rowKey="id"
            renderItem={(item) => (
              <List.Item>
                <Card
                  title={<span className="text-sm text-gray-800">{item.filename}</span>}
                  className="w-full shadow-sm hover:shadow-md transition-shadow"
                >
                  <Paragraph
                    ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
                    onClick={() => openTextModal(item.text, item.filename)}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.text}
                  </Paragraph>
                  <div className="text-xs text-gray-500 mt-3 flex flex-wrap gap-4">
                    <span>ID: {item.id}</span>
                    <span>
                      Created:{' '}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}
                    </span>
                    {mode !== 'vectorSearch' && (
                      <span>
                        _score:{' '}
                        {typeof item._score === 'number' ? item._score.toFixed(6) : 'N/A'}
                      </span>
                    )}
                    {mode === 'hybridSearch' && (
                      <span>
                        _relevance_score:{' '}
                        {typeof item._relevance_score === 'number'
                          ? item._relevance_score.toFixed(6)
                          : 'N/A'}
                      </span>
                    )}
                    {mode === 'vectorSearch' && (
                      <span>
                        _distance:{' '}
                        {typeof item._distance === 'number'
                          ? item._distance.toFixed(6)
                          : 'N/A'}
                      </span>
                    )}
                  </div>
                </Card>
              </List.Item>
            )}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <Table<RendererDocumentItem>
            dataSource={dataItems}
            rowKey="id"
            loading={dataLoading}
            pagination={{
              current: dataPage,
              pageSize: dataPageSize,
              total: dataTotal,
              onChange: (page, pageSize) => {
                loadDocuments(page, pageSize, dataKeyword)
              }
            }}
            columns={[
              {
                title: 'ID',
                dataIndex: 'id',
                key: 'id',
                render: (text: string) => <Typography.Text copyable={{ text }}>{text}</Typography.Text>
              },
              {
                title: 'Filename',
                dataIndex: 'filename',
                key: 'filename',
                ellipsis: true
              },
              {
                title: 'Text',
                dataIndex: 'text',
                key: 'text',
                render: (text: string, record: RendererDocumentItem) => (
                  <Paragraph
                    ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
                    onClick={() => openTextModal(text, record.filename)}
                    style={{ cursor: 'pointer' }}
                  >
                    {text}
                  </Paragraph>
                )
              },
              {
                title: 'TokenizedText',
                dataIndex: 'tokenizedText',
                key: 'tokenizedText',
                render: (text: string, record: RendererDocumentItem) => (
                  <Paragraph
                    ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
                    onClick={() => openTextModal(text, record.filename)}
                    style={{ cursor: 'pointer' }}
                  >
                    {text}
                  </Paragraph>
                )
              },
              {
                title: 'Created',
                dataIndex: 'createdAt',
                key: 'createdAt',
                render: (v?: number) => (v ? new Date(v).toLocaleString() : 'N/A')
              },
              {
                title: 'Vector',
                dataIndex: 'vector',
                key: 'vector',
                render: (_: number[], record: RendererDocumentItem) => (
                  <Typography.Text copyable={{ text: JSON.stringify(record.vector) }}>...</Typography.Text>
                )
              }
            ]}
          />
        </div>
      )}
      <Modal
        open={dropOpen}
        title="确认删除 document 表"
        onOk={handleConfirmDrop}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: dropLoading }}
        onCancel={() => setDropOpen(false)}
      >
        该操作将清空所有已索引数据，且不可恢复。
      </Modal>
      <Modal
        open={detailOpen}
        title={detailTitle}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={800}
      >
        <Paragraph
          copyable={{ text: detailText }}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {detailText}
        </Paragraph>
      </Modal>
    </div>
  )
}

export default TestPage
