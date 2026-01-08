import React, { useState } from 'react'
import { Upload, Button, message, Card, Typography, List } from 'antd'
import { InboxOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'

const { Dragger } = Upload
const { Title } = Typography

const ImportPage: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [processedFiles, setProcessedFiles] = useState<{name: string, count: number}[]>([])

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    beforeUpload: async () => {
      // Prevent automatic upload
      return false
    },
    onChange: (info) => {
      setFileList(info.fileList)
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files)
    },
  }

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select files first')
      return
    }

    setProcessing(true)
    const filesToProcess = [...fileList]

    // Process files sequentially
    for (const file of filesToProcess) {
      try {
        // We need to access the file path. In Electron with webSecurity: false or nodeIntegration,
        // File object usually has 'path' property.
        const filePath = (file.originFileObj as any).path

        if (!filePath) {
          message.error(`Cannot get path for ${file.name}`)
          continue
        }

        message.loading({ content: `Processing ${file.name}...`, key: 'process' })

        const result = await window.api.ingestFile(file.originFileObj as File)

        if (result.success) {
          message.success({ content: `Processed ${file.name} (${result.count} chunks)`, key: 'process' })
          setProcessedFiles(prev => [...prev, { name: file.name, count: result.count || 0 }])
        } else {
          message.error({ content: `Failed to process ${file.name}: ${result.error}`, key: 'process' })
        }
      } catch (error: any) {
        message.error({ content: `Error processing ${file.name}: ${error.message}`, key: 'process' })
      }
    }

    setProcessing(false)
    setFileList([])
  }

  return (
    <div className="min-h-screen bg-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <Title level={2} className="mb-8 text-center font-light">Import Documents</Title>

        <Card className="shadow-sm border border-gray-200 mb-8">
          <Dragger {...props} style={{ padding: '40px 0' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#000' }} />
            </p>
            <p className="ant-upload-text">Click or drag files to this area to upload</p>
            <p className="ant-upload-hint">
              Support for PDF and DOCX files.
            </p>
          </Dragger>

          <div className="mt-4 flex justify-end">
            <Button
              type="primary"
              onClick={handleUpload}
              disabled={fileList.length === 0}
              loading={processing}
              size="large"
              style={{ backgroundColor: 'black', borderColor: 'black' }}
            >
              {processing ? 'Processing...' : 'Start Ingestion'}
            </Button>
          </div>
        </Card>

        {processedFiles.length > 0 && (
          <div className="mt-8">
            <Title level={4} className="mb-4">Recently Processed</Title>
            <List
              bordered
              dataSource={processedFiles}
              renderItem={(item) => (
                <List.Item>
                  <div className="flex items-center gap-2">
                    <CheckCircleOutlined className="text-green-500" />
                    <span className="font-medium">{item.name}</span>
                    <span className="text-gray-500 text-sm">({item.count} chunks)</span>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ImportPage
