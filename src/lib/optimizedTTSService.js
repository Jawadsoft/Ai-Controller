// Optimized TTS Service - Streaming audio generation with caching
// Target: ≤600ms first audio, streaming playback
// Features: Sentence-level streaming, intelligent caching, parallel processing

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import settingsManager from './settingsManager.js';

class OptimizedTTSService extends EventEmitter {
  constructor() {
    super();
    this.ttsCache = new Map();
    this.audioBuffer = new Map();
    this.processingQueue = new Map();
    this.performanceMetrics = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Performance targets
    this.targets = {
      cacheLookup: 10,       // ms
      ttsGeneration: 600,     // ms
      audioStreaming: 200,    // ms
      totalResponse: 800      // ms
    };
    
    // Cache settings
    this.cacheSettings = {
      maxSize: 1000,          // Maximum cached items
      ttl: 30 * 60 * 1000,   // 30 minutes TTL
      cleanupInterval: 5 * 60 * 1000 // 5 minutes cleanup
    };
    
    // Start cache cleanup
    this.startCacheCleanup();
  }

  // Generate streaming TTS response
  async generateStreamingTTS(text, dealerId = null, options = {}) {
    const tStart = performance.now();
    const sessionId = options.sessionId || `tts_${Date.now()}`;
    
    try {
      // 1. Check cache first (≤10ms)
      const cacheKey = this.generateCacheKey(text, dealerId);
      const cachedAudio = this.getCachedAudio(cacheKey);
      
      if (cachedAudio) {
        this.trackPerformance('cache_hit', performance.now() - tStart);
        this.emit('audio_ready', { sessionId, audio: cachedAudio, fromCache: true });
        return { sessionId, fromCache: true, audio: cachedAudio };
      }
      
      // 2. Get TTS settings
      const ttsSettings = await settingsManager.getTTSSettings(dealerId);
      const apiKeys = await settingsManager.getAPIKeys(dealerId);
      
      // 3. Split text into sentences for streaming
      const sentences = this.splitIntoSentences(text);
      
      // 4. Start streaming TTS generation
      const streamResult = await this.streamTTSGeneration(
        sentences, 
        ttsSettings, 
        apiKeys, 
        sessionId,
        options
      );
      
      // 5. Cache the result
      this.cacheAudio(cacheKey, streamResult.audio);
      
      const tEnd = performance.now();
      this.trackPerformance('total_tts', tEnd - tStart);
      
      return { sessionId, fromCache: false, audio: streamResult.audio };
      
    } catch (error) {
      console.error('TTS generation error:', error);
      this.emit('error', { sessionId, error: error.message });
      throw error;
    }
  }

  // Stream TTS generation sentence by sentence
  async streamTTSGeneration(sentences, ttsSettings, apiKeys, sessionId, options) {
    const tStart = performance.now();
    const audioChunks = [];
    
    try {
      // Determine TTS provider
      const provider = ttsSettings.ttsProvider || 'elevenlabs';
      
      // Process sentences in parallel for speed
      const sentencePromises = sentences.map(async (sentence, index) => {
        if (!sentence.trim()) return null;
        
        const sentenceStart = performance.now();
        
        try {
          let audioBuffer;
          
          switch (provider) {
            case 'elevenlabs':
              audioBuffer = await this.generateElevenLabsAudio(sentence, ttsSettings, apiKeys.elevenlabs);
              break;
            case 'openai':
              audioBuffer = await this.generateOpenAIAudio(sentence, ttsSettings, apiKeys.openai);
              break;
            case 'deepgram':
              audioBuffer = await this.generateDeepgramAudio(sentence, ttsSettings, apiKeys.deepgram);
              break;
            default:
              audioBuffer = await this.generateElevenLabsAudio(sentence, ttsSettings, apiKeys.elevenlabs);
          }
          
          if (audioBuffer) {
            // Emit sentence audio as it's ready
            this.emit('sentence_audio', {
              sessionId,
              sentenceIndex: index,
              sentence,
              audio: audioBuffer,
              timestamp: Date.now()
            });
            
            // Track sentence performance
            const sentenceEnd = performance.now();
            this.trackPerformance('sentence_tts', sentenceEnd - sentenceStart);
            
            return { index, audio: audioBuffer, sentence };
          }
          
        } catch (error) {
          console.error(`Error generating audio for sentence ${index}:`, error);
          return null;
        }
      });
      
      // Wait for all sentences to complete
      const results = await Promise.all(sentencePromises);
      
      // Combine audio chunks in order
      const orderedResults = results
        .filter(r => r !== null)
        .sort((a, b) => a.index - b.index);
      
      // Merge audio buffers
      const finalAudio = this.mergeAudioBuffers(
        orderedResults.map(r => r.audio)
      );
      
      // Emit completion
      this.emit('tts_complete', {
        sessionId,
        audio: finalAudio,
        sentenceCount: sentences.length,
        totalTime: performance.now() - tStart
      });
      
      return { audio: finalAudio, sentences: orderedResults };
      
    } catch (error) {
      console.error('Streaming TTS generation error:', error);
      throw error;
    }
  }

