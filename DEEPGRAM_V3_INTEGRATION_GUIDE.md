# Deepgram v3 Integration Guide

This guide covers the integration of Deepgram v3 for speech-to-text (STT) functionality in the D.A.I.V.E. system.

## Overview

Deepgram v3 provides enhanced speech recognition capabilities with improved accuracy, new models, and additional features compared to v2.

## Key v3 Features

### New Models
- **Nova-2**: Latest and most accurate model
- **Nova**: High accuracy model
- **Enhanced**: Enhanced accuracy model
- **Base**: Standard accuracy model

### New v3 Options
- **Filler Words**: Include filler words like "um", "uh", "you know"
- **Profanity Filter**: Filter out profanity from transcriptions
- **Redact**: Redact sensitive information
- **Search**: Search for specific terms in audio
- **Replace**: Replace specific terms in transcription

### Enhanced Response Format
- **Words**: Detailed word-level information
- **Sentences**: Sentence segmentation
- **Paragraphs**: Paragraph segmentation
- **Duration**: Audio duration information

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

### 3. Voice Settings Configuration

1. Go to the **Voice Settings** tab
2. Select **Deepgram** from the **Speech-to-Text Provider** dropdown
3. Click **Save Voice Settings**

## Usage

### Basic Transcription

```javascript
import DeepgramService from './src/lib/deepgram-v3.js';

const deepgramService = new DeepgramService(apiKey);
const result = await deepgramService.transcribeAudio(audioFilePath);
```

### Advanced Transcription with v3 Options

```javascript
const result = await deepgramService.transcribeAudioWithOptions(audioFilePath, {
  model: 'nova-2',
  language: 'en',
  smart_format: true,
  punctuate: true,
  filler_words: true,
  profanity_filter: false,
  redact: false,
  utterances: true
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
| `speech_provider` | Speech-to-text provider | `deepgram` or `whisper` |

## Testing

### Test Deepgram v3 Integration

```bash
node test-deepgram-v3-features.js
```

### Test Basic Integration

```bash
node test-deepgram-integration.js
```

### Test with Environment Variable

```bash
$env:DEEPGRAM_API_KEY="your-key"; node test-deepgram-v3-features.js
```

## v3 vs v2 Comparison

| Feature | v2 | v3 |
|---------|----|----|
| Default Model | `nova` | `nova-2` |
| Filler Words | ❌ | ✅ |
| Profanity Filter | ❌ | ✅ |
| Redact | ❌ | ✅ |
| Search/Replace | ❌ | ✅ |
| Enhanced Response | ❌ | ✅ |
| Usage API | ❌ | ✅ |
| Models API | ❌ | ✅ |

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**
   - Check if your API key is valid
   - Verify the key has the necessary permissions

2. **400 Bad Request**
   - Ensure audio file is in supported format (WAV, MP3, etc.)
   - Check file size (max 10MB)

3. **Connection Timeout**
   - Verify internet connection
   - Check Deepgram service status

### Debug Steps

1. Test API connection:
   ```bash
   node test-deepgram-v3-features.js
   ```

2. Check API settings in database:
   ```sql
   SELECT * FROM daive_api_settings WHERE setting_type = 'deepgram_key';
   ```

3. Verify environment variable:
   ```bash
   echo $DEEPGRAM_API_KEY
   ```

## Cost Comparison

| Model | Price per Hour |
|-------|----------------|
| Nova-2 | $0.006 |
| Nova | $0.004 |
| Enhanced | $0.002 |
| Base | $0.001 |

## Best Practices

1. **Model Selection**: Use `nova-2` for best accuracy, `base` for cost efficiency
2. **Language Detection**: Let Deepgram auto-detect language unless you're certain
3. **Smart Format**: Always enable for better readability
4. **Error Handling**: Implement proper error handling for production use
5. **Rate Limiting**: Respect API rate limits

## Support

For Deepgram-specific issues:
- [Deepgram Documentation](https://developers.deepgram.com/)
- [Deepgram API Reference](https://developers.deepgram.com/api-reference/)
- [Deepgram Support](https://support.deepgram.com/)

For D.A.I.V.E. integration issues:
- Check the application logs
- Verify database settings
- Test with the provided test scripts 