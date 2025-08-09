# ElevenLabs Jessica Voice Setup Guide

## Overview

ElevenLabs Jessica voice provides high-quality, natural-sounding speech synthesis for your D.A.I.V.E. AI assistant. This guide explains how to configure and use the Jessica voice.

## Features

### 🎤 ElevenLabs Jessica Voice
- **Natural Sounding**: Human-like voice quality
- **Professional Tone**: Perfect for customer service
- **High Quality**: Studio-grade speech synthesis
- **Customizable**: Speed, pitch, and style control
- **Multi-language**: Support for multiple languages

### 🚀 Voice Capabilities
- **Speech Recognition**: OpenAI Whisper for transcription
- **AI Processing**: GPT models for intelligent responses
- **Speech Synthesis**: ElevenLabs Jessica for natural output
- **Context Awareness**: Understands vehicle and dealer context

## Setup Instructions

### 1. Prerequisites

**Required:**
- ElevenLabs API key
- Valid ElevenLabs account with sufficient credits
- Node.js server running

**Optional:**
- Vehicle database with car information
- Dealer information for context

### 2. Database Configuration

The voice settings have been configured with:

```bash
node setup-elevenlabs-jessica.js
```

**Current Settings:**
- `voice_provider`: elevenlabs
- `voice_tts_provider`: elevenlabs
- `voice_elevenlabs_voice`: jessica
- `voice_speech_provider`: whisper
- `voice_enabled`: true
- `voice_realtime_enabled`: true
- `voice_streaming_enabled`: true

### 3. API Key Configuration

1. **Get ElevenLabs API Key:**
   - Go to [ElevenLabs Dashboard](https://elevenlabs.io/)
   - Sign up or log in to your account
   - Navigate to Profile → API Key
   - Copy your API key

2. **Add API Key to DAIVE Settings:**
   - Go to **DAIVE Settings** → **API Keys**
   - Enter your ElevenLabs API key
   - Click **Test** to verify the connection
   - Click **Save API Keys**

### 4. Voice Settings Verification

1. **Go to DAIVE Settings** → **Voice Settings**
2. **Verify settings:**
   - Voice Provider: ElevenLabs
   - Voice: Jessica
   - Voice Enabled: ✓
   - Real-time: ✓

## API Endpoints

### Voice Endpoint

**POST** `/api/daive/voice`

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

const response = await fetch('/api/daive/voice', {
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
    "audioResponseUrl": "/uploads/daive-audio/elevenlabs-response-1234567890.mp3",
    "model": "gpt-4o",
    "conversationId": "session-id"
  }
}
```

## Usage Examples

### Frontend Implementation

```javascript
// Record audio and send to ElevenLabs Jessica
async function sendToElevenLabsJessica(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('vehicleId', currentVehicle.id);
  formData.append('sessionId', sessionId);
  formData.append('customerInfo', JSON.stringify(customerInfo));

  const response = await fetch('/api/daive/voice', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  
  if (data.success) {
    // Play Jessica's audio response
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
// Continuous voice conversation with Jessica
class ElevenLabsVoiceChat {
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
    // Send to ElevenLabs Jessica endpoint
    const result = await sendToElevenLabsJessica(audioBlob);
    // Handle response...
  }
}
```

## Testing

### Test ElevenLabs Jessica Voice

```bash
node test-elevenlabs-jessica.js
```

This will:
1. Create a test audio file
2. Send it to the voice endpoint
3. Verify transcription and response
4. Check Jessica's audio generation

### Manual Testing

1. Start your server: `npm run dev`
2. Open the application
3. Go to a vehicle detail page
4. Click the voice chat button
5. Speak a question about the vehicle
6. Listen to Jessica's response

## Configuration Options

### Voice Settings

| Setting | Description | Current Value |
|---------|-------------|---------------|
| `voice_provider` | Voice provider | `elevenlabs` |
| `voice_tts_provider` | TTS provider | `elevenlabs` |
| `voice_elevenlabs_voice` | ElevenLabs voice | `jessica` |
| `voice_speed` | Speech speed | `1.0` |
| `voice_pitch` | Voice pitch | `1.0` |
| `voice_language` | Language | `en-US` |

### Advanced Settings

| Setting | Description | Current Value |
|---------|-------------|---------------|
| `voice_realtime_enabled` | Enable real-time processing | `true` |
| `voice_streaming_enabled` | Enable streaming responses | `true` |
| `voice_response_format` | Response format | `text` |

## Troubleshooting

### Common Issues

**1. "No ElevenLabs API key found"**
- Check that your API key is saved in the database
- Verify the key has sufficient credits
- Test the API connection in settings

**2. "Audio transcription failed"**
- Check audio file format (WAV, MP3 supported)
- Ensure file size is under 10MB
- Verify microphone permissions

**3. "ElevenLabs processing error"**
- Check API key has sufficient credits
- Verify Jessica voice access
- Check network connectivity

**4. "Audio response not generated"**
- Verify ElevenLabs TTS settings are correct
- Check ElevenLabs API access
- Ensure voice settings are saved

### Debug Commands

```bash
# Check voice settings
node check-voice-settings.js

# Test ElevenLabs Jessica voice
node test-elevenlabs-jessica.js

# Clean up voice settings
node cleanup-elevenlabs-settings.js
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

### ElevenLabs API Costs

- **Jessica Voice**: ~$0.30 per 1K characters
- **High Quality**: Premium voice quality
- **Customizable**: Speed and style control

### Optimization Tips

1. **Limit Response Length**: Set reasonable max_tokens
2. **Cache Responses**: Store common responses
3. **Batch Processing**: Process multiple requests together
4. **Monitor Usage**: Track API usage and costs

## Voice Characteristics

### Jessica Voice Profile

- **Tone**: Professional and friendly
- **Style**: Natural and conversational
- **Pace**: Clear and well-paced
- **Quality**: High-fidelity audio
- **Use Case**: Customer service, sales, information

### Customization Options

- **Speed**: Adjust speech rate (0.5x to 2.0x)
- **Pitch**: Modify voice pitch
- **Style**: Change speaking style
- **Language**: Support for multiple languages

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

## Jessica Voice Benefits

### For Car Dealerships

- **Professional**: Maintains professional image
- **Friendly**: Creates welcoming atmosphere
- **Clear**: Easy to understand vehicle information
- **Engaging**: Keeps customers interested
- **Trustworthy**: Builds customer confidence

### Technical Advantages

- **High Quality**: Studio-grade audio output
- **Natural**: Human-like speech patterns
- **Reliable**: Consistent performance
- **Scalable**: Handles multiple conversations
- **Customizable**: Adjustable parameters 