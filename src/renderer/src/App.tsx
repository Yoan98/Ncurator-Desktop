import React from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Layout, ConfigProvider, theme, Button, Dropdown } from 'antd'
import { ArrowLeftOutlined, SettingOutlined, BookOutlined, BlockOutlined } from '@ant-design/icons'
import SearchPage from './pages/SearchPage'
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
          colorPrimary: '#404040',
          colorLink: '#404040',
          borderRadius: 6,
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        components: {
          Button: {
            primaryShadow: 'none'
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
    <Layout className="min-h-screen bg-[#fafafa]">
      <Header className="!bg-[#fafafa] px-4 flex items-center justify-between sticky top-0 z-10 h-16 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg">
              <img src={brandIcon} alt="N" className="w-6 h-6" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-[#404040]">Ncurator</span>
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

        <div className="flex items-center gap-3">
          <Dropdown
            trigger={['hover', 'click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'kb', label: '知识库', icon: <BookOutlined /> },
                { key: 'test', label: '测试页面', icon: <BlockOutlined /> }
              ],
              onClick: (info) => {
                if (info.key === 'kb') navigate('/import')
                if (info.key === 'test') navigate('/test')
              }
            }}
          >
            <Button icon={<SettingOutlined />} />
          </Dropdown>
        </div>
      </Header>
      <Content className="bg-[#fafafa] overflow-auto">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
