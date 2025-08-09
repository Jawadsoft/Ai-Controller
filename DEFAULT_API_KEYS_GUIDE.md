# Default API Keys Setup Guide

## Overview

The D.A.I.V.E. system now includes a **"Set Default Keys"** feature that automatically configures all necessary API keys for testing and development. This makes it easy to get started with voice recognition and AI features.

## What's New

### ✅ **Default API Keys Button**
- **Location**: DAIVE Settings → API Keys tab
- **Purpose**: Automatically sets up all required API keys
- **Includes**: OpenAI, ElevenLabs, Deepgram, Azure Speech keys
- **Default Speech Provider**: Deepgram (your working key)

### ✅ **Enhanced AIBotPage Communication**
- **Better Error Handling**: Specific error messages for different issues
- **API Settings Check**: Automatically checks if keys are configured
- **User Feedback**: Clear notifications about missing configurations

## Setup Instructions

### 1. **Access DAIVE Settings**
1. Log into your dealer account
2. Navigate to **DAIVE Settings**
3. Click on **"API Keys"** tab

### 2. **Set Default API Keys**
1. Click the **"Set Default Keys"** button
2. Wait for the confirmation message
3. Verify all keys are displayed in the form

### 3. **Test API Connections**
1. Click **"Test"** button for each API service
2. Verify all connections are successful
3. If any fail, check the error messages

### 4. **Configure Voice Settings**
1. Go to **"Voice Settings"** tab
2. Enable **"Voice Responses"**
3. Select **"Deepgram"** as Speech-to-Text Provider
4. Click **"Save Voice Settings"**

## Default API Keys

When you click "Set Default Keys", the following keys are automatically configured:

### **Deepgram API Key**
- **Key**: `fc3ae1a1762b2eb96ff9b59813d49f8881030dd2`
- **Purpose**: Speech-to-text transcription
- **Status**: ✅ Working (your provided key)

### **OpenAI API Key**
- **Key**: `sk-test-openai-key`
- **Purpose**: AI conversation processing
- **Status**: ⚠️ Test key (replace with real key)

### **ElevenLabs API Key**
- **Key**: `test-elevenlabs-key`
- **Purpose**: Text-to-speech synthesis
- **Status**: ⚠️ Test key (replace with real key)

### **Azure Speech API Key**
- **Key**: `test-azure-key`
- **Purpose**: Alternative text-to-speech
- **Status**: ⚠️ Test key (replace with real key)

## Testing the Setup

### 1. **Test in AIBotPage**
1. Go to any vehicle page
2. Click **"Chat with D.A.I.V.E."**
3. Enable voice (blue dot)
4. Click microphone and speak clearly
5. Verify Deepgram transcription works

### 2. **Test API Connections**
```bash
# Test Deepgram integration
node test-deepgram-integration.js

# Test default API keys
node test-default-api-keys.js
```

### 3. **Manual Testing**
1. **Voice Input**: Speak clearly into microphone
2. **Transcription**: Should show your speech as text
3. **AI Response**: Should generate appropriate response
4. **Audio Output**: Should play voice response (if enabled)

## Troubleshooting

### **"Voice recognition not configured"**
**Solution**:
1. Click **"Set Default Keys"** in API Keys tab
2. Go to Voice Settings → Enable voice responses
3. Select Deepgram as speech provider
4. Save settings and try again

### **"API key not found"**
**Solution**:
1. Check if you're logged in as a dealer
2. Verify the "Set Default Keys" button was clicked
3. Refresh the page and check API Keys tab
4. Manually enter your Deepgram key if needed

### **"Authentication required"**
**Solution**:
1. Log out and log back in
2. Check if your session is still valid
3. Try accessing from a different browser
4. Clear browser cache and cookies

### **"Deepgram API connection failed"**
**Solution**:
1. Verify your Deepgram API key is correct
2. Check if the key has sufficient credits
3. Test the connection using the "Test" button
4. Contact Deepgram support if issues persist

## Advanced Configuration

### **Replace Test Keys with Real Keys**

#### OpenAI API Key
1. Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Replace `sk-test-openai-key` with your real key
3. Test the connection

#### ElevenLabs API Key
1. Get your key from [ElevenLabs](https://elevenlabs.io/)
2. Replace `test-elevenlabs-key` with your real key
3. Test the connection

#### Azure Speech API Key
1. Get your key from [Azure Speech Services](https://azure.microsoft.com/en-us/services/cognitive-services/speech-services/)
2. Replace `test-azure-key` with your real key
3. Test the connection

### **Environment Variables**
For production, set these environment variables:

```bash
# .env file
REACT_APP_OPENAI_KEY=your-real-openai-key
REACT_APP_ELEVENLABS_KEY=your-real-elevenlabs-key
REACT_APP_DEEPGRAM_KEY=fc3ae1a1762b2eb96ff9b59813d49f8881030dd2
REACT_APP_AZURE_SPEECH_KEY=your-real-azure-key
```

## Features Added

### **Enhanced Error Handling**
- Specific error messages for different HTTP status codes
- Clear user feedback for configuration issues
- Automatic API settings validation

### **API Settings Validation**
- Checks if required keys are configured
- Warns about missing or invalid keys
- Provides guidance for setup issues

### **Default Configuration**
- One-click setup for all API keys
- Automatic speech provider selection
- Pre-configured for Deepgram integration

## Best Practices

### **Security**
1. **Never share API keys** publicly
2. **Use environment variables** in production
3. **Rotate keys regularly** for security
4. **Monitor API usage** to control costs

### **Testing**
1. **Test all API connections** before enabling features
2. **Verify voice recognition** works with your setup
3. **Check audio playback** functions correctly
4. **Test with different voices** and accents

### **Performance**
1. **Use appropriate models** for your use case
2. **Monitor transcription accuracy** and adjust settings
3. **Keep API keys updated** and valid
4. **Test regularly** to ensure everything works

## Support

### **Getting Help**
1. **Check the console** for error messages
2. **Test API connections** using the Test buttons
3. **Verify settings** in DAIVE Settings
4. **Contact support** if issues persist

### **Useful Commands**
```bash
# Test Deepgram integration
node test-deepgram-integration.js

# Test default API keys
node test-default-api-keys.js

# Test voice endpoint
node test-voice-simple.js
```

## Conclusion

The default API keys feature makes it easy to get started with D.A.I.V.E. voice recognition. Your Deepgram API key is already working, and the system will automatically use it for speech-to-text processing.

**Next Steps**:
1. ✅ Click **"Set Default Keys"** in DAIVE Settings
2. ✅ Test voice recognition in AIBotPage
3. ✅ Replace test keys with real keys as needed
4. ✅ Enjoy seamless voice interaction with D.A.I.V.E.! 