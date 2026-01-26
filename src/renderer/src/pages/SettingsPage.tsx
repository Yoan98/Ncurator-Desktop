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

import openaiLogo from '../assets/img/openai.png'
import qianwenLogo from '../assets/img/qianwen.png'
import doubaoLogo from '../assets/img/doubao.png'
import deepseekLogo from '../assets/img/deepseek.png'
import kimiLogo from '../assets/img/kimi.png'
import guijiliudongLogo from '../assets/img/guijiliudong.png'

const { Title } = Typography

const PROVIDER_OPTIONS = [
  {
    label: 'OpenAI',
    value: 'https://api.openai.com/v1',
    icon: <img src={openaiLogo} alt="OpenAI" className="w-4 h-4" />,
    desc: '官方 API'
  },
  {
    label: '阿里云百炼 (通义千问)',
    value: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    icon: <img src={qianwenLogo} alt="Qianwen" className="w-4 h-4" />,
    desc: '官方 API'
  },
  {
    label: '火山引擎 (豆包)',
    value: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: <img src={doubaoLogo} alt="Doubao" className="w-4 h-4" />,
    desc: '官方 API'
  },
  {
    label: 'DeepSeek',
    value: 'https://api.deepseek.com',
    icon: <img src={deepseekLogo} alt="DeepSeek" className="w-4 h-4" />,
    desc: '官方 API'
  },
  {
    label: 'Kimi',
    value: 'https://api.moonshot.cn/v1',
    icon: <img src={kimiLogo} alt="Kimi" className="w-4 h-4" />,
    desc: '官方 API'
  },
  {
    label: '硅基流动 (SiliconFlow)',
    value: 'https://api.siliconflow.cn/v1',
    icon: <img src={guijiliudongLogo} alt="SiliconFlow" className="w-4 h-4" />,
    desc: '官方 API'
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
