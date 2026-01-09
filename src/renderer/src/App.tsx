import React from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Layout, ConfigProvider, theme, Button, Segmented, Avatar } from 'antd'
import {
  ArrowLeftOutlined,
  SettingOutlined,
  TranslationOutlined,
  SearchOutlined,
  MessageOutlined
} from '@ant-design/icons'
import SearchPage from './pages/SearchPage'
import ImportPage from './pages/ImportPage'

const { Header, Content } = Layout

function App(): React.JSX.Element {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#404040',
          colorLink: '#404040',
          borderRadius: 6,
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        components: {
          Button: {
            primaryShadow: 'none'
          },
          Segmented: {
            itemSelectedBg: '#404040',
            itemSelectedColor: '#ffffff',
            trackBg: '#f5f5f5'
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

  return (
    <Layout className="min-h-screen bg-white">
      <Header className="bg-white px-4 flex items-center justify-between sticky top-0 z-10 h-16 border-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-[#404040] rounded-md flex items-center justify-center text-white font-bold text-lg">
              <img src="/src/assets/icon.png" alt="N" className="w-6 h-6 invert filter brightness-0 invert" onError={(e) => {e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerText='N'}} />
            </div>
            <span className="font-semibold text-lg tracking-tight text-[#404040]">NCurator</span>
          </div>

          {!isSearchPage && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              className="ml-2"
            />
          )}
        </div>

        {isSearchPage && (
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Segmented
              options={[
                { label: '搜索', value: 'search', icon: <SearchOutlined /> },
                { label: '聊天', value: 'chat', icon: <MessageOutlined /> }
              ]}
              defaultValue="search"
              className="bg-gray-100"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded px-2 py-1 gap-2 cursor-pointer hover:bg-gray-50">
            <span className="text-sm">zh-CN</span>
            <TranslationOutlined className="text-xs" />
          </div>
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate('/import')} // Temporary link to Import page via Settings for now
          />
          <Avatar
            shape="square"
            size="small"
            className="bg-white border border-gray-200 text-[#404040] font-medium"
          >
            S
          </Avatar>
        </div>
      </Header>
      <Content className="bg-white overflow-auto">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
