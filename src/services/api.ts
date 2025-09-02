// src/services/api.ts

const API_URL = 'http://localhost:3001/api';

// Store token in localStorage
let authToken = localStorage.getItem('authToken');

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired - redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Authentication
export const auth = {
  async login(username: string, password: string) {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (data.token) {
      authToken = data.token;
      localStorage.setItem('authToken', data.token);
    }
    
    return data;
  },

  async register(username: string, password: string, role = 'user') {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  },

  async verify() {
    return apiCall('/auth/verify');
  },

  logout() {
    authToken = null;
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  },

  isLoggedIn() {
    return !!authToken;
  },

  getToken() {
    return authToken;
  }
};

// Agents
export const agents = {
  async getAll() {
    return apiCall('/agents');
  },

  async getById(id: string) {
    return apiCall(`/agents/${id}`);
  },

  async create(data: any) {
    return apiCall('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return apiCall(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiCall(`/agents/${id}`, {
      method: 'DELETE',
    });
  },
};

// Forms
export const forms = {
  async getAll() {
    return apiCall('/forms');
  },

  async getByAgent(agentId: string) {
    return apiCall(`/forms/agent/${agentId}`);
  },

  async create(data: any) {
    return apiCall('/forms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return apiCall(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Export everything
const api = {
  auth,
  agents,
  forms,
};

export default api;