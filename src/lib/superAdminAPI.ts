// Super Admin API client
import { API_BASE_URL } from './config';
// API_BASE_URL already includes '/api' in development; append only '/super-admin'
const API_BASE = `${API_BASE_URL}/super-admin`;

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
});

export const superAdminAPI = {
  // Global Settings
  async getSettings() {
    const response = await fetch(`${API_BASE}/settings`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch global settings');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Unexpected response. Expected JSON but got: ${text.slice(0, 120)}...`);
    }

    return response.json();
  },

  async updateSetting(provider: string, key: string, data: any) {
    const response = await fetch(`${API_BASE}/settings/${provider}/${key}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update setting');
    }
    
    return response.json();
  },

  async testIntegration(provider: string) {
    const response = await fetch(`${API_BASE}/settings/${provider}/test`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to test integration');
    }
    
    return response.json();
  },

  // Role Management
  async getRoles() {
    const response = await fetch(`${API_BASE}/roles`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch roles');
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Unexpected response. Expected JSON but got: ${text.slice(0, 120)}...`);
    }
    
    return response.json();
  },

  async createRole(data: any) {
    const response = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to create role');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  async updateRole(roleId: string, data: any) {
    const response = await fetch(`${API_BASE}/roles/${roleId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to update role');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  async deleteRole(roleId: string) {
    const response = await fetch(`${API_BASE}/roles/${roleId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to delete role');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  // Software Leads
  async getSoftwareLeads(params: any = {}) {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await fetch(`${API_BASE}/software-leads?${queryParams}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch software leads');
    }
    
    return response.json();
  },

  async createSoftwareLead(data: any) {
    const response = await fetch(`${API_BASE}/software-leads`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create software lead');
    }
    
    return response.json();
  },

  async updateSoftwareLead(id: string, data: any) {
    const response = await fetch(`${API_BASE}/software-leads/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update software lead');
    }
    
    return response.json();
  },

  async deleteSoftwareLead(id: string) {
    const response = await fetch(`${API_BASE}/software-leads/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete software lead');
    }
    
    return response.json();
  },

  async getSoftwareLead(id: string) {
    const response = await fetch(`${API_BASE}/software-leads/${id}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch software lead');
    }
    
    return response.json();
  },

  // Dealers
  async getDealers(params: any = {}) {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await fetch(`${API_BASE}/dealers?${queryParams}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch dealers');
    }
    
    return response.json();
  },

  async getDealer(id: string) {
    const response = await fetch(`${API_BASE}/dealers/${id}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch dealer');
    }
    
    return response.json();
  },

  async createDealer(data: any) {
    const response = await fetch(`${API_BASE}/dealers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to create dealer');
    }
    
    return response.json();
  },

  async updateDealer(id: string, data: any) {
    const response = await fetch(`${API_BASE}/dealers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update dealer');
    }
    
    return response.json();
  },

  // Stripe Subscription Management
  async createStripeCustomer(dealerId: string) {
    const response = await fetch(`${API_BASE}/stripe/customers/${dealerId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to create Stripe customer');
    }
    
    return response.json();
  },

  async createSubscription(dealerId: string, priceId: string, trialDays?: number) {
    const response = await fetch(`${API_BASE}/stripe/subscriptions/${dealerId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ price_id: priceId, trial_days: trialDays })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create subscription');
    }
    
    return response.json();
  },

  async cancelSubscription(dealerId: string) {
    const response = await fetch(`${API_BASE}/stripe/subscriptions/${dealerId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }
    
    return response.json();
  },

  async getInvoices(dealerId: string) {
    const response = await fetch(`${API_BASE}/stripe/invoices/${dealerId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }
    
    return response.json();
  },

  // Software Leads Bulk Operations
  async bulkDeleteLeads(ids: string[]) {
    const response = await fetch(`${API_BASE}/software-leads/bulk`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids })
    });
    
    if (!response.ok) {
      throw new Error('Failed to bulk delete leads');
    }
    
    return response.json();
  },

  async bulkUpdateLeadStatus(ids: string[], status: string) {
    const response = await fetch(`${API_BASE}/software-leads/bulk/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids, status })
    });
    
    if (!response.ok) {
      throw new Error('Failed to bulk update lead status');
    }
    
    return response.json();
  },

  async importLeadsFromCSV(file: File) {
    const formData = new FormData();
    formData.append('csvFile', file);

    const response = await fetch(`${API_BASE}/software-leads/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        const error = new Error(errorData.error || errorData.message || 'Failed to import leads');
        (error as any).response = { data: errorData };
        throw error;
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  async exportLeadsToCSV(params: any = {}) {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await fetch(`${API_BASE}/software-leads/export?${queryParams}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to export leads');
    }
    
    return response.blob();
  },

  // Daive Integration
  async testDaiveConnection() {
    const response = await fetch(`${API_BASE}/daive/test-connection`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to test Daive connection');
    }
    
    return response.json();
  },

  async getDaiveStatus() {
    const response = await fetch(`${API_BASE}/daive/status`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get Daive status');
    }
    
    return response.json();
  },

  // Marketing Journeys
  async getMarketingJourneys() {
    const response = await fetch(`${API_BASE}/marketing/journeys`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get marketing journeys');
    }
    
    return response.json();
  },

  async createMarketingJourney(data: any) {
    const response = await fetch(`${API_BASE}/marketing/journeys`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create marketing journey');
    }
    
    return response.json();
  },

  async updateMarketingJourney(journeyId: string, data: any) {
    const response = await fetch(`${API_BASE}/marketing/journeys/${journeyId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update marketing journey');
    }
    
    return response.json();
  },

  async deleteMarketingJourney(journeyId: string) {
    const response = await fetch(`${API_BASE}/marketing/journeys/${journeyId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete marketing journey');
    }
    
    return response.json();
  },

  async getMarketingJourneySteps(journeyId: string) {
    const response = await fetch(`${API_BASE}/marketing/journeys/${journeyId}/steps`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get marketing journey steps');
    }
    
    return response.json();
  },

  async addMarketingJourneyStep(journeyId: string, data: any) {
    const response = await fetch(`${API_BASE}/marketing/journeys/${journeyId}/steps`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to add marketing journey step');
    }
    
    return response.json();
  },

  async updateMarketingJourneyStep(stepId: string, data: any) {
    const response = await fetch(`${API_BASE}/marketing/journey-steps/${stepId}`, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update marketing journey step');
    }
    
    return response.json();
  },

  async deleteMarketingJourneyStep(stepId: string) {
    const response = await fetch(`${API_BASE}/marketing/journey-steps/${stepId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete marketing journey step');
    }
    
    return response.json();
  },

  async enrollLeadInJourney(journeyId: string, leadId: string) {
    const response = await fetch(`${API_BASE}/marketing/journeys/${journeyId}/enroll`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lead_id: leadId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to enroll lead in journey');
    }
    
    return response.json();
  },

  async getMarketingEnrollments(journeyId?: string) {
    const url = journeyId 
      ? `${API_BASE}/marketing/journeys/${journeyId}/enrollments`
      : `${API_BASE}/marketing/enrollments`;
    
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get marketing enrollments');
    }
    
    return response.json();
  },

  async runNextMarketingStep(enrollmentId: string) {
    const response = await fetch(`${API_BASE}/marketing/enrollments/${enrollmentId}/run-next`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to run next marketing step');
    }
    
    return response.json();
  },

  // Marketing Scheduler
  async getSchedulerStatus() {
    const response = await fetch(`${API_BASE}/marketing/scheduler/status`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get scheduler status');
    }
    
    return response.json();
  },

  async startScheduler() {
    const response = await fetch(`${API_BASE}/marketing/scheduler/start`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to start scheduler');
    }
    
    return response.json();
  },

  async stopScheduler() {
    const response = await fetch(`${API_BASE}/marketing/scheduler/stop`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to stop scheduler');
    }
    
    return response.json();
  },

  async triggerScheduler() {
    const response = await fetch(`${API_BASE}/marketing/scheduler/trigger`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to trigger scheduler');
    }
    
    return response.json();
  },

  // Audit Logging API
  async getAuditLogs(filters: any = {}, pagination: any = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    Object.entries(pagination).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const response = await fetch(`${API_BASE}/audit/logs?${params}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get audit logs');
    }
    
    return response.json();
  },

  async getAuditLogDetails(logId: string) {
    const response = await fetch(`${API_BASE}/audit/logs/${logId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get audit log details');
    }
    
    return response.json();
  },

  async generateAuditReport(reportConfig: any) {
    const response = await fetch(`${API_BASE}/audit/reports`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportConfig)
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate audit report');
    }
    
    return response.json();
  },

  async getAuditAlerts(filters: any = {}, pagination: any = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    Object.entries(pagination).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const response = await fetch(`${API_BASE}/audit/alerts?${params}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get audit alerts');
    }
    
    return response.json();
  },

  async resolveAuditAlert(alertId: string, resolutionNotes?: string) {
    const response = await fetch(`${API_BASE}/audit/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resolutionNotes })
    });
    
    if (!response.ok) {
      throw new Error('Failed to resolve audit alert');
    }
    
    return response.json();
  },

  async getAuditStatistics(period: string = '30d') {
    const response = await fetch(`${API_BASE}/audit/statistics?period=${period}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get audit statistics');
    }
    
    return response.json();
  },

  async exportAuditLogs(filters: any = {}, format: string = 'csv') {
    const params = new URLSearchParams();
    params.append('format', format);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const response = await fetch(`${API_BASE}/audit/export?${params}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to export audit logs');
    }
    
    return response.text();
  },

  async getAuditCategories() {
    const response = await fetch(`${API_BASE}/audit/categories`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get audit categories');
    }
    
    return response.json();
  },

  async getAuditSeverityLevels() {
    const response = await fetch(`${API_BASE}/audit/severity-levels`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to get audit severity levels');
    }
    
    return response.json();
  },

  async cleanupAuditLogs() {
    const response = await fetch(`${API_BASE}/audit/cleanup`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to cleanup audit logs');
    }
    
    return response.json();
  },

  // Subscription Management Functions
  async getSubscriptionPlans() {
    const response = await fetch(`${API_BASE}/subscription/plans`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to fetch subscription plans');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },


  async updateSubscription(subscriptionId: string, updates: any) {
    const response = await fetch(`${API_BASE}/subscription/${subscriptionId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to update subscription');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },


  async getSubscriptionDetails(subscriptionId: string) {
    const response = await fetch(`${API_BASE}/subscription/${subscriptionId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to fetch subscription details');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  async getSubscriptionInvoices(customerId: string) {
    const response = await fetch(`${API_BASE}/subscription/invoices/${customerId}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to fetch invoices');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  // Lead Activities
  async getLeadActivities(leadId: string, limit = 50, offset = 0) {
    const response = await fetch(`${API_BASE}/software-leads/${leadId}/activities?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to fetch lead activities');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  // Email and SMS Functions
  async sendEmailToLead(leadId: string, emailData: any) {
    const response = await fetch(`${API_BASE}/software-leads/${leadId}/send-email`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to send email');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  async sendSmsToLead(leadId: string, smsData: any) {
    const response = await fetch(`${API_BASE}/software-leads/${leadId}/send-sms`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smsData)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to send SMS');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
    }
    
    return response.json();
  },

  // =====================================================
  // MARKETING ANALYTICS API METHODS
  // =====================================================

  // Get campaign performance metrics
  async getCampaignAnalytics(journeyId: string, days: number = 30) {
    const response = await fetch(`${API_BASE}/marketing/analytics/campaigns/${journeyId}?days=${days}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get campaign analytics');
    }

    return response.json();
  },

  // Get all campaigns analytics overview
  async getAllCampaignsAnalytics(days: number = 30) {
    const response = await fetch(`${API_BASE}/marketing/analytics/campaigns?days=${days}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get campaigns analytics');
    }

    return response.json();
  },

  // Get real-time activity feed
  async getActivityFeed(limit: number = 50) {
    const response = await fetch(`${API_BASE}/marketing/analytics/activity?limit=${limit}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get activity feed');
    }

    return response.json();
  },

  // Get lead scoring trends
  async getLeadScoringAnalytics(leadId: string) {
    const response = await fetch(`${API_BASE}/marketing/analytics/lead-scoring/${leadId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get lead scoring analytics');
    }

    return response.json();
  },

  // Get revenue attribution
  async getRevenueAttribution(days: number = 30) {
    const response = await fetch(`${API_BASE}/marketing/analytics/revenue-attribution?days=${days}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get revenue attribution');
    }

    return response.json();
  },

  // Get email template performance
  async getTemplateAnalytics() {
    const response = await fetch(`${API_BASE}/marketing/analytics/templates`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to get template analytics');
    }

    return response.json();
  },

  // Update lead score with marketing trigger
  async updateLeadScoreWithMarketingTrigger(leadId: string, newScore: number, changeReason: string, marketingTriggerId?: string) {
    const response = await fetch(`${API_BASE}/marketing/analytics/lead-scoring/${leadId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        new_score: newScore,
        change_reason: changeReason,
        marketing_trigger_id: marketingTriggerId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update lead score');
    }

    return response.json();
  },

  // Record revenue attribution
  async recordRevenueAttribution(leadId: string, journeyId: string, revenueAmount: number, attributionType: 'direct' | 'assisted' | 'influenced') {
    const response = await fetch(`${API_BASE}/marketing/analytics/revenue-attribution`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        lead_id: leadId,
        journey_id: journeyId,
        revenue_amount: revenueAmount,
        attribution_type: attributionType
      })
    });

    if (!response.ok) {
      throw new Error('Failed to record revenue attribution');
    }

    return response.json();
  },

  // Add staff member to dealer
  async addDealerStaff(dealerId: string, staffData: {
    email: string;
    password: string;
    name?: string;
    staff_role: 'admin' | 'sales' | 'finance' | 'service' | 'inventory';
    permissions?: string[];
  }) {
    const response = await fetch(`${API_BASE}/dealers/${dealerId}/staff`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(staffData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to add staff member');
    }

    return response.json();
  },

  async toggleMarbalismAI(dealerId: string, enabled: boolean) {
    const response = await fetch(`${API_BASE}/dealers/${dealerId}/marbalism-toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to toggle Marbalism AI');
    }

    return response.json();
  },

  // ─── CONVERSATION MONITOR ──────────────────────────────────────────────────

  async getMonitorConversations(params: {
    dealer_id?: string;
    page?: number;
    limit?: number;
    status?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.dealer_id) qs.set('dealer_id', params.dealer_id);
    if (params.page)      qs.set('page',      String(params.page));
    if (params.limit)     qs.set('limit',     String(params.limit));
    if (params.status)    qs.set('status',    params.status);
    const response = await fetch(`${API_BASE}/conv-monitor/conversations?${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
  },

  async getMonitorMessages(sessionId: string) {
    const response = await fetch(
      `${API_BASE}/conv-monitor/conversations/${encodeURIComponent(sessionId)}/messages`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch conversation messages');
    return response.json();
  },

  async analyzeConversation(sessionId: string) {
    const response = await fetch(
      `${API_BASE}/conv-monitor/conversations/${encodeURIComponent(sessionId)}/analyze`,
      { method: 'POST', headers: getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to analyze conversation');
    return response.json();
  },

  // ─── END CONVERSATION MONITOR ─────────────────────────────────────────────
};

export default superAdminAPI;
