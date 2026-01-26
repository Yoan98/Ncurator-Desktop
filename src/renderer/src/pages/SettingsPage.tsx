import React, { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  AutoComplete,
  message,
  Typography,
  Tag,
  Space,
  Popconfirm
} from 'antd'
import { HiPlus, HiPencil, HiTrash, HiCheckCircle, HiCog6Tooth } from 'react-icons/hi2'
import { LLMConfig, STORAGE_KEY_CONFIGS } from '../services/llmService'

const { Title } = Typography

// Provider Icons
const OpenAIIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#10A37F]">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a1.54 1.54 0 0 0 .0383 3.109t-.0385-.0063v3.4251a4.4828 4.4828 0 0 1-4.4563 3.5912zm6.9551-5.7444a1.54 1.54 0 0 0-1.7061-1.8756v-3.7716a4.4828 4.4828 0 0 1 2.5093 1.2588 4.4804 4.4804 0 0 1 1.2166 3.3768l-.1419.0804-4.7783 2.7582a.7757.7757 0 0 0-.3927.6813v2.05l2.4501-1.4153a1.54 1.54 0 0 0 .843-2.9922v-.1506zm-1.841-9.6732-.1419.0804-4.7783 2.7582a.7757.7757 0 0 0-.3927.6813v6.7369l-2.02-1.1686a1.54 1.54 0 0 0-.0383-3.109l.0385.0063v-3.4251a4.4828 4.4828 0 0 1 4.4563-3.5912 4.4755 4.4755 0 0 1 2.8764 1.0408zm-15.5866 2.7751a1.54 1.54 0 0 0 1.7061 1.8756v3.7716a4.4828 4.4828 0 0 1-2.5093-1.2588 4.4804 4.4804 0 0 1-1.2166-3.3768l.1419-.0804 4.7783-2.7582a.7757.7757 0 0 0 .3927-.6813v-2.05l-2.4501 1.4153a1.54 1.54 0 0 0-.843 2.9922v.1506zm1.841 9.6732.1419-.0804 4.7783-2.7582a.7757.7757 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a1.54 1.54 0 0 0 .0383 3.109l-.0385-.0063v3.4251a4.4828 4.4828 0 0 1-4.4563 3.5912 4.4755 4.4755 0 0 1-2.8764-1.0408zm8.6315-4.9818L10.9856 9.155v5.69l4.2752 2.4685v-5.4428z" />
  </svg>
)

const AliyunIcon = () => (
  <svg viewBox="0 0 1024 1024" fill="currentColor" className="w-4 h-4 text-[#FF6A00]">
    <path d="M512 0L0 128l512 256 512-256L512 0z m0 384l-256-128-128 64 384 192 384-192-128-64-256 128z m0 192L128 448v192l384 192 384-192V448L512 576z m0 256L256 704v192l256 128 256-128V704L512 832z" />
  </svg>
)

const DoubaoIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-4 h-4 text-[#165DFF]">
    <path
      d="M37.3629 17.8931C39.0496 17.8931 40.5481 19.1414 40.5481 21.3653V26.6343C40.5481 28.8582 39.0496 30.1065 37.3629 30.1065H27.5615V43H18.8475V30.1065H9.04616C7.3595 30.1065 5.86096 28.8582 5.86096 26.6343V21.3653C5.86096 19.1414 7.3595 17.8931 9.04616 17.8931H18.8475V5H27.5615V17.8931H37.3629Z"
      fill="currentColor"
    />
  </svg>
)

const DeepSeekIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#4D6BFE]">
    <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2-1-2 1zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
)

const PROVIDER_OPTIONS = [
  {
    label: 'OpenAI',
    value: 'https://api.openai.com/v1',
    icon: <OpenAIIcon />,
    desc: '官方 API'
  },
  {
    label: '阿里云百炼 (通义千问)',
    value: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    icon: <AliyunIcon />,
    desc: 'Compatible Mode'
  },
  {
    label: '火山引擎 (豆包)',
    value: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: <DoubaoIcon />,
    desc: 'API v3'
  },
  {
    label: 'DeepSeek',
    value: 'https://api.deepseek.com',
    icon: <DeepSeekIcon />,
    desc: '官方 API'
  },
  {
    label: 'Moonshot AI (Kimi)',
    value: 'https://api.moonshot.cn/v1',
    icon: <span className="text-lg">🌙</span>,
    desc: 'Kimi 开放平台'
  },
  {
    label: '硅基流动 (SiliconFlow)',
    value: 'https://api.siliconflow.cn/v1',
    icon: <span className="text-lg">🌊</span>,
    desc: 'SiliconCloud'
  },
  {
    label: 'Ollama (本地)',
    value: 'http://localhost:11434/v1',
    icon: <span className="text-lg">🦙</span>,
    desc: '本地运行'
  }
]

const SettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<LLMConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIGS)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load configs', error)
      return []
    }
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null)
  const [form] = Form.useForm()

  const saveConfigs = (newConfigs: LLMConfig[]) => {
    setConfigs(newConfigs)
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(newConfigs))
  }

  const handleAdd = () => {
    setEditingConfig(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const handleEdit = (record: LLMConfig) => {
    setEditingConfig(record)
    form.setFieldsValue(record)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    const newConfigs = configs.filter((c) => c.id !== id)
    saveConfigs(newConfigs)
    message.success('配置已删除')
  }

  const handleActivate = (id: string) => {
    const newConfigs = configs.map((c) => ({
      ...c,
      isActive: c.id === id
    }))
    saveConfigs(newConfigs)
    message.success('已切换当前模型')
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()

      if (editingConfig) {
        // Update
        const newConfigs = configs.map((c) => (c.id === editingConfig.id ? { ...c, ...values } : c))
        saveConfigs(newConfigs)
        message.success('配置已更新')
      } else {
        // Create
        const newConfig: LLMConfig = {
          id: crypto.randomUUID(),
          ...values,
          isActive: configs.length === 0 // Make active if it's the first one
        }
        saveConfigs([...configs, newConfig])
        message.success('配置已添加')
      }

      setIsModalOpen(false)
    } catch {
      // Validation failed
    }
  }

  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: LLMConfig) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#1F1F1F]">{text}</span>
          {record.isActive && (
            <Tag color="#D97757" icon={<HiCheckCircle className="inline" />}>
              当前使用
            </Tag>
          )}
        </div>
      )
    },
    {
      title: '模型名称',
      dataIndex: 'modelName',
      key: 'modelName',
      render: (text: string) => <Tag>{text}</Tag>
    },
    {
      title: 'Base URL',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
      render: (text: string) => <span className="text-[#666666]">{text}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: LLMConfig) => (
        <Space size="small">
          {!record.isActive && (
            <Button
              type="link"
              size="small"
              onClick={() => handleActivate(record.id)}
              className="!text-[#D97757]"
            >
              启用
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<HiPencil />}
            onClick={() => handleEdit(record)}
            className="text-[#666666] hover:text-[#D97757]"
          />
          <Popconfirm
            title="确定要删除此配置吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger size="small" icon={<HiTrash />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="min-h-full p-8 font-sans max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FBF5F2] flex items-center justify-center text-[#D97757]">
            <HiCog6Tooth className="text-xl" />
          </div>
          <div>
            <Title level={3} className="!mb-0 !font-bold !text-[#1F1F1F]">
              模型配置
            </Title>
            <p className="text-[#999999] text-sm mt-1">配置 LLM API 连接信息</p>
          </div>
        </div>
        <Button
          type="primary"
          icon={<HiPlus className="w-4 h-4" />}
          onClick={handleAdd}
          className="!bg-[#D97757] hover:!bg-[#C66A4A] h-9 px-5 rounded-lg shadow-sm border-none"
        >
          新增配置
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5E4] shadow-sm overflow-hidden">
        <Table
          dataSource={configs}
          columns={columns}
          rowKey="id"
          pagination={false}
          className="[&_.ant-table-thead_th]:!bg-[#F5F5F4] [&_.ant-table-thead_th]:!text-[#666666] [&_.ant-table-thead_th]:!font-medium [&_.ant-table-tbody_td]:!py-4"
        />
      </div>

      <Modal
        title={editingConfig ? '编辑配置' : '新增配置'}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={() => setIsModalOpen(false)}
        width={500}
        className="[&_.ant-modal-content]:!rounded-2xl"
      >
        <Form form={form} layout="vertical" className="pt-4">
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：我的 OpenAI" />
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label="Base URL"
            rules={[{ required: true, message: '请输入 Base URL' }]}
            help="选择常用地址或手动输入"
          >
            <AutoComplete
              placeholder="https://api.openai.com/v1"
              options={PROVIDER_OPTIONS.map((provider) => ({
                value: provider.value,
                label: (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-5 h-5">
                        {provider.icon}
                      </div>
                      <span className="font-medium text-[#1F1F1F]">{provider.label}</span>
                    </div>
                    <span className="text-xs text-[#999999]">{provider.desc}</span>
                  </div>
                )
              }))}
              filterOption={(inputValue, option) => {
                const provider = PROVIDER_OPTIONS.find((p) => p.value === option?.value)
                const matchValue = option?.value
                  ?.toString()
                  .toUpperCase()
                  .includes(inputValue.toUpperCase())
                const matchLabel = provider?.label.toUpperCase().includes(inputValue.toUpperCase())
                return !!(matchValue || matchLabel)
              }}
            />
          </Form.Item>

          <Form.Item
            name="modelName"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：gpt-4o-mini" />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SettingsPage
