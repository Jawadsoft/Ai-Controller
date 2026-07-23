# CrewAI Debug Guide - Fixing Fallback Responses

## 🚨 Current Issue

You're still getting the fallback response:
> "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or contact our team directly for immediate assistance."

This means the CrewAI initialization is still failing. Let's debug this step by step.

## 🔍 Step-by-Step Debugging

### 1. **Check Console Logs**

Look for these specific log messages in your browser console:

```
🚀 DAIVE processConversation STARTED (CrewAI Mode)
🔄 Service not initialized, initializing now...
🔧 Attempting to initialize Settings Manager...
🤖 Step 1: Initializing Settings Manager...
🤖 Step 2: Initializing CrewAI LLM for dealer: [dealer-id]
⚙️ Initializing CrewAI for dealer: [dealer-id]
🔍 Searching for available OpenAI API key...
🔑 Using OpenAI API key: [key-preview]...
✅ CrewAI LLM initialized for dealer: [dealer-id]
🧪 Testing CrewAI connection...
✅ CrewAI test successful: [response preview]
```

### 2. **Run API Key Detection Test**

```bash
node test-api-key-detection.js
```

This will show you:
- ✅/❌ Environment variables
- ✅/❌ Database connection
- ✅/❌ Settings Manager availability

### 3. **Check Environment Variables**

Make sure you have these set in your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### 4. **Database Connection Test**

Check if your database is accessible and has the required tables:

```sql
-- Check if daive_api_settings table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'daive_api_settings'
);

-- Check for OpenAI API keys
SELECT dealer_id, setting_type, setting_value 
FROM daive_api_settings 
WHERE setting_type = 'openai_key' 
AND setting_value IS NOT NULL;
```

## 🛠️ Quick Fixes to Try

### Fix 1: **Force Environment Variable Usage**

If the settings manager is failing, force the service to use environment variables:

```javascript
// In your .env file, make sure you have:
OPENAI_API_KEY=sk-your-actual-key-here

// Then restart your application
```

### Fix 2: **Check Settings Manager Import**

The settings manager might be failing to import. Check if this file exists:
```
src/lib/settingsManager.js
```

### Fix 3: **Database Connection Issues**

If the database is failing, the service can't get API keys. Check:
- Database server is running
- Connection credentials are correct
- Required tables exist

### Fix 4: **LangChain Dependencies**

Make sure you have the required packages:

```bash
npm install @langchain/openai @langchain/core
```

## 🔧 Manual Testing

### Test 1: **Basic OpenAI Connection**

```javascript
// Test if OpenAI works at all
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-api-key-here'
});

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 10
  });
  console.log('✅ OpenAI connection works:', response.choices[0].message.content);
} catch (error) {
  console.error('❌ OpenAI connection failed:', error.message);
}
```

### Test 2: **Database Connection**

```javascript
// Test database connection
import { pool } from './src/database/connection.js';

try {
  const result = await pool.query('SELECT 1 as test');
  console.log('✅ Database connection works:', result.rows[0]);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
}
```

## 📊 Expected Debug Output

### ✅ **Successful Initialization**
```
🚀 DAIVE processConversation STARTED (CrewAI Mode)
🔍 Current service state: { initialized: false, crewAI: false, settingsManager: true, dealerId: "dealer-123" }
🔄 Service not initialized, initializing now...
🔧 Attempting to initialize Settings Manager...
✅ Settings Manager initialized in DAIVE Service
🤖 Step 1: Initializing Settings Manager...
🤖 Step 2: Initializing CrewAI LLM for dealer: dealer-123
⚙️ Initializing CrewAI for dealer: dealer-123
🔑 Got OpenAI API key from dealer: dealer-123
🔑 Using OpenAI API key: sk-1234567890...
✅ CrewAI LLM initialized for dealer: dealer-123
🧪 Testing CrewAI connection...
✅ CrewAI test successful: Hello! I'm here to help you...
🔍 CrewAI status after initialization: { crewAI: true, initialized: true, dealerId: "dealer-123" }
🚀 Calling processWithAI with CrewAI...
✅ AI response received, generating contextual response...
```

### ❌ **Failed Initialization (Current Issue)**
```
🚀 DAIVE processConversation STARTED (CrewAI Mode)
🔍 Current service state: { initialized: false, crewAI: false, settingsManager: false, dealerId: "dealer-123" }
🔄 Service not initialized, initializing now...
🔧 Attempting to initialize Settings Manager...
❌ Error initializing Settings Manager: [error details]
⚠️ Will continue with fallback mode
🔍 Current service state: { initialized: false, crewAI: false, settingsManager: false, dealerId: "dealer-123" }
🤖 Processing conversation with CrewAI...
🔄 Attempting to initialize CrewAI with dealer: dealer-123...
⚙️ Initializing CrewAI for dealer: dealer-123
⚠️ OpenAI API key not found anywhere - Crew AI will use fallback responses
🔍 CrewAI status after initialization: { crewAI: false, initialized: false, dealerId: "dealer-123" }
⚠️ CrewAI still not available after initialization attempt, using fallback
❌ CrewAI processing failed, using fallback: CrewAI not available
```

## 🎯 **Most Likely Causes**

1. **Missing OpenAI API Key**: No API key in environment or database
2. **Settings Manager Failure**: Import or initialization issues
3. **Database Connection**: Can't access API key storage
4. **LangChain Issues**: Missing or incompatible dependencies
5. **Environment Variables**: Not loaded or incorrect format

## 🚀 **Next Steps**

1. **Run the API key detection test** to identify the issue
2. **Check console logs** for specific error messages
3. **Verify environment variables** are set correctly
4. **Test database connection** manually
5. **Check package dependencies** are installed correctly

## 📞 **Need More Help?**

If you're still getting fallback responses after trying these fixes, please share:

1. **Console log output** from the conversation attempt
2. **Results** from `test-api-key-detection.js`
3. **Environment variable status**
4. **Database connection test results**
5. **Any error messages** you see

This will help identify the exact issue and provide a targeted solution. 