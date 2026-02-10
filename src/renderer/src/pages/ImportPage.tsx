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
  HiInboxArrowDown,
  HiArrowPath,
  HiMagnifyingGlass,
  HiDocumentText,
  HiBookOpen,
  HiGlobeAlt
} from 'react-icons/hi2'
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
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
  const [webModalVisible, setWebModalVisible] = useState(false)
  const [webUrlsText, setWebUrlsText] = useState('')
  const [webIncludeSelectorsText, setWebIncludeSelectorsText] = useState('')
  const [webExcludeSelectorsText, setWebExcludeSelectorsText] = useState('')
  const [webSubmitting, setWebSubmitting] = useState(false)

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
    if (record.source_type === 'file') return '文件'
    if (record.source_type === 'web') return '网页'
    return '未知'
  }

  const displayedDocuments = useMemo(() => {
    if (typeFilter === 'all') return documents
    return documents.filter((d) => d.source_type === typeFilter)
  }, [documents, typeFilter])

  const parseSelectors = (input: string): string[] | undefined => {
    const list = input
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean)
    return list.length > 0 ? list : undefined
  }

  const handleWebImport = async () => {
    if (webSubmitting) return
    const urls = Array.from(
      new Set(
        webUrlsText
          .split(/\r?\n/g)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )
    if (urls.length === 0) {
      message.warning('请输入至少一个 URL（每行一个）')
      return
    }

    const invalid = urls.filter((u) => {
      try {
        const parsed = new URL(u)
        return !['http:', 'https:'].includes(parsed.protocol)
      } catch {
        return true
      }
    })
    if (invalid.length > 0) {
      message.error(`URL 不合法：${invalid.slice(0, 3).join('，')}${invalid.length > 3 ? '…' : ''}`)
      return
    }

    setWebSubmitting(true)
    try {
      const includeSelectors = parseSelectors(webIncludeSelectorsText)
      const excludeSelectors = parseSelectors(webExcludeSelectorsText)
      if (urls.length === 1) {
        const res = await window.api.ingestWeb({
          url: urls[0],
          includeSelectors,
          excludeSelectors
        })
        if (res.success) {
          message.success(`已提交导入，新增 ${res.count || 0} 条内容`)
        } else {
          message.error(res.error || '提交导入失败')
        }
      } else {
        const res = await window.api.ingestWebs(
          urls.map((url) => ({
            url,
            includeSelectors,
            excludeSelectors
          }))
        )
        if (res.success) {
          message.success(`已提交导入，新增 ${res.created || 0} 个网页`)
        } else {
          message.error(res.error || '提交导入失败')
        }
      }
      setWebUrlsText('')
      setWebIncludeSelectorsText('')
      setWebExcludeSelectorsText('')
      setWebModalVisible(false)
      fetchDocuments()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      message.error(`提交导入出错: ${msg}`)
    }
    setWebSubmitting(false)
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DocumentRecord) => (
        <div className="flex items-center gap-2">
          {record.source_type === 'web' ? (
            <HiGlobeAlt className="text-[#3B82F6]" />
          ) : record.name.toLowerCase().endsWith('.pdf') ? (
            <HiDocumentText className="text-[#D97757]" />
          ) : (
            <HiDocumentText className="text-[#666666]" />
          )}
          <span className="text-[#1F1F1F]">{text}</span>
        </div>
      )
    },
    {
      title: '来源',
      key: 'source',
      ellipsis: true,
      render: (_: unknown, record: DocumentRecord) => {
        const source = record.file_path || ''
        if (!source) return <span className="text-[#999999]">-</span>
        if (record.source_type === 'web') {
          return (
            <Typography.Link
              onClick={async (e) => {
                e.preventDefault()
                const res = await window.api.openExternal(source)
                if (!res.success) {
                  message.error(res.error || '打开链接失败')
                }
              }}
              className="!text-[#D97757]"
            >
              {source}
            </Typography.Link>
          )
        }
        return (
          <Typography.Text ellipsis={{ tooltip: source }} className="text-[#666666]">
            {source}
          </Typography.Text>
        )
      }
    },
    {
      title: '类型',
      key: 'type',
      width: 120,
      render: (_: unknown, record: DocumentRecord) => {
        const label = getSourceTypeLabel(record)
        const color =
          record.source_type === 'file'
            ? 'default'
            : record.source_type === 'web'
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
        const cfg = map[record.import_status] || map[2]
        return (
          <Tag color={cfg.color}>
            {record.import_status === 1 ? (
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
    console.log('selectedRowKeys', selectedRowKeys)
    if (selectedRowKeys.length === 0 || deleting) return
    setDeleteConfirmVisible(true)
  }

  const handleConfirmDelete = async () => {
    if (selectedRowKeys.length === 0) return
    setDeleting(true)
    try {
      const ids = selectedRowKeys.map((k) => String(k))
      const res = await window.api.deleteDocuments(ids)
      if (res.success) {
        message.success(`删除成功`)
        setSelectedRowKeys([])
        setDeleteConfirmVisible(false)
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

  return (
    <div className="min-h-full p-8 font-sans max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FBF5F2] flex items-center justify-center text-[#D97757]">
            <HiBookOpen className="text-xl" />
          </div>
          <div>
            <Title level={3} className="!mb-0 !font-bold !text-[#1F1F1F]">
              知识库管理
            </Title>
            <p className="text-[#999999] text-sm mt-1">管理您的本地文档资源</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<HiArrowPath />}
            shape="circle"
            onClick={fetchDocuments}
            className="border-[#E5E5E4] text-[#666666] hover:text-[#D97757] hover:border-[#F4E5DF] hover:bg-[#FBF5F2]"
          />
          <Button
            danger
            disabled={selectedRowKeys.length === 0 || deleting}
            onClick={handleDeleteSelected}
            className="hover:!bg-red-50 hover:!border-red-200"
          >
            删除所选
          </Button>
          <Button
            type="primary"
            icon={<HiInboxArrowDown />}
            className="!bg-[#D97757] hover:!bg-[#C66A4A] border-none h-9 px-5 rounded-lg shadow-sm hover:shadow-md transition-all"
            onClick={() => setUploadModalVisible(true)}
          >
            新增文档
          </Button>
          <Button
            icon={<HiGlobeAlt />}
            className="border-[#F4E5DF] bg-[#FBF5F2] text-[#D97757] hover:!bg-[#F4E5DF] hover:!border-[#F4E5DF] h-9 px-5 rounded-lg shadow-sm"
            onClick={() => setWebModalVisible(true)}
          >
            导入网页
          </Button>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center bg-white p-2 rounded-xl border border-[#E5E5E4] shadow-sm">
        <Input
          placeholder="搜索文档名称..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          bordered={false}
          className="max-w-md text-[#1F1F1F] placeholder:text-[#999999]"
          prefix={<HiMagnifyingGlass className="text-[#999999] mr-2" />}
        />
        <Segmented
          value={typeFilter}
          onChange={(val) => setTypeFilter(val as 'all' | 'file' | 'web')}
          options={[
            { label: '全部', value: 'all' },
            { label: '文件', value: 'file' },
            { label: '网页', value: 'web' }
          ]}
          className="bg-[#F5F5F4] p-1 rounded-lg"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5E4] shadow-sm overflow-hidden">
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
            showSizeChanger: false,
            className: 'px-6 py-4'
          }}
          loading={loading}
          size="middle"
          className="[&_.ant-table-thead_th]:!bg-[#F5F5F4] [&_.ant-table-thead_th]:!text-[#666666] [&_.ant-table-thead_th]:!font-medium [&_.ant-table-tbody_td]:!py-4"
        />
      </div>

      <Modal
        open={deleteConfirmVisible}
        onCancel={() => setDeleteConfirmVisible(false)}
        title={
          <div className="flex items-center gap-2 text-[#1F1F1F]">
            <span className="w-1 h-4 bg-red-500 rounded-full"></span>
            删除文档
          </div>
        }
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => setDeleteConfirmVisible(false)}
              disabled={deleting}
              className="rounded-lg"
            >
              取消
            </Button>
            <Button
              danger
              type="primary"
              onClick={handleConfirmDelete}
              loading={deleting}
              className="rounded-lg bg-red-500 hover:!bg-red-600"
            >
              确认删除
            </Button>
          </div>
        }
        width={400}
        className="[&_.ant-modal-content]:!rounded-2xl"
      >
        <div className="py-4 text-[#666666]">
          <p>确定要删除选中的 {selectedRowKeys.length} 个文档吗？</p>
          <p className="text-xs text-[#999999] mt-2">
            此操作将同时删除相关的向量数据，且不可恢复。
          </p>
        </div>
      </Modal>
      <Modal
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        title={<span className="text-[#1F1F1F] font-bold">上传文件</span>}
        width={600}
        className="[&_.ant-modal-content]:!rounded-2xl"
      >
        <div className="pt-4">
          <Dragger
            {...uploadProps}
            className="!border-[#E5E5E4] !bg-[#F5F5F4] hover:!border-[#D97757] [&_.ant-upload-drag-icon]:!mb-2"
            style={{ padding: '32px', borderRadius: '16px' }}
          >
            <p className="ant-upload-drag-icon">
              <HiInboxArrowDown className="!text-[#D97757] text-4xl mx-auto" />
            </p>
            <p className="ant-upload-text !text-[#1F1F1F] !text-base font-medium">
              点击或拖拽文件到此处上传
            </p>
            <p className="ant-upload-hint !text-[#999999]">支持 PDF 和 DOCX 文件</p>
          </Dragger>
          <div className="mt-6 flex justify-end">
            <Button
              type="primary"
              onClick={handleUpload}
              disabled={fileList.length === 0}
              loading={processing}
              className="!bg-[#D97757] hover:!bg-[#C66A4A] h-10 px-6 rounded-lg font-medium shadow-sm hover:shadow-md transition-all border-none"
            >
              {processing ? '处理中...' : '开始导入'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={webModalVisible}
        onCancel={() => setWebModalVisible(false)}
        footer={null}
        title={<span className="text-[#1F1F1F] font-bold">导入网页 URL</span>}
        width={640}
        className="[&_.ant-modal-content]:!rounded-2xl"
      >
        <div className="pt-4 space-y-4">
          <div>
            <div className="text-sm font-medium text-[#1F1F1F] mb-2">网页地址（每行一个）</div>
            <Input.TextArea
              value={webUrlsText}
              onChange={(e) => setWebUrlsText(e.target.value)}
              autoSize={{ minRows: 5, maxRows: 10 }}
              placeholder={`https://example.com\nhttps://example.com/docs`}
              className="rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setWebModalVisible(false)} disabled={webSubmitting}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleWebImport}
              loading={webSubmitting}
              className="!bg-[#D97757] hover:!bg-[#C66A4A] border-none rounded-lg h-10 px-6 font-medium shadow-sm hover:shadow-md transition-all"
            >
              开始导入
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ImportPage
