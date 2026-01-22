import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Typography,
  Tag,
  Space,
  Popconfirm
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { LLMConfig, STORAGE_KEY_CONFIGS } from '../services/llmService'

const { Title } = Typography

const SettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIGS)
      if (stored) {
        setConfigs(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load configs', e)
    }
  }

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
    } catch (e) {
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
          <span className="font-medium">{text}</span>
          {record.isActive && (
            <Tag color="success" icon={<CheckCircleOutlined />}>
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
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: LLMConfig) => (
        <Space size="small">
          {!record.isActive && (
            <Button type="link" size="small" onClick={() => handleActivate(record.id)}>
              启用
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定要删除此配置吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="min-h-full p-8 font-sans max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <SettingOutlined className="text-xl" />
          </div>
          <div>
            <Title level={3} className="!mb-0 !font-bold !text-slate-800">
              模型配置
            </Title>
            <p className="text-slate-500 text-sm mt-1">配置 LLM API 连接信息</p>
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          className="bg-blue-600 hover:!bg-blue-700 h-9 px-5 rounded-lg shadow-sm"
        >
          新增配置
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <Table
          dataSource={configs}
          columns={columns}
          rowKey="id"
          pagination={false}
          className="[&_.ant-table-thead_th]:!bg-slate-50 [&_.ant-table-thead_th]:!text-slate-600 [&_.ant-table-thead_th]:!font-medium [&_.ant-table-tbody_td]:!py-4"
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
            help="例如：https://api.openai.com/v1"
          >
            <Input placeholder="https://api.openai.com/v1" />
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
