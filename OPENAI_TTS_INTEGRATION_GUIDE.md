# OpenAI TTS Integration Guide

This guide covers the integration of OpenAI Text-to-Speech (TTS) functionality in the D.A.I.V.E. system using the tts-1-hd model.

## Overview

OpenAI TTS provides high-quality speech synthesis with the tts-1-hd model, offering excellent voice quality and natural-sounding speech. This integration adds OpenAI TTS as an alternative to ElevenLabs and Deepgram for text-to-speech functionality.

## Key Features

### Available Model
- **tts-1-hd**: High-definition text-to-speech model for superior audio quality

### Available Voices
- **Alloy**: Neutral, balanced voice (default)
- **Echo**: Warm, friendly voice
- **Fable**: Clear, professional voice
- **Onyx**: Deep, authoritative voice
- **Nova**: Bright, energetic voice
- **Shimmer**: Soft, gentle voice

### Supported Features
- **Speed Control**: Adjustable from 0.25x to 4.0x
- **Response Format**: MP3 output
- **High Quality**: HD audio output
- **Multiple Voices**: 6 different voice options

## Setup

### 1. Environment Variables

Add your OpenAI API key to your `.env` file:

```bash
OPENAI_API_KEY=your-openai-api-key
```

### 2. API Key Configuration

1. Go to the **DAIVE Settings** page
2. Navigate to the **API Keys** tab
3. Enter your OpenAI API key in the **OpenAI API Key** field
4. Click **Test** to verify the connection
5. Click **Test TTS** to verify TTS functionality
6. Click **Save API Keys** to store the key

### 3. Voice Provider Configuration

You can configure OpenAI TTS in two ways:

#### Option A: Voice Provider (Recommended)
1. Go to the **Voice Settings** tab
2. Select **OpenAI TTS (tts-1-hd)** from the **Voice Provider** dropdown
3. Choose your preferred voice from the **OpenAI Voice** dropdown
4. Click **Save Voice Settings**

#### Option B: TTS Provider
1. Go to the **Voice Settings** tab
2. Select **OpenAI TTS (tts-1-hd)** from the **Text-to-Speech Provider** dropdown
3. Choose your preferred voice from the **OpenAI Voice** dropdown
4. Click **Save Voice Settings**

**Note**: The system prioritizes the TTS Provider setting over the Voice Provider setting. If both are configured, the TTS Provider setting will be used.

## Usage

### Basic TTS Synthesis

```javascript
const response = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'tts-1-hd',
    input: text,
    voice: 'alloy',
    response_format: 'mp3',
    speed: 1.0
  })
});
```

### Advanced TTS with Options

```javascript
const ttsOptions = {
  model: 'tts-1-hd',
  input: text,
  voice: 'nova', // Choose from: alloy, echo, fable, onyx, nova, shimmer
  response_format: 'mp3',
  speed: 1.2 // Range: 0.25 to 4.0
};
```

## API Endpoints

### Voice Processing
- **POST** `/api/daive/voice` - Process voice input with STT and TTS

### API Settings Management
- **POST** `/api/daive/api-settings` - Save API keys
- **GET** `/api/daive/api-settings` - Retrieve API settings
- **POST** `/api/daive/test-api` - Test API connections

### Voice Settings Management
- **POST** `/api/daive/voice-settings` - Save voice preferences
- **GET** `/api/daive/voice-settings` - Retrieve voice settings

## Database Schema

Settings are stored in the `daive_api_settings` table:

