# Deepgram Integration Guide

## Overview

The D.A.I.V.E. system now supports **Deepgram** as an alternative speech-to-text provider alongside OpenAI Whisper. Deepgram offers high-quality transcription with excellent accuracy and competitive pricing.

## What's New

### ✅ **DeepgramService Class**
- **Location**: `src/lib/deepgram.js`
- **Purpose**: Dedicated service for Deepgram API integration
- **Features**: 
  - High-accuracy transcription using Nova-2 model
  - Multi-language support
  - Configurable transcription options
  - Better error handling
  - Language detection

### ✅ **Updated Voice Processing**
- **Location**: `src/routes/daive.js`
- **Improvements**:
  - Supports both Whisper and Deepgram
  - Automatic provider selection based on settings
  - Fallback to environment variables
  - Better error handling and logging

### ✅ **Enhanced Settings UI**
- **Location**: `src/components/daive/DAIVESettings.tsx`
- **New Features**:
  - Deepgram API key management
  - Speech-to-text provider selection
  - API connection testing
  - Secure key storage

## Setup Instructions

### 1. Get Deepgram API Key

1. **Visit Deepgram**: Go to [Deepgram Console](https://console.deepgram.com/)
2. **Create Account**: Sign up for a free account
3. **Get API Key**: Navigate to API Keys section
4. **Copy Key**: Copy your API key (starts with `dg_`)

### 2. Configure in DAIVE Settings

1. **Log in as dealer**: Use your dealer account
2. **Go to DAIVE Settings**: Navigate to Settings page
3. **API Keys Tab**: Click on "API Keys" tab
4. **Add Deepgram Key**: 
   - Enter your Deepgram API key
   - Click "Test" to verify connection
   - Click "Save API Keys"
5. **Voice Settings Tab**: Click on "Voice Settings" tab
6. **Select Provider**: Choose "Deepgram" as Speech-to-Text Provider
7. **Save Settings**: Click "Save Voice Settings"

### 3. Test the Integration

1. **Run Test Script**: 
   ```bash
   node test-deepgram-integration.js
   ```
2. **Test in Browser**: 
   - Go to any vehicle page
   - Start D.A.I.V.E. chat
   - Enable voice and test recording

## Technical Implementation

### DeepgramService Features

#### Basic Transcription
```javascript
const deepgramService = new DeepgramService(apiKey);
const result = await deepgramService.transcribeAudio(audioFilePath);
```

#### Advanced Transcription with Options
```javascript
const result = await deepgramService.transcribeAudioWithOptions(audioFilePath, {
  language: 'en',           // Language code
  model: 'nova-2',          // Deepgram model
  diarize: false            // Speaker diarization
});
```

#### API Connection Test
```javascript
const testResult = await deepgramService.testConnection();
```

### Supported Models

#### Nova-2 (Recommended)
- **Pros**: Highest accuracy, best for production
- **Cons**: Higher cost
- **Best for**: Most use cases

#### Nova
- **Pros**: Good accuracy, reasonable cost
- **Cons**: Slightly lower accuracy than Nova-2
- **Best for**: Cost-conscious deployments

#### Enhanced
- **Pros**: Good accuracy, lower cost
- **Cons**: Lower accuracy than Nova models
- **Best for**: Budget deployments

### Configuration Options

#### Language Settings
```javascript
// In DAIVE Settings → Voice Settings
{
  language: 'en',           // English
  language: 'es',           // Spanish
  language: 'fr',           // French
  language: 'de',           // German
  language: 'auto'          // Auto-detect
}
```

#### Model Options
- **nova-2**: Highest accuracy (recommended)
- **nova**: Good accuracy
- **enhanced**: Budget option

#### Advanced Options
- **smart_format**: Automatic formatting
- **punctuate**: Add punctuation
- **diarize**: Speaker identification
- **utterances**: Segment into utterances

## API Endpoints

### Voice Processing
```http
POST /api/daive/voice
Content-Type: multipart/form-data

Parameters:
- audio: Audio file (WAV, MP3, M4A, etc.)
- vehicleId: Vehicle identifier
- sessionId: Session identifier
- customerInfo: Customer information (JSON)
```

### Response Format
```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "response": "AI response text",
    "transcription": "Transcribed voice input",
    "leadScore": 50,
    "shouldHandoff": false,
    "audioResponseUrl": "/uploads/daive-audio/response.mp3"
  }
}
```

## Database Schema

### New Settings
```sql
-- Speech provider setting
INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
VALUES ('dealer-id', 'speech_provider', 'deepgram');

-- Deepgram API key
INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
VALUES ('dealer-id', 'deepgram_key', 'dg_your-api-key');
```

## Testing

### Test Scripts

#### Test Deepgram Integration
```bash
node test-deepgram-integration.js
```

#### Test Voice Endpoint with Deepgram
```bash
node test-voice-simple.js
```

### Manual Testing

1. **Configure API Key**: Add Deepgram API key in settings
2. **Select Provider**: Choose Deepgram as speech provider
3. **Test Recording**: Use voice input in browser
4. **Verify Transcription**: Check accuracy and speed

## Troubleshooting

### Common Issues

#### "Deepgram API connection failed"
**Solution**:
1. Verify API key is correct and complete
2. Check if the key is active and has credits
3. Test the connection using the built-in tester
4. Ensure you have internet connectivity

#### "No transcription returned"
**Solution**:
1. Check audio file format (WAV recommended)
2. Ensure audio quality is good
3. Speak clearly and reduce background noise
4. Verify API key has sufficient credits

#### "Provider not found"
**Solution**:
1. Make sure speech provider is set to 'deepgram'
2. Check that Deepgram API key is configured
3. Restart the application if needed

### Error Messages

#### API Key Errors
- `401 Unauthorized`: Invalid API key
- `403 Forbidden`: Insufficient permissions
- `429 Too Many Requests`: Rate limit exceeded

#### Audio Processing Errors
- `400 Bad Request`: Invalid audio format
- `413 Payload Too Large`: Audio file too large
- `500 Internal Server Error`: Server processing error

## Cost Comparison

### Deepgram Pricing
- **Nova-2**: $0.0049 per minute
- **Nova**: $0.0039 per minute
- **Enhanced**: $0.0029 per minute

### Whisper Pricing
- **Whisper-1**: $0.006 per minute

### Recommendation
- **Deepgram Nova-2**: Best accuracy, competitive pricing
- **Deepgram Nova**: Good balance of accuracy and cost
- **Whisper**: Good accuracy, slightly higher cost

## Best Practices

### Security
1. **Never share API keys** publicly
2. **Rotate keys regularly** for security
3. **Use environment variables** in production
4. **Monitor API usage** to control costs

### Performance
1. **Test API connections** before enabling features
2. **Use appropriate models** for your use case
3. **Monitor transcription accuracy** and adjust settings
4. **Keep API keys updated** and valid

### User Experience
1. **Provide clear instructions** for voice usage
2. **Test with different accents** and speaking speeds
3. **Offer text fallback** for voice failures
4. **Monitor customer feedback** on voice quality

## Migration from Whisper

### Step-by-Step Migration

1. **Get Deepgram API Key**: Sign up at Deepgram Console
2. **Configure in Settings**: Add API key and test connection
3. **Switch Provider**: Change speech provider to Deepgram
4. **Test Thoroughly**: Verify all voice features work
5. **Monitor Performance**: Check accuracy and response times
6. **Update Documentation**: Inform team of new provider

### Rollback Plan

If issues arise with Deepgram:

1. **Switch Back**: Change speech provider to 'whisper'
2. **Verify Whisper**: Ensure OpenAI key is still valid
3. **Test Functionality**: Confirm voice features work
4. **Investigate Issues**: Debug Deepgram problems
5. **Re-enable**: Switch back once issues resolved

## Support

### Deepgram Resources
- **Documentation**: [Deepgram Docs](https://developers.deepgram.com/)
- **API Reference**: [Deepgram API](https://developers.deepgram.com/reference)
- **Support**: [Deepgram Support](https://support.deepgram.com/)

### DAIVE Support
- **Issues**: Check existing documentation
- **Testing**: Use provided test scripts
- **Configuration**: Follow setup instructions

## Conclusion

Deepgram integration provides D.A.I.V.E. with a high-quality alternative to Whisper for speech-to-text processing. The implementation is seamless and allows easy switching between providers based on your needs and preferences.

The system now supports:
- ✅ **Multiple speech providers** (Whisper, Deepgram)
- ✅ **Easy provider switching** via settings
- ✅ **Comprehensive testing** tools
- ✅ **Secure API key management**
- ✅ **Fallback mechanisms** for reliability

Choose the provider that best fits your accuracy, cost, and performance requirements! 