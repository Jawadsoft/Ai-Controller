// Streaming Voice Routes - Ultra-fast voice bot API endpoints
// Target: 2-4 second end-to-end response time
// Features: WebSocket streaming, parallel processing, performance monitoring

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import StreamingVoiceService from '../lib/streamingVoiceService.js';
import OptimizedCrewAI from '../lib/optimizedCrewAI.js';
import OptimizedTTSService from '../lib/optimizedTTSService.js';
import settingsManager from '../lib/settingsManager.js';

const router = express.Router();

// Initialize services
const streamingVoiceService = new StreamingVoiceService();
const optimizedCrewAI = new OptimizedCrewAI();
const optimizedTTS = new OptimizedTTSService();

// Initialize WebSocket server when this module is loaded
let wsServer = null;

export const initializeStreamingVoice = (server) => {
  wsServer = streamingVoiceService.initializeWebSocket(server);
  console.log('🚀 Streaming Voice WebSocket server initialized');
};

// GET /api/streaming-voice/status - Get service status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = {
      websocket: wsServer ? 'running' : 'stopped',
      crewAI: optimizedCrewAI.llm ? 'initialized' : 'not_initialized',
      tts: 'running',
      performance: {
        websocket: streamingVoiceService.getPerformanceSummary(),
        crewAI: optimizedCrewAI.getPerformanceSummary(),
        tts: optimizedTTS.getPerformanceSummary()
      },
      cache: {
        tts: optimizedTTS.getCacheStats()
      }
    };
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Error getting streaming voice status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

// POST /api/streaming-voice/initialize - Initialize services for dealer
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.body;
    const userDealerId = req.user.dealer_id;
    
    if (!dealerId || dealerId !== userDealerId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid dealer ID'
      });
    }
    
    console.log(`🔄 Initializing streaming voice services for dealer: ${dealerId}`);
    
    // Initialize CrewAI
    await optimizedCrewAI.initialize(dealerId);
    
    // Pre-generate common TTS phrases
    await optimizedTTS.pregenerateCommonPhrases(dealerId);
    
    res.json({
      success: true,
      message: 'Streaming voice services initialized successfully',
      data: {
        crewAI: 'initialized',
        tts: 'initialized',
        dealerId
      }
    });
    
  } catch (error) {
    console.error('Error initializing streaming voice services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize services'
    });
  }
});

