import React, { useState, useEffect, useMemo } from 'react'
import {
  Upload,
  Button,
  message,
  Typography,
  Input,
  Table,
  Modal,
  Segmented,
  Tag,
  Spin
} from 'antd'
import {
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  BookOutlined
} from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import type { DocumentRecord } from '../../../shared/types'

const { Dragger } = Upload
const { Title } = Typography

const ImportPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'file' | 'web'>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [deleting, setDeleting] = useState(false)

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await window.api.listDocuments({ page: 1, pageSize: 100, keyword })
      setDocuments(res.items)
    } catch (error) {
      console.error(error)
      message.error('加载文档失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [keyword])

  useEffect(() => {
    const handler = () => {
      fetchDocuments()
    }
    window.api.documentListRefresh(handler)
    return () => {
      window.api.removeDocumentListRefreshListeners?.()
    }
  }, [])

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件')
      return
    }

    setProcessing(true)
    try {
      const origins = fileList
        .map((f) => f.originFileObj)
        .filter(Boolean)
        .map((f) => f as File)
      const result = await window.api.ingestFiles(origins)
      if (result.success) {
        message.success(`已提交导入，新增 ${result.created || 0} 个文档`)
      } else {
        message.error(result.error || '提交导入失败')
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      message.error(`提交导入出错: ${msg}`)
    }

    setProcessing(false)
    setFileList([])
    setUploadModalVisible(false)
    fetchDocuments()
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    accept: '.pdf,.docx',
    beforeUpload: (file) => {
      const name = file.name.toLowerCase()
      const ok = name.endsWith('.pdf') || name.endsWith('.docx')
      if (!ok) {
        message.warning('仅支持 PDF 或 DOCX 文件')
        return Upload.LIST_IGNORE
      }
      return false
    },
    onChange: (info) => {
      setFileList(info.fileList)
    }
  }

  const getSourceTypeLabel = (record: DocumentRecord) => {
    if (record.sourceType === 'file') return '文件'
    if (record.sourceType === 'web') return '网页'
    return '未知'
  }

  const displayedDocuments = useMemo(() => {
    if (typeFilter === 'all') return documents
    return documents.filter((d) => d.sourceType === typeFilter)
  }, [documents, typeFilter])

  console.log('displayedDocuments', displayedDocuments)

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DocumentRecord) => (
        <div className="flex items-center gap-2">
          {record.name.toLowerCase().endsWith('.pdf') ? (
            <FilePdfOutlined className="text-red-500" />
          ) : (
            <FileTextOutlined className="text-blue-500" />
          )}
          <span className="text-gray-700">{text}</span>
        </div>
      )
    },
    {
      title: '类型',
      key: 'type',
      width: 120,
      render: (_: unknown, record: DocumentRecord) => {
        const label = getSourceTypeLabel(record)
        const color =
          record.sourceType === 'file'
            ? 'default'
            : record.sourceType === 'web'
              ? 'blue'
              : 'default'
        return <Tag color={color}>{label}</Tag>
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: unknown, record: DocumentRecord) => {
        const map: Record<number, { text: string; color: string }> = {
          1: { text: '导入中', color: 'default' },
          2: { text: '成功', color: 'green' },
          3: { text: '失败', color: 'red' }
        }
        const cfg = map[record.importStatus] || map[2]
        return (
          <Tag color={cfg.color}>
            {record.importStatus === 1 ? (
              <>
                <Spin size="small" style={{ marginRight: 6 }} />
                {cfg.text}
              </>
            ) : (
              cfg.text
            )}
          </Tag>
        )
      }
    }
  ]

  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0 || deleting) return
    Modal.confirm({
      title: '删除文档',
      content: '确定删除所选文档？将同时删除相关分片',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleting(true)
        try {
          const ids = selectedRowKeys.map((k) => String(k))
          const res = await window.api.deleteDocuments(ids)
          if (res.success) {
            message.success(
              `删除成功，文档 ${res.deletedDocs || 0} 个，分片 ${res.deletedChunks || 0} 个`
            )
            setSelectedRowKeys([])
            fetchDocuments()
          } else {
            message.error(res.error || '删除失败')
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          message.error(`删除出错: ${msg}`)
        }
        setDeleting(false)
      }
    })
  }

  return (
    <div className="min-h-screen bg-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BookOutlined className="text-2xl" />
            <Title level={3} className="!mb-0 !font-bold">
              知识库
            </Title>
          </div>
          <div className="flex items-center gap-3">
            <Button
              icon={<ReloadOutlined />}
              shape="circle"
              onClick={fetchDocuments}
              className="border-none shadow-none hover:bg-gray-100"
            />
            <Button
              danger
              disabled={selectedRowKeys.length === 0 || deleting}
              onClick={handleDeleteSelected}
            >
              删除所选
            </Button>
            <Button
              type="primary"
              className="bg-gray-800 hover:!bg-gray-700 border-none h-9 px-4 rounded"
              onClick={() => setUploadModalVisible(true)}
            >
              新增文档
            </Button>
          </div>
        </div>

        <div className="mb-6 flex gap-2 items-center">
          <Input
            placeholder="请输入关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="rounded-lg border-gray-200 hover:border-gray-300 focus:border-black focus:shadow-none"
            suffix={
              <SearchOutlined
                className="text-gray-400 text-white p-2 rounded cursor-pointer"
                style={{ marginRight: -7 }}
              />
            }
          />
          <Segmented
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as 'all' | 'file' | 'web')}
            options={[
              { label: '全部', value: 'all' },
              { label: '文件', value: 'file' },
              { label: '网页', value: 'web' }
            ]}
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <Table
            dataSource={displayedDocuments}
            columns={columns}
            rowKey="id"
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys)
            }}
            pagination={{
              pageSize: 10,
              position: ['bottomRight'],
              size: 'small',
              showSizeChanger: false
            }}
            loading={loading}
            size="middle"
            className="custom-table"
          />
        </div>

        <Modal
          open={uploadModalVisible}
          onCancel={() => setUploadModalVisible(false)}
          footer={null}
          title="上传文件"
          width={600}
        >
          <Dragger {...uploadProps} style={{ padding: '20px' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#000' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p className="ant-upload-hint">支持 PDF 和 DOCX 文件</p>
          </Dragger>
          <div className="mt-4 flex justify-end">
            <Button
              type="primary"
              onClick={handleUpload}
              disabled={fileList.length === 0}
              loading={processing}
              className="bg-black hover:!bg-gray-800"
            >
              {processing ? '处理中...' : '开始导入'}
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  )
}

export default ImportPage