  // Generate ElevenLabs audio
  async generateElevenLabsAudio(text, ttsSettings, apiKey) {
    try {
      const voiceId = this.getElevenLabsVoiceId(ttsSettings.voice || 'mark');
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: ttsSettings.model || 'eleven_multilingual_v2',
          voice_settings: {
            stability: ttsSettings.stability || 0.5,
            similarity_boost: ttsSettings.similarityBoost || 0.5
          },
          output_format: 'mp3_44100_128'
        })
      });
      
      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
      
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  // Generate OpenAI audio
  async generateOpenAIAudio(text, ttsSettings, apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text.trim(),
          voice: ttsSettings.voice || 'alloy',
          response_format: 'mp3'
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI TTS API error: ${response.status}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
      
    } catch (error) {
      console.error('OpenAI TTS error:', error);
      throw error;
    }
  }

  // Generate Deepgram audio
  async generateDeepgramAudio(text, ttsSettings, apiKey) {
    try {
      const response = await fetch('https://api.deepgram.com/v1/speak', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text.trim(),
          model: ttsSettings.model || 'aura-asteria',
          voice: ttsSettings.voice || 'asteria',
          encoding: 'mp3',
          container: 'mp3',
          sample_rate: 24000
        })
      });
      
      if (!response.ok) {
        throw new Error(`Deepgram TTS API error: ${response.status}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer);
      
    } catch (error) {
      console.error('Deepgram TTS error:', error);
      throw error;
    }
  }

  // Split text into sentences for streaming
  splitIntoSentences(text) {
    // Split by sentence endings, but preserve abbreviations
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    // Filter out empty sentences and clean up
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => this.cleanSentence(s));
  }

  // Clean sentence for TTS
  cleanSentence(sentence) {
    return sentence
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\w\s.,!?;:()'-]/g, '') // Remove special characters
      .trim();
  }

  // Merge audio buffers into single audio
  mergeAudioBuffers(buffers) {
    if (buffers.length === 0) return Buffer.alloc(0);
    if (buffers.length === 1) return buffers[0];
    
    // For MP3, we need to concatenate the buffers
    // This is a simplified approach - in production, you might want to use a proper audio library
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const merged = Buffer.alloc(totalLength);
    
    let offset = 0;
    for (const buffer of buffers) {
      buffer.copy(merged, offset);
      offset += buffer.length;
    }
    
    return merged;
  }

  // Get ElevenLabs voice ID
  getElevenLabsVoiceId(voiceName) {
    const voiceMap = {
      'mark': 'UgBBYS2sOqTuMpoF3BR0',
      'liam': 'wUwsnXivqGrDWuz1Fc89',
      'jessica': 'cgSgspJ2msm6clMCkdW9',
      'rachel': '21m00Tcm4TlvDq8ikWAM',
      'default': 'UgBBYS2sOqTuMpoF3BR0'
    };
    
    return voiceMap[voiceName.toLowerCase()] || voiceMap.default;
  }

  // Cache management
  generateCacheKey(text, dealerId) {
    const normalizedText = text.toLowerCase().trim().replace(/\s+/g, '_');
    const dealer = dealerId || 'global';
    return `${dealer}_${normalizedText.substring(0, 100)}`;
  }

  // Get cached audio
  getCachedAudio(cacheKey) {
    const tStart = performance.now();
    
    if (this.ttsCache.has(cacheKey)) {
      const cached = this.ttsCache.get(cacheKey);
      
      // Check if cache is still valid
      if (Date.now() - cached.timestamp < this.cacheSettings.ttl) {
        this.cacheHits++;
        const tEnd = performance.now();
        this.trackPerformance('cache_lookup', tEnd - tStart);
        return cached.audio;
      } else {
        // Remove expired cache
        this.ttsCache.delete(cacheKey);
      }
    }
    
    this.cacheMisses++;
    const tEnd = performance.now();
    this.trackPerformance('cache_lookup', tEnd - tStart);
    return null;
  }

  // Cache audio
  cacheAudio(cacheKey, audio) {
    // Check cache size limit
    if (this.ttsCache.size >= this.cacheSettings.maxSize) {
      // Remove oldest entries
      const oldestKeys = Array.from(this.ttsCache.keys())
        .sort((a, b) => this.ttsCache.get(a).timestamp - this.ttsCache.get(b).timestamp)
        .slice(0, Math.floor(this.cacheSettings.maxSize * 0.2)); // Remove 20% oldest
      
      oldestKeys.forEach(key => this.ttsCache.delete(key));
    }
    
    // Add to cache
    this.ttsCache.set(cacheKey, {
      audio,
      timestamp: Date.now()
    });
  }

  // Start cache cleanup
  startCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.cacheSettings.cleanupInterval);
  }

  // Cleanup expired cache entries
  cleanupExpiredCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of this.ttsCache.entries()) {
      if (now - value.timestamp > this.cacheSettings.ttl) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.ttsCache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired TTS cache entries`);
    }
  }

  // Pre-generate common phrases
  async pregenerateCommonPhrases(dealerId) {
    const commonPhrases = [
      "Hello, how can I help you today?",
      "Thank you for your interest.",
      "Let me check that for you.",
      "I'd be happy to help with that.",
      "Is there anything else you'd like to know?",
      "Please let me know if you have any questions.",
      "I'll get back to you shortly.",
      "Thank you for contacting us."
    ];
    
    console.log('🔄 Pre-generating common TTS phrases...');
    
    const ttsSettings = await settingsManager.getTTSSettings(dealerId);
    const apiKeys = await settingsManager.getAPIKeys(dealerId);
    
    for (const phrase of commonPhrases) {
      try {
        const cacheKey = this.generateCacheKey(phrase, dealerId);
        
        // Skip if already cached
        if (this.getCachedAudio(cacheKey)) continue;
        
        // Generate audio for phrase
        let audioBuffer;
        const provider = ttsSettings.ttsProvider || 'elevenlabs';
        
        switch (provider) {
          case 'elevenlabs':
            audioBuffer = await this.generateElevenLabsAudio(phrase, ttsSettings, apiKeys.elevenlabs);
            break;
          case 'openai':
            audioBuffer = await this.generateOpenAIAudio(phrase, ttsSettings, apiKeys.openai);
            break;
          case 'deepgram':
            audioBuffer = await this.generateDeepgramAudio(phrase, ttsSettings, apiKeys.deepgram);
            break;
        }
        
        if (audioBuffer) {
          this.cacheAudio(cacheKey, audioBuffer);
          console.log(`✅ Pre-generated TTS for: "${phrase}"`);
        }
        
      } catch (error) {
        console.error(`Error pre-generating TTS for "${phrase}":`, error);
      }
    }
    
    console.log('✅ Common TTS phrases pre-generation complete');
  }

  // Track performance metrics
  trackPerformance(metric, value) {
    if (!this.performanceMetrics.has(metric)) {
      this.performanceMetrics.set(metric, []);
    }
    
    const metrics = this.performanceMetrics.get(metric);
    metrics.push({
      value,
      timestamp: Date.now()
    });
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    // Log performance data
    console.log(`📊 TTS ${metric}: ${value.toFixed(2)}ms`);
    
    // Check against targets
    const target = this.targets[metric] || 1000;
    if (value > target) {
      console.warn(`⚠️ TTS ${metric} exceeded target: ${value.toFixed(2)}ms > ${target}ms`);
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {
      cacheStats: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
      },
      cacheSize: this.ttsCache.size,
      performance: {}
    };
    
    for (const [metric, measurements] of this.performanceMetrics.entries()) {
      if (measurements.length > 0) {
        const values = measurements.map(m => m.value);
        summary.performance[metric] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    }
    
    return summary;
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.ttsCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      maxSize: this.cacheSettings.maxSize,
      ttl: this.cacheSettings.ttl
    };
  }

  // Clear cache
  clearCache() {
    this.ttsCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('🧹 TTS cache cleared');
  }

  // Clear performance metrics
  clearPerformanceMetrics() {
    this.performanceMetrics.clear();
  }
}

export default OptimizedTTSService;
