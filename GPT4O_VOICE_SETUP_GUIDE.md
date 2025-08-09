# GPT-4o Real-time Voice Setup Guide

## Overview

GPT-4o real-time voice provides advanced voice conversation capabilities using OpenAI's latest GPT-4o model. This guide explains how to configure and use this feature.

## Features

### 🎤 Real-time Voice Conversation
- **Speech Recognition**: Uses OpenAI Whisper for accurate transcription
- **AI Processing**: GPT-4o for intelligent responses
- **Speech Synthesis**: OpenAI TTS for natural voice output
- **Context Awareness**: Understands vehicle and dealer context

### 🚀 Advanced Capabilities
- **Low Latency**: Optimized for real-time conversation
- **Multi-modal**: Can understand context from vehicle information
- **Natural Flow**: Maintains conversation context
- **Professional**: Tailored for car dealership interactions

## Setup Instructions

### 1. Prerequisites

**Required:**
- OpenAI API key with GPT-4o access
- Valid OpenAI account with sufficient credits
- Node.js server running

**Optional:**
- Vehicle database with car information
- Dealer information for context

### 2. Database Configuration

Run the setup script to configure GPT-4o voice settings:

```bash
node setup-gpt4o-voice.js
```

This will set:
- `openai_model`: gpt-4o
- `voice_provider`: openai
- `voice_tts_provider`: openai
- `voice_speech_provider`: whisper
- `voice_realtime_enabled`: true
- `voice_streaming_enabled`: true

### 3. API Key Configuration

1. Go to **DAIVE Settings** → **API Keys**
2. Enter your OpenAI API key
3. Click **Test** to verify the connection
4. Click **Save API Keys**

### 4. Voice Settings

1. Go to **DAIVE Settings** → **Voice Settings**
2. Select **OpenAI TTS** as Voice Provider
3. Choose your preferred voice (Nova recommended)
4. Enable **Voice Enabled**
5. Click **Save Voice Settings**

## API Endpoints

### GPT-4o Voice Endpoint

**POST** `/api/daive/gpt4o-voice`

**Request:**
```javascript
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('vehicleId', 'vehicle-id');
formData.append('sessionId', 'session-id');
formData.append('customerInfo', JSON.stringify({
  name: 'Customer Name',
  email: 'customer@email.com',
  dealerId: 'dealer-id'
}));

const response = await fetch('/api/daive/gpt4o-voice', {
  method: 'POST',
  body: formData
});
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "transcription": "What are the safety features?",
    "response": "This vehicle comes with advanced safety features...",
    "audioResponseUrl": "/uploads/daive-audio/gpt4o-response-1234567890.mp3",
    "model": "gpt-4o",
    "conversationId": "session-id"
  }
}
```

## Usage Examples

### Frontend Implementation

```javascript
// Record audio and send to GPT-4o
async function sendToGPT4o(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('vehicleId', currentVehicle.id);
  formData.append('sessionId', sessionId);
  formData.append('customerInfo', JSON.stringify(customerInfo));

  const response = await fetch('/api/daive/gpt4o-voice', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  
  if (data.success) {
    // Play audio response
    const audio = new Audio(data.data.audioResponseUrl);
    audio.play();
    
    // Display transcription and response
    displayMessage(data.data.transcription, 'user');
    displayMessage(data.data.response, 'assistant');
  }
}
```

### Real-time Voice Chat

```javascript
// Continuous voice conversation
class GPT4oVoiceChat {
  constructor() {
    this.mediaRecorder = null;
    this.isRecording = false;
  }

  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    
    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        await this.processAudio(event.data);
      }
    };
    
    this.mediaRecorder.start();
    this.isRecording = true;
  }

  async processAudio(audioBlob) {
    // Send to GPT-4o endpoint
    const result = await sendToGPT4o(audioBlob);
    // Handle response...
  }
}
```

## Testing

### Test GPT-4o Voice

```bash
node test-gpt4o-voice.js
```

This will:
1. Create a test audio file
2. Send it to the GPT-4o endpoint
3. Verify transcription and response
4. Check audio generation

### Manual Testing

1. Start your server: `npm run dev`
2. Open the application
3. Go to a vehicle detail page
4. Click the voice chat button
5. Speak a question about the vehicle
6. Listen to the GPT-4o response

## Configuration Options

### Voice Settings

| Setting | Description | Options |
|---------|-------------|---------|
| `openai_model` | AI model to use | `gpt-4o` |
| `voice_provider` | Voice provider | `openai` |
| `voice_openai_voice` | TTS voice | `nova`, `echo`, `fable`, `onyx`, `alloy`, `shimmer` |
| `voice_speed` | Speech speed | `0.5` to `2.0` |
| `voice_pitch` | Voice pitch | `0.5` to `2.0` |

### Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `voice_realtime_enabled` | Enable real-time processing | `true` |
| `voice_streaming_enabled` | Enable streaming responses | `true` |
| `voice_response_format` | Response format | `text` |

## Troubleshooting

### Common Issues

**1. "No OpenAI API key found"**
- Check that your API key is saved in the database
- Verify the key has GPT-4o access
- Test the API connection in settings

**2. "Audio transcription failed"**
- Check audio file format (WAV, MP3 supported)
- Ensure file size is under 10MB
- Verify microphone permissions

**3. "GPT-4o processing error"**
- Check API key has sufficient credits
- Verify GPT-4o model access
- Check network connectivity

**4. "Audio response not generated"**
- Verify TTS settings are correct
- Check OpenAI TTS API access
- Ensure voice settings are saved

### Debug Commands

```bash
# Check voice settings
node check-voice-settings.js

# Test GPT-4o voice
node test-gpt4o-voice.js

# Fix invalid voice settings
node fix-invalid-voice.js
```

## Performance Optimization

### For Production

1. **Audio Compression**: Compress audio before sending
2. **Caching**: Cache common responses
3. **Streaming**: Implement real-time streaming
4. **Error Handling**: Add robust error handling
5. **Monitoring**: Add performance monitoring

### Best Practices

1. **Audio Quality**: Use 16kHz sample rate for optimal transcription
2. **File Size**: Keep audio files under 10MB
3. **Context**: Provide vehicle and dealer context
4. **Session Management**: Maintain conversation context
5. **Error Recovery**: Handle network and API errors gracefully

## Cost Considerations

### OpenAI API Costs

- **GPT-4o**: ~$0.01 per 1K tokens
- **Whisper**: ~$0.006 per minute
- **TTS**: ~$0.015 per 1K characters

### Optimization Tips

1. **Limit Response Length**: Set reasonable max_tokens
2. **Cache Responses**: Store common responses
3. **Batch Processing**: Process multiple requests together
4. **Monitor Usage**: Track API usage and costs

## Next Steps

1. **Real-time Streaming**: Implement WebSocket streaming
2. **Multi-language**: Add support for multiple languages
3. **Voice Biometrics**: Add voice recognition features
4. **Advanced Context**: Integrate with CRM systems
5. **Analytics**: Add conversation analytics

## Support

For issues or questions:
1. Check the troubleshooting section
2. Run debug commands
3. Check server logs
4. Verify API key and settings
5. Test with the provided test scripts 