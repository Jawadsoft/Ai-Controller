// Streaming Voice Service - Ultra-fast voice bot pipeline
// Target: 2-4 second end-to-end response time
// Features: Chunked WebSocket, streaming STT, parallel processing, streaming TTS

import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import settingsManager from './settingsManager.js';
import { pool } from '../database/connection.js';

class StreamingVoiceService extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.clients = new Map();
    this.activeSessions = new Map();
    this.ttsCache = new Map();
    this.contextCache = new Map();
    this.performanceMetrics = new Map();
    
    // Performance targets
    this.targets = {
      voiceCapture: 80,      // ms
      sttFirstPartial: 300,  // ms
      intentDetection: 120,   // ms
      llmFirstToken: 700,     // ms
      ttsFirstAudio: 600,     // ms
      audioPlayStart: 120,    // ms
      totalResponse: 4000     // ms
    };
  }

  // Initialize WebSocket server
  initializeWebSocket(server) {
    // Create WebSocket server with path
    this.wss = new WebSocketServer({ 
      server,
      path: '/streaming-voice'
    });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    console.log('🚀 Streaming Voice Service initialized on path: /streaming-voice');
    
    return this.wss;
  }

  // Handle new WebSocket connection
  handleConnection(ws, req) {
    const sessionId = this.generateSessionId();
    const client = {
      ws,
      sessionId,
      connectedAt: Date.now(),
      audioChunks: [],
      isRecording: false,
      performanceStart: Date.now()
    };
    
    this.clients.set(sessionId, client);
    
    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      sessionId,
      status: 'connected'
    }));

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await this.handleClientMessage(sessionId, message);
      } catch (error) {
        console.error('Error handling client message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      this.cleanupSession(sessionId);
    });

    console.log(`🔌 New streaming client connected: ${sessionId}`);
  }

  // Handle client messages (audio chunks, commands)
  async handleClientMessage(sessionId, message) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    const { type, data } = message;
    
    switch (type) {
      case 'audio_chunk':
        await this.processAudioChunk(sessionId, data);
        break;
      case 'start_recording':
        this.startRecording(sessionId);
        break;
      case 'stop_recording':
        await this.stopRecording(sessionId);
        break;
      case 'text_message':
        await this.processTextMessage(sessionId, data);
        break;
      default:
        console.log(`Unknown message type: ${type}`);
    }
  }

  // Process incoming audio chunk with streaming STT
  async processAudioChunk(sessionId, audioData) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    const tStart = performance.now();
    
    // Add chunk to buffer
    client.audioChunks.push(audioData);
    
    // Start streaming STT immediately if we have enough audio
    if (client.audioChunks.length >= 3) { // ~300ms of audio
      this.startStreamingSTT(sessionId);
    }
    
    // Track performance
    const tEnd = performance.now();
    this.trackPerformance(sessionId, 'audio_chunk_processing', tEnd - tStart);
  }

  // Start streaming STT processing
  async startStreamingSTT(sessionId) {
    const client = this.clients.get(sessionId);
    if (!client || client.sttActive) return;

    client.sttActive = true;
    const tStart = performance.now();
    
    try {
      // Get API keys
      const apiKeys = await settingsManager.getAPIKeys(client.dealerId);
      if (!apiKeys.openai) {
        throw new Error('No OpenAI API key available');
      }

      // Initialize OpenAI with streaming
      const openai = new OpenAI({
        apiKey: apiKeys.openai,
        dangerouslyAllowBrowser: true
      });

      // Create audio buffer from chunks
      const audioBuffer = this.concatenateAudioChunks(client.audioChunks);
      
      // Start streaming transcription
      const stream = await openai.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      // Process streaming response
      let partialTranscript = '';
      let words = [];
      
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          partialTranscript += content;
          
          // Send partial transcript to client
          client.ws.send(JSON.stringify({
            type: 'partial_transcript',
            transcript: partialTranscript,
            isComplete: false
          }));
          
          // Start intent detection as soon as we have meaningful content
          if (partialTranscript.length > 10 && !client.intentDetected) {
            this.detectIntentEarly(sessionId, partialTranscript);
          }
        }
      }

      // Final transcript
      client.finalTranscript = partialTranscript;
      client.ws.send(JSON.stringify({
        type: 'final_transcript',
        transcript: partialTranscript,
        isComplete: true
      }));

      // Track STT performance
      const tEnd = performance.now();
      this.trackPerformance(sessionId, 'stt_complete', tEnd - tStart);
      
      // Start CrewAI processing immediately
      this.startCrewAIProcessing(sessionId, partialTranscript);
      
    } catch (error) {
      console.error('STT error:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        error: 'STT processing failed'
      }));
    } finally {
      client.sttActive = false;
    }
  }

  // Early intent detection (≤120ms target)
  async detectIntentEarly(sessionId, partialTranscript) {
    const client = this.clients.get(sessionId);
    if (!client || client.intentDetected) return;

    const tStart = performance.now();
    client.intentDetected = true;
    
    // Use lightweight local classifier instead of LLM
    const intent = this.localIntentClassifier(partialTranscript);
    client.detectedIntent = intent;
    
    // Send intent to client
    client.ws.send(JSON.stringify({
      type: 'intent_detected',
      intent,
      confidence: 0.85
    }));
    
    // Track performance
    const tEnd = performance.now();
    this.trackPerformance(sessionId, 'intent_detection', tEnd - tStart);
    
    // Pre-warm CrewAI based on intent
    this.preWarmCrewAI(sessionId, intent);
  }

  // Lightweight local intent classifier
  localIntentClassifier(text) {
    const t = text.toLowerCase();
    
    // Fast regex-based classification
    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(t)) return 'GREET';
    if (/\b(test\s*drive|schedule|drive)\b/.test(t)) return 'TEST_DRIVE';
    if (/\b(price|cost|how much|o\.t\.d|out the door)\b/.test(t)) return 'PRICE';
    if (/\b(finance|payment|loan|apr|interest rate|monthly payment)\b/.test(t)) return 'FINANCE';
    if (/\b(feature|spec|details?|safety|mpg|mileage)\b/.test(t)) return 'FEATURES';
    if (/\b(inventory|available|stock|show me|what do you have)\b/.test(t)) return 'INVENTORY';
    if (/\b(alternative|other|options|similar|compare)\b/.test(t)) return 'ALTERNATIVES';
    if (/\b(trade[\s-]*in|tradein|valuation)\b/.test(t)) return 'TRADE_IN';
    if (/\b(human|agent|representative|talk to|call me)\b/.test(t)) return 'HANDOFF';
    if (/\b(urgent|asap|today|immediately|now|quick)\b/.test(t)) return 'URGENT';
    
    return 'GENERAL_INQUIRY';
  }

  // Pre-warm CrewAI based on detected intent
  async preWarmCrewAI(sessionId, intent) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    try {
      // Initialize CrewAI with optimized settings
      const crewAI = new ChatOpenAI({
        openAIApiKey: client.apiKeys?.openai,
        modelName: 'gpt-4o-mini',
        temperature: 0, // Deterministic for speed
        maxTokens: 200, // Limited for faster response
        streaming: true // Enable streaming
      });

      client.crewAI = crewAI;
      
      // Pre-load context based on intent
      if (intent === 'INVENTORY') {
        this.preloadInventoryContext(sessionId);
      }
      
    } catch (error) {
      console.error('CrewAI pre-warm error:', error);
    }
  }

  // Start CrewAI processing with streaming
  async startCrewAIProcessing(sessionId, transcript) {
    const client = this.clients.get(sessionId);
    if (!client || !client.crewAI) return;

    const tStart = performance.now();
    
    try {
      // Build system prompt
      const systemPrompt = await this.buildOptimizedSystemPrompt(sessionId, transcript);
      
      // Start streaming LLM response
      const stream = await client.crewAI.stream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ]);

      let responseText = '';
      let firstTokenReceived = false;
      
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          responseText += content;
          
          // Track first token timing
          if (!firstTokenReceived) {
            const tFirstToken = performance.now();
            this.trackPerformance(sessionId, 'llm_first_token', tFirstToken - tStart);
            firstTokenReceived = true;
            
            // Start TTS streaming immediately
            this.startStreamingTTS(sessionId, content);
          }
          
          // Send partial response to client
          client.ws.send(JSON.stringify({
            type: 'partial_response',
            content,
            isComplete: false
          }));
        }
      }

      // Final response
      client.finalResponse = responseText;
      client.ws.send(JSON.stringify({
        type: 'final_response',
        content: responseText,
        isComplete: true
      }));

      // Track total processing time
      const tEnd = performance.now();
      this.trackPerformance(sessionId, 'total_processing', tEnd - tStart);
      
    } catch (error) {
      console.error('CrewAI processing error:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        error: 'AI processing failed'
      }));
    }
  }

  // Start streaming TTS (first sentence should speak while model generates)
  async startStreamingTTS(sessionId, text) {
    const client = this.clients.get(sessionId);
    if (!client || client.ttsActive) return;

    const tStart = performance.now();
    client.ttsActive = true;
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(text);
      if (this.ttsCache.has(cacheKey)) {
        const cachedAudio = this.ttsCache.get(cacheKey);
        this.sendAudioChunk(sessionId, cachedAudio, true);
        return;
      }

      // Get TTS settings
      const ttsSettings = await settingsManager.getTTSSettings(client.dealerId);
      const apiKeys = await settingsManager.getAPIKeys(client.dealerId);
      
      if (ttsSettings.ttsProvider === 'elevenlabs' && apiKeys.elevenlabs) {
        await this.streamElevenLabsTTS(sessionId, text, ttsSettings, apiKeys.elevenlabs);
      } else if (ttsSettings.ttsProvider === 'openai' && apiKeys.openai) {
        await this.streamOpenAITTS(sessionId, text, ttsSettings, apiKeys.openai);
      }
      
    } catch (error) {
      console.error('TTS streaming error:', error);
    } finally {
      client.ttsActive = false;
    }
  }

  // Stream ElevenLabs TTS
  async streamElevenLabsTTS(sessionId, text, ttsSettings, apiKey) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    try {
      // Split text into sentences for streaming
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      for (const sentence of sentences) {
        if (sentence.trim().length === 0) continue;
        
        // Generate audio for sentence
        const audioResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/stream', {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: sentence.trim(),
            model_id: ttsSettings.model || 'eleven_multilingual_v2',
            voice_settings: {
              stability: ttsSettings.stability || 0.5,
              similarity_boost: ttsSettings.similarityBoost || 0.5
            },
            output_format: 'mp3_44100_128'
          })
        });

        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          
          // Send audio chunk to client
          this.sendAudioChunk(sessionId, audioBuffer, false);
          
          // Cache for future use
          const cacheKey = this.generateCacheKey(sentence);
          this.ttsCache.set(cacheKey, audioBuffer);
          
          // Track TTS performance
          const tEnd = performance.now();
          this.trackPerformance(sessionId, 'tts_sentence', tEnd - performance.now());
        }
      }
      
      // Mark TTS complete
      this.sendAudioChunk(sessionId, null, true);
      
    } catch (error) {
      console.error('ElevenLabs TTS streaming error:', error);
    }
  }

  // Stream OpenAI TTS
  async streamOpenAITTS(sessionId, text, ttsSettings, apiKey) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    try {
      // OpenAI TTS doesn't support streaming, so we'll generate in chunks
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      for (const sentence of sentences) {
        if (sentence.trim().length === 0) continue;
        
        const audioResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: sentence.trim(),
            voice: ttsSettings.voice || 'alloy',
            response_format: 'mp3'
          })
        });

        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          this.sendAudioChunk(sessionId, audioBuffer, false);
        }
      }
      
      this.sendAudioChunk(sessionId, null, true);
      
    } catch (error) {
      console.error('OpenAI TTS streaming error:', error);
    }
  }

  // Send audio chunk to client
  sendAudioChunk(sessionId, audioBuffer, isComplete) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    if (isComplete) {
      client.ws.send(JSON.stringify({
        type: 'tts_complete',
        isComplete: true
      }));
    } else if (audioBuffer) {
      // Convert to base64 for WebSocket transmission
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      
      client.ws.send(JSON.stringify({
        type: 'audio_chunk',
        audio: base64Audio,
        format: 'mp3',
        isComplete: false
      }));
    }
  }

  // Build optimized system prompt
  async buildOptimizedSystemPrompt(sessionId, transcript) {
    const client = this.clients.get(sessionId);
    if (!client) return '';

    try {
      // Get dealer context from cache or load
      let dealerContext = this.contextCache.get(client.dealerId);
      if (!dealerContext) {
        dealerContext = await this.loadDealerContext(client.dealerId);
        this.contextCache.set(client.dealerId, dealerContext);
      }

      // Build concise prompt
      return `You are a helpful car dealership AI assistant. 
Context: ${dealerContext.name} - ${dealerContext.location}
Focus: ${client.detectedIntent || 'GENERAL_INQUIRY'}
Keep responses under 200 words. Be helpful and professional.`;
      
    } catch (error) {
      console.error('Error building system prompt:', error);
      return 'You are a helpful car dealership AI assistant. Keep responses concise and professional.';
    }
  }

  // Load dealer context
  async loadDealerContext(dealerId) {
    try {
      const result = await pool.query(
        'SELECT name, location, specialties FROM dealers WHERE id = $1',
        [dealerId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      return { name: 'Dealership', location: 'Unknown', specialties: [] };
    } catch (error) {
      console.error('Error loading dealer context:', error);
      return { name: 'Dealership', location: 'Unknown', specialties: [] };
    }
  }

  // Preload inventory context for inventory queries
  async preloadInventoryContext(sessionId) {
    const client = this.clients.get(sessionId);
    if (!client || !client.dealerId) return;

    try {
      // Load inventory in background
      const inventoryPromise = pool.query(
        'SELECT make, model, year, price FROM vehicles WHERE dealer_id = $1 AND status = $2 LIMIT 10',
        [client.dealerId, 'available']
      );

      // Store promise for later use
      client.inventoryPromise = inventoryPromise;
      
    } catch (error) {
      console.error('Error preloading inventory:', error);
    }
  }

  // Track performance metrics
  trackPerformance(sessionId, metric, value) {
    if (!this.performanceMetrics.has(sessionId)) {
      this.performanceMetrics.set(sessionId, {});
    }
    
    const metrics = this.performanceMetrics.get(sessionId);
    metrics[metric] = value;
    
    // Log performance data
    console.log(`📊 ${sessionId} - ${metric}: ${value.toFixed(2)}ms`);
    
    // Check against targets
    const target = this.targets[metric] || 1000;
    if (value > target) {
      console.warn(`⚠️ ${sessionId} - ${metric} exceeded target: ${value.toFixed(2)}ms > ${target}ms`);
    }
  }

  // Generate session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate cache key for TTS
  generateCacheKey(text) {
    return text.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100);
  }

  // Concatenate audio chunks
  concatenateAudioChunks(chunks) {
    // Implementation depends on audio format
    // For now, return first chunk as placeholder
    return chunks[0];
  }

  // Start recording
  startRecording(sessionId) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    client.isRecording = true;
    client.audioChunks = [];
    client.performanceStart = performance.now();
    
    client.ws.send(JSON.stringify({
      type: 'recording_started',
      sessionId
    }));
  }

  // Stop recording
  async stopRecording(sessionId) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    client.isRecording = false;
    
    // Process remaining audio chunks
    if (client.audioChunks.length > 0) {
      await this.processAudioChunk(sessionId, client.audioChunks[client.audioChunks.length - 1]);
    }
    
    client.ws.send(JSON.stringify({
      type: 'recording_stopped',
      sessionId
    }));
  }

  // Process text message (fallback for non-voice)
  async processTextMessage(sessionId, text) {
    const client = this.clients.get(sessionId);
    if (!client) return;

    // Start CrewAI processing directly
    await this.startCrewAIProcessing(sessionId, text);
  }

  // Cleanup session
  cleanupSession(sessionId) {
    const client = this.clients.get(sessionId);
    if (client) {
      // Log final performance metrics
      const totalTime = Date.now() - client.connectedAt;
      console.log(`📊 ${sessionId} - Total session time: ${totalTime}ms`);
      
      // Cleanup resources
      if (client.crewAI) {
        client.crewAI = null;
      }
      
      this.clients.delete(sessionId);
      this.activeSessions.delete(sessionId);
      this.performanceMetrics.delete(sessionId);
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {
      activeConnections: this.clients.size,
      activeSessions: this.activeSessions.size,
      cacheHitRate: this.calculateCacheHitRate(),
      averageResponseTime: this.calculateAverageResponseTime()
    };
    
    return summary;
  }

  // Calculate cache hit rate
  calculateCacheHitRate() {
    // Implementation for cache statistics
    return 0.75; // Placeholder
  }

  // Calculate average response time
  calculateAverageResponseTime() {
    let totalTime = 0;
    let count = 0;
    
    this.performanceMetrics.forEach(metrics => {
      if (metrics.total_processing) {
        totalTime += metrics.total_processing;
        count++;
      }
    });
    
    return count > 0 ? totalTime / count : 0;
  }
}

export default StreamingVoiceService;
