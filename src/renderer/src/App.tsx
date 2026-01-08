import React from 'react'
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, ConfigProvider, theme } from 'antd'
import { SearchOutlined, CloudUploadOutlined } from '@ant-design/icons'
import SearchPage from './pages/SearchPage'
import ImportPage from './pages/ImportPage'

const { Header, Content } = Layout

function App(): React.JSX.Element {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#000000',
          colorLink: '#000000',
          borderRadius: 4,
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        components: {
          Menu: {
            itemSelectedColor: '#000000',
            itemSelectedBg: '#f0f0f0',
            activeBarBorderWidth: 0
          },
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

  const items = [
    {
      key: '/',
      icon: <SearchOutlined />,
      label: <Link to="/">Search</Link>
    },
    {
      key: '/import',
      icon: <CloudUploadOutlined />,
      label: <Link to="/import">Import</Link>
    }
  ]

  return (
    <Layout className="min-h-screen bg-white">
      <Header className="bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-0 z-10 h-16 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center text-white font-bold text-lg">
            N
          </div>
          <span className="font-semibold text-lg tracking-tight">NCurator</span>
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={items}
          className="border-none min-w-[200px] justify-end"
          style={{ lineHeight: '64px' }}
        />
      </Header>
      <Content className="bg-white">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
