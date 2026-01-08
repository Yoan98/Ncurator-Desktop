import React from 'react'
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import TestPage from './pages/TestPage'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test" element={<TestPage />} />
      </Routes>
    </HashRouter>
  )
}

function Home(): React.JSX.Element {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">NCurator Desktop</h1>
      <div className="flex flex-col gap-4">
        <Link to="/test" className="text-blue-500 hover:underline">
          Go to Test Page (Original App)
        </Link>
      </div>
    </div>
  )
}

export default App
