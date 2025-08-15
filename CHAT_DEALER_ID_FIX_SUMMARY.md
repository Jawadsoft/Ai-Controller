# CrewAI Processing Flow Documentation
## D.A.I.V.E. AI Bot System

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Input Processing Flow](#input-processing-flow)
4. [CrewAI Processing Pipeline](#crewai-processing-pipeline)
5. [Voice Processing](#voice-processing)
6. [Response Generation](#response-generation)
7. [Context Management](#context-management)
8. [Performance Monitoring](#performance-monitoring)
9. [Configuration](#configuration)
10. [API Endpoints](#api-endpoints)
11. [Error Handling](#error-handling)
12. [Best Practices](#best-practices)

---

## 🚀 Overview

The D.A.I.V.E. (Dealership AI Vehicle Expert) system uses CrewAI to process both voice and text inputs from customers, providing intelligent, context-aware responses for car dealership interactions. The system combines multiple AI technologies to create a seamless conversational experience.

### Key Features
- **Multi-modal Input**: Supports both voice and text inputs
- **Intelligent Routing**: Automatically routes requests to appropriate AI systems
- **Context Awareness**: Maintains conversation context across sessions
- **Inventory Integration**: Provides real-time vehicle information
- **Multi-provider TTS**: Supports multiple text-to-speech providers
- **Lead Scoring**: Automatically qualifies leads and suggests human handoffs

---

## 🏗️ System Architecture
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Voice Input │ │ Text Input │ │ Web Interface │
│ (Audio File) │ │ (Chat) │ │ (React App) │
└─────────┬───────┘ └─────────┬───────┘ └─────────┬───────┘
│ │ │
▼ ▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Gateway Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ /api/daive/ │ │ /api/daive/ │ │ Authentication │ │
│ │ voice │ │ chat │ │ Middleware │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ Processing Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Speech-to-Text │ │ Intent │ │ Context │ │
│ │ (Whisper/ │ │ Detection │ │ Management │ │
│ │ Deepgram) │ └─────────────────┘ └─────────────────┘ │
│ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ CrewAI Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Prompt │ │ AI Response │ │ Response │ │
│ │ Engineering │ │ Generation │ │ Enhancement │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ Output Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Text │ │ Text-to- │ │ Lead Scoring │ │
│ │ Response │ │ Speech (TTS) │ │ & Handoff │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
Apply to CHAT_DEALER_...
?

I see you sent a "?" - it looks like my previous response was cut off when I was creating the documentation file. Let me complete the CrewAI Processing Flow documentation for you.
Here's the complete documentation content that you can save as CREWAI_PROCESSING_FLOW.md:
Apply to CHAT_DEALER_...
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Voice Input │ │ Text Input │ │ Web Interface │
│ (Audio File) │ │ (Chat) │ │ (React App) │
└─────────┬───────┘ └─────────┬───────┘ └─────────┬───────┘
│ │ │
▼ ▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Gateway Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ /api/daive/ │ │ /api/daive/ │ │ Authentication │ │
│ │ voice │ │ chat │ │ Middleware │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ Processing Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Speech-to-Text │ │ Intent │ │ Context │ │
│ │ (Whisper/ │ │ Detection │ │ Management │ │
│ │ Deepgram) │ └─────────────────┘ └─────────────────┘ │
│ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ CrewAI Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Prompt │ │ AI Response │ │ Response │ │
│ │ Engineering │ │ Generation │ │ Enhancement │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│ Output Layer │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Text │ │ Text-to- │ │ Lead Scoring │ │
│ │ Response │ │ Speech (TTS) │ │ & Handoff │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
Apply to CHAT_DEALER_...
This is the complete documentation file for your CrewAI processing flow. You can save this content as CREWAI_PROCESSING_FLOW.md in your workspace root directory.
The documentation covers everything from system architecture to troubleshooting, making it a comprehensive reference for developers working with your D.A.I.V.E. AI Bot system.

---

## 🔄 Input Processing Flow

### Text Input Processing
```javascript
// POST /api/daive/chat
router.post('/chat', async (req, res) => {
  const { vehicleId, sessionId, message, customerInfo } = req.body;
  
  // Direct text processing
  const result = await daiveService.processConversation(
    sessionId,
    vehicleId, 
    message,        // User's text message
    customerInfo
  );
});
```

### Voice Input Processing
```javascript
// POST /api/daive/voice
router.post('/voice', upload.single('audio'), async (req, res) => {
  const { vehicleId, sessionId, customerInfo } = req.body;
  const audioFile = req.file;
  
  // 1. Audio file validation (max 10MB)
  // 2. Speech-to-Text conversion
  // 3. Text sent to same processing pipeline
});
```

---

## 🤖 CrewAI Processing Pipeline

### 1. Intent Detection & Routing
```javascript
// NEW ROUTING LOGIC:
// 1. ONLY explicit inventory requests → Inventory-Aware AI
// 2. ALL other questions → CrewAI

const isInventory = this.isInventoryQuery(userMessage);
if (isInventory) {
  // Use inventory-aware response
  result = await this.generateInventoryAwareResponse(userMessage, dealerId, customerInfo);
} else {
  // Use CrewAI with context management
  result = await this.processWithAI(sessionId, vehicleId, userMessage, customerInfo);
}
```

### 2. Context Management
```javascript
// Store conversation context
await this.storeConversationContext(sessionId, userMessage, '', {
  intent: 'PENDING',
  dealerId: customerInfo.dealerId,
  vehicleId,
  timestamp: new Date().toISOString()
});

// Update user preferences
await this.updateUserPreferences(sessionId, userMessage, result.response);
```

### 3. CrewAI Initialization
```javascript
// Initialize CrewAI with dealer-specific settings
if (!this.crewAI && customerInfo.dealerId) {
  console.log(`🔄 Attempting to initialize CrewAI with dealer: ${customerInfo.dealerId}...`);
  await this.initializeCrewAI(customerInfo.dealerId);
}
```

### 4. Prompt Engineering
```javascript
// Create context-aware system prompt
const systemPrompt = this.buildSystemPrompt(dealerInfo, prompts, customerInfo);

// Add strict formatting rules
systemPrompt += `
�� FORMATTING RULES - FOLLOW THESE EXACTLY:
- NEVER use email format (no Subject:, Hi Customer, etc.)
- NEVER start with "Subject:" or email headers
- Respond in natural chat conversation style
- Use friendly, casual language
- Keep it conversational, not formal business communication
- If you start to write an email, STOP and rewrite as a chat message`;
```

### 5. AI Response Generation
```javascript
// Get AI response using CrewAI
const response = await this.crewAI.invoke([
  new HumanMessage(systemPrompt),
  new HumanMessage(userPrompt)
]);
```

---

## �� Voice Processing

### Speech-to-Text Providers
```javascript
// Multiple STT providers supported:
// 1. OpenAI Whisper API (default)
// 2. Deepgram V3 (alternative)

const voiceProvider = 'whisper'; // Default to Whisper
const speechProviderQuery = `
  SELECT setting_value
  FROM daive_api_settings
  WHERE setting_type = 'voice_speech_provider'
  LIMIT 1
`;
```

### Text-to-Speech Providers
```javascript
// Multiple TTS providers supported:
// 1. ElevenLabs (default)
// 2. OpenAI TTS
// 3. Deepgram TTS

const providerToUse = ttsProvider !== 'default' ? ttsProvider : voiceProvider;
```

### OpenAI TTS Configuration
```javascript
const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'tts-1-hd',
    input: result.response,
    voice: openaiVoice, // alloy, echo, fable, onyx, nova, shimmer
    response_format: 'mp3',
    speed: 1.0
  })
});
```

---

## 📝 Response Generation

### Context-Aware Response Enhancement
```javascript
// Generate context-aware response
if (result.response) {
  result.response = await this.generateContextAwareResponse(
    userMessage, 
    sessionId, 
    result.response, 
    { dealerId: customerInfo.dealerId, vehicleId, intent }
  );
}
```

### Inventory Integration
```javascript
// Smart inventory selection for vehicle requests
if (isAskingForVehicles && context.dealerId) {
  const bestVehicles = this.selectBestVehicles(allVehicles, messageLower, context);
  
  // Add inventory to response
  enhancedResponse += `\n\n�� **Best Options for You:**\n`;
  bestVehicles.forEach((vehicle, index) => {
    enhancedResponse += `\n**${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    enhancedResponse += `\n   💰 Price: $${vehicle.price?.toLocaleString() || 'Call for price'}`;
    enhancedResponse += `\n   �� Mileage: ${vehicle.mileage?.toLocaleString() || 'N/A'} miles`;
    enhancedResponse += `\n   🎨 Color: ${vehicle.color || 'N/A'}\n`;
  });
}
```

### Response Style Guidelines
```javascript
// EMOTIONAL & HUMAN-LIKE RESPONSES:
- Show genuine excitement and enthusiasm about helping customers
- Use emotional language: "I'm thrilled to help you!", "That's fantastic!", "I absolutely love that choice!"
- Express empathy and understanding: "I totally get what you're looking for", "That makes perfect sense"
- Be encouraging and supportive: "You're making a great choice", "I think you'll love this"
- Use conversational fillers naturally: "You know", "Actually", "Honestly", "Well"
- Show personality and warmth: "I'm here to make this fun and easy for you!"
- React emotionally to customer preferences: "Fantastic, Toyota? Excellent choice! They're known for reliability"
```

---

## �� Context Management

### Session Management
```javascript
// Generate unique session ID
generateSessionId() {
  return `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Chat history and context management
this.chatHistory = new Map(); // sessionId -> conversation history
this.contextVectorStore = new Map(); // sessionId -> vector store for context
this.userPreferences = new Map(); // sessionId -> extracted user preferences
```

### Vector Store for Context
```javascript
// Initialize embedding model and text splitter
this.embeddingModel = null;
this.textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
```

### User Preference Tracking
```javascript
// Extract and store user preferences
await this.updateUserPreferences(sessionId, userMessage, result.response);

// Track preferences like:
// - Vehicle preferences (make, model, type)
// - Budget constraints
// - Urgency level
// - Communication style
```

---

## 📊 Performance Monitoring

### Detailed Timing Metrics
```javascript
// Performance tracking throughout the pipeline
const timings = {
  promptCreation: performance.now() - promptStart,
  aiResponse: performance.now() - aiStart,
  contextualResponse: performance.now() - contextualStart,
  intentAnalysis: performance.now() - analysisStart,
  ttsGeneration: performance.now() - ttsStart
};

console.log('📊 CrewAI PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
console.log('📊 Detailed Timings:', {
  promptCreation: `${timings.promptCreation.toFixed(2)}ms`,
  aiResponse: `${timings.aiResponse.toFixed(2)}ms`,
  contextualResponse: `${timings.contextualResponse.toFixed(2)}ms`,
  intentAnalysis: `${timings.intentAnalysis.toFixed(2)}ms`,
  ttsGeneration: `${timings.ttsGeneration.toFixed(2)}ms`,
  totalTime: `${totalTime.toFixed(2)}ms`
});
```

### Lead Scoring & Analysis
```javascript
// Analyze customer intent for lead scoring
const intent = this.detectIntent(customerMessage);
const urgency = this.assessUrgency(customerMessage);
const leadScore = this.calculateLeadScore({ intent, urgency, message: customerMessage });
const shouldHandoff = this.shouldHandoffToHuman({ intent, urgency, leadScore });

// Lead scoring based on keywords:
// - buy/purchase: +30 points
// - price/cost: +20 points  
// - test drive: +25 points
// - financing: +20 points
// - urgent/asap: +15 points
```

---

## ⚙️ Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Optional
OPENAI_TTS_VOICE=alloy
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### Database Settings
```sql
-- Voice settings table
CREATE TABLE daive_api_settings (
  id SERIAL PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id),
  setting_type VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Common setting types:
-- voice_enabled: true/false
-- voice_speech_provider: whisper/deepgram
-- voice_tts_provider: elevenlabs/openai/deepgram
-- voice_openai_voice: alloy/echo/fable/onyx/nova/shimmer
-- deepgram_key: API key for Deepgram
-- openai_key: API key for OpenAI
```

---

## �� API Endpoints

### Chat Endpoint
```javascript
POST /api/daive/chat
Content-Type: application/json

{
  "vehicleId": "uuid-optional",
  "sessionId": "string-optional", 
  "message": "User's text message",
  "customerInfo": {
    "name": "Customer Name",
    "email": "customer@email.com",
    "dealerId": "dealer-uuid"
  }
}
```

### Voice Endpoint
```javascript
POST /api/daive/voice
Content-Type: multipart/form-data

Form Data:
- audio: Audio file (max 10MB)
- vehicleId: UUID (optional)
- sessionId: String (optional)
- customerInfo: JSON string (optional)
```

### Health Check
```javascript
GET /api/daive/health

Response:
{
  "status": "OK",
  "service": "D.A.I.V.E.",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 🚨 Error Handling

### Graceful Degradation
```javascript
// Fallback responses when CrewAI is unavailable
if (!this.crewAI) {
  console.log('⚠️ CrewAI LLM not available, using fallback response');
  
  const fallbackResponse = this.generateSimpleFallbackResponse(customerMessage, context);
  
  return {
    success: true,
    response: fallbackResponse,
    crewUsed: false,
    crewType: 'Fallback',
    intent: this.detectIntent(customerMessage),
    leadScore: this.calculateLeadScore({ 
      intent: this.detectIntent(customerMessage), 
      urgency: this.assessUrgency(customerMessage), 
      message: customerMessage 
    }),
    shouldHandoff: false,
    audioResponseUrl: null
  };
}
```

### Error Response Format
```javascript
catch (error) {
  console.error('❌ Error in CrewAI processing:', error);
  const totalTime = performance.now() - startTime;
  
  return {
    response: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or contact our team directly for immediate assistance.",
    hasInventory: false,
    crewUsed: true,
    intent: 'ERROR',
    leadScore: 0,
    error: error.message,
    processingTime: totalTime
  };
}
```

---

## 💡 Best Practices

### 1. Response Quality
- Keep responses under 200 tokens for clarity and focus
- Use conversational, human-like language
- Avoid formal email formatting
- Include relevant inventory information when requested
- Provide actionable next steps

### 2. Performance Optimization
- Use parallel processing where possible
- Implement caching for frequently requested data
- Monitor response times and optimize bottlenecks
- Use connection pooling for database queries

### 3. Error Handling
- Always provide fallback responses
- Log errors with sufficient context
- Implement retry mechanisms for transient failures
- Gracefully degrade functionality when services are unavailable

### 4. Security
- Validate all input data
- Implement proper authentication and authorization
- Sanitize user inputs to prevent injection attacks
- Use environment variables for sensitive configuration

### 5. Monitoring
- Track response times and success rates
- Monitor API usage and rate limits
- Implement alerting for critical failures
- Use structured logging for better debugging

---

## 🔧 Troubleshooting

### Common Issues

#### 1. CrewAI Not Initializing
```javascript
// Check initialization status
if (!this.isInitialized) {
  console.log('⚠️ DAIVE Service not fully initialized, attempting to initialize now...');
  try {
    await this.initialize(context.dealerId);
  } catch (initError) {
    console.error('❌ Failed to initialize service:', initError);
  }
}
```

#### 2. TTS Generation Failing
```javascript
// Check API keys and provider settings
try {
  const ttsStart = performance.now();
  audioResponseUrl = await this.generateTTSResponse(aiResponse, context.dealerId);
  timings.ttsGeneration = performance.now() - ttsStart;
  console.log(`⏱️  TTS generation: ${timings.ttsGeneration.toFixed(2)}ms`);
} catch (ttsError) {
  console.log('⚠️ TTS generation failed, continuing without audio:', ttsError.message);
  timings.ttsGeneration = 0;
}
```

#### 3. Database Connection Issues
```javascript
// Implement connection retry logic
try {
  const result = await pool.query(query, params);
  return result.rows;
} catch (error) {
  console.error('Error executing database query:', error);
  // Implement retry logic or fallback
  return [];
}
```

---

## 📚 Additional Resources

### Related Documentation
- [Structured Responses Guide](./STRUCTURED_RESPONSES_README.md)
- [Voice Settings Configuration](./VOICE_SETTINGS_CENTRALIZATION_SUMMARY.md)
- [CrewAI Debug Guide](./CREWAI_DEBUG_GUIDE.md)
- [Database Migration Guide](./DATABASE_MIGRATION_SUMMARY.md)

### Testing Tools
- `test-crewai-performance.js` - Performance testing
- `test-crewai-timing.js` - Response time analysis
- `test-context-management.js` - Context handling tests
- `crewai-debug-interface.html` - Web-based debugging interface

### Configuration Scripts
- `setup-env.js` - Environment setup
- `setup-voice-settings.js` - Voice configuration
- `add-openai-key.js` - API key management

---

## 📞 Support

For technical support or questions about the CrewAI processing flow:

1. **Check the logs** for detailed error messages and timing information
2. **Review the configuration** to ensure all required settings are properly configured
3. **Test individual components** using the provided testing tools
4. **Consult the troubleshooting section** for common issues and solutions
5. **Review related documentation** for specific feature details

---

*Last updated: January 2025*
*Version: 1.0*
*D.A.I.V.E. AI Bot System*