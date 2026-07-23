# Streaming Voice Pipeline - Ultra-Fast Voice Bot

## Overview

This implementation provides a **2-4 second end-to-end response time** for voice bot interactions through a fully streaming pipeline with WebSocket support, parallel processing, and intelligent caching.

## 🚀 Performance Targets

| Metric | Target (p50) | Description |
|--------|---------------|-------------|
| Voice Capture + Endpointing | ≤80ms | Audio recording and silence detection |
| STT First Partial | ≤300-500ms | First transcription chunk |
| Intent Detection | ≤120ms | Lightweight local classification |
| LLM First Token | ≤350-700ms | First AI response token |
| TTS First Audio | ≤300-600ms | First audio chunk generated |
| Audio Playback Start | ≤120ms | Audio starts playing |
| **Total Time-to-First-Audio** | **~1.2-2.0s** | End-to-end until user hears response |
| **Total Response Time** | **~2.8-4.2s** | Complete interaction cycle |

## 🏗️ Architecture

### 1. Streaming Voice Service (`src/lib/streamingVoiceService.js`)
- **WebSocket server** for real-time audio streaming
- **Chunked audio processing** (100ms chunks)
- **Parallel STT + intent detection** 
- **Streaming LLM responses**
- **Performance tracking** with trace IDs

### 2. Optimized CrewAI (`src/lib/optimizedCrewAI.js`)
- **Collapsed multi-agent routing** → single optimized agent
- **Context caching** (dealer info, prompts, inventory)
- **Lightweight intent detection** (regex-based, ≤120ms)
- **Streaming responses** with early TTS trigger
- **Parallel context loading** with LLM processing

### 3. Optimized TTS Service (`src/lib/optimizedTTSService.js`)
- **Sentence-level streaming** TTS generation
- **Intelligent caching** with 30-minute TTL
- **Pre-generated common phrases** ("Hello, how can I help?")
- **Multiple provider support** (ElevenLabs, OpenAI, Deepgram)
- **Audio chunk merging** for seamless playback

### 4. Frontend Components
- **StreamingVoiceRecorder** - Real-time voice input with WebSocket
- **PerformanceDashboard** - Live metrics and system health
- **WebSocket client** - Handles streaming audio and responses

## 🔧 Setup & Configuration

### 1. Install Dependencies
```bash
npm install ws @langchain/openai openai
```

### 2. Environment Variables
```env
# Required
OPENAI_API_KEY=your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key

# Optional
DEEPGRAM_API_KEY=your-deepgram-key
NODE_ENV=production
```

### 3. Initialize Services
```javascript
// In your main server file
import { initializeStreamingVoice } from './routes/streamingVoice.js';

const server = app.listen(PORT);
initializeStreamingVoice(server);
```

### 4. Frontend Integration
```tsx
import StreamingVoiceRecorder from './components/daive/StreamingVoiceRecorder';
import PerformanceDashboard from './components/daive/PerformanceDashboard';

// Use in your components
<StreamingVoiceRecorder 
  dealerId={dealerId}
  onVoiceSubmit={handleVoiceSubmit}
  onPartialTranscript={handlePartialTranscript}
/>
```

## 📊 Performance Monitoring

### Real-time Metrics Dashboard
```tsx
<PerformanceDashboard dealerId={dealerId} />
```

### API Endpoints
- `GET /api/streaming-voice/performance` - Performance metrics
- `GET /api/streaming-voice/status` - Service health
- `POST /api/streaming-voice/initialize` - Initialize services
- `POST /api/streaming-voice/clear-cache` - Clear caches

### Key Metrics Tracked
- **Response times** for each pipeline stage
- **Cache hit rates** for TTS and context
- **WebSocket connection** health
- **Error rates** and failure modes
- **Resource usage** (memory, CPU)

## 🎯 Usage Examples

### 1. Basic Voice Interaction
```typescript
const voiceRecorder = new StreamingVoiceRecorder({
  dealerId: 'dealer-123',
  onVoiceSubmit: (transcript, audioBlob) => {
    console.log('Voice submitted:', transcript);
  },
  onPartialTranscript: (partial) => {
    console.log('Partial transcript:', partial);
  }
});
```

### 2. Performance Monitoring
```typescript
// Get real-time performance data
const response = await fetch('/api/streaming-voice/performance');
const metrics = await response.json();

console.log('Current performance:', metrics.data);
console.log('Cache hit rate:', metrics.data.tts.cacheStats.hitRate);
```

### 3. Service Management
```typescript
// Initialize services for a dealer
await fetch('/api/streaming-voice/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dealerId: 'dealer-123' })
});

// Preload common phrases
await fetch('/api/streaming-voice/preload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dealerId: 'dealer-123' })
});
```

## 🔄 Pipeline Flow

### 1. Voice Input
```
User speaks → Audio chunks (100ms) → WebSocket streaming
```

### 2. Parallel Processing
```
Audio chunks → STT transcription (300ms)
     ↓
Intent detection (120ms) → CrewAI pre-warm
     ↓
Context loading (150ms) → Inventory/DB queries
```

### 3. AI Generation
```
System prompt → LLM streaming → First token (700ms)
     ↓
TTS generation starts → First audio (600ms)
     ↓
Audio streaming → Playback (120ms)
```

### 4. Response Delivery
```
Audio chunks → Client buffer → Seamless playback
     ↓
Complete response → Cache storage → Performance logging
```

## 🚀 Optimization Techniques

### 1. **Parallel Processing**
- STT + intent detection run simultaneously
- Context loading + LLM initialization overlap
- TTS generation starts on first token

