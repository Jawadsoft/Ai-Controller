# Whisper API Voice Input Implementation Guide

## Overview

The D.A.I.V.E. system now uses **OpenAI's Whisper API** for high-quality voice-to-text conversion. This implementation provides better accuracy, multi-language support, and improved reliability compared to other speech recognition solutions.

## What Changed

### ✅ **New WhisperService Class**
- **Location**: `src/lib/whisper.js`
- **Purpose**: Dedicated service for OpenAI Whisper API integration
- **Features**: 
  - Multi-language support
  - Configurable transcription options
  - Better error handling
  - Language detection

### ✅ **Updated Voice Endpoint**
- **Location**: `src/routes/daive.js`
- **Improvements**:
  - Uses WhisperService instead of manual FormData
  - Automatic language detection from dealer settings
  - Better error handling and logging
  - More reliable API calls

## Technical Implementation

### WhisperService Features

#### Basic Transcription
```javascript
const whisperService = new WhisperService(openaiKey);
const result = await whisperService.transcribeAudio(audioFilePath);
```

#### Advanced Transcription with Options
```javascript
const result = await whisperService.transcribeAudioWithOptions(audioFilePath, {
  language: 'en',           // Language code
  model: 'whisper-1',       // Whisper model
  temperature: 0.0          // Deterministic results
});
```

### Supported Languages

The Whisper API supports **99+ languages** including:

- **English** (en, en-US, en-GB)
- **Spanish** (es, es-ES)
- **French** (fr, fr-FR)
- **German** (de, de-DE)
- **Italian** (it, it-IT)
- **Portuguese** (pt, pt-BR)
- **Chinese** (zh, zh-CN)
- **Japanese** (ja)
- **Korean** (ko)
- **And many more...**

### Configuration Options

#### Language Settings
```javascript
// In DAIVE Settings → Voice Settings
{
  language: 'en-US',        // English (US)
  language: 'es-ES',        // Spanish
  language: 'fr-FR',        // French
  language: 'de-DE'         // German
}
```

#### Model Options
- **whisper-1**: Standard model (recommended)
- **whisper-large-v3**: Higher accuracy (premium)

#### Temperature Settings
- **0.0**: Most deterministic (recommended for voice commands)
- **0.1-0.5**: Balanced accuracy and creativity
- **0.6-1.0**: More creative but less accurate

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

## Setup Instructions

### 1. Configure OpenAI API Key

1. **Get API Key**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Add to DAIVE Settings**: Go to API Keys tab
3. **Test Connection**: Use the "Test" button
4. **Save Settings**: Click "Save" to store the key

### 2. Enable Voice Features

1. **Go to Voice Settings**: DAIVE Settings → Voice Settings
2. **Enable Voice**: Toggle "Voice Responses" ON
3. **Select Language**: Choose your preferred language
4. **Save Settings**: Click "Save Voice Settings"

### 3. Test Voice Input

1. **Open Vehicle Detail**: Go to any vehicle page
2. **Start Chat**: Click "Chat with D.A.I.V.E."
3. **Enable Voice**: Make sure voice is enabled (blue dot)
4. **Test Recording**: Click microphone and speak clearly

## Testing

### Test Scripts

#### Test Whisper API
```bash
node test-whisper-api.js
```

#### Test Voice Endpoint
```bash
node test-voice-simple.js
```

#### Test Voice Recognition
```bash
node test-voice-recognition.js
```

### Manual Testing

1. **Create Test Audio**: Record a clear voice message
2. **Upload via Chat**: Use the microphone button in chat
3. **Verify Transcription**: Check if text appears correctly
4. **Test Response**: Ensure AI responds appropriately

## Troubleshooting

### Common Issues

#### "Whisper API error: 401"
**Solution**:
- Check OpenAI API key is valid
- Verify API key has sufficient credits
- Test API connection in settings

#### "Sorry, I couldn't understand your voice"
**Solution**:
- Speak clearly and slowly
- Reduce background noise
- Check microphone permissions
- Try different language settings

#### "Voice recognition is not configured"
**Solution**:
- Ensure OpenAI API key is configured
- Check voice is enabled in settings
- Verify dealer has proper settings

### Debug Information

#### Check API Status
```bash
# Test API connection
curl -X POST https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@test.wav" \
  -F "model=whisper-1"
```

#### Check Voice Settings
```sql
-- Query voice settings
SELECT setting_type, setting_value 
FROM daive_api_settings 
WHERE dealer_id = 'your-dealer-id' 
AND setting_type LIKE 'voice_%';
```

## Performance Optimization

### Best Practices

1. **Audio Quality**:
   - Use 16kHz sample rate
   - WAV format preferred
   - Clear audio without background noise

2. **Language Settings**:
   - Set correct language for better accuracy
   - Use language codes (en, es, fr, etc.)

3. **API Usage**:
   - Monitor API usage to control costs
   - Use appropriate model for your needs
   - Implement rate limiting if needed

### Error Handling

The WhisperService includes comprehensive error handling:

```javascript
// Error response format
{
  success: false,
  error: "Error description",
  details: "Detailed error information"
}
```

## Migration from Previous Implementation

### What's New
- ✅ **Better Accuracy**: Whisper API provides superior transcription
- ✅ **Multi-language**: Support for 99+ languages
- ✅ **Language Detection**: Automatic language identification
- ✅ **Error Handling**: Improved error messages and debugging
- ✅ **Configuration**: More flexible settings

### Backward Compatibility
- ✅ **Same API Endpoints**: No changes to frontend code
- ✅ **Same Response Format**: Compatible with existing clients
- ✅ **Same Settings**: Uses existing voice settings

## Cost Considerations

### OpenAI Whisper API Pricing
- **Input**: $0.006 per minute
- **Output**: Free (text only)
- **Model**: whisper-1 (standard)

### Cost Optimization
1. **Monitor Usage**: Track API calls and costs
2. **Set Limits**: Implement usage limits if needed
3. **Choose Model**: Use appropriate model for your needs
4. **Batch Processing**: Consider batching for efficiency

## Security

### API Key Security
- ✅ **Encrypted Storage**: Keys stored securely in database
- ✅ **Access Control**: Only authenticated dealers can access
- ✅ **HTTPS Only**: All API calls use secure connections
- ✅ **No Logging**: API keys are not logged

### Data Privacy
- ✅ **No Storage**: Audio files are processed and deleted
- ✅ **Temporary Files**: Files stored temporarily only
- ✅ **Secure Transmission**: All data transmitted over HTTPS

## Support

### Getting Help
1. **Check Logs**: Review server logs for errors
2. **Test API**: Use test scripts to verify functionality
3. **Verify Settings**: Ensure all settings are correct
4. **Contact Support**: Report issues with detailed information

### Documentation
- **Whisper API**: [OpenAI Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- **Voice Settings**: See VOICE_RECOGNITION_SETUP_GUIDE.md
- **Troubleshooting**: See VOICE_TROUBLESHOOTING.md

## Quick Reference

### Required Settings
- ✅ OpenAI API Key (Whisper API)
- ✅ Voice Enabled = true
- ✅ Language = en-US (or preferred)
- ✅ Voice Provider = elevenlabs (for output)

### Test Commands
- "Tell me about this vehicle"
- "What are the features?"
- "How much does it cost?"
- "Can I schedule a test drive?"

### Expected Behavior
1. **Click microphone** → Recording starts
2. **Speak clearly** → Voice captured
3. **Whisper processes** → High-quality transcription
4. **AI responds** → Text and voice response
5. **Audio plays** → Voice response heard 