// POST /api/streaming-voice/process-text - Process text message with optimized pipeline
router.post('/process-text', authenticateToken, async (req, res) => {
  try {
    const { message, dealerId, vehicleId, sessionId } = req.body;
    const userDealerId = req.user.dealer_id;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    if (dealerId && dealerId !== userDealerId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid dealer ID'
      });
    }
    
    const actualDealerId = dealerId || userDealerId;
    
    console.log(`📝 Processing text message for dealer: ${actualDealerId}`);
    console.log(`📝 Message: "${message}"`);
    
    const startTime = performance.now();
    
    // Process with optimized CrewAI
    const crewAIResult = await optimizedCrewAI.processConversation(message, {
      dealerId: actualDealerId,
      vehicleId,
      sessionId
    });
    
    // Generate TTS if enabled
    let audioResponse = null;
    try {
      const voiceSettings = await settingsManager.getVoiceSettings(actualDealerId);
      
      if (voiceSettings.enabled) {
        console.log('🔊 Generating TTS for response...');
        
        const ttsResult = await optimizedTTS.generateStreamingTTS(
          crewAIResult.response,
          actualDealerId,
          { sessionId }
        );
        
        audioResponse = {
          audioUrl: `/api/streaming-voice/audio/${ttsResult.sessionId}`,
          fromCache: ttsResult.fromCache,
          sessionId: ttsResult.sessionId
        };
      }
    } catch (ttsError) {
      console.error('TTS generation error:', ttsError);
      // Continue without TTS
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    console.log(`✅ Text processing completed in ${totalTime.toFixed(2)}ms`);
    
    res.json({
      success: true,
      data: {
        response: crewAIResult.response,
        intent: crewAIResult.intent,
        context: crewAIResult.context,
        audioResponse,
        performance: {
          totalTime,
          ...crewAIResult.performance
        }
      }
    });
    
  } catch (error) {
    console.error('Error processing text message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// POST /api/streaming-voice/process-voice - Process voice message (fallback for non-WebSocket)
router.post('/process-voice', authenticateToken, async (req, res) => {
  try {
    const { audioData, dealerId, vehicleId, sessionId } = req.body;
    const userDealerId = req.user.dealer_id;
    
    if (!audioData) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required'
      });
    }
    
    if (dealerId && dealerId !== userDealerId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid dealer ID'
      });
    }
    
    const actualDealerId = dealerId || userDealerId;
    
    console.log(`🎤 Processing voice message for dealer: ${actualDealerId}`);
    
    const startTime = performance.now();
    
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Process with OpenAI Whisper for transcription
    const apiKeys = await settingsManager.getAPIKeys(actualDealerId);
    if (!apiKeys.openai) {
      throw new Error('No OpenAI API key available');
    }
    
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.openai}`
      },
      body: (() => {
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/webm' });
        formData.append('file', blob, 'audio.webm');
        formData.append('model', 'whisper-1');
        return formData;
      })()
    });
    
    if (!transcriptionResponse.ok) {
      throw new Error(`Whisper API error: ${transcriptionResponse.status}`);
    }
    
    const transcriptionResult = await transcriptionResponse.json();
    const transcript = transcriptionResult.text;
    
    console.log(`📝 Transcription: "${transcript}"`);
    
    // Process with optimized CrewAI
    const crewAIResult = await optimizedCrewAI.processConversation(transcript, {
      dealerId: actualDealerId,
      vehicleId,
      sessionId
    });
    
    // Generate TTS if enabled
    let audioResponse = null;
    try {
      const voiceSettings = await settingsManager.getVoiceSettings(actualDealerId);
      
      if (voiceSettings.enabled) {
        console.log('🔊 Generating TTS for response...');
        
        const ttsResult = await optimizedTTS.generateStreamingTTS(
          crewAIResult.response,
          actualDealerId,
          { sessionId }
        );
        
        audioResponse = {
          audioUrl: `/api/streaming-voice/audio/${ttsResult.sessionId}`,
          fromCache: ttsResult.fromCache,
          sessionId: ttsResult.sessionId
        };
      }
    } catch (ttsError) {
      console.error('TTS generation error:', ttsError);
      // Continue without TTS
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    console.log(`✅ Voice processing completed in ${totalTime.toFixed(2)}ms`);
    
    res.json({
      success: true,
      data: {
        transcription: transcript,
        response: crewAIResult.response,
        intent: crewAIResult.intent,
        context: crewAIResult.context,
        audioResponse,
        performance: {
          totalTime,
          transcription: endTime - startTime,
          ...crewAIResult.performance
        }
      }
    });
    
  } catch (error) {
    console.error('Error processing voice message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process voice message'
    });
  }
});

// GET /api/streaming-voice/audio/:sessionId - Get generated audio
router.get('/audio/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get audio from TTS service
    const audio = optimizedTTS.getAudioBySessionId(sessionId);
    
    if (!audio) {
      return res.status(404).json({
        success: false,
        error: 'Audio not found'
      });
    }
    
    // Set headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    
    // Send audio buffer
    res.send(audio);
    
  } catch (error) {
    console.error('Error serving audio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve audio'
    });
  }
});

// GET /api/streaming-voice/performance - Get performance metrics
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const performance = {
      websocket: streamingVoiceService.getPerformanceSummary(),
      crewAI: optimizedCrewAI.getPerformanceSummary(),
      tts: optimizedTTS.getPerformanceSummary(),
      targets: {
        voiceCapture: 80,
        sttFirstPartial: 300,
        intentDetection: 120,
        llmFirstToken: 700,
        ttsFirstAudio: 600,
        audioPlayStart: 120,
        totalResponse: 4000
      }
    };
    
    res.json({
      success: true,
      data: performance
    });
    
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

// POST /api/streaming-voice/clear-cache - Clear TTS cache
router.post('/clear-cache', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.body;
    const userDealerId = req.user.dealer_id;
    
    if (dealerId && dealerId !== userDealerId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid dealer ID'
      });
    }
    
    // Clear TTS cache
    optimizedTTS.clearCache();
    
    // Clear CrewAI caches
    optimizedCrewAI.clearCaches();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

// POST /api/streaming-voice/preload - Preload common phrases
router.post('/preload', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.body;
    const userDealerId = req.user.dealer_id;
    
    if (!dealerId || dealerId !== userDealerId) {
      return res.status(403).json({
        success: false,
        error: 'Invalid dealer ID'
      });
    }
    
    console.log(`🔄 Preloading common TTS phrases for dealer: ${dealerId}`);
    
    // Pre-generate common phrases
    await optimizedTTS.pregenerateCommonPhrases(dealerId);
    
    res.json({
      success: true,
      message: 'Common phrases preloaded successfully'
    });
    
  } catch (error) {
    console.error('Error preloading phrases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preload phrases'
    });
  }
});

// GET /api/streaming-voice/health - Health check
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        websocket: wsServer ? 'running' : 'stopped',
        crewAI: optimizedCrewAI.llm ? 'initialized' : 'not_initialized',
        tts: 'running'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    
    res.json(health);
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
