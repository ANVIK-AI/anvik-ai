import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DocumentRoutesTester } from './pages/document-routes-tester';
import { ChatTester } from './pages/chatTester';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './pages/layout';
import Home from './pages/Home';
import { ChatMessages } from './components/views/chat/chat-messages';
import { useEffect, useState } from 'react';
import Chat from './pages/Chat';
import Login from './pages/Login';
import { authAPI } from './services/api';
import PortfolioHome from './pages/PortfolioHome';
import ThreeBackground from './ui/components/ThreeBackground';
import Signup from './pages/Signup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'

library.add(fas, far, fab)

function App() {
  const [showTestPage, setShowTestPage] = useState(true);
  const [showChatPage, setShowChatPage] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in and validate token
    const token = localStorage.getItem('authToken');
    if (token) {
      // Optionally validate token with backend
      authAPI
        .getCurrentUser()
        .then(() => {
          setIsAuthenticated(true);
        })
        .catch(() => {
          // Token invalid, clear it
          authAPI.logout();
          setIsAuthenticated(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="app-shell h-screen flex flex-col">
      <AuthProvider>

      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Home/>}/>
          <Route path="/profile" element={<PortfolioHome />} />
          <Route
            path="/login"
            element={
              <div className="app-content">
                <ThreeBackground />
                <Login setIsAuthenticated={setIsAuthenticated} isAuthenticated={isAuthenticated} />
              </div>
            }
          />
          <Route
            path="/signup"
            element={
              <div className="app-content">
                <ThreeBackground />
                <Signup setIsAuthenticated={setIsAuthenticated} />
              </div>
            }
          />
          <Route element={<Layout setShowTestPage={setShowTestPage} />}>
            <Route path="/chat" element={<Chat />} />
            <Route
              path="/test"
              element={
                <TestPage
                  showTestPage={showTestPage}
                  setShowTestPage={setShowTestPage}
                  showChatPage={showChatPage}
                  setShowChatPage={setShowChatPage}
                />
              }
            />
            <Route path="/chat/:id" element={<ChatMessages />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthProvider>

    </div>
  );
}

const TestPage = ({ showTestPage, setShowTestPage, showChatPage, setShowChatPage }: any) => {
  const navigate = useNavigate();
  return (
    <div className="">
      {showTestPage ? (
        <div className="relative">
          <button
            onClick={() => {
              setShowTestPage(false);
              navigate('/chat');
            }}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Main App
          </button>
          <DocumentRoutesTester />
        </div>
      ) : showChatPage ? (
        <div className="relative">
          <button
            onClick={() => setShowChatPage(false)}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Main App
          </button>
          <ChatTester />
        </div>
      ) : (
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
  );
};

export default App;
