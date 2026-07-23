// Simple CrewAI Test Script
// This script tests the core CrewAI functionality

import fetch from 'node-fetch';

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testDealerId: '857310bf-94a6-4fbb-b08b-1b5fa5f82bfb', // Real UUID from database
  testSessionId: `test_session_${Date.now()}`,
  timeout: 30000
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TEST_CONFIG.timeout
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    log(`Making ${method} request to: ${url}`);
    if (data) {
      log(`Request data: ${JSON.stringify(data, null, 2)}`);
    }

    const response = await fetch(url, options);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { rawResponse: responseText };
    }

    log(`Response status: ${response.status}`);
    log(`Response data: ${JSON.stringify(responseData, null, 2)}`);

    return {
      success: response.ok,
      status: response.status,
      data: responseData
    };
  } catch (error) {
    log(`Request failed: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message
    };
  }
}

// Test functions
async function testHealthCheck() {
  log('Testing health check endpoint...');
  const result = await makeRequest('/api/daive/health');
  
  if (result.success && result.data.status === 'OK') {
    log('Health check passed', 'success');
    return true;
  } else {
    log('Health check failed', 'error');
    return false;
  }
}

async function testDebugEndpoint() {
  log('Testing debug endpoint...');
  const result = await makeRequest('/api/daive/debug');
  
  if (result.success) {
    log('Debug endpoint working', 'success');
    return true;
  } else {
    log('Debug endpoint failed', 'error');
    return false;
  }
}

async function testCrewAISettings() {
  log('Testing CrewAI settings endpoint...');
  
  const result = await makeRequest(`/api/daive/crew-ai-settings?dealerId=${TEST_CONFIG.testDealerId}`);
  
  if (result.success && result.data.success) {
    log('CrewAI settings endpoint working', 'success');
    log(`CrewAI enabled: ${result.data.data.enabled}`);
    log(`Max tokens: ${result.data.data.maxTokens}`);
    return true;
  } else {
    log('CrewAI settings endpoint failed', 'error');
    return false;
  }
}

async function testPromptsEndpoint() {
  log('Testing prompts endpoint...');
  
  const result = await makeRequest(`/api/daive/prompts/public?dealerId=${TEST_CONFIG.testDealerId}`);
  
  if (result.success && result.data.success) {
    log('Prompts endpoint working', 'success');
    log(`Available prompts: ${Object.keys(result.data.data).join(', ')}`);
    return true;
  } else {
    log('Prompts endpoint failed', 'error');
    return false;
  }
}

async function testTextChat(message, vehicleId = null) {
  log(`Testing text chat with message: "${message}"`);
  
  const requestData = {
    message,
    sessionId: TEST_CONFIG.testSessionId,
    customerInfo: {
      dealerId: TEST_CONFIG.testDealerId
    }
  };

  if (vehicleId) {
    requestData.vehicleId = vehicleId;
  }

  const result = await makeRequest('/api/daive/chat', 'POST', requestData);
  
  if (result.success && result.data.success) {
    log('Text chat successful', 'success');
    log(`AI Response: ${result.data.data.response.substring(0, 100)}...`);
    
    if (result.data.data.audioResponseUrl) {
      log(`Audio response generated: ${result.data.data.audioResponseUrl}`, 'success');
    }
    
    return true;
  } else {
    log('Text chat failed', 'error');
    if (result.data && result.data.error) {
      log(`Error details: ${result.data.error}`, 'error');
    }
    return false;
  }
}

async function testTTSEndpoint(text) {
  log(`Testing TTS endpoint with text: "${text}"`);
  
  const requestData = {
    text,
    dealerId: TEST_CONFIG.testDealerId,
    voice: 'liam',
    provider: 'elevenlabs'
  };

  const result = await makeRequest('/api/daive/tts', 'POST', requestData);
  
  if (result.success && result.data.success) {
    log('TTS generation successful', 'success');
    log(`Audio URL: ${result.data.data.audioUrl}`);
    return true;
  } else {
    log('TTS generation failed', 'error');
    if (result.data && result.data.error) {
      log(`Error details: ${result.data.error}`, 'error');
    }
    return false;
  }
}

async function runBasicTests() {
  log('🚀 Starting Basic CrewAI Test Suite...');
  log(`Test configuration: ${JSON.stringify(TEST_CONFIG, null, 2)}`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  try {
    // Test 1: Health Check
    results.total++;
    if (await testHealthCheck()) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    await sleep(1000);
    
    // Test 2: Debug Endpoint
    results.total++;
    if (await testDebugEndpoint()) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    await sleep(1000);
    
    // Test 3: CrewAI Settings
    results.total++;
    if (await testCrewAISettings()) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    await sleep(1000);
    
    // Test 4: Prompts Endpoint
    results.total++;
    if (await testPromptsEndpoint()) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    await sleep(1000);
    
    // Test 5: Basic Text Chat
    results.total++;
    if (await testTextChat('Hello, I\'m interested in your vehicles.')) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    await sleep(2000);
    
    // Test 6: TTS Generation
    results.total++;
    if (await testTTSEndpoint('Thank you for your help today.')) {
      results.passed++;
    } else {
      results.failed++;
    }
    
  } catch (error) {
    log(`Test suite error: ${error.message}`, 'error');
    results.failed++;
  }
  
  // Summary
  log('\n📊 Test Results Summary:', 'info');
  log(`Total Tests: ${results.total}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, 'error');
  
  if (results.failed === 0) {
    log('🎉 All tests passed! CrewAI chat is working correctly.', 'success');
  } else {
    log('⚠️ Some tests failed. Please check the logs above for details.', 'warning');
  }
  
  return results;
}

// Run tests
runBasicTests().catch(error => {
  log(`Test suite crashed: ${error.message}`, 'error');
  process.exit(1);
});
