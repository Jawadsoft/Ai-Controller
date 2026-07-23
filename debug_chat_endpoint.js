// Debug script to test the chat endpoint
import fetch from 'node-fetch';

async function testChatEndpoint() {
  try {
    console.log('🧪 Testing chat endpoint...');
    
    const response = await fetch('http://localhost:3000/api/daive/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello, I need a car for my family',
        sessionId: 'test-session-123',
        vehicleId: null,
        customerInfo: {
          dealerId: 'test-dealer-123'
        }
      })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', response.headers);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success response:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Fetch error:', error);
  }
}

// Also test the health endpoint
async function testHealthEndpoint() {
  try {
    console.log('\n🏥 Testing health endpoint...');
    
    const response = await fetch('http://localhost:3000/api/daive/health');
    console.log('📊 Health response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health response:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Health error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Health endpoint error:', error);
  }
}

// Test debug endpoint
async function testDebugEndpoint() {
  try {
    console.log('\n🔍 Testing debug endpoint...');
    
    const response = await fetch('http://localhost:3000/api/daive/debug');
    console.log('📊 Debug response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Debug response:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Debug error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting chat endpoint tests...\n');
  
  await testHealthEndpoint();
  await testDebugEndpoint();
  await testChatEndpoint();
  
  console.log('\n🏁 All tests completed');
}

runAllTests().catch(console.error);
