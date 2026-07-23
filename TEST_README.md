# 🧪 CrewAI Chat Test Suite

This test suite will help you verify that your CrewAI chat functionality is working correctly after the recent centralization changes.

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# On Linux/Mac
chmod +x setup-test.sh
./setup-test.sh

# On Windows
setup-test.bat
```

### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Run basic tests
npm test

# Run full test suite
npm run test-full
```

## 📋 What Gets Tested

### 🔍 **Basic Functionality Tests**
1. **Health Check** - Verifies the server is responding
2. **Debug Endpoint** - Tests the debug functionality
3. **CrewAI Settings** - Checks if CrewAI settings are accessible
4. **Prompts Endpoint** - Verifies prompts are working
5. **Text Chat** - Tests basic AI conversation
6. **TTS Generation** - Tests text-to-speech functionality

### 🎯 **Test Scenarios**
- Basic greetings and inquiries
- Vehicle-specific questions
- Inventory queries
- Test drive requests
- Voice chat processing
- TTS audio generation

## ⚙️ Configuration

### **Update Test Settings**
Edit `simple-crewai-test.js` and update:

```javascript
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',        // Your server URL
  testDealerId: 1,                        // Existing dealer ID in your database
  testSessionId: `test_session_${Date.now()}`,
  timeout: 30000
};
```

### **Database Requirements**
Ensure you have:
- ✅ At least one dealer in the `dealers` table
- ✅ API keys configured in `daive_api_settings`
- ✅ Voice settings configured
- ✅ CrewAI settings configured

## 🔧 Troubleshooting

### **Common Issues & Solutions**

#### 1. **Server Not Running**
```
❌ Server is not running on http://localhost:3000
```
**Solution**: Start your server first
```bash
npm run dev
# or
npm start
```

#### 2. **Database Connection Issues**
```
❌ CrewAI settings endpoint failed
```
**Solution**: Check your database connection and ensure tables exist

#### 3. **API Key Missing**
```
❌ Text chat failed
```
**Solution**: Verify API keys are configured in the database

#### 4. **Settings Manager Issues**
```
❌ Settings manager error
```
**Solution**: Check if `settingsManager.js` is properly initialized

### **Debug Mode**
Enable detailed logging by checking the server console for:
- 🔍 Settings manager initialization
- 🔑 API key retrieval
- 🤖 CrewAI initialization
- 💬 Chat processing

## 📊 Expected Test Results

### **All Tests Should Pass If:**
- ✅ Server is running and accessible
- ✅ Database is connected and has data
- ✅ Settings manager is working
- ✅ API keys are configured
- ✅ CrewAI is properly initialized

### **Partial Success Expected If:**
- ⚠️ Some endpoints require authentication
- ⚠️ TTS fails due to missing API keys
- ⚠️ Voice chat fails due to audio processing issues

## 🎯 **What to Look For**

### **Successful Test Indicators:**
1. **Health Check**: Returns `{"status": "OK"}`
2. **Debug Endpoint**: Shows service status
3. **CrewAI Settings**: Returns enabled status and max tokens
4. **Prompts**: Shows available prompt types
5. **Text Chat**: Returns AI-generated response
6. **TTS**: Generates audio file URL

### **Potential Issues to Monitor:**
1. **Settings Centralization**: All API calls should use settings manager
2. **No Hardcoded Values**: No direct `process.env` usage for API keys
3. **Proper Fallbacks**: Environment variables only used when settings manager unavailable
4. **Response Quality**: AI responses should be relevant and helpful

## 🔍 **Manual Testing**

### **Test Individual Endpoints**
```bash
# Health check
curl http://localhost:3000/api/daive/health

# Debug endpoint
curl http://localhost:3000/api/daive/debug

# CrewAI settings
curl "http://localhost:3000/api/daive/crew-ai-settings?dealerId=1"

# Text chat
curl -X POST http://localhost:3000/api/daive/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","sessionId":"test","customerInfo":{"dealerId":1}}'
```

## 📝 **Test Report**

After running tests, you'll see:
```
📊 Test Results Summary:
Total Tests: 6
Passed: 6
Failed: 0

🎉 All tests passed! CrewAI chat is working correctly.
```

## 🚨 **If Tests Fail**

1. **Check Server Logs**: Look for error messages in your server console
2. **Verify Database**: Ensure all required tables and data exist
3. **Check API Keys**: Verify OpenAI, ElevenLabs, and other API keys are configured
4. **Settings Manager**: Ensure the settings manager is properly initialized
5. **Network Issues**: Check if the server is accessible on the expected port

## 🎉 **Success Criteria**

Your CrewAI system is working correctly when:
- ✅ All basic tests pass
- ✅ Settings are properly centralized
- ✅ No hardcoded environment variables
- ✅ API keys come from settings manager
- ✅ Chat responses are generated successfully
- ✅ TTS audio is generated (if configured)

---

**Need Help?** Check the server console logs for detailed error information and ensure all the recent centralization changes have been properly applied.
