# Voice Recognition Setup Guide

## Overview

Voice Recognition in D.A.I.V.E. allows customers to interact with the AI assistant using voice commands. This guide explains how to configure and enable voice features.

## Prerequisites

Before setting up voice recognition, you need:

1. **Dealer Account**: Must be logged in as a dealer
2. **API Keys**: OpenAI and ElevenLabs API keys
3. **Vehicle Inventory**: At least one vehicle in your inventory
4. **Browser Permissions**: Microphone access enabled

## Step-by-Step Setup

### Step 1: Configure API Keys

1. **Log in as dealer1@example.com**
2. **Navigate to DAIVE Settings**
3. **Go to "API Keys" tab**
4. **Configure the following keys:**

#### OpenAI API Key (Required for Speech-to-Text)
- Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- Enter the key in the "OpenAI API Key" field
- Click "Test" to verify the connection
- Click "Save" to store the key

#### ElevenLabs API Key (Required for Text-to-Speech)
- Get your API key from [ElevenLabs](https://elevenlabs.io/)
- Enter the key in the "ElevenLabs API Key" field
- Click "Test" to verify the connection
- Click "Save" to store the key

### Step 2: Enable Voice Settings

1. **Go to "Voice Settings" tab**
2. **Enable "Voice Responses"** (toggle ON)
3. **Configure voice options:**
   - **Voice Provider**: Choose "ElevenLabs" (recommended)
   - **Language**: Select "English (US)"
   - **Voice Speed**: Set to 1.0x (normal speed)
   - **Voice Pitch**: Set to 1.0x (normal pitch)
4. **Click "Save Voice Settings"**

### Step 3: Test Voice Configuration

1. **Go to Vehicles page**
2. **Select a vehicle** that belongs to your dealer account
3. **Open the vehicle detail page**
4. **Click "Chat with D.A.I.V.E. AI Assistant"**
5. **Enable voice** (blue dot in chat header)
6. **Click microphone button** (🎤)
7. **Speak clearly**: "Tell me about this vehicle"
8. **Listen for voice response**

## Voice Settings Explained

### Voice Provider Options

#### ElevenLabs (Recommended)
- **Pros**: High-quality voices, easy setup, good pricing
- **Cons**: Limited free tier
- **Best for**: Most dealerships

#### Azure Speech Services
- **Pros**: Enterprise-grade, extensive language support
- **Cons**: More complex setup, higher cost
- **Best for**: Large enterprise deployments

#### Google Cloud Speech
- **Pros**: Excellent accuracy, good integration
- **Cons**: Requires Google Cloud account
- **Best for**: Google ecosystem users

### Voice Customization

#### Language Settings
- **en-US**: English (United States) - Default
- **en-GB**: English (United Kingdom)
- **es-ES**: Spanish
- **fr-FR**: French
- **de-DE**: German

#### Speed and Pitch
- **Speed Range**: 0.5x to 2.0x
- **Pitch Range**: 0.5x to 2.0x
- **Recommended**: 1.0x for both (natural sound)

## Troubleshooting

### Common Issues

#### "Voice recognition is not configured"
**Solution:**
1. Check that OpenAI API key is configured
2. Verify the key is valid and has credits
3. Test the API connection in settings
4. Make sure voice is enabled in Voice Settings

#### "Microphone not working"
**Solution:**
1. Allow microphone permissions in browser
2. Check if microphone is being used by other apps
3. Try refreshing the page
4. Test in a different browser

#### "No voice response"
**Solution:**
1. Check ElevenLabs API key is configured
2. Enable voice responses in Voice Settings
3. Check browser audio settings
4. Verify API key has sufficient credits

#### "Poor transcription quality"
**Solution:**
1. Speak clearly and slowly
2. Reduce background noise
3. Use a good quality microphone
4. Check OpenAI API key is valid

### Testing Your Setup

Run these tests to verify your configuration:

```bash
# Test API keys
node test-api-settings.js

# Test voice recognition
node test-voice-recognition.js

# Test voice endpoint
node test-voice-simple.js
```

## Database Configuration

Voice settings are stored in the `daive_api_settings` table:

```sql
-- Check voice settings for a dealer
SELECT setting_type, setting_value 
FROM daive_api_settings 
WHERE dealer_id = 'your-dealer-id' 
AND setting_type LIKE 'voice_%';

-- Check API keys
SELECT setting_type, setting_value 
FROM daive_api_settings 
WHERE dealer_id = 'your-dealer-id' 
AND setting_type IN ('openai_key', 'elevenlabs_key');
```

## API Endpoints

### Voice Settings
```http
GET /api/daive/voice-settings
POST /api/daive/voice-settings
```

### Voice Processing
```http
POST /api/daive/voice
Content-Type: multipart/form-data
```

### API Settings
```http
GET /api/daive/api-settings
POST /api/daive/api-settings
```

## Best Practices

### Security
1. **Never share API keys** publicly
2. **Rotate keys regularly** for security
3. **Use environment variables** in production
4. **Monitor API usage** to control costs

### Performance
1. **Test API connections** before enabling features
2. **Use appropriate voice settings** for your use case
3. **Monitor transcription accuracy** and adjust settings
4. **Keep API keys updated** and valid

### User Experience
1. **Provide clear instructions** for voice usage
2. **Test with different accents** and speaking speeds
3. **Offer text fallback** for voice failures
4. **Monitor customer feedback** on voice quality

## Advanced Configuration

### Custom Voice Prompts
You can customize voice prompts in the AI Prompts tab:

1. **Greeting**: How D.A.I.V.E. introduces itself
2. **Vehicle Info**: How to describe vehicle features
3. **Financing**: How to discuss financing options
4. **Test Drive**: How to handle test drive requests
5. **Handoff**: When to transfer to human agent

### Integration Settings
Configure webhooks and CRM integration:

1. **Webhook URLs**: Send conversation data to external systems
2. **CRM Integration**: Connect with your CRM system
3. **Analytics Export**: Export conversation analytics
4. **Lead Management**: Configure lead scoring and handoff

## Support

If you encounter issues:

1. **Check the troubleshooting guide** in VOICE_TROUBLESHOOTING.md
2. **Run diagnostic tests** using the provided test scripts
3. **Check server logs** for error messages
4. **Verify API key status** and credits
5. **Test in different browsers** to isolate issues

## Quick Reference

### Required Settings
- ✅ OpenAI API Key (Speech-to-Text)
- ✅ ElevenLabs API Key (Text-to-Speech)
- ✅ Voice Enabled = true
- ✅ Voice Provider = elevenlabs
- ✅ Language = en-US

### Test Commands
- "Tell me about this vehicle"
- "What are the features?"
- "How much does it cost?"
- "Can I schedule a test drive?"

### Expected Behavior
1. **Click microphone** → Recording starts
2. **Speak clearly** → Voice is captured
3. **Stop recording** → Transcription appears
4. **AI responds** → Text and voice response
5. **Audio plays** → Voice response is heard 