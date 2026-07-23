// Test Setup for Streaming Voice Pipeline
// Configures testing environment and global test utilities

import { jest } from '@jest/globals';

// Global test configuration
global.testConfig = {
  performanceTesting: true,
  benchmarkMode: true,
  mockExternalServices: true,
  enableLogging: false
};

// Performance measurement utilities
global.performanceUtils = {
  // Measure execution time of async functions
  async measureAsync(fn, label = 'Function') {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      const duration = end - start;
      
      if (global.testConfig.enableLogging) {
        console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
      }
      
      return { result, duration };
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      
      if (global.testConfig.enableLogging) {
        console.log(`❌ ${label} failed after ${duration.toFixed(2)}ms:`, error.message);
      }
      
      throw error;
    }
  },

  // Measure execution time of sync functions
  measureSync(fn, label = 'Function') {
    const start = performance.now();
    try {
      const result = fn();
      const end = performance.now();
      const duration = end - start;
      
      if (global.testConfig.enableLogging) {
        console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
      }
      
      return { result, duration };
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      
      if (global.testConfig.enableLogging) {
        console.log(`❌ ${label} failed after ${duration.toFixed(2)}ms:`, error.message);
      }
      
      throw error;
    }
  },

  // Generate test data for performance testing
  generateTestData(size = 1024) {
    return {
      audioChunk: new ArrayBuffer(size),
      text: 'This is a test message for performance benchmarking.',
      sessionId: `test-session-${Date.now()}`,
      dealerId: 'test-dealer-123'
    };
  },

  // Simulate network latency
  simulateLatency(delay = 50) {
    return new Promise(resolve => setTimeout(resolve, delay));
  },

  // Generate random test phrases
  generateTestPhrases(count = 10) {
    const phrases = [
      'What cars do you have in stock?',
      'What are your current prices?',
      'Do you offer financing options?',
      'What are your business hours?',
      'Can you help me find a specific vehicle?',
      'Do you have any special offers?',
      'What is your return policy?',
      'Can you provide a test drive?',
      'What warranty do you offer?',
      'Do you have certified pre-owned vehicles?'
    ];
    
    return phrases.slice(0, count);
  }
};

// Mock utilities for testing
global.mockUtils = {
  // Create mock audio data
  createMockAudioData(format = 'wav', duration = 1000) {
    const sampleRate = 16000;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const samples = (sampleRate * duration) / 1000;
    const dataSize = samples * channels * bytesPerSample;
    
    const buffer = new ArrayBuffer(dataSize);
    const view = new DataView(buffer);
    
    // Generate simple sine wave
    for (let i = 0; i < samples; i++) {
      const value = Math.sin((i / sampleRate) * 2 * Math.PI * 440) * 0.5;
      const sample = Math.round(value * 32767);
      view.setInt16(i * bytesPerSample, sample, true);
    }
    
    return buffer;
  },

  // Create mock TTS response
  createMockTTSResponse(text, format = 'mp3') {
    return {
      audio: new ArrayBuffer(1024),
      format,
      duration: text.length * 50, // Rough estimate
      text,
      timestamp: Date.now()
    };
  },

  // Create mock CrewAI response
  createMockCrewAIResponse(userMessage, intent = 'general_inquiry') {
    return {
      response: `Thank you for your inquiry about "${userMessage}". I'd be happy to help you with that.`,
      intent,
      confidence: 0.95,
      suggestedActions: ['provide_information', 'ask_follow_up'],
      timestamp: Date.now()
    };
  },

  // Create mock performance metrics
  createMockPerformanceMetrics() {
    return {
      t_first_partial: Math.random() * 500 + 100,
      t_first_token: Math.random() * 700 + 200,
      t_first_audio: Math.random() * 600 + 300,
      t_play_start: Math.random() * 200 + 100,
      t_end: Math.random() * 1000 + 500
    };
  }
};

// Test assertion utilities
global.assertPerformance = {
  // Assert that a duration meets performance targets
  meetsTarget(duration, target, component) {
    if (duration > target) {
      throw new Error(
        `Performance target not met for ${component}: ${duration.toFixed(2)}ms > ${target}ms`
      );
    }
  },

  // Assert that cached response is significantly faster
  cacheSpeedup(coldDuration, cachedDuration, minSpeedup = 5) {
    const speedup = coldDuration / cachedDuration;
    if (speedup < minSpeedup) {
      throw new Error(
        `Cache speedup insufficient: ${speedup.toFixed(2)}x < ${minSpeedup}x`
      );
    }
  },

  // Assert that concurrent operations are efficient
  concurrentEfficiency(totalDuration, sessionCount, maxTotalDuration) {
    if (totalDuration > maxTotalDuration) {
      throw new Error(
        `Concurrent efficiency insufficient: ${totalDuration.toFixed(2)}ms for ${sessionCount} sessions > ${maxTotalDuration}ms`
      );
    }
  }
};

// Global test helpers
global.testHelpers = {
  // Wait for a condition to be true
  async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Retry a function with exponential backoff
  async retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  },

  // Generate unique test IDs
  generateTestId(prefix = 'test') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Clean up test resources
  async cleanup(testId) {
    // Cleanup logic here
    if (global.testConfig.enableLogging) {
      console.log(`🧹 Cleaning up test: ${testId}`);
    }
  }
};

// Performance monitoring
global.performanceMonitor = {
  metrics: new Map(),
  
  start(label) {
    this.metrics.set(label, { start: performance.now() });
  },
  
  end(label) {
    const metric = this.metrics.get(label);
    if (metric) {
      metric.end = performance.now();
      metric.duration = metric.end - metric.start;
      this.metrics.set(label, metric);
    }
  },
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  },
  
  clear() {
    this.metrics.clear();
  }
};

// Setup console logging for tests
if (global.testConfig.enableLogging) {
  console.log('🧪 Test environment configured for streaming voice pipeline');
  console.log('📊 Performance testing enabled');
  console.log('🎯 Benchmark mode active');
}

// Global test timeout
jest.setTimeout(30000);

// Suppress console warnings in tests (unless explicitly enabled)
if (!global.testConfig.enableLogging) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Only show warnings for actual test failures
    if (args[0] && typeof args[0] === 'string' && args[0].includes('test')) {
      originalWarn(...args);
    }
  };
}

export default global.testConfig;
