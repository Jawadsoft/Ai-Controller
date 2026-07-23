/**
 * Test Endpoints Script
 * Tests the PDF and signature endpoints directly
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8080';

// You'll need to replace this with a real auth token from your browser
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

async function testEndpoint(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n🔍 Testing: ${method} ${path}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const status = response.status;
    const statusText = response.statusText;
    
    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
    
    if (status === 404) {
      console.log(`❌ 404 NOT FOUND - Endpoint doesn't exist or route not registered`);
    } else if (status === 401 || status === 403) {
      console.log(`⚠️  ${status} ${statusText} - Authentication issue (expected without real token)`);
    } else if (status >= 200 && status < 300) {
      console.log(`✅ ${status} ${statusText} - Endpoint responding correctly`);
    } else {
      console.log(`⚠️  ${status} ${statusText}`);
    }
    
    console.log(`Response:`, JSON.stringify(data, null, 2).substring(0, 200));
    
  } catch (error) {
    console.log(`❌ Request failed:`, error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log(`   Server is not running on ${BASE_URL}`);
    }
  }
}

async function runTests() {
  console.log('🧪 Testing PDF & Signature Endpoints\n');
  console.log('📝 Note: You need to update AUTH_TOKEN in this script with a real token\n');
  
  // Test Finance endpoints
  await testEndpoint('GET', '/api/finance/deals');
  await testEndpoint('GET', '/api/finance/programs');
  
  // Test PDF generation endpoint (will fail without real deal ID)
  await testEndpoint('POST', '/api/finance/deals/00000000-0000-0000-0000-000000000000/generate-sheet');
  
  // Test signature endpoint
  await testEndpoint('POST', '/api/signatures/request', {
    deal_id: '00000000-0000-0000-0000-000000000000',
    signer_name: 'Test User',
    signer_email: 'test@example.com',
    document_url: 'http://example.com/doc.pdf',
    document_name: 'Test Document'
  });
  
  console.log('\n✅ Tests Complete!');
  console.log('\n💡 Interpretation:');
  console.log('   - 404 = Route not registered (server needs restart)');
  console.log('   - 401/403 = Route exists but needs authentication (GOOD!)');
  console.log('   - 400/422 = Route exists, validation error (GOOD!)');
  console.log('   - ECONNREFUSED = Server not running\n');
}

runTests();

