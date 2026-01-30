import React, { useState, useEffect } from 'react'
import { Card, Button, Progress, Typography, Steps, message, Tag } from 'antd'
import { HiCloudArrowDown, HiCheckCircle, HiExclamationCircle, HiCube } from 'react-icons/hi2'

const { Title, Paragraph } = Typography

const MODEL_ID = 'jinaai/jina-embeddings-v2-base-zh'

const ModelDownloadPage: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'completed' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState('')
  const [fileProgress, setFileProgress] = useState({ completed: 0, total: 0 })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const handleProgress = (data: {
      repoId: string
      file?: string
      status: string
      progress: number
      totalFiles?: number
      completedFiles?: number
      error?: string
    }) => {
      if (data.repoId !== MODEL_ID) return

      if (data.status === 'downloading') {
        setStatus('downloading')
        setProgress(data.progress)
        if (data.file) setCurrentFile(data.file)
        if (data.totalFiles) {
          setFileProgress({
            completed: data.completedFiles || 0,
            total: data.totalFiles
          })
        }
      } else if (data.status === 'completed') {
        setStatus('completed')
        setProgress(100)
        message.success('模型下载完成！')
      } else if (data.status === 'error') {
        setStatus('error')
        setErrorMsg(data.error || '未知错误')
        message.error('下载失败: ' + data.error)
      }
    }

    window.api.onDownloadProgress(handleProgress)

    return () => {
      window.api.removeDownloadProgressListeners()
    }
  }, [])

  const handleDownload = async () => {
    setStatus('downloading')
    setProgress(0)
    setErrorMsg('')
    try {
      const res = await window.api.downloadModel(MODEL_ID)
      if (!res.success) {
        setStatus('error')
        setErrorMsg(res.error || '启动下载失败')
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message)
    }
  }

  return (
    <div className="min-h-full p-8 font-sans max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#FBF5F2] flex items-center justify-center text-[#D97757]">
          <HiCloudArrowDown className="text-xl" />
        </div>
        <div>
          <Title level={3} className="!mb-0 !font-bold !text-[#1F1F1F]">
            模型下载
          </Title>
          <p className="text-[#999999] text-sm mt-1">
            下载本地向量模型，为您的知识库提供语义搜索能力
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Explanation */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-white border border-[#E5E5E4] shadow-sm !rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <HiCube className="text-[#D97757] text-lg" />
              <span className="font-bold text-[#1F1F1F]">什么是向量模型？</span>
            </div>
            <Paragraph className="text-[#666666] text-sm leading-relaxed">
              向量模型（Embedding Model）是将文本转换为数值向量的 AI 模型。
            </Paragraph>
            <Paragraph className="text-[#666666] text-sm leading-relaxed">
              它能捕捉文字背后的<span className="text-[#D97757] font-medium">语义信息</span>
              ，使得计算机能够理解“苹果”和“水果”是相关的，而不仅仅是匹配关键词。
            </Paragraph>
            <Paragraph className="text-[#666666] text-sm leading-relaxed !mb-0">
              这是实现<span className="text-[#D97757] font-medium">语义搜索</span>和
              <span className="text-[#D97757] font-medium">RAG（检索增强生成）</span>的核心组件。
            </Paragraph>
          </Card>

          <Steps
            direction="vertical"
            size="small"
            current={status === 'completed' ? 2 : status === 'downloading' ? 1 : 0}
            items={[
              {
                title: '准备',
                description: '选择合适的模型'
              },
              {
                title: '下载',
                description: '从 HF-Mirror 镜像站下载'
              },
              {
                title: '就绪',
                description: '模型加载至本地，即可使用'
              }
            ]}
          />
        </div>

        {/* Right Column: Download Card */}
        <div className="md:col-span-2">
          <Card className="bg-white border border-[#E5E5E4] shadow-sm !rounded-2xl h-full flex flex-col justify-center">
            <div className="p-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <Title level={4} className="!mb-2 !text-[#1F1F1F]">
                    jina-embeddings-v2-base-zh
                  </Title>
                  <Space size="small" className="mb-2">
                    <Tag color="blue">中文优化</Tag>
                    <Tag color="purple">8k 上下文</Tag>
                    <Tag color="cyan">768 维度</Tag>
                  </Space>
                  <Paragraph className="text-[#666666] mt-2">
                    由 Jina AI 发布的第二代文本嵌入模型，专为中文理解优化。支持长达 8192 token
                    的上下文窗口，非常适合处理长文档。
                  </Paragraph>
                </div>
                {status === 'completed' && <HiCheckCircle className="text-green-500 text-3xl" />}
              </div>

              {status === 'idle' && (
                <Button
                  type="primary"
                  size="large"
                  onClick={handleDownload}
                  icon={<HiCloudArrowDown />}
                  className="!bg-[#D97757] hover:!bg-[#C66A4A] h-12 px-8 rounded-xl shadow-md border-none w-full md:w-auto"
                >
                  开始下载
                </Button>
              )}

              {status === 'downloading' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#666666]">总进度</span>
                      <span className="text-[#D97757] font-medium">{progress}%</span>
                    </div>
                    <Progress
                      percent={progress}
                      strokeColor="#D97757"
                      showInfo={false}
                      className="!mb-0"
                    />
                  </div>

                  <div className="bg-[#F5F5F4] p-3 rounded-lg border border-[#E5E5E4]">
                    <div className="flex justify-between text-xs text-[#999999] mb-1">
                      <span>
                        正在下载文件 ({fileProgress.completed + 1}/{fileProgress.total})
                      </span>
                    </div>
                    <div className="text-sm text-[#1F1F1F] font-mono truncate">
                      {currentFile || '准备中...'}
                    </div>
                  </div>
                </div>
              )}

              {status === 'completed' && (
                <div className="bg-[#F0FDF4] border border-[#DCFCE7] p-4 rounded-xl text-green-700 flex items-center gap-3">
                  <HiCheckCircle className="text-xl" />
                  <span>模型已成功下载并安装至本地。</span>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-4">
                  <div className="bg-[#FEF2F2] border border-[#FEE2E2] p-4 rounded-xl text-red-700 flex items-start gap-3">
                    <HiExclamationCircle className="text-xl mt-0.5" />
                    <div>
                      <div className="font-medium">下载失败</div>
                      <div className="text-sm mt-1">{errorMsg}</div>
                    </div>
                  </div>
                  <Button onClick={handleDownload} type="default">
                    重试
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { Space } from 'antd'

export default ModelDownloadPage
