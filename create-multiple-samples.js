/**
 * Create multiple sample credit applications and deals
 * Demonstrates bulk creation for testing
 */

import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
let authToken = null;

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    let errorMessage = errorData.error || `HTTP ${response.status}`;
    if (errorData.errors && Array.isArray(errorData.errors)) {
      errorMessage = errorData.errors.map(e => e.msg || e.message).join(', ');
    }
    throw new Error(`${errorMessage} (HTTP ${response.status})`);
  }

  return response.json();
}

// Finance API
const financeAPI = {
  createCreditApplication: async (data) => {
    return apiRequest('/finance/credit-application', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  createFinanceDeal: async (data) => {
    return apiRequest('/finance/deal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  createLeaseDeal: async (data) => {
    return apiRequest('/finance/lease', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Vehicles API
const vehiclesAPI = {
  getAll: async (params = {}) => {
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
};

// Auth API
const authAPI = {
  login: async (data) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.token) {
      authToken = response.token;
    }
    
    return response;
  },
};

// Sample customers with different credit scores
const sampleCustomers = [
  { name: 'John Smith', email: 'john.smith@example.com', credit_score: 780, down_payment: 8000 },
  { name: 'Sarah Johnson', email: 'sarah.j@example.com', credit_score: 690, down_payment: 4000 },
  { name: 'Mike Chen', email: 'mike.chen@example.com', credit_score: 650, down_payment: 3000 },
  { name: 'Emily Davis', email: 'emily.d@example.com', credit_score: 720, down_payment: 6000 },
  { name: 'David Wilson', email: 'david.w@example.com', credit_score: 680, down_payment: 3500 },
  { name: 'Lisa Anderson', email: 'lisa.a@example.com', credit_score: 750, down_payment: 7000 },
  { name: 'Robert Taylor', email: 'robert.t@example.com', credit_score: 620, down_payment: 2500 },
  { name: 'Jennifer Brown', email: 'jennifer.b@example.com', credit_score: 710, down_payment: 5500 },
];

async function createMultipleSamples() {
  try {
    console.log('🚀 Creating Multiple Sample Applications & Deals...\n');
    console.log('='.repeat(70));

    // Step 1: Login
    console.log('📋 Step 1: Logging in...');
    const loginResponse = await authAPI.login({
      email: 'dealer1@example.com',
      password: 'dealeriq'
    });
    
    if (!loginResponse.token) {
      console.error('❌ Login failed!');
      return;
    }
    console.log('✅ Logged in successfully');
    console.log('');

    // Step 2: Get vehicles
    console.log('📋 Step 2: Fetching vehicles...');
    const vehiclesResponse = await vehiclesAPI.getAll({ limit: 10 });
    
    if (!vehiclesResponse.data || vehiclesResponse.data.length === 0) {
      console.error('❌ No vehicles found. Please create vehicles first.');
      return;
    }
    
    const vehicles = vehiclesResponse.data;
    console.log(`✅ Found ${vehicles.length} vehicles`);
    console.log('');

    // Step 3: Create credit applications and deals
    console.log('📋 Step 3: Creating credit applications and deals...\n');
    
    const results = {
      applications: [],
      deals: [],
      errors: []
    };

    for (let i = 0; i < sampleCustomers.length && i < vehicles.length; i++) {
      const customer = sampleCustomers[i];
      const vehicle = vehicles[i];
      
      try {
        console.log(`   Processing ${i + 1}/${Math.min(sampleCustomers.length, vehicles.length)}: ${customer.name}`);
        
        // Create credit application
        const appResponse = await financeAPI.createCreditApplication({
          customer_name: customer.name,
          customer_email: customer.email,
          credit_score: customer.credit_score,
          notes: `Sample application for ${customer.name}`
        });
        
        const application = appResponse.data || appResponse;
        const applicationId = application.id || application.data?.id;
        
        console.log(`      ✅ Application created (ID: ${applicationId.substring(0, 8)}...)`);
        results.applications.push(application);
        
        // Create finance deal
        const vehiclePrice = vehicle.price || 30000;
        const termMonths = customer.credit_score >= 750 ? 72 : customer.credit_score >= 700 ? 60 : 48;
        
        const dealResponse = await financeAPI.createFinanceDeal({
          vehicle_id: vehicle.id,
          price: vehiclePrice,
          down_payment: customer.down_payment,
          credit_score: customer.credit_score,
          term_months: termMonths,
          application_id: applicationId
        });
        
        const deal = dealResponse.data || dealResponse;
        
        const monthlyPayment = typeof deal.monthly_payment === 'number' 
          ? deal.monthly_payment.toFixed(2)
          : (deal.monthly_payment ? parseFloat(deal.monthly_payment).toFixed(2) : 'N/A');
        
        console.log(`      ✅ Deal created - Monthly: $${monthlyPayment}, APR: ${deal.apr || 'N/A'}%`);
        results.deals.push(deal);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`      ❌ Error for ${customer.name}:`, error.message);
        results.errors.push({ customer: customer.name, error: error.message });
      }
      
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Applications Created: ${results.applications.length}`);
    console.log(`✅ Deals Created: ${results.deals.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(err => {
        console.log(`   - ${err.customer}: ${err.error}`);
      });
    }
    
    console.log('\n💡 View results in Finance page:');
    console.log('   http://localhost:8080/#/finance');
    console.log('   - Credit Applications tab: View all applications');
    console.log('   - Deals tab: View all deals');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createMultipleSamples();

