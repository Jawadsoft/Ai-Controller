// API client for the new PostgreSQL backend

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-domain.com/api' 
  : 'http://localhost:3000/api';

// Token management
const getToken = () => localStorage.getItem('auth_token');
const setToken = (token: string) => localStorage.setItem('auth_token', token);
const removeToken = () => localStorage.removeItem('auth_token');

// API request helper
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Auth API
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    businessName: string;
    contactName: string;
  }) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.token) {
      setToken(response.token);
    }
    
    return response;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.token) {
      setToken(response.token);
    }
    
    return response;
  },

  logout: () => {
    removeToken();
  },

  getCurrentUser: () => apiRequest('/auth/me'),
};

// Vehicles API
export const vehiclesAPI = {
  getAll: () => apiRequest('/vehicles'),
  getOne: (id: string) => apiRequest(`/vehicles/${id}`),
  create: (data: any) => apiRequest('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/vehicles/${id}`, {
    method: 'DELETE',
  }),
  // QR Code methods
  generateQRCode: (id: string) => apiRequest(`/vehicles/${id}/qr-code`, {
    method: 'POST',
  }),
  generateBulkQRCodes: (vehicleIds: string[]) => apiRequest('/vehicles/qr-codes/bulk', {
    method: 'POST',
    body: JSON.stringify({ vehicleIds }),
  }),
  deleteQRCode: (id: string) => apiRequest(`/vehicles/${id}/qr-code`, {
    method: 'DELETE',
  }),
  // Image methods
  uploadImages: (id: string, formData: FormData) => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/vehicles/${id}/images`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }).then(response => {
      if (!response.ok) {
        return response.json().then(error => {
          throw new Error(error.error || `HTTP ${response.status}`);
        });
      }
      return response.json();
    });
  },
  deleteImage: (id: string, imageIndex: number) => apiRequest(`/vehicles/${id}/images/${imageIndex}`, {
    method: 'DELETE',
  }),
  deleteAllImages: (id: string) => apiRequest(`/vehicles/${id}/images`, {
    method: 'DELETE',
  }),
};

// Dealers API
export const dealersAPI = {
  getProfile: () => apiRequest('/dealers/profile'),
  updateProfile: (data: any) => apiRequest('/dealers/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  getAll: () => apiRequest('/dealers'),
  getOne: (id: string) => apiRequest(`/dealers/${id}`),
  update: (id: string, data: any) => apiRequest(`/dealers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Leads API
export const leadsAPI = {
  getAll: () => apiRequest('/leads'),
  getOne: (id: string) => apiRequest(`/leads/${id}`),
  create: (data: any) => apiRequest('/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createPublic: (data: any) => apiRequest('/leads/public', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/leads/${id}`, {
    method: 'DELETE',
  }),
};

// Admin API
export const adminAPI = {
  getUsers: () => apiRequest('/admin/users'),
  createUser: (data: { email: string; password: string; role: string }) => 
    apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUserRole: (id: string, role: string) => 
    apiRequest(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  deleteUser: (id: string) => 
    apiRequest(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
  getStats: () => apiRequest('/admin/stats'),
};

export { getToken, setToken, removeToken };