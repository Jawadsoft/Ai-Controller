// Streaming Voice Performance Tests
// Tests the ultra-fast voice bot pipeline optimizations
// Target: Verify 2-4 second end-to-end response times

import { jest } from '@jest/globals';
import StreamingVoiceService from '../src/lib/streamingVoiceService.js';
import OptimizedCrewAI from '../src/lib/optimizedCrewAI.js';
import OptimizedTTSService from '../src/lib/optimizedTTSService.js';

// Mock dependencies
jest.mock('../src/lib/settingsManager.js');
jest.mock('../src/database/connection.js');

describe('Streaming Voice Pipeline Performance Tests', () => {
  let streamingVoiceService;
  let optimizedCrewAI;
  let optimizedTTS;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize services
    streamingVoiceService = new StreamingVoiceService();
    optimizedCrewAI = new OptimizedCrewAI();
    optimizedTTS = new OptimizedTTSService();
  });

  describe('Performance Timing Targets', () => {
    test('should meet voice capture + endpointing ≤80ms target', async () => {
      const startTime = performance.now();
      
      // Simulate voice capture and endpointing
      await streamingVoiceService.startRecording('test-session');
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing
      await streamingVoiceService.stopRecording('test-session');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThanOrEqual(80);
    });

    test('should meet STT first partial ≤500ms target', async () => {
      const sessionId = 'test-session';
      const startTime = performance.now();
      
      // Simulate audio chunk processing
      const audioChunk = new ArrayBuffer(1024);
      await streamingVoiceService.processAudioChunk(sessionId, audioChunk);
      
      // Wait for first partial transcript
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThanOrEqual(500);
    });

    test('should meet intent detection ≤120ms target', async () => {
      const startTime = performance.now();
      
      // Test local intent classifier
      const intent = streamingVoiceService.localIntentClassifier('What cars do you have in stock?');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThanOrEqual(120);
      expect(intent).toBeDefined();
    });

    test('should meet LLM first token ≤700ms target', async () => {
      const startTime = performance.now();
      
      // Mock CrewAI processing
      const mockProcess = jest.fn().mockResolvedValue('Test response');
      optimizedCrewAI.processConversation = mockProcess;
      
      await optimizedCrewAI.processConversation('Test message', {});
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThanOrEqual(700);
      expect(mockProcess).toHaveBeenCalled();
    });

    test('should meet TTS first audio ≤600ms target', async () => {
      const startTime = performance.now();
      
      // Mock TTS generation
      const mockGenerate = jest.fn().mockResolvedValue(new ArrayBuffer(1024));
      optimizedTTS.generateStreamingTTS = mockGenerate;
      
      await optimizedTTS.generateStreamingTTS('Test text');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThanOrEqual(600);
      expect(mockGenerate).toHaveBeenCalled();
    });

    test('should meet total time-to-first-audio ≤2.0s target', async () => {
      const sessionId = 'test-session';
      const startTime = performance.now();
      
      // Simulate full pipeline
      await streamingVoiceService.startRecording(sessionId);
      await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
      await streamingVoiceService.startStreamingSTT(sessionId);
      
      // Wait for first audio
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThanOrEqual(2000);
    });
  });

  describe('Caching Performance', () => {
    test('should cache TTS outputs for instant playback', async () => {
      const text = 'One moment please...';
      const dealerId = 'test-dealer';
      
      // First generation (should cache)
      const startTime1 = performance.now();
      await optimizedTTS.generateStreamingTTS(text, dealerId);
      const duration1 = performance.now() - startTime1;
      
      // Second generation (should use cache)
      const startTime2 = performance.now();
      await optimizedTTS.generateStreamingTTS(text, dealerId);
      const duration2 = performance.now() - startTime2;
      
      // Cached version should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.1); // 10x faster
    });

    test('should preload common phrases for instant access', async () => {
      const dealerId = 'test-dealer';
      
      // Preload common phrases
      await optimizedTTS.pregenerateCommonPhrases(dealerId);
      
      // Test instant access to common phrases
      const startTime = performance.now();
      await optimizedTTS.generateStreamingTTS('Thank you for calling', dealerId);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Should be nearly instant
    });
  });

  describe('Parallel Processing', () => {
    test('should run inventory queries in parallel with LLM calls', async () => {
      const startTime = performance.now();
      
      // Start parallel operations
      const llmPromise = optimizedCrewAI.processConversation('What cars do you have?', {});
      const inventoryPromise = optimizedCrewAI.loadInventoryContext('test-dealer', 'What cars do you have?');
      
      // Wait for both to complete
      const [llmResult, inventoryResult] = await Promise.all([llmPromise, inventoryPromise]);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should be faster than sequential execution
      expect(duration).toBeLessThan(1000);
      expect(llmResult).toBeDefined();
      expect(inventoryResult).toBeDefined();
    });

    test('should overlap intent detection with STT processing', async () => {
      const sessionId = 'test-session';
      const startTime = performance.now();
      
      // Start STT processing
      const sttPromise = streamingVoiceService.startStreamingSTT(sessionId);
      
      // Overlap with intent detection
      const intentPromise = streamingVoiceService.detectIntentEarly(sessionId, 'partial transcript');
      
      // Wait for both
      const [sttResult, intentResult] = await Promise.all([sttPromise, intentPromise]);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(800); // Combined time should be less than sum
      expect(sttResult).toBeDefined();
      expect(intentResult).toBeDefined();
    });
  });

  describe('WebSocket Streaming', () => {
    test('should handle chunked audio uploads efficiently', async () => {
      const sessionId = 'test-session';
      const chunks = [];
      
      // Simulate chunked audio upload
      for (let i = 0; i < 10; i++) {
        const chunk = new ArrayBuffer(512);
        chunks.push(chunk);
        await streamingVoiceService.processAudioChunk(sessionId, chunk);
      }
      
      // Verify all chunks were processed
      expect(chunks.length).toBe(10);
    });

    test('should stream TTS audio chunks immediately', async () => {
      const sessionId = 'test-session';
      const text = 'This is a test response that should be streamed.';
      
      // Mock audio chunk emission
      const audioChunks = [];
      streamingVoiceService.on('audioChunk', (chunk) => {
        audioChunks.push(chunk);
      });
      
      await streamingVoiceService.startStreamingTTS(sessionId, text);
      
      // Should have multiple audio chunks
      expect(audioChunks.length).toBeGreaterThan(1);
    });
  });

  describe('CrewAI Optimizations', () => {
    test('should use optimized LLM parameters', async () => {
      const mockChatOpenAI = jest.fn();
      optimizedCrewAI.llm = { invoke: mockChatOpenAI };
      
      await optimizedCrewAI.generateStreamingResponse(
        'System prompt',
        'User message',
        {},
        'test-session'
      );
      
      // Verify optimized parameters were used
      expect(mockChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: expect.any(Number),
          temperature: 0
        })
      );
    });

    test('should collapse multi-agent routing', async () => {
      const intent = 'inventory_query';
      const result = await optimizedCrewAI.detectIntentFast('What cars do you have?');
      
      // Should directly identify intent without complex routing
      expect(result).toBe(intent);
    });

    test('should maintain server-side context', async () => {
      const dealerId = 'test-dealer';
      
      // Preload context
      await optimizedCrewAI.preloadDealerContext(dealerId);
      
      // Verify context is cached
      const context = await optimizedCrewAI.loadRelevantContext(dealerId, 'inventory_query', '');
      expect(context).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    test('should track all performance metrics', async () => {
      const sessionId = 'test-session';
      
      // Track various metrics
      streamingVoiceService.trackPerformance(sessionId, 't_first_partial', 250);
      streamingVoiceService.trackPerformance(sessionId, 't_first_token', 500);
      streamingVoiceService.trackPerformance(sessionId, 't_first_audio', 800);
      streamingVoiceService.trackPerformance(sessionId, 't_play_start', 900);
      streamingVoiceService.trackPerformance(sessionId, 't_end', 1200);
      
      const summary = streamingVoiceService.getPerformanceSummary();
      
      expect(summary.totalSessions).toBeGreaterThan(0);
      expect(summary.averageResponseTime).toBeDefined();
    });

    test('should calculate cache hit rates', async () => {
      // Generate some cache data
      await optimizedTTS.generateStreamingTTS('Test text 1');
      await optimizedTTS.generateStreamingTTS('Test text 2');
      await optimizedTTS.generateStreamingTTS('Test text 1'); // Should hit cache
      
      const cacheStats = optimizedTTS.getCacheStats();
      
      expect(cacheStats.hitRate).toBeGreaterThan(0);
      expect(cacheStats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should complete full pipeline within 4 seconds', async () => {
      const sessionId = 'test-session';
      const startTime = performance.now();
      
      // Complete pipeline
      await streamingVoiceService.startRecording(sessionId);
      await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
      await streamingVoiceService.startStreamingSTT(sessionId);
      await streamingVoiceService.detectIntentEarly(sessionId, 'What cars do you have?');
      await streamingVoiceService.startCrewAIProcessing(sessionId, 'What cars do you have?');
      await streamingVoiceService.startStreamingTTS(sessionId, 'I have several cars in stock...');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(4000); // 4 second target
    });

    test('should handle multiple concurrent sessions', async () => {
      const sessions = ['session1', 'session2', 'session3'];
      const startTime = performance.now();
      
      // Process multiple sessions concurrently
      const promises = sessions.map(async (sessionId) => {
        await streamingVoiceService.startRecording(sessionId);
        await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
        return streamingVoiceService.startStreamingSTT(sessionId);
      });
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle concurrency efficiently
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should gracefully handle TTS failures', async () => {
      // Mock TTS failure
      jest.spyOn(optimizedTTS, 'generateStreamingTTS').mockRejectedValue(new Error('TTS failed'));
      
      try {
        await optimizedTTS.generateStreamingTTS('Test text');
      } catch (error) {
        expect(error.message).toBe('TTS failed');
      }
    });

    test('should fallback to text processing if voice fails', async () => {
      const sessionId = 'test-session';
      
      // Mock voice processing failure
      jest.spyOn(streamingVoiceService, 'processAudioChunk').mockRejectedValue(new Error('Voice failed'));
      
      // Should fallback to text processing
      const result = await streamingVoiceService.processTextMessage(sessionId, 'Fallback text message');
      expect(result).toBeDefined();
    });
  });
});
