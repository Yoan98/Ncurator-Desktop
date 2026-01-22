import React from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Layout, ConfigProvider, theme, Button, Dropdown, Segmented } from 'antd'
import {
  ArrowLeftOutlined,
  SettingOutlined,
  BookOutlined,
  BlockOutlined,
  SearchOutlined,
  CommentOutlined,
  ToolOutlined
} from '@ant-design/icons'
import SearchPage from './pages/SearchPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import ImportPage from './pages/ImportPage'
import TestPage from './pages/TestPage'
import brandIcon from '../../../resources/icon.png'

const { Header, Content } = Layout

function App(): React.JSX.Element {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb', // Blue-600
          colorLink: '#2563eb',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, sans-serif',
          colorText: '#334155', // slate-700
          colorTextHeading: '#1e293b', // slate-800
          colorBorder: '#e2e8f0' // slate-200
        },
        components: {
          Button: {
            primaryShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            borderRadius: 8
          },
          Card: {
            borderRadiusLG: 16
          }
        }
      }}
    >
      <HashRouter>
        <MainLayout />
      </HashRouter>
    </ConfigProvider>
  )
}

const MainLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isSearchPage = location.pathname === '/'
  const isChatPage = location.pathname === '/chat'
  const isHomeOrChat = isSearchPage || isChatPage

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Header className="!bg-slate-50/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 h-16 border-b border-slate-200 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-105 transition-transform duration-300">
              <img src={brandIcon} alt="N" className="w-6 h-6 invert" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors">
              Ncurator
            </span>
          </div>

          {isHomeOrChat ? (
            <Segmented
              options={[
                { label: '搜索', value: '/', icon: <SearchOutlined /> },
                { label: '对话', value: '/chat', icon: <CommentOutlined /> }
              ]}
              value={location.pathname === '/chat' ? '/chat' : '/'}
              onChange={(val) => navigate(val)}
              className="ml-4 bg-slate-200/50"
            />
          ) : (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              className="ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <Dropdown
            trigger={['hover', 'click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'kb', label: '知识库管理', icon: <BookOutlined /> },
                { key: 'settings', label: '模型配置', icon: <ToolOutlined /> },
                { key: 'test', label: '实验室', icon: <BlockOutlined /> }
              ],
              onClick: (info) => {
                if (info.key === 'kb') navigate('/import')
                if (info.key === 'settings') navigate('/settings')
                if (info.key === 'test') navigate('/test')
              }
            }}
          >
            <Button
              icon={<SettingOutlined />}
              className="!border-slate-200 !text-slate-600 hover:!border-blue-500 hover:!text-blue-600 !rounded-lg"
            />
          </Dropdown>
        </div>
      </Header>
      <Content className="bg-slate-50 overflow-auto">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