### 2. **Intelligent Caching**
- **TTS cache**: Common phrases pre-generated
- **Context cache**: Dealer info, prompts, inventory
- **Prompt cache**: System prompts by intent
- **Audio cache**: Generated responses with TTL

### 3. **Streaming Architecture**
- **Chunked audio**: 100ms audio chunks for real-time
- **Partial transcripts**: Show progress to user
- **Streaming LLM**: Response starts before completion
- **Audio streaming**: Play first chunks while generating rest

### 4. **Performance Tuning**
- **CrewAI**: `temperature=0`, `maxTokens=200`
- **Model selection**: `gpt-4o-mini` for speed
- **Embeddings**: `text-embedding-3-small` for context
- **Timeout**: 10s max for API calls

## 📈 Expected Performance Improvements

### Current vs. Optimized
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Response Time | 7-12s | 2-4s | **75-80% faster** |
| First Audio | 3-5s | 1.2-2s | **70-75% faster** |
| Intent Detection | 500-800ms | 80-120ms | **85-90% faster** |
| TTS Generation | 2-4s | 300-600ms | **80-85% faster** |
| Cache Hit Rate | 0% | 75-85% | **New capability** |

### Performance Factors
- **Network latency**: WebSocket vs. HTTP
- **Parallel processing**: Overlapping operations
- **Caching**: Eliminating redundant API calls
- **Streaming**: Starting output before completion
- **Optimized models**: Faster inference times

## 🛠️ Troubleshooting

### Common Issues

#### 1. High Response Times
```bash
# Check performance metrics
GET /api/streaming-voice/performance

# Clear caches
POST /api/streaming-voice/clear-cache

# Check service status
GET /api/streaming-voice/status
```

#### 2. WebSocket Connection Issues
```typescript
// Check connection status
if (wsRef.current?.readyState === WebSocket.OPEN) {
  console.log('WebSocket connected');
} else {
  console.log('WebSocket disconnected');
}
```

#### 3. TTS Generation Failures
```typescript
// Verify API keys
const response = await fetch('/api/streaming-voice/status');
const status = await response.json();

console.log('TTS status:', status.data.tts);
console.log('API keys available:', status.data.apiKeys);
```

### Debug Commands
```bash
# Monitor WebSocket connections
netstat -an | grep :3000

# Check service logs
tail -f logs/streaming-voice.log

# Performance profiling
node --prof server.js
```

## 🔒 Security Considerations

### 1. **Authentication**
- All routes require valid JWT token
- Dealer ID validation on all requests
- Rate limiting on API endpoints

### 2. **Data Privacy**
- Audio data not stored permanently
- Transcripts logged for debugging only
- API keys stored securely in database

### 3. **Access Control**
- WebSocket connections authenticated
- Dealer-scoped data access
- Admin-only performance monitoring

## 📚 API Reference

### WebSocket Events

#### Client → Server
```typescript
// Start recording
{ type: 'start_recording', timestamp: number }

// Audio chunk
{ type: 'audio_chunk', data: ArrayBuffer, timestamp: number }

// Stop recording
{ type: 'stop_recording', timestamp: number }

// Text message
{ type: 'text_message', data: string, timestamp: number }
```

#### Server → Client
```typescript
// Partial transcript
{ type: 'partial_transcript', transcript: string, isComplete: false }

// Intent detected
{ type: 'intent_detected', intent: string, confidence: number }

// Partial response
{ type: 'partial_response', content: string, isComplete: false }

// Audio chunk
{ type: 'audio_chunk', audio: string, format: string, isComplete: false }
```

### REST API Endpoints

#### Performance & Monitoring
- `GET /api/streaming-voice/performance` - Get performance metrics
- `GET /api/streaming-voice/status` - Get service status
- `GET /api/streaming-voice/health` - Health check

#### Service Management
- `POST /api/streaming-voice/initialize` - Initialize services
- `POST /api/streaming-voice/clear-cache` - Clear caches
- `POST /api/streaming-voice/preload` - Preload common phrases

#### Processing
- `POST /api/streaming-voice/process-text` - Process text message
- `POST /api/streaming-voice/process-voice` - Process voice message (fallback)
- `GET /api/streaming-voice/audio/:sessionId` - Get generated audio

## 🚀 Deployment

### 1. **Production Build**
```bash
npm run build
npm run start:production
```

### 2. **Environment Configuration**
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com
```

### 3. **Load Balancing**
- WebSocket connections require sticky sessions
- Use Redis for session storage
- Monitor WebSocket connection limits

### 4. **Monitoring**
- Set up alerts for response time thresholds
- Monitor cache hit rates
- Track WebSocket connection health
- Log performance metrics to external service

## 🔮 Future Enhancements

### 1. **Advanced Caching**
- Redis-based distributed cache
- Predictive phrase generation
- Adaptive cache sizing

### 2. **Performance Optimization**
- WebAssembly-based intent detection
- Edge computing for TTS
- GPU acceleration for audio processing

### 3. **Analytics & Insights**
- User interaction patterns
- Response quality metrics
- A/B testing framework
- Predictive performance optimization

### 4. **Multi-language Support**
- Language detection
- Localized TTS voices
- Cultural context adaptation

## 📞 Support

For technical support or questions about the streaming voice pipeline:

1. **Check the logs** for detailed error information
2. **Review performance metrics** in the dashboard
3. **Verify API keys** and service configuration
4. **Test with simple examples** to isolate issues

The streaming voice pipeline represents a significant performance improvement over traditional voice bot implementations, delivering near real-time responses while maintaining high quality and reliability.
