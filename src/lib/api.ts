// API client for the new PostgreSQL backend
import { API_BASE_URL } from './config';

// Token management — resilient across Safari Private Browsing and ITP storage eviction.
// Priority order: localStorage → sessionStorage → in-memory fallback.
const STORAGE_KEY = 'auth_token';
let _memoryToken: string | null = null;

const getToken = (): string | null => {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val) return val;
  } catch {}
  try {
    const val = sessionStorage.getItem(STORAGE_KEY);
    if (val) {
      // Promote back to localStorage if it became available again
      try { localStorage.setItem(STORAGE_KEY, val); } catch {}
      return val;
    }
  } catch {}
  return _memoryToken;
};

const setToken = (token: string): void => {
  _memoryToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
    return;
  } catch {}
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {}
};

const removeToken = (): void => {
  _memoryToken = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
};

// Build full API URL from endpoint
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

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
    
    // Handle validation errors array from express-validator
    if (error.errors && Array.isArray(error.errors)) {
      const messages = error.errors.map((e: any) => e.msg || e.message).join(', ');
      throw new Error(messages);
    }
    
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
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
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    make?: string;
    model?: string;
    year?: string;
    status?: string;
    inventory_status?: string;
    new_used?: string;
    stock_number?: string;
    min_price?: string;
    max_price?: string;
    sort_by?: string;
    sort_order?: string;
    sticker_status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    return apiRequest(`/vehicles${queryString ? `?${queryString}` : ''}`);
  },
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
   // Sticker methods
  markStickerPrinted: (id: string) => apiRequest(`/vehicles/${id}/mark-sticker-printed`, {
    method: 'POST',
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
  updateTrimType: () => apiRequest('/vehicles/update-trim-type', {
    method: 'POST',
  }),
  
  // CARFAX methods
  uploadCarfax: (id: string, formData: FormData) => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/vehicles/${id}/carfax`, {
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
  getCarfaxReports: (id: string) => apiRequest(`/vehicles/${id}/carfax`),
  getLatestCarfaxReport: (id: string) => apiRequest(`/vehicles/${id}/carfax/latest`),
  deleteCarfaxReport: (reportId: string) => apiRequest(`/vehicles/carfax/${reportId}`, {
    method: 'DELETE',
  }),
  generateStickerPDF: (data: { html: string; pageWidth?: string; pageHeight?: string }) => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/vehicles/generate-sticker-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    }).then(response => {
      if (!response.ok) {
        return response.json().then(error => {
          throw new Error(error.error || `HTTP ${response.status}`);
        });
      }
      return response.blob();
    });
  },
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
  activateMarbalismAI: () => apiRequest('/dealers/activate-marbalism', {
    method: 'POST',
  }),
  getMarbalismStatus: () => apiRequest('/dealers/marbalism-status'),
  /** Dealer dashboard: user sign-ins (7d) + credit application aggregates */
  getDashboardInsights: () => apiRequest('/dealers/dashboard-insights'),
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
  
  // Follow-up methods
  getFollowUps: (leadId: string) => apiRequest(`/leads/${leadId}/follow-ups`),
  createFollowUp: (leadId: string, data: any) => apiRequest(`/leads/${leadId}/follow-ups`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateFollowUp: (followUpId: string, data: any) => apiRequest(`/leads/follow-ups/${followUpId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteFollowUp: (followUpId: string) => apiRequest(`/leads/follow-ups/${followUpId}`, {
    method: 'DELETE',
  }),
  getUpcomingFollowUps: (days?: number, userId?: string) => {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    if (userId) params.append('userId', userId);
    return apiRequest(`/leads/follow-ups/upcoming?${params.toString()}`);
  },
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

// Conversation Context API
export const conversationContextAPI = {
  getLiveLeads: (dealerId: string, params?: {
    limit?: number;
    status?: string;
    step?: string;
    timeRange?: string;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('dealer_id', dealerId);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    return apiRequest(`/conversation-context/live-leads?${queryString}`);
  },
  
  getConversationContext: (sessionId: string) => 
    apiRequest(`/conversation-context/${sessionId}`),
  
  upsertConversationContext: (data: any) => 
    apiRequest('/conversation-context', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateStepData: (sessionId: string, stepName: string, stepData: any) => 
    apiRequest(`/conversation-context/${sessionId}/step/${stepName}`, {
      method: 'PUT',
      body: JSON.stringify(stepData),
    }),
  
  updateVehicleArray: (sessionId: string, arrayType: string, vehicles: any[]) => 
    apiRequest(`/conversation-context/${sessionId}/vehicles/${arrayType}`, {
      method: 'PUT',
      body: JSON.stringify(vehicles),
    }),
  
  updateLeadStatus: (sessionId: string, leadStatus: string, leadScore?: number) => 
    apiRequest(`/conversation-context/${sessionId}/lead-status`, {
      method: 'PUT',
      body: JSON.stringify({ lead_status: leadStatus, lead_qualification_score: leadScore }),
    }),
  
  getConversationStats: (dealerId: string, timeRange?: string) => {
    const queryParams = new URLSearchParams();
    if (timeRange) {
      queryParams.append('timeRange', timeRange);
    }
    const queryString = queryParams.toString();
    return apiRequest(`/conversation-context/stats/${dealerId}${queryString ? `?${queryString}` : ''}`);
  },
  
  deleteConversationContext: (sessionId: string) => 
    apiRequest(`/conversation-context/${sessionId}`, {
      method: 'DELETE',
    }),
};

// Finance API
export const financeAPI = {
  // Credit Applications
  createCreditApplication: (data: {
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    ssn?: string;
    dl_number?: string;
    credit_score?: number;
    conversation_id?: string;
    notes?: string;
  }) => apiRequest('/finance/credit-application', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getCreditApplications: (params?: {
    status?: string;
    credit_score_min?: number;
    credit_score_max?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    return apiRequest(`/finance/credit-applications${queryString ? `?${queryString}` : ''}`);
  },
  
  getCreditApplication: (id: string) => 
    apiRequest(`/finance/credit-applications/${id}`),
  
  updateCreditApplication: (id: string, data: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string | null;
    credit_score?: number | null;
    preferred_lender_id?: string | null;
    notes?: string | null;
  }) => apiRequest(`/finance/credit-applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  updateCreditApplicationStatus: (id: string, status: string) => 
    apiRequest(`/finance/credit-applications/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  
  deleteCreditApplication: (id: string) =>
    apiRequest(`/finance/credit-applications/${id}`, {
      method: 'DELETE',
    }),
  
  // Finance Terms/Programs
  getTerms: (params: {
    type: 'finance' | 'lease';
    term_months: number;
    credit_score: number;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('type', params.type);
    queryParams.append('term_months', params.term_months.toString());
    queryParams.append('credit_score', params.credit_score.toString());
    return apiRequest(`/finance/terms?${queryParams.toString()}`);
  },
  
  getPrograms: (params?: {
    type?: 'finance' | 'lease';
    is_active?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    return apiRequest(`/finance/programs${queryString ? `?${queryString}` : ''}`);
  },
  
  createProgram: (data: {
    program_name: string;
    type: 'finance' | 'lease';
    term_months: number;
    tier_min_score: number;
    tier_max_score: number;
    interest_rate?: number;
    money_factor?: number;
    residual_value_pct?: number;
    down_payment_min?: number;
    program_source: 'OEM' | 'Bank' | 'CreditUnion' | 'InHouse';
    is_active: boolean;
    effective_date: string;
    expiry_date?: string;
  }) => apiRequest('/finance/programs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  updateProgram: (id: string, data: any) => 
    apiRequest(`/finance/programs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteProgram: (id: string) => 
    apiRequest(`/finance/programs/${id}`, {
      method: 'DELETE',
    }),
  
  // Finance Deals
  createFinanceDeal: (data: {
    vehicle_id: string;
    price: number;
    down_payment?: number;
    credit_score: number;
    term_months: number;
    application_id?: string;
    conversation_id?: string;
    sales_tax_rate?: number;
    title_fee?: number;
    license_fee?: number;
    registration_fee?: number;
    inspection_fee?: number;
    processing_fee?: number;
    trade_in_acv?: number;
    trade_in_payoff?: number;
    add_ons?: number;
    protection_products?: number;
  }) => apiRequest('/finance/deal', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  createLeaseDeal: (data: {
    vehicle_id: string;
    cap_cost: number;
    credit_score: number;
    term_months: number;
    application_id?: string;
    conversation_id?: string;
    msrp?: number;
    cap_cost_reductions?: number;
    capitalized_fees?: number;
    tax_rate?: number;
    annual_mileage?: number;
    excess_mileage_rate?: number;
  }) => apiRequest('/finance/lease', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getDeals: (params?: {
    status?: string;
    deal_type?: 'finance' | 'lease';
    conversation_id?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    return apiRequest(`/finance/deals${queryString ? `?${queryString}` : ''}`);
  },
  
  getDeal: (id: string) => 
    apiRequest(`/finance/deals/${id}`),
  
  updateDealStatus: (id: string, status: string) => 
    apiRequest(`/finance/deals/${id}/update-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  
  updateDeal: (id: string, data: any) => 
    apiRequest(`/finance/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Lenders API
export const lendersAPI = {
  getAll: (params?: {
    type?: string;
    is_active?: boolean;
    is_preferred?: boolean;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    return apiRequest(`/lenders${queryString ? `?${queryString}` : ''}`);
  },
  
  getById: (id: string) => 
    apiRequest(`/lenders/${id}`),
  
  create: (data: {
    lender_name: string;
    lender_type: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
    address?: string;
    min_credit_score?: number;
    max_ltv?: number;
    notes?: string;
    is_preferred?: boolean;
  }) => apiRequest('/lenders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: any) => 
    apiRequest(`/lenders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) => 
    apiRequest(`/lenders/${id}`, {
      method: 'DELETE',
    }),
  
  getPrograms: (id: string) => 
    apiRequest(`/lenders/${id}/programs`),
  
  submitDeal: (lenderId: string, data: {
    deal_id: string;
    submission_method?: string;
    notes?: string;
  }) => apiRequest(`/lenders/${lenderId}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  updateSubmission: (submissionId: string, data: {
    submission_status?: string;
    approved_amount?: number;
    approved_apr?: number;
    approved_term_months?: number;
    rejection_reason?: string;
    lender_reference_number?: string;
  }) => apiRequest(`/lenders/submissions/${submissionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  getDealSubmissions: (dealId: string) => 
    apiRequest(`/lenders/deals/${dealId}/submissions`),
};

// Customer Management API
export const customersAPI = {
  getAll: () => apiRequest('/customers'),
  
  generateApplicationLink: (customerId: string, data: {
    vehicleId?: string;
    expiresIn?: number;
  }) => apiRequest(`/customers/${customerId}/generate-link`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  sendApplicationLink: (customerId: string, data: {
    vehicleId?: string;
    expiresIn?: number;
    method: 'email' | 'sms' | 'both';
  }) => apiRequest(`/customers/${customerId}/send-link`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getApplicationLinks: () => apiRequest('/customers/links'),

  delete: (customerId: string) =>
    apiRequest(`/customers/${customerId}`, { method: 'DELETE' }),
};

// Unified API export
export const api = {
  // Auth
  login: authAPI.login,
  register: authAPI.register,
  logout: authAPI.logout,
  getCurrentUser: authAPI.getCurrentUser,
  
  // Vehicles
  getVehicles: vehiclesAPI.getAll,
  getVehicle: vehiclesAPI.getOne,
  createVehicle: vehiclesAPI.create,
  updateVehicle: vehiclesAPI.update,
  deleteVehicle: vehiclesAPI.delete,
  
  // Leads
  getLeads: leadsAPI.getAll,
  getLead: leadsAPI.getOne,
  createLead: leadsAPI.create,
  updateLead: leadsAPI.update,
  
  // Finance
  createCreditApplication: financeAPI.createCreditApplication,
  getCreditApplications: financeAPI.getCreditApplications,
  getCreditApplication: financeAPI.getCreditApplication,
  updateCreditApplication: financeAPI.updateCreditApplication,
  deleteCreditApplication: financeAPI.deleteCreditApplication,
  createFinanceDeal: financeAPI.createFinanceDeal,
  createLeaseDeal: financeAPI.createLeaseDeal,
  getDeals: financeAPI.getDeals,
  getDeal: financeAPI.getDeal,
  updateDeal: financeAPI.updateDeal,
  updateDealStatus: financeAPI.updateDealStatus,
  
  // Lenders
  getLenders: lendersAPI.getAll,
  getLender: lendersAPI.getById,
  createLender: lendersAPI.create,
  updateLender: lendersAPI.update,
  deleteLender: lendersAPI.delete,
  getLenderPrograms: lendersAPI.getPrograms,
  submitDealToLender: lendersAPI.submitDeal,
  updateLenderSubmission: lendersAPI.updateSubmission,
  getDealSubmissions: lendersAPI.getDealSubmissions,
  
  // Customers
  getCustomers: customersAPI.getAll,
  generateCustomerApplicationLink: customersAPI.generateApplicationLink,
  sendCustomerApplicationLink: customersAPI.sendApplicationLink,
  getCustomerApplicationLinks: customersAPI.getApplicationLinks,
  deleteCustomer: customersAPI.delete,
  
  // Admin
  getAdminUsers: adminAPI.getUsers,
  createAdminUser: adminAPI.createUser,
  updateAdminUserRole: adminAPI.updateUserRole,
  deleteAdminUser: adminAPI.deleteUser,
  getAdminStats: adminAPI.getStats,
  get: (endpoint: string, options?: RequestInit) => apiRequest(endpoint, options),
  post: (endpoint: string, data?: any) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint: string, data?: any) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' }),
};

export { getToken, setToken, removeToken };
