/**
 * Sample script to create a finance deal (Node.js compatible)
 * Demonstrates the finance system workflow
 * 
 * NOTE: This script requires the backend server to be running
 * Run: npm run dev (to start the backend)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Node.js fetch (Node 18+ has native fetch)
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
    console.error(`   API Error Details:`, JSON.stringify(errorData, null, 2));
    throw new Error(`${errorMessage} (HTTP ${response.status})`);
  }

  return response.json();
}

// Finance API functions
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

async function createSampleDeal() {
  try {
    console.log('🚀 Starting Finance Deal Creation...\n');
    console.log('='.repeat(60));

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
    console.log(`   User: ${loginResponse.user?.email || 'N/A'}`);
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log('');

    // Step 2: Get a vehicle
    console.log('📋 Step 2: Fetching vehicles...');
    const vehiclesResponse = await vehiclesAPI.getAll({ limit: 5 });
    
    if (vehiclesResponse.data.length === 0) {
      console.error('❌ No vehicles found. Please create a vehicle first.');
      console.log('   Go to: /#/vehicles to add a vehicle');
      return;
    }
    
    const vehicle = vehiclesResponse.data[0];
    console.log('✅ Vehicle found!');
    console.log(`   Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    console.log(`   Price: $${vehicle.price ? vehicle.price.toLocaleString() : 'N/A'}`);
    console.log(`   Vehicle ID: ${vehicle.id}`);
    console.log('');

    // Step 3: Create credit application
    console.log('📋 Step 3: Creating credit application...');
    const application = await financeAPI.createCreditApplication({
      customer_name: 'Sample Customer',
      customer_email: 'sample@example.com',
      // customer_phone is optional - omit if validation fails
      credit_score: 720,
      notes: 'Sample credit application for testing'
    });
    
    console.log('✅ Credit Application created!');
    const applicationId = application.data?.id || application.id;
    console.log(`   Application ID: ${applicationId}`);
    console.log(`   Customer: ${application.data?.customer_name || application.customer_name}`);
    console.log(`   Credit Score: 720`);
    console.log(`   Status: ${application.data?.application_status || application.application_status}`);
    console.log('');

    // Step 4: Generate finance deal
    console.log('📋 Step 4: Generating finance deal...');
    const vehiclePrice = vehicle.price || 30000;
    
    const dealResponse = await financeAPI.createFinanceDeal({
      vehicle_id: vehicle.id,
      price: vehiclePrice,
      down_payment: 5000,
      credit_score: 720,
      term_months: 60,
      application_id: applicationId
    });

    const deal = dealResponse.data || dealResponse;

    console.log('✅ Finance Deal Generated!');
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 DEAL DETAILS');
    console.log('='.repeat(60));
    console.log(`Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    console.log(`VIN: ${vehicle.vin || 'N/A'}`);
    console.log(`Vehicle Price: $${deal.vehicle_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Down Payment: $${deal.down_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Credit Score: 720`);
    console.log(`Term: ${deal.term_months} months`);
    console.log(`APR: ${deal.apr}%`);
    console.log(`Monthly Payment: $${deal.monthly_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Amount: $${deal.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Interest: $${deal.total_interest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Status: ${deal.status}`);
    console.log(`Deal ID: ${deal.id}`);
    console.log('='.repeat(60));
    console.log('');

    console.log('💡 You can now view this deal in the Finance page:');
    console.log(`   http://localhost:8080/#/finance`);
    console.log('   Navigate to the "Deals" tab');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('401') || error.message.includes('token') || error.message.includes('credentials')) {
      console.error('\n💡 Login failed. Check your credentials.');
      console.error('   Email: dealer1@example.com');
      console.error('   Password: dealeriq');
    } else if (error.message.includes('vehicle') || error.message.includes('No vehicles')) {
      console.error('\n💡 No vehicles found. Create a vehicle first: http://localhost:8080/#/vehicles');
    } else if (error.message.includes('program') || error.message.includes('term') || error.message.includes('No finance')) {
      console.error('\n💡 No finance program found for this credit score and term.');
      console.error('   Make sure finance programs are loaded in the database.');
      console.error('   Check the Programs tab in Finance page.');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.error('\n💡 Cannot connect to server. Make sure the backend is running:');
      console.error('   npm run dev');
    } else {
      console.error('\n   Full error:', error);
      if (error.stack) {
        console.error('\n   Stack:', error.stack);
      }
    }
    
    process.exit(1);
  }
}

createSampleDeal();

