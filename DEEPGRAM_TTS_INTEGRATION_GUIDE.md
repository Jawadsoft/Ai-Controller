# Deepgram TTS Integration Guide

This guide covers the integration of Deepgram Text-to-Speech (TTS) functionality in the D.A.I.V.E. system as an alternative to ElevenLabs.

## Overview

Deepgram TTS provides high-quality speech synthesis with multiple voices and models, offering an alternative to ElevenLabs for text-to-speech functionality.

## Key Features

### Available Models
- **Aura-Asteria**: High-quality neural voice model
- **Aura-Luna**: Alternative voice model
- **Aura-Stella**: Additional voice option

### Available Voices
- **Asteria**: Default voice (recommended)
- **Luna**: Alternative voice
- **Stella**: Additional voice option

### Supported Formats
- **MP3**: Default output format
- **WAV**: Alternative format
- **Sample Rates**: 24000 Hz (default), 16000 Hz, 8000 Hz

## Setup

### 1. Environment Variables

Add your Deepgram API key to your `.env` file:

```bash
DEEPGRAM_API_KEY=your-deepgram-api-key
```

### 2. API Key Configuration

1. Go to the **DAIVE Settings** page
2. Navigate to the **API Keys** tab
3. Enter your Deepgram API key in the **Deepgram API Key** field
4. Click **Test** to verify the connection
5. Click **Save API Keys** to store the key

### 3. TTS Provider Configuration

1. Go to the **Voice Settings** tab
2. Select **Deepgram** from the **Text-to-Speech Provider** dropdown
3. Click **Save Voice Settings**

## Usage

### Basic TTS Synthesis

```javascript
import DeepgramTTSService from './src/lib/deepgram-tts.js';

const deepgramTTS = new DeepgramTTSService(apiKey);
const result = await deepgramTTS.synthesizeSpeech(text, options);
```

### Advanced TTS with Options

```javascript
const result = await deepgramTTS.synthesizeSpeech(text, {
  model: 'aura-asteria',
  voice: 'asteria',
  encoding: 'mp3',
  container: 'mp3',
  sample_rate: 24000
});
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
| `deepgram_key` | Deepgram API key | `fc3ae1a1762b2eb96ff9b59813d49f8881030dd2` |
| `tts_provider` | Text-to-speech provider | `deepgram` or `elevenlabs` |
| `speech_provider` | Speech-to-text provider | `deepgram` or `whisper` |

## Testing

### Test Deepgram TTS Integration

```bash
node test-deepgram-tts.js
```

### Test Voice Endpoint with TTS Providers

```bash
node test-voice-tts-providers.js
```

### Set TTS Provider in Database

```bash
node set-tts-provider.js
```

### Test with Environment Variable

```bash
$env:DEEPGRAM_API_KEY="your-key"; node test-deepgram-tts.js
```

## Deepgram vs ElevenLabs Comparison

| Feature | Deepgram TTS | ElevenLabs |
|---------|--------------|------------|
| **Voice Quality** | High-quality neural voices | High-quality cloned voices |
| **Voice Options** | 3+ voices | 100+ voices |
| **Customization** | Limited | Extensive (stability, similarity) |
| **Pricing** | Pay-per-character | Pay-per-character |
| **API Speed** | Fast | Fast |
| **Integration** | Simple | Simple |

## Configuration Options

### Default Settings

```javascript
{
  model: 'aura-asteria',
  voice: 'asteria',
  encoding: 'mp3',
  container: 'mp3',
  sample_rate: 24000
}
```

### Voice Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Model** | `aura-asteria` | Neural voice model |
| **Voice** | `asteria` | Voice selection |
| **Encoding** | `mp3` | Audio format |
| **Sample Rate** | `24000` | Audio quality |

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**
   - Check if your API key is valid
   - Verify the key has TTS permissions

2. **400 Bad Request**
   - Ensure text is not empty
   - Check text length limits

3. **Connection Timeout**
   - Verify internet connection
   - Check Deepgram service status

### Debug Steps

1. Test TTS connection:
   ```bash
   node test-deepgram-tts.js
   ```

2. Check API settings in database:
   ```sql
   SELECT * FROM daive_api_settings WHERE setting_type = 'deepgram_key';
   SELECT * FROM daive_api_settings WHERE setting_type = 'tts_provider';
   ```

3. Verify environment variable:
   ```bash
   echo $DEEPGRAM_API_KEY
   ```

## Cost Comparison

| Service | Price per Character |
|---------|-------------------|
| Deepgram TTS | $0.000016 |
| ElevenLabs | $0.000024 |

## Best Practices

1. **Model Selection**: Use `aura-asteria` for best quality
2. **Voice Selection**: Use `asteria` for consistent results
3. **Text Processing**: Clean and format text before synthesis
4. **Error Handling**: Implement proper error handling for production use
5. **Rate Limiting**: Respect API rate limits

## Support

For Deepgram-specific issues:
- [Deepgram TTS Documentation](https://developers.deepgram.com/docs/text-to-speech)
- [Deepgram API Reference](https://developers.deepgram.com/api-reference/text-to-speech)
- [Deepgram Support](https://support.deepgram.com/)

For D.A.I.V.E. integration issues:
- Check the application logs
- Verify database settings
- Test with the provided test scripts

## Migration from ElevenLabs

To switch from ElevenLabs to Deepgram TTS:

1. **Update API Settings**:
   - Add Deepgram API key
   - Set `tts_provider` to `'deepgram'`

2. **Test Integration**:
   - Run `test-deepgram-tts.js`
   - Verify voice quality and performance

3. **Update Frontend**:
   - Select Deepgram in Voice Settings
   - Save settings

4. **Monitor Usage**:
   - Check API usage and costs
   - Monitor voice quality feedback 