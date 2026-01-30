import React, { useEffect, useState } from 'react'
import { Card, Button, Typography } from 'antd'
import { HiCloudArrowDown, HiXMark } from 'react-icons/hi2'
import { useNavigate, useLocation } from 'react-router-dom'

const { Text } = Typography

const ModelStatusChecker: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(false)

  // Don't show on download page
  const isDownloadPage = location.pathname === '/model-download'

  useEffect(() => {
    if (isDownloadPage) {
      setVisible(false)
      return
    }
    checkModelStatus()
  }, [location.pathname])

  const checkModelStatus = async () => {
    if (checking) return
    setChecking(true)
    try {
      const status = await window.api.getEmbeddingStatus()
      if (status === 'error' || status === 'uninitialized') {
        const models = await window.api.getModels()
        const isDownloaded = models.some((m) => m.isDownloaded)
        if (!isDownloaded) {
          setVisible(true)
        } else {
          setVisible(false)
        }
      } else {
        setVisible(false)
      }
    } catch (e) {
      console.error('Failed to check model status', e)
    } finally {
      setChecking(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
      <Card
        className="w-80 shadow-lg border-[#D97757]/20 !bg-white/95 backdrop-blur-md"
        size="small"
        actions={[
          <Button
            type="text"
            size="small"
            onClick={() => setVisible(false)}
            className="text-[#999999]"
          >
            稍后
          </Button>,
          <Button
            type="primary"
            size="small"
            icon={<HiCloudArrowDown />}
            onClick={() => {
              setVisible(false)
              navigate('/model-download')
            }}
            className="!bg-[#D97757] hover:!bg-[#C66A4A]"
          >
            去下载
          </Button>
        ]}
      >
        <Card.Meta
          avatar={
            <div className="w-10 h-10 rounded-lg bg-[#FBF5F2] flex items-center justify-center text-[#D97757]">
              <HiCloudArrowDown className="text-xl" />
            </div>
          }
          title={<span className="text-[#1F1F1F]">缺少向量模型</span>}
          description={
            <Text className="text-[#666666] text-xs">
              搜索和对话功能依赖本地向量模型，请先下载模型文件。
            </Text>
          }
        />
      </Card>
    </div>
  )
}

export default ModelStatusChecker