```sql
CREATE TABLE daive_api_settings (
  id SERIAL PRIMARY KEY,
  dealer_id INTEGER NOT NULL,
  setting_type VARCHAR(50) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Setting Types

| Setting Type | Description | Example Value |
|--------------|-------------|---------------|
| `openai_key` | OpenAI API key | `sk-...` |
| `voice_tts_provider` | Text-to-speech provider | `openai` |
| `voice_openai_voice` | OpenAI voice selection | `alloy`, `echo`, `fable`, etc. |

## Testing

### Test OpenAI TTS Integration

```bash
node test-openai-tts.js
```

### Test Voice Endpoint with OpenAI TTS

```bash
node test-voice-tts-providers.js
```

### Test with Environment Variable

```bash
$env:OPENAI_API_KEY="your-key"; node test-openai-tts.js
```

## OpenAI vs Other TTS Providers Comparison

| Feature | OpenAI TTS | ElevenLabs | Deepgram TTS |
|---------|------------|------------|--------------|
| **Voice Quality** | HD quality (tts-1-hd) | High-quality cloned voices | High-quality neural voices |
| **Voice Options** | 6 voices | 100+ voices | 3+ voices |
| **Speed Control** | 0.25x to 4.0x | Limited | Limited |
| **Customization** | Basic | Extensive | Limited |
| **Pricing** | Pay-per-character | Pay-per-character | Pay-per-character |
| **API Speed** | Fast | Fast | Fast |
| **Integration** | Simple | Simple | Simple |

## Configuration Options

### Default Settings

```javascript
{
  model: 'tts-1-hd',
  voice: 'alloy',
  response_format: 'mp3',
  speed: 1.0
}
```

### Voice Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Model** | `tts-1-hd` | High-definition TTS model |
| **Voice** | `alloy` | Voice selection |
| **Response Format** | `mp3` | Audio format |
| **Speed** | `1.0` | Speech speed (0.25-4.0) |

## Voice Characteristics

| Voice | Characteristics | Best For |
|-------|----------------|----------|
| **Alloy** | Neutral, balanced | General use, professional content |
| **Echo** | Warm, friendly | Customer service, casual conversations |
| **Fable** | Clear, professional | Business presentations, formal content |
| **Onyx** | Deep, authoritative | News, announcements, serious content |
| **Nova** | Bright, energetic | Marketing, promotional content |
| **Shimmer** | Soft, gentle | Relaxing content, meditation |

## Troubleshooting

### Common Issues

1. **401 Unauthorized Error**
   - Check if your API key is valid
   - Verify the key has TTS permissions

2. **400 Bad Request**
   - Ensure text is not empty
   - Check text length limits (4096 characters max)
   - Verify voice name is correct

3. **429 Rate Limit Error**
   - Respect API rate limits
   - Implement exponential backoff

4. **Connection Timeout**
   - Verify internet connection
   - Check OpenAI service status

### Debug Steps

1. Test TTS connection:
   ```bash
   node test-openai-tts.js
   ```

2. Check API settings in database:
   ```sql
   SELECT * FROM daive_api_settings WHERE setting_type = 'openai_key';
   SELECT * FROM daive_api_settings WHERE setting_type = 'voice_tts_provider';
   SELECT * FROM daive_api_settings WHERE setting_type = 'voice_openai_voice';
   ```

3. Verify environment variable:
   ```bash
   echo $OPENAI_API_KEY
   ```

## Cost Information

| Service | Price per 1K Characters |
|---------|------------------------|
| OpenAI TTS (tts-1-hd) | $0.030 |
| ElevenLabs | $0.024 |
| Deepgram TTS | $0.016 |

## Best Practices

1. **Voice Selection**: Choose appropriate voice for your content type
2. **Speed Control**: Use 1.0x for normal speech, adjust for emphasis
3. **Text Processing**: Clean and format text before synthesis
4. **Error Handling**: Implement proper error handling for production use
5. **Rate Limiting**: Respect API rate limits and implement backoff
6. **Caching**: Cache frequently used audio responses

## Support

For OpenAI-specific issues:
- [OpenAI TTS Documentation](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/audio)
- [OpenAI Support](https://help.openai.com/)

For D.A.I.V.E. integration issues:
- Check the application logs for detailed error messages
- Verify API key configuration in the database
- Test individual components using the provided test scripts

## Migration from Other TTS Providers

### From ElevenLabs to OpenAI TTS

1. **Update Voice Settings**:
   - Change TTS provider to "OpenAI TTS (tts-1-hd)"
   - Select appropriate OpenAI voice
   - Save settings

2. **Test Integration**:
   - Use the test scripts to verify functionality
   - Check voice quality and performance

3. **Monitor Usage**:
   - Track API usage and costs
   - Adjust settings as needed

### From Deepgram TTS to OpenAI TTS

1. **Update Configuration**:
   - Change TTS provider in voice settings
   - Configure OpenAI voice selection
   - Test voice quality

2. **Verify Functionality**:
   - Test voice processing endpoint
   - Check audio file generation
   - Monitor performance

## Future Enhancements

Potential improvements for the OpenAI TTS integration:

1. **Voice Cloning**: Support for custom voice training
2. **Emotion Control**: Add emotion parameters to voice synthesis
3. **Batch Processing**: Support for processing multiple text inputs
4. **Audio Post-processing**: Add effects and enhancements
5. **Real-time Streaming**: Support for streaming audio responses
6. **Multi-language Support**: Enhanced language detection and support 