// Optimized Settings Tests
// Tests the configuration parameters and settings that enable ultra-fast performance
// Target: Verify all optimization settings are properly configured

import { jest } from '@jest/globals';
import StreamingVoiceService from '../src/lib/streamingVoiceService.js';
import OptimizedCrewAI from '../src/lib/optimizedCrewAI.js';
import OptimizedTTSService from '../src/lib/optimizedTTSService.js';

// Mock dependencies
jest.mock('../src/lib/settingsManager.js');
jest.mock('../src/database/connection.js');

describe('Optimized Settings Configuration Tests', () => {
  let streamingVoiceService;
  let optimizedCrewAI;
  let optimizedTTS;

  beforeEach(() => {
    jest.clearAllMocks();
    streamingVoiceService = new StreamingVoiceService();
    optimizedCrewAI = new OptimizedCrewAI();
    optimizedTTS = new OptimizedTTSService();
  });

  describe('LLM Parameter Optimizations', () => {
    test('should use temperature=0 for deterministic responses', () => {
      const config = optimizedCrewAI.getOptimizedConfig();
      
      expect(config.temperature).toBe(0);
      expect(config.temperature).toBeLessThan(0.1);
    });

    test('should limit max_tokens to 200-300 range', () => {
      const config = optimizedCrewAI.getOptimizedConfig();
      
      expect(config.maxTokens).toBeGreaterThanOrEqual(200);
      expect(config.maxTokens).toBeLessThanOrEqual(300);
      expect(config.maxTokens).toBe(250); // Default optimized value
    });

    test('should use gpt-4o-mini for speed', () => {
      const config = optimizedCrewAI.getOptimizedConfig();
      
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.model).not.toBe('gpt-4o');
      expect(config.model).not.toBe('gpt-4');
    });

    test('should enable streaming for immediate token delivery', () => {
      const config = optimizedCrewAI.getOptimizedConfig();
      
      expect(config.streaming).toBe(true);
      expect(config.streaming).not.toBe(false);
    });
  });

  describe('CrewAI Routing Optimizations', () => {
    test('should collapse multi-agent routing to single agent', () => {
      const routingConfig = optimizedCrewAI.getRoutingConfig();
      
      expect(routingConfig.useMultiAgent).toBe(false);
      expect(routingConfig.primaryAgent).toBe('conversation_agent');
      expect(routingConfig.fallbackAgent).toBe(null);
    });

    test('should maintain system context server-side', () => {
      const contextConfig = optimizedCrewAI.getContextConfig();
      
      expect(contextConfig.serverSideCaching).toBe(true);
      expect(contextConfig.clientSideUpdates).toBe(false);
      expect(contextConfig.contextWindowSize).toBe(2000); // 2k token limit
    });

    test('should use conversation summarization for history', () => {
      const historyConfig = optimizedCrewAI.getHistoryConfig();
      
      expect(historyConfig.useSummarization).toBe(true);
      expect(historyConfig.maxHistoryTokens).toBe(1500);
      expect(historyConfig.summaryInterval).toBe(5); // Summarize every 5 exchanges
    });
  });

  describe('TTS Streaming Optimizations', () => {
    test('should enable sentence-level streaming', () => {
      const streamingConfig = optimizedTTS.getStreamingConfig();
      
      expect(streamingConfig.enableStreaming).toBe(true);
      expect(streamingConfig.sentenceLevel).toBe(true);
      expect(streamingConfig.chunkSize).toBe(512); // Optimal chunk size
    });

    test('should configure intelligent caching', () => {
      const cacheConfig = optimizedTTS.getCacheConfig();
      
      expect(cacheConfig.enableCaching).toBe(true);
      expect(cacheConfig.maxCacheSize).toBe(1000); // 1000 cached phrases
      expect(cacheConfig.ttl).toBe(3600000); // 1 hour TTL
      expect(cacheConfig.preloadCommon).toBe(true);
    });

    test('should support multiple TTS providers for redundancy', () => {
      const providers = optimizedTTS.getSupportedProviders();
      
      expect(providers).toContain('elevenlabs');
      expect(providers).toContain('openai');
      expect(providers).toContain('deepgram');
      expect(providers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('WebSocket Configuration', () => {
    test('should use optimal chunk sizes for audio streaming', () => {
      const wsConfig = streamingVoiceService.getWebSocketConfig();
      
      expect(wsConfig.audioChunkSize).toBe(1024); // 1KB chunks
      expect(wsConfig.maxChunkDelay).toBe(100); // 100ms max delay
      expect(wsConfig.enableCompression).toBe(true);
    });

    test('should configure connection pooling', () => {
      const connectionConfig = streamingVoiceService.getConnectionConfig();
      
      expect(connectionConfig.maxConnections).toBe(100);
      expect(connectionConfig.heartbeatInterval).toBe(30000); // 30s
      expect(connectionConfig.connectionTimeout).toBe(60000); // 60s
    });
  });

  describe('Performance Thresholds', () => {
    test('should set voice capture threshold to ≤80ms', () => {
      const thresholds = streamingVoiceService.getPerformanceThresholds();
      
      expect(thresholds.voiceCapture).toBeLessThanOrEqual(80);
      expect(thresholds.voiceCapture).toBe(80);
    });

    test('should set STT first partial threshold to ≤500ms', () => {
      const thresholds = streamingVoiceService.getPerformanceThresholds();
      
      expect(thresholds.sttFirstPartial).toBeLessThanOrEqual(500);
      expect(thresholds.sttFirstPartial).toBe(500);
    });

    test('should set intent detection threshold to ≤120ms', () => {
      const thresholds = streamingVoiceService.getPerformanceThresholds();
      
      expect(thresholds.intentDetection).toBeLessThanOrEqual(120);
      expect(thresholds.intentDetection).toBe(120);
    });

    test('should set LLM first token threshold to ≤700ms', () => {
      const thresholds = streamingVoiceService.getPerformanceThresholds();
      
      expect(thresholds.llmFirstToken).toBeLessThanOrEqual(700);
      expect(thresholds.llmFirstToken).toBe(700);
    });

    test('should set TTS first audio threshold to ≤600ms', () => {
      const thresholds = streamingVoiceService.getPerformanceThresholds();
      
      expect(thresholds.ttsFirstAudio).toBeLessThanOrEqual(600);
      expect(thresholds.ttsFirstAudio).toBe(600);
    });

    test('should set total response threshold to ≤4000ms', () => {
      const thresholds = streamingVoiceService.getPerformanceThresholds();
      
      expect(thresholds.totalResponse).toBeLessThanOrEqual(4000);
      expect(thresholds.totalResponse).toBe(4000);
    });
  });

  describe('Caching Strategy', () => {
    test('should configure in-memory caching for speed', () => {
      const cacheStrategy = streamingVoiceService.getCacheStrategy();
      
      expect(cacheStrategy.type).toBe('memory');
      expect(cacheStrategy.maxSize).toBe(100);
      expect(cacheStrategy.ttl).toBe(1800000); // 30 minutes
    });

    test('should preload common dealer phrases', () => {
      const preloadConfig = optimizedTTS.getPreloadConfig();
      
      expect(preloadConfig.enablePreloading).toBe(true);
      expect(preloadConfig.commonPhrases).toContain('Thank you for calling');
      expect(preloadConfig.commonPhrases).toContain('One moment please');
      expect(preloadConfig.commonPhrases).toContain('How can I help you today');
    });

    test('should cache dealer context for instant access', () => {
      const contextCache = optimizedCrewAI.getContextCacheConfig();
      
      expect(contextCache.enableCaching).toBe(true);
      expect(contextCache.maxDealers).toBe(50);
      expect(contextCache.dealerTTL).toBe(3600000); // 1 hour
    });
  });

  describe('Parallel Processing Configuration', () => {
    test('should enable parallel inventory queries', () => {
      const parallelConfig = optimizedCrewAI.getParallelConfig();
      
      expect(parallelConfig.enableParallelQueries).toBe(true);
      expect(parallelConfig.maxConcurrentQueries).toBe(5);
      expect(parallelConfig.queryTimeout).toBe(2000); // 2s timeout
    });

    test('should overlap STT and intent detection', () => {
      const overlapConfig = streamingVoiceService.getOverlapConfig();
      
      expect(overlapConfig.sttIntentOverlap).toBe(true);
      expect(overlapConfig.llmTtsOverlap).toBe(true);
      expect(overlapConfig.parallelContextLoading).toBe(true);
    });
  });

  describe('Voice Activity Detection (VAD)', () => {
    test('should configure VAD for ≤300ms endpointing', () => {
      const vadConfig = streamingVoiceService.getVADConfig();
      
      expect(vadConfig.enabled).toBe(true);
      expect(vadConfig.endpointingThreshold).toBeLessThanOrEqual(300);
      expect(vadConfig.endpointingThreshold).toBe(300);
      expect(vadConfig.silenceThreshold).toBe(0.1);
      expect(vadConfig.speechThreshold).toBe(0.7);
    });

    test('should use WebRTC VAD for browser compatibility', () => {
      const vadConfig = streamingVoiceService.getVADConfig();
      
      expect(vadConfig.implementation).toBe('webrtc');
      expect(vadConfig.sampleRate).toBe(16000);
      expect(vadConfig.frameSize).toBe(480);
    });
  });

  describe('Audio Playback Optimization', () => {
    test('should use small buffer for immediate playback', () => {
      const playbackConfig = streamingVoiceService.getPlaybackConfig();
      
      expect(playbackConfig.bufferSize).toBeLessThanOrEqual(300);
      expect(playbackConfig.bufferSize).toBe(200); // 200ms buffer
      expect(playbackConfig.enableMSE).toBe(true);
    });

    test('should configure MediaSource Extensions', () => {
      const mseConfig = streamingVoiceService.getMSEConfig();
      
      expect(mseConfig.enabled).toBe(true);
      expect(mseConfig.segmentDuration).toBe(1000); // 1s segments
      expect(mseConfig.maxBufferSize).toBe(10); // 10 segments max
    });
  });

  describe('Database Query Optimization', () => {
    test('should use connection pooling for database', () => {
      const dbConfig = streamingVoiceService.getDatabaseConfig();
      
      expect(dbConfig.connectionPool).toBe(true);
      expect(dbConfig.maxConnections).toBe(20);
      expect(dbConfig.idleTimeout).toBe(30000); // 30s
    });

    test('should cache frequent queries', () => {
      const queryCache = optimizedCrewAI.getQueryCacheConfig();
      
      expect(queryCache.enableCaching).toBe(true);
      expect(queryCache.maxQueries).toBe(100);
      expect(queryCache.queryTTL).toBe(300000); // 5 minutes
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should configure graceful degradation', () => {
      const fallbackConfig = streamingVoiceService.getFallbackConfig();
      
      expect(fallbackConfig.enableFallbacks).toBe(true);
      expect(fallbackConfig.ttsFallback).toBe('openai');
      expect(fallbackConfig.llmFallback).toBe('gpt-3.5-turbo');
      expect(fallbackConfig.sttFallback).toBe('whisper-1');
    });

    test('should set retry limits for failed operations', () => {
      const retryConfig = streamingVoiceService.getRetryConfig();
      
      expect(retryConfig.maxRetries).toBe(3);
      expect(retryConfig.retryDelay).toBe(1000); // 1s
      expect(retryConfig.exponentialBackoff).toBe(true);
    });
  });

  describe('Monitoring and Logging', () => {
    test('should enable performance tracking', () => {
      const monitoringConfig = streamingVoiceService.getMonitoringConfig();
      
      expect(monitoringConfig.enableTracking).toBe(true);
      expect(monitoringConfig.traceIds).toBe(true);
      expect(monitoringConfig.metrics).toBe(true);
    });

    test('should track all required timing metrics', () => {
      const metrics = streamingVoiceService.getRequiredMetrics();
      
      expect(metrics).toContain('t_first_partial');
      expect(metrics).toContain('t_first_token');
      expect(metrics).toContain('t_first_audio');
      expect(metrics).toContain('t_play_start');
      expect(metrics).toContain('t_end');
    });

    test('should configure performance dashboard', () => {
      const dashboardConfig = streamingVoiceService.getDashboardConfig();
      
      expect(dashboardConfig.enabled).toBe(true);
      expect(dashboardConfig.refreshInterval).toBe(5000); // 5s refresh
      expect(dashboardConfig.realTimeUpdates).toBe(true);
    });
  });

  describe('Security and Rate Limiting', () => {
    test('should configure rate limiting for API endpoints', () => {
      const rateLimitConfig = streamingVoiceService.getRateLimitConfig();
      
      expect(rateLimitConfig.enabled).toBe(true);
      expect(rateLimitConfig.maxRequestsPerMinute).toBe(60);
      expect(rateLimitConfig.maxConcurrentSessions).toBe(10);
    });

    test('should validate authentication tokens', () => {
      const authConfig = streamingVoiceService.getAuthConfig();
      
      expect(authConfig.requireAuth).toBe(true);
      expect(authConfig.tokenValidation).toBe(true);
      expect(authConfig.sessionTimeout).toBe(3600000); // 1 hour
    });
  });

  describe('Integration Settings Validation', () => {
    test('should validate all optimization settings are consistent', () => {
      const allSettings = streamingVoiceService.getAllSettings();
      
      // Check that all required optimizations are enabled
      expect(allSettings.streaming.enabled).toBe(true);
      expect(allSettings.caching.enabled).toBe(true);
      expect(allSettings.parallel.enabled).toBe(true);
      expect(allSettings.vad.enabled).toBe(true);
      expect(allSettings.mse.enabled).toBe(true);
    });

    test('should ensure performance targets are achievable', () => {
      const targets = streamingVoiceService.getPerformanceTargets();
      const config = streamingVoiceService.getOptimizedConfig();
      
      // Verify that configuration supports targets
      expect(config.maxTokens).toBeLessThanOrEqual(300);
      expect(config.temperature).toBe(0);
      expect(config.streaming).toBe(true);
      
      // Verify targets are realistic
      expect(targets.totalResponse).toBeLessThanOrEqual(4000);
      expect(targets.timeToFirstAudio).toBeLessThanOrEqual(2000);
    });
  });
});
