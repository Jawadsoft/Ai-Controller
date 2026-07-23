/**
 * ✅ SIMPLE SERVER TEST
 * Quick test to verify server is responding
 */

import http from 'http';

async function testServer() {
  console.log('🔍 Testing server connection...');
  
  try {
    const response = await makeRequest('GET', '/api/health');
    console.log('✅ Server is responding!');
    console.log('Response:', response);
    
    // Test the chat endpoint
    const chatResponse = await makeRequest('POST', '/api/daive/chat', {
      vehicleId: null,
      sessionId: 'test-session-' + Date.now(),
      message: 'hello',
      customerInfo: { dealerId: 'test-dealer' }
    });
    
    console.log('✅ Chat endpoint is working!');
    console.log('Chat Response:', chatResponse);
    
  } catch (error) {
    console.error('❌ Server test failed:', error);
  }
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          resolve({ raw: responseData, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Run the test
testServer().catch(console.error);
