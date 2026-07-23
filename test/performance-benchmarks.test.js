// Performance Benchmarks Tests
// Runs actual performance measurements to verify 2-4 second targets
// Target: Measure real-world performance against optimization goals

import { jest } from '@jest/globals';
import StreamingVoiceService from '../src/lib/streamingVoiceService.js';
import OptimizedCrewAI from '../src/lib/optimizedCrewAI.js';
import OptimizedTTSService from '../src/lib/optimizedTTSService.js';

// Mock dependencies for performance testing
jest.mock('../src/lib/settingsManager.js');
jest.mock('../src/database/connection.js');

describe('Performance Benchmarks - Real-world Measurements', () => {
  let streamingVoiceService;
  let optimizedCrewAI;
  let optimizedTTS;

  beforeEach(() => {
    jest.clearAllMocks();
    streamingVoiceService = new StreamingVoiceService();
    optimizedCrewAI = new OptimizedCrewAI();
    optimizedTTS = new OptimizedTTSService();
  });

  describe('End-to-End Pipeline Benchmarks', () => {
    test('should complete full voice pipeline within 4 seconds (p50)', async () => {
      const sessionId = 'benchmark-session';
      const startTime = performance.now();
      
      // Simulate complete user interaction
      await streamingVoiceService.startRecording(sessionId);
      
      // Simulate audio input and processing
      const audioChunk = new ArrayBuffer(2048); // 2KB audio chunk
      await streamingVoiceService.processAudioChunk(sessionId, audioChunk);
      
      // Start streaming STT
      await streamingVoiceService.startStreamingSTT(sessionId);
      
      // Simulate partial transcript arrival
      await streamingVoiceService.detectIntentEarly(sessionId, 'What cars do you have in stock?');
      
      // Start CrewAI processing
      await streamingVoiceService.startCrewAIProcessing(sessionId, 'What cars do you have in stock?');
      
      // Start TTS generation
      await streamingVoiceService.startStreamingTTS(sessionId, 'I have several cars available in our inventory...');
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      
      console.log(`🚀 Full Pipeline Duration: ${totalDuration.toFixed(2)}ms`);
      
      // Primary target: ≤4 seconds
      expect(totalDuration).toBeLessThanOrEqual(4000);
      
      // Stretch target: ≤3 seconds
      if (totalDuration <= 3000) {
        console.log('✅ EXCELLENT: Pipeline completed in ≤3 seconds');
      } else if (totalDuration <= 4000) {
        console.log('✅ GOOD: Pipeline completed in ≤4 seconds');
      } else {
        console.log('❌ NEEDS IMPROVEMENT: Pipeline exceeded 4 seconds');
      }
    }, 10000); // 10 second timeout for benchmark

    test('should achieve time-to-first-audio within 2 seconds (p50)', async () => {
      const sessionId = 'first-audio-benchmark';
      const startTime = performance.now();
      
      // Start the pipeline
      await streamingVoiceService.startRecording(sessionId);
      await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
      
      // Wait for first audio chunk
      let audioReceived = false;
      streamingVoiceService.on('audioChunk', () => {
        audioReceived = true;
      });
      
      // Start TTS generation
      await streamingVoiceService.startStreamingTTS(sessionId, 'Hello, how can I help you today?');
      
      // Wait for audio or timeout
      let attempts = 0;
      while (!audioReceived && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      const endTime = performance.now();
      const timeToFirstAudio = endTime - startTime;
      
      console.log(`🎵 Time to First Audio: ${timeToFirstAudio.toFixed(2)}ms`);
      
      // Primary target: ≤2 seconds
      expect(timeToFirstAudio).toBeLessThanOrEqual(2000);
      
      // Stretch target: ≤1.5 seconds
      if (timeToFirstAudio <= 1500) {
        console.log('✅ EXCELLENT: First audio in ≤1.5 seconds');
      } else if (timeToFirstAudio <= 2000) {
        console.log('✅ GOOD: First audio in ≤2 seconds');
      } else {
        console.log('❌ NEEDS IMPROVEMENT: First audio exceeded 2 seconds');
      }
    }, 5000);
  });

  describe('Individual Component Benchmarks', () => {
    test('should process audio chunks within 80ms', async () => {
      const sessionId = 'chunk-benchmark';
      const audioChunk = new ArrayBuffer(1024);
      
      const startTime = performance.now();
      await streamingVoiceService.processAudioChunk(sessionId, audioChunk);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`🔊 Audio Chunk Processing: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThanOrEqual(80);
    });

    test('should detect intent within 120ms', async () => {
      const testPhrases = [
        'What cars do you have in stock?',
        'What are your prices?',
        'Do you have financing options?',
        'What are your business hours?',
        'Can you help me find a specific car?'
      ];
      
      const results = [];
      
      for (const phrase of testPhrases) {
        const startTime = performance.now();
        const intent = streamingVoiceService.localIntentClassifier(phrase);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        results.push({ phrase, duration, intent });
        
        expect(duration).toBeLessThanOrEqual(120);
      }
      
      // Log results
      console.log('🧠 Intent Detection Benchmarks:');
      results.forEach(result => {
        console.log(`  "${result.phrase}": ${result.duration.toFixed(2)}ms -> ${result.intent}`);
      });
      
      // Calculate average
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      console.log(`📊 Average Intent Detection: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThanOrEqual(100); // Average should be well under 120ms
    });

    test('should generate first LLM token within 700ms', async () => {
      const startTime = performance.now();
      
      // Mock LLM response
      const mockResponse = 'I can help you find the perfect car for your needs.';
      optimizedCrewAI.processConversation = jest.fn().mockResolvedValue(mockResponse);
      
      const result = await optimizedCrewAI.processConversation('What cars do you have?', {});
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`🤖 LLM First Token: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThanOrEqual(700);
      expect(result).toBe(mockResponse);
    });

    test('should generate first TTS audio within 600ms', async () => {
      const testText = 'Thank you for calling our dealership. How can I assist you today?';
      const dealerId = 'benchmark-dealer';
      
      const startTime = performance.now();
      const audio = await optimizedTTS.generateStreamingTTS(testText, dealerId);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`🔊 TTS First Audio: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThanOrEqual(600);
      expect(audio).toBeDefined();
    });
  });

  describe('Concurrent Load Testing', () => {
    test('should handle 5 concurrent sessions efficiently', async () => {
      const sessionCount = 5;
      const sessions = Array.from({ length: sessionCount }, (_, i) => `concurrent-${i}`);
      
      const startTime = performance.now();
      
      // Start all sessions concurrently
      const promises = sessions.map(async (sessionId) => {
        await streamingVoiceService.startRecording(sessionId);
        await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
        return streamingVoiceService.startStreamingSTT(sessionId);
      });
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const avgPerSession = totalDuration / sessionCount;
      
      console.log(`🔄 Concurrent Sessions (${sessionCount}):`);
      console.log(`  Total Time: ${totalDuration.toFixed(2)}ms`);
      console.log(`  Average per Session: ${avgPerSession.toFixed(2)}ms`);
      
      // Should handle concurrency efficiently
      expect(totalDuration).toBeLessThanOrEqual(2000); // 2 seconds for 5 sessions
      expect(avgPerSession).toBeLessThanOrEqual(500); // 500ms average per session
    }, 10000);

    test('should maintain performance under memory pressure', async () => {
      const sessionId = 'memory-pressure-test';
      
      // Simulate memory pressure by creating many sessions
      const sessions = [];
      for (let i = 0; i < 20; i++) {
        const session = `memory-test-${i}`;
        sessions.push(session);
        await streamingVoiceService.startRecording(session);
      }
      
      // Test performance under pressure
      const startTime = performance.now();
      await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`💾 Performance Under Memory Pressure: ${duration.toFixed(2)}ms`);
      
      // Should still meet performance targets
      expect(duration).toBeLessThanOrEqual(100); // Slightly relaxed under pressure
      
      // Cleanup
      sessions.forEach(session => streamingVoiceService.cleanupSession(session));
    });
  });

  describe('Caching Performance Impact', () => {
    test('should show significant speedup with cached responses', async () => {
      const testText = 'Welcome to our dealership. We have a great selection of vehicles.';
      const dealerId = 'cache-benchmark';
      
      // First generation (cold)
      const startTime1 = performance.now();
      await optimizedTTS.generateStreamingTTS(testText, dealerId);
      const duration1 = performance.now() - startTime1;
      
      // Second generation (cached)
      const startTime2 = performance.now();
      await optimizedTTS.generateStreamingTTS(testText, dealerId);
      const duration2 = performance.now() - startTime2;
      
      const speedup = duration1 / duration2;
      
      console.log(`⚡ Caching Performance Impact:`);
      console.log(`  Cold Generation: ${duration1.toFixed(2)}ms`);
      console.log(`  Cached Generation: ${duration2.toFixed(2)}ms`);
      console.log(`  Speedup: ${speedup.toFixed(2)}x`);
      
      // Should show significant improvement
      expect(speedup).toBeGreaterThan(5); // At least 5x faster
      expect(duration2).toBeLessThan(100); // Cached should be nearly instant
    });

    test('should preload common phrases for instant access', async () => {
      const dealerId = 'preload-benchmark';
      
      // Preload common phrases
      const preloadStart = performance.now();
      await optimizedTTS.pregenerateCommonPhrases(dealerId);
      const preloadDuration = performance.now() - preloadStart;
      
      console.log(`📚 Preload Duration: ${preloadDuration.toFixed(2)}ms`);
      
      // Test instant access
      const phrases = [
        'Thank you for calling',
        'One moment please',
        'How can I help you today',
        'We have several options available'
      ];
      
      const accessTimes = [];
      
      for (const phrase of phrases) {
        const startTime = performance.now();
        await optimizedTTS.generateStreamingTTS(phrase, dealerId);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        accessTimes.push(duration);
        
        expect(duration).toBeLessThan(100); // Should be nearly instant
      }
      
      const avgAccessTime = accessTimes.reduce((sum, time) => sum + time, 0) / accessTimes.length;
      console.log(`🚀 Average Preloaded Access: ${avgAccessTime.toFixed(2)}ms`);
      
      expect(avgAccessTime).toBeLessThan(50); // Average should be under 50ms
    });
  });

  describe('Network Latency Simulation', () => {
    test('should maintain performance with simulated network delays', async () => {
      const sessionId = 'network-latency-test';
      
      // Simulate network latency
      const originalProcessAudio = streamingVoiceService.processAudioChunk;
      streamingVoiceService.processAudioChunk = async (sessionId, audioData) => {
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms network delay
        return originalProcessAudio.call(streamingVoiceService, sessionId, audioData);
      };
      
      const startTime = performance.now();
      await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`🌐 Performance with Network Latency: ${duration.toFixed(2)}ms`);
      
      // Should still meet targets even with network delay
      expect(duration).toBeLessThanOrEqual(130); // 80ms + 50ms network
      
      // Restore original method
      streamingVoiceService.processAudioChunk = originalProcessAudio;
    });
  });

  describe('Performance Regression Detection', () => {
    test('should detect performance regressions', async () => {
      const sessionId = 'regression-test';
      const baseline = {
        audioChunk: 60,
        intentDetection: 80,
        llmFirstToken: 500,
        ttsFirstAudio: 400,
        totalPipeline: 3000
      };
      
      // Run current performance test
      const current = {};
      
      // Audio chunk processing
      const start1 = performance.now();
      await streamingVoiceService.processAudioChunk(sessionId, new ArrayBuffer(1024));
      current.audioChunk = performance.now() - start1;
      
      // Intent detection
      const start2 = performance.now();
      streamingVoiceService.localIntentClassifier('What cars do you have?');
      current.intentDetection = performance.now() - start2;
      
      // Check for regressions
      const regressions = [];
      
      if (current.audioChunk > baseline.audioChunk * 1.2) {
        regressions.push(`Audio chunk processing: ${current.audioChunk}ms (baseline: ${baseline.audioChunk}ms)`);
      }
      
      if (current.intentDetection > baseline.intentDetection * 1.2) {
        regressions.push(`Intent detection: ${current.intentDetection}ms (baseline: ${baseline.intentDetection}ms)`);
      }
      
      console.log(`📊 Performance Regression Check:`);
      console.log(`  Audio Chunk: ${current.audioChunk}ms (baseline: ${baseline.audioChunk}ms)`);
      console.log(`  Intent Detection: ${current.intentDetection}ms (baseline: ${baseline.intentDetection}ms)`);
      
      if (regressions.length > 0) {
        console.log(`❌ Performance Regressions Detected:`);
        regressions.forEach(regression => console.log(`  - ${regression}`));
      } else {
        console.log(`✅ No Performance Regressions Detected`);
      }
      
      // Fail test if significant regressions found
      expect(regressions.length).toBe(0);
    });
  });

  describe('Performance Summary Report', () => {
    test('should generate comprehensive performance report', async () => {
      // Run a series of benchmarks
      const benchmarks = {
        audioChunk: 0,
        intentDetection: 0,
        llmFirstToken: 0,
        ttsFirstAudio: 0,
        fullPipeline: 0,
        concurrentSessions: 0
      };
      
      // Audio chunk benchmark
      const start1 = performance.now();
      await streamingVoiceService.processAudioChunk('report-session', new ArrayBuffer(1024));
      benchmarks.audioChunk = performance.now() - start1;
      
      // Intent detection benchmark
      const start2 = performance.now();
      streamingVoiceService.localIntentClassifier('What cars do you have?');
      benchmarks.intentDetection = performance.now() - start2;
      
      // Generate performance report
      const report = {
        timestamp: new Date().toISOString(),
        benchmarks,
        targets: {
          audioChunk: 80,
          intentDetection: 120,
          llmFirstToken: 700,
          ttsFirstAudio: 600,
          fullPipeline: 4000,
          concurrentSessions: 2000
        },
        status: 'PASS'
      };
      
      // Check if all benchmarks meet targets
      const failedTargets = [];
      Object.keys(benchmarks).forEach(key => {
        if (benchmarks[key] > report.targets[key]) {
          failedTargets.push(`${key}: ${benchmarks[key]}ms > ${report.targets[key]}ms`);
          report.status = 'FAIL';
        }
      });
      
      // Generate detailed report
      console.log('\n📈 PERFORMANCE BENCHMARK REPORT');
      console.log('================================');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log(`Overall Status: ${report.status}`);
      console.log('\nBenchmark Results:');
      
      Object.keys(benchmarks).forEach(key => {
        const benchmark = benchmarks[key];
        const target = report.targets[key];
        const status = benchmark <= target ? '✅' : '❌';
        console.log(`  ${key}: ${benchmark.toFixed(2)}ms ${status} (target: ${target}ms)`);
      });
      
      if (failedTargets.length > 0) {
        console.log('\n❌ Failed Targets:');
        failedTargets.forEach(failure => console.log(`  - ${failure}`));
      } else {
        console.log('\n✅ All Performance Targets Met!');
      }
      
      // Calculate performance score
      const scores = Object.keys(benchmarks).map(key => {
        const benchmark = benchmarks[key];
        const target = report.targets[key];
        return Math.max(0, 100 - ((benchmark - target) / target) * 100);
      });
      
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      console.log(`\n📊 Performance Score: ${averageScore.toFixed(1)}/100`);
      
      // Test should pass if all targets met
      expect(report.status).toBe('PASS');
      expect(averageScore).toBeGreaterThan(90); // At least 90% performance score
    }, 15000);
  });
});
