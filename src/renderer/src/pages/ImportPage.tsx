import React, { useState, useEffect } from 'react'
import { Upload, Button, message, Typography, Collapse, Input, Table, Modal } from 'antd'
import { 
  InboxOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  SettingOutlined, 
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
const { Panel } = Collapse

const ImportPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [keyword, setKeyword] = useState('')

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await window.api.listDocuments({ page: 1, pageSize: 100, keyword })
      setDocuments(res.items)
    } catch (error) {
      console.error(error)
      message.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [keyword])

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select files first')
      return
    }

    setProcessing(true)
    const filesToProcess = [...fileList]
    let processedCount = 0

    for (const file of filesToProcess) {
      try {
        const filePath = (file.originFileObj as any).path

        if (!filePath) {
          message.error(`Cannot get path for ${file.name}`)
          continue
        }

        const result = await window.api.ingestFile(file.originFileObj as File)

        if (result.success) {
          processedCount++
        } else {
          message.error(`Failed to process ${file.name}: ${result.error}`)
        }
      } catch (error: any) {
        message.error(`Error processing ${file.name}: ${error.message}`)
      }
    }

    setProcessing(false)
    setFileList([])
    setUploadModalVisible(false)
    if (processedCount > 0) {
        message.success(`Successfully processed ${processedCount} files`)
        fetchDocuments()
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    beforeUpload: () => false, // Prevent auto upload
    onChange: (info) => {
      setFileList(info.fileList)
    },
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DocumentRecord) => (
        <div className="flex items-center gap-2">
           {record.name.toLowerCase().endsWith('.pdf') ? <FilePdfOutlined className="text-red-500" /> : <FileTextOutlined className="text-blue-500" />}
           <span className="text-gray-700">{text}</span>
        </div>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 150,
      render: () => (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-gray-600">成功</span>
        </div>
      )
    }
  ]

  const genExtra = () => (
    <div onClick={e => e.stopPropagation()} className="flex gap-4 text-gray-400">
      <PlusOutlined className="cursor-pointer hover:text-black transition-colors" onClick={() => setUploadModalVisible(true)} />
      <DeleteOutlined className="cursor-pointer hover:text-black transition-colors" />
      <SettingOutlined className="cursor-pointer hover:text-black transition-colors" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
             <BookOutlined className="text-2xl" />
             <Title level={3} className="!mb-0 !font-bold">知识库</Title>
           </div>
           <div className="flex items-center gap-3">
             <Button icon={<ReloadOutlined />} shape="circle" onClick={fetchDocuments} className="border-none shadow-none hover:bg-gray-100" />
             <Button type="primary" className="bg-gray-800 hover:!bg-gray-700 border-none h-9 px-4 rounded">新增知识库</Button>
           </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex gap-2">
          <Input 
            placeholder="请输入名称" 
            size="large"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="rounded-lg border-gray-200 hover:border-gray-300 focus:border-black focus:shadow-none"
            suffix={<SearchOutlined className="text-gray-400 bg-gray-800 text-white p-2 rounded cursor-pointer" style={{ marginRight: -7 }} />}
          />
        </div>

        {/* KB List */}
        <div className="border border-gray-100 rounded-lg bg-gray-50/30">
            <Collapse 
            defaultActiveKey={['1']} 
            expandIconPosition="start"
            ghost
            className="custom-collapse"
            >
            <Panel 
                header={<span className="font-medium text-base ml-1">test</span>} 
                key="1" 
                extra={genExtra()}
                className="!border-b-0"
            >
                <div className="bg-white rounded-lg border border-gray-100 overflow-hidden mt-2">
                    <Table 
                    dataSource={documents} 
                    columns={columns} 
                    rowKey="id"
                    pagination={{ 
                        pageSize: 10,
                        position: ['bottomRight'],
                        size: 'small',
                        showSizeChanger: false
                    }}
                    rowSelection={{ type: 'checkbox' }}
                    loading={loading}
                    size="middle"
                    className="custom-table"
                    />
                </div>
            </Panel>
            </Collapse>
        </div>
        
        {/* Upload Modal */}
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
            <p className="ant-upload-hint">
              支持 PDF 和 DOCX 文件
            </p>
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
