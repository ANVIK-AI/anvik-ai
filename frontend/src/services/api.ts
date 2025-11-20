/**
 * API Service Layer for ANVIK Backend
 * Handles all communication with the backend API
 */

const BACKEND_URL = (import.meta.env?.VITE_PUBLIC_BACKEND_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

// Log backend URL in development for debugging
if (import.meta.env.DEV) {
  console.log('🔗 Backend URL:', BACKEND_URL);
  console.log(
    '📝 Environment variable VITE_PUBLIC_BACKEND_URL:',
    import.meta.env?.VITE_PUBLIC_BACKEND_URL || 'not set (using default)',
  );
}

/**
 * Get authentication headers with token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * Handle API response
 */
const handleResponse = async (response: any) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }
  return response.json();
};

/**
 * Handle fetch errors with better error messages
 */
const handleFetchError = (error: any, endpoint: string): any => {
  console.error(`API Error (${endpoint}):`, error);

  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    // Network error - backend not reachable
    throw new Error(
      `Cannot connect to backend server at ${BACKEND_URL}. ` +
        `Please ensure:\n` +
        `1. Backend server is running on port 3000\n` +
        `2. CORS is enabled on the backend\n` +
        `3. Backend URL is correct (check .env file)`,
    );
  }

  throw error;
};

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Register a new user
   */
  signup: async (name: string, email: string, password: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      const data = await handleResponse(response);
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return data;
    } catch (error) {
      handleFetchError(error, '/api/auth/signup');
    }
  },

  /**
   * Login user
   */
  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await handleResponse(response);
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return data;
    } catch (error) {
      handleFetchError(error, '/api/auth/login');
    }
  },

  /**
   * Logout user
   */
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  /**
   * Get current user
   */
  getCurrentUser: async () => {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

/**
 * AI Chat API
 */
export const chatAPI = {
  /**
   * Send a message to the AI
   */
  sendMessage: async (prompt: string, history: any[] = [], files: File[] = []) => {
    const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prompt,
        history: history.slice(-20).map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        files: files.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      }),
    });
    return handleResponse(response);
  },

  /**
   * Get chat history
   */
  getChatHistory: async () => {
    const response = await fetch(`${BACKEND_URL}/api/ai/history`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Delete a chat
   */
  deleteChat: async (chatId: string) => {
    const response = await fetch(`${BACKEND_URL}/api/ai/chat/${chatId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

/**
 * Memory/Document API
 */
export const memoryAPI = {
  /**
   * Upload a document (PDF, etc.)
   */
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('authToken');
    const response = await fetch(`${BACKEND_URL}/api/memory/newdoc`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });
    return handleResponse(response);
  },

  /**
   * Get all documents
   */
  getDocuments: async () => {
    const response = await fetch(`${BACKEND_URL}/api/memory/documents`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Delete a document
   */
  deleteDocument: async (documentId: string) => {
    const response = await fetch(`${BACKEND_URL}/api/memory/documents/${documentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

/**
 * Calendar Tool API
 */
export const calendarAPI = {
  /**
   * Get calendar events
   */
  getEvents: async (startDate: string, endDate: string) => {
    const response = await fetch(
      `${BACKEND_URL}/api/tools/calendar/events?start=${startDate}&end=${endDate}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      },
    );
    return handleResponse(response);
  },

  /**
   * Create a calendar event
   */
  createEvent: async (eventData: any) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/calendar/events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(eventData),
    });
    return handleResponse(response);
  },

  /**
   * Update a calendar event
   */
  updateEvent: async (eventId: string, eventData: any) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/calendar/events/${eventId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(eventData),
    });
    return handleResponse(response);
  },

  /**
   * Delete a calendar event
   */
  deleteEvent: async (eventId: string) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/calendar/events/${eventId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

/**
 * Notion Tool API
 */
export const notionAPI = {
  /**
   * Connect Notion account
   */
  connect: async (code: string) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/notion/connect`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
    return handleResponse(response);
  },

  /**
   * Get Notion pages
   */
  getPages: async (databaseId = null) => {
    const url = databaseId
      ? `${BACKEND_URL}/api/tools/notion/pages?database=${databaseId}`
      : `${BACKEND_URL}/api/tools/notion/pages`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Create a Notion page
   */
  createPage: async (pageData: any) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/notion/pages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(pageData),
    });
    return handleResponse(response);
  },

  /**
   * Update a Notion page
   */
  updatePage: async (pageId: string, pageData: any) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/notion/pages/${pageId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(pageData),
    });
    return handleResponse(response);
  },

  /**
   * Search Notion
   */
  search: async (query: string) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/notion/search`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query }),
    });
    return handleResponse(response);
  },
};

/**
 * Email Tool API
 */
export const emailAPI = {
  /**
   * Connect email account
   */
  connect: async (provider: string, credentials: any) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/email/connect`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ provider, credentials }),
    });
    return handleResponse(response);
  },

  /**
   * Get emails
   */
  getEmails: async (folder = 'inbox', limit = 50) => {
    const response = await fetch(
      `${BACKEND_URL}/api/tools/email/messages?folder=${folder}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      },
    );
    return handleResponse(response);
  },

  /**
   * Send an email
   */
  sendEmail: async (emailData: any) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/email/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(emailData),
    });
    return handleResponse(response);
  },

  /**
   * Get a specific email
   */
  getEmail: async (emailId: string) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/email/messages/${emailId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

/**
 * Tools Management API
 */
export const toolsAPI = {
  /**
   * Get all available tools
   */
  getAvailableTools: async () => {
    const response = await fetch(`${BACKEND_URL}/api/tools`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Get connected tools for current user
   */
  getConnectedTools: async () => {
    const response = await fetch(`${BACKEND_URL}/api/tools/connected`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Disconnect a tool
   */
  disconnectTool: async (toolName: string) => {
    const response = await fetch(`${BACKEND_URL}/api/tools/${toolName}/disconnect`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

export default {
  auth: authAPI,
  chat: chatAPI,
  memory: memoryAPI,
  calendar: calendarAPI,
  notion: notionAPI,
  email: emailAPI,
  tools: toolsAPI,
};
