import './App.css'
import { DocumentRoutesTester } from './pages/document-routes-tester'
import { ChatTester } from './pages/chatTester'
import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from './pages/layout'
import Home from './pages/Home'
import { ChatMessages } from './components/views/chat/chat-messages'
import { useState } from 'react'


function App() {

  const [showTestPage, setShowTestPage] = useState(false)
  const [showChatPage, setShowChatPage] = useState(false)

  return (
    <div className='bg-[#090B0E]'>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<TestPage
              showTestPage={showTestPage}
              setShowTestPage={setShowTestPage}
              showChatPage={showChatPage} 
              setShowChatPage={setShowChatPage}/>} />
            <Route path="/chat/:id" element={<ChatMessages />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  )
}

const TestPage = ({ showTestPage, setShowTestPage, showChatPage, setShowChatPage
}: any) => {

  return (
    <div>
      {showTestPage ? (
        <div className="relative">
          <button
            onClick={() => setShowTestPage(false)}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Main App
          </button>
          <DocumentRoutesTester />
        </div>
      ) :
        showChatPage ? (
          <div className="relative">
            <button
              onClick={() => setShowChatPage(false)}
              className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Main App
            </button>
            <ChatTester />
          </div>
        ) :
          (
            <div>
              <button
                onClick={() => setShowTestPage(true)}
                className="fixed top-20 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Document Routes
              </button>
              <button
                onClick={() => setShowChatPage(true)}
                className="fixed top-40 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test chat Routes
              </button>
              <Home />
            </div>
          )}


    </div>
  )
}

export default App
