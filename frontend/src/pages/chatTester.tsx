import { useAuth } from '@/context/AuthContext';
import { useState, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

//

export function ChatTester() {
  const {user}= useAuth();
  const generateId = () => {
    try {
      // @ts-ignore
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch {}
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [testTitle, setTestTitle] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!input.trim() || !projectId.trim()) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      const url = `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/chat`;
      console.log('[chatTester] sending POST to', url, {
        msgCount: messages.length + 1,
        hasProjectId: !!projectId,
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          metadata: {
            projectId: projectId,
            id:user?.id
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('[chatTester] response received', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        transferEncoding: response.headers.get('transfer-encoding'),
        cacheControl: response.headers.get('cache-control'),
      });

      // Clone before locking the body/reader
      let respClone: Response | null = null;
      try {
        respClone = response.clone();
      } catch (e) {
        console.log('[chatTester] response.clone failed (ok if body already locked):', e);
      }

      // If streaming body is unavailable (browser/proxy limitation), fallback to full text
      const reader = response.body?.getReader();
      if (!reader) {
        console.log('[chatTester] No reader available; falling back to response.text');
        const fullText = await response.text();
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: fullText,
        };
        setMessages(prev => [...prev, assistantMessage]);
        return;
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let bytes = 0;
      const startedAt = Date.now();
      // Watchdog: log if no chunks within 5000ms
      let gotFirstChunk = false;
      const watchdog = setTimeout(() => {
        if (!gotFirstChunk) {
          console.log('[chatTester] watchdog: no chunks received after 5000ms');
        }
      }, 5000);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          bytes += value?.byteLength || 0;
          accumulated += chunk;
          gotFirstChunk = true;
          console.log('[chatTester] received chunk', {
            len: chunk.length,
            bytesSoFar: bytes,
            elapsedMs: Date.now() - startedAt,
          });

          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: accumulated }
                : msg
            )
          );
          scrollToBottom();
        }
      } catch (loopErr) {
        console.log('[chatTester] stream loop error', loopErr);
      } finally {
        clearTimeout(watchdog);
      }

      // If no chunks came through, try non-streaming fallback from the cloned response
      if (!accumulated) {
        console.log('[chatTester] stream complete but no content; trying clone.text fallback');
        try {
          const fallbackText = respClone ? await respClone.text() : '';
          console.log('[chatTester] clone.text length', fallbackText.length);
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: fallbackText || '(no content received)' }
                : msg
            )
          );
        } catch (e) {
          console.log('[chatTester] clone.text failed', e);
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: '(no content received from server)' }
                : msg
            )
          );
        }
      } else {
        console.log('[chatTester] stream finished', { totalBytes: bytes, totalChars: accumulated.length });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const generateTitle = async () => {
    if (!testTitle.trim()) return;

    setIsGeneratingTitle(true);
    setGeneratedTitle('');

    try {
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/chat/title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt: testTitle,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      let title = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        title += chunk;
        setGeneratedTitle(title);
      }
    } catch (error) {
      console.error('Error generating title:', error);
      setGeneratedTitle(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/chat/health`, {
        credentials: 'include',
      });
      const health = await response.json();
      console.log('Health check:', health);
      alert(`Health: ${health.status}\nMemories: ${health.memories?.total}\nDatabase: ${health.database}`);
    } catch (error) {
      console.error('Health check failed:', error);
      alert('Health check failed');
    }
  };

  const clearChat = () => {
    setMessages([]);
    setGeneratedTitle('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 className='text-slate-200'>Chat Route Tester</h1>
      
      {/* Health Check */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={checkHealth}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#10b981', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Check Health
        </button>
      </div>

      {/* Project ID Input */}
      <div style={{ marginBottom: '20px' }}>
        <label className='text-slate-200' style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Project ID (Space ID):
        </label>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Enter project/space ID"
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Chat Interface */}
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h3>Chat Test</h3>
        
        {/* Messages Display */}
        <div style={{ 
          height: '300px', 
          overflowY: 'auto', 
          border: '1px solid #ddd', 
          borderRadius: '4px', 
          padding: '10px',
          marginBottom: '10px',
          backgroundColor: 'white'
        }}>
          {messages.map((message) => (
            <div key={message.id} style={{ 
              marginBottom: '10px',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
              borderLeft: `4px solid ${message.role === 'user' ? '#2196f3' : '#4caf50'}`
            }}>
              <strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>
                {message.content || '...'}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ 
              padding: '8px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Press Enter to send)"
            rows={3}
            style={{ 
              flex: 1, 
              padding: '8px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            disabled={isLoading || !projectId}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <button 
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || !projectId}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
            <button 
              onClick={clearChat}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#6b7280', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Title Generation Test */}
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        padding: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h3>Title Generation Test</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="Enter prompt for title generation"
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              marginBottom: '10px',
              boxSizing: 'border-box'
            }}
          />
          <button 
            onClick={generateTitle}
            disabled={isGeneratingTitle || !testTitle.trim()}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#8b5cf6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: isGeneratingTitle ? 'not-allowed' : 'pointer',
              opacity: isGeneratingTitle ? 0.6 : 1
            }}
          >
            {isGeneratingTitle ? 'Generating...' : 'Generate Title'}
          </button>
        </div>

        {generatedTitle && (
          <div style={{ 
            padding: '10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: 'white'
          }}>
            <strong>Generated Title:</strong> {generatedTitle}
          </div>
        )}
      </div>

      {/* Test Instructions */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeaa7',
        borderRadius: '4px'
      }}>
        <h4>Testing Instructions:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Enter a valid Project ID (Space ID from your database)</li>
          <li>Use the chat to test memory tools - ask about personal preferences or add new memories</li>
          <li>Try questions like "What is my favorite color?" or "Remember that I like pizza"</li>
          <li>Check the browser console for detailed logs</li>
          <li>Use the health check to verify backend connectivity</li>
        </ul>
      </div>
    </div>
  );
}