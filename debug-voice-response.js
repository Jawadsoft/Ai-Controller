import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug script for voice response issues
console.log('🔍 Voice Response Debug Script');
console.log('==============================\n');

// Test 1: Check if uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'daive-audio');
console.log('📁 Checking uploads directory...');
if (fs.existsSync(uploadsDir)) {
  console.log('✅ Uploads directory exists:', uploadsDir);
  
  // List audio files
  const files = fs.readdirSync(uploadsDir);
  console.log(`📂 Found ${files.length} audio files:`);
  files.forEach(file => {
    const filePath = path.join(uploadsDir, file);
    const stats = fs.statSync(filePath);
    console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
} else {
  console.log('❌ Uploads directory does not exist:', uploadsDir);
  console.log('💡 Creating uploads directory...');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created');
}

// Test 2: Check backend voice endpoint
console.log('\n🌐 Testing backend voice endpoint...');
const testVoiceEndpoint = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/daive/voice-settings', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Voice settings endpoint working');
      console.log('📊 Voice settings:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Voice settings endpoint failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Could not connect to voice settings endpoint:', error.message);
  }
};

// Test 3: Check API settings
console.log('\n🔑 Testing API settings endpoint...');
const testApiSettings = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/daive/api-settings', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API settings endpoint working');
      
      // Check for API keys
      const settings = data.data || {};
      const hasOpenAI = !!settings.openai_key?.value;
      const hasElevenLabs = !!settings.elevenlabs_key?.value;
      const hasDeepgram = !!settings.deepgram_key?.value;
      
      console.log('🔑 API Keys Status:');
      console.log(`   - OpenAI: ${hasOpenAI ? '✅' : '❌'}`);
      console.log(`   - ElevenLabs: ${hasElevenLabs ? '✅' : '❌'}`);
      console.log(`   - Deepgram: ${hasDeepgram ? '✅' : '❌'}`);
      
      if (!hasOpenAI && !hasElevenLabs && !hasDeepgram) {
        console.log('⚠️  No API keys configured! This is why voice responses are not working.');
        console.log('💡 Please configure API keys in the DAIVE Settings page.');
      }
    } else {
      console.log('❌ API settings endpoint failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Could not connect to API settings endpoint:', error.message);
  }
};

// Test 4: Check if backend is running
console.log('\n🚀 Checking if backend is running...');
const checkBackend = async () => {
  try {
    const response = await fetch('http://localhost:3000/health', {
      method: 'GET'
    });
    
    if (response.ok) {
      console.log('✅ Backend is running');
    } else {
      console.log('⚠️  Backend responded but health check failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Backend is not running or not accessible');
    console.log('💡 Please start the backend server first');
    return false;
  }
  return true;
};

// Run tests
const runTests = async () => {
  const backendRunning = await checkBackend();
  
  if (backendRunning) {
    await testVoiceEndpoint();
    await testApiSettings();
  }
  
  console.log('\n📋 Summary of Issues:');
  console.log('1. Check if backend server is running on port 3000');
  console.log('2. Verify API keys are configured in DAIVE Settings');
  console.log('3. Check browser console for JavaScript errors');
  console.log('4. Ensure microphone permissions are granted');
  console.log('5. Check if audio files are being generated in uploads/daive-audio/');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Open DAIVE Settings page and configure API keys');
  console.log('2. Test voice recording with the "Test Voice" button');
  console.log('3. Check browser console for detailed error messages');
  console.log('4. Verify audio playback works in other applications');
};

runTests().catch(console.error); 