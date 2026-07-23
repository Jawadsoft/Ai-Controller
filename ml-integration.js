// 🚀 ML Integration for CrewAI - Fast & Accurate Intent Detection
// This module integrates trained ML models with your existing CrewAI system

class MLIntentDetector {
  constructor(options = {}) {
    this.providers = new Map();
    this.fallbackThreshold = options.fallbackThreshold || 0.7;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 30000; // 30 seconds
    this.maxCacheSize = options.maxCacheSize || 1000;
    
    // Performance monitoring
    this.stats = {
      totalRequests: 0,
      mlHits: 0,
      fallbacks: 0,
      avgResponseTime: 0,
      cacheHits: 0
    };
  }

  // Add ML provider (Rasa, Dialogflow, etc.)
  addProvider(name, provider) {
    this.providers.set(name, provider);
    console.log(`🤖 ML Provider '${name}' added to intent detection system`);
  }

  // Fast intent detection with ML + fallback
  async detectIntent(message, context = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Check cache first (fastest response)
      const cacheKey = this.generateCacheKey(message, context);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.stats.cacheHits++;
        return cachedResult;
      }

      // Try ML providers first (highest accuracy)
      for (const [providerName, provider] of this.providers) {
        try {
          const mlResult = await this.callProvider(provider, message, context);
          
          if (mlResult && mlResult.confidence >= this.fallbackThreshold) {
            this.stats.mlHits++;
            const finalResult = this.processMLResult(mlResult, providerName);
            
            // Cache the result for future fast access
            this.setCache(cacheKey, finalResult);
            
            // Update performance stats
            const responseTime = Date.now() - startTime;
            this.updatePerformanceStats(responseTime);
            
            console.log(`🤖 ML Provider '${providerName}' detected intent: ${finalResult.intent} (confidence: ${mlResult.confidence}, time: ${responseTime}ms)`);
            
            return finalResult;
          }
        } catch (error) {
          console.warn(`⚠️ ML Provider '${providerName}' failed:`, error.message);
          continue; // Try next provider
        }
      }

      // ML failed or low confidence - use CrewAI fallback
      this.stats.fallbacks++;
      const fallbackResult = await this.crewAIFallback(message, context);
      
      // Cache fallback result too
      this.setCache(cacheKey, fallbackResult);
      
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime);
      
      console.log(`🔄 CrewAI fallback used for intent: ${fallbackResult.intent} (time: ${responseTime}ms)`);
      
      return fallbackResult;

    } catch (error) {
      console.error('❌ Intent detection failed:', error);
      return this.createErrorResult(error);
    }
  }

  // Call specific ML provider
  async callProvider(provider, message, context) {
    if (typeof provider.detectIntent === 'function') {
      return await provider.detectIntent(message, context);
    } else if (typeof provider.getIntentWithConfidence === 'function') {
      return await provider.getIntentWithConfidence(message, this.fallbackThreshold);
    } else {
      throw new Error('Invalid ML provider interface');
    }
  }

  // Process ML result and map to CrewAI intents
  processMLResult(mlResult, providerName) {
    // Map ML intents to your internal CrewAI system
    const intentMapping = {
      // Rasa/Dialogflow intents → CrewAI intents
      'buy_car': 'purchase',
      'car_type_preference': 'car_type',
      'budget_inquiry': 'budget',
      'financing_options': 'financing',
      'feature_request': 'features',
      'car_comparison': 'comparison',
      'check_availability': 'availability',
      'ask_discounts': 'discounts',
      'after_sales': 'after_sales',
      'purchase_commitment': 'purchase_commitment'
    };

    const mappedIntent = intentMapping[mlResult.intent] || mlResult.intent;
    
    return {
      intent: mappedIntent,
      confidence: mlResult.confidence,
      provider: providerName,
      method: 'ml',
      entities: mlResult.entities || [],
      raw: mlResult,
      timestamp: Date.now()
    };
  }

  // CrewAI fallback when ML fails
  async crewAIFallback(message, context) {
    // This will be replaced by your existing CrewAI logic
    // For now, return a basic result
    return {
      intent: 'general_inquiry',
      confidence: 0.5,
      provider: 'crewai',
      method: 'fallback',
      entities: [],
      timestamp: Date.now()
    };
  }

  // Cache management for fast responses
  generateCacheKey(message, context) {
    const normalizedMessage = message.toLowerCase().trim();
    const contextHash = JSON.stringify(context);
    return `${normalizedMessage}:${contextHash}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    if (cached) {
      this.cache.delete(key); // Expired
    }
    
    return null;
  }

  setCache(key, result) {
    // Clean cache if it's too large
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      result: result,
      timestamp: Date.now()
    });
  }

  // Performance monitoring
  updatePerformanceStats(responseTime) {
    const currentAvg = this.stats.avgResponseTime;
    const totalRequests = this.stats.totalRequests;
    
    this.stats.avgResponseTime = (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
  }

  // Get performance statistics
  getStats() {
    const mlAccuracy = this.stats.totalRequests > 0 ? 
      (this.stats.mlHits / this.stats.totalRequests * 100).toFixed(1) : 0;
    
    const fallbackRate = this.stats.totalRequests > 0 ? 
      (this.stats.fallbacks / this.stats.totalRequests * 100).toFixed(1) : 0;
    
    const cacheHitRate = this.stats.totalRequests > 0 ? 
      (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1) : 0;

    return {
      totalRequests: this.stats.totalRequests,
      mlAccuracy: `${mlAccuracy}%`,
      fallbackRate: `${fallbackRate}%`,
      cacheHitRate: `${cacheHitRate}%`,
      avgResponseTime: `${this.stats.avgResponseTime.toFixed(1)}ms`,
      cacheSize: this.cache.size,
      providers: Array.from(this.providers.keys())
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('🧹 ML intent detection cache cleared');
  }

  // Create error result
  createErrorResult(error) {
    return {
      intent: 'error',
      confidence: 0,
      provider: 'error',
      method: 'error',
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// Rasa Provider Implementation
class RasaProvider {
  constructor(rasaUrl = 'http://localhost:5005') {
    this.rasaUrl = rasaUrl;
    this.endpoint = `${rasaUrl}/model/parse`;
    this.timeout = 2000; // 2 second timeout for fast responses
  }

  async detectIntent(message, context = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: message }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Rasa API error: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        intent: result.intent.name,
        confidence: result.intent.confidence,
        entities: result.entities || [],
        raw: result
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Rasa request timeout');
      }
      throw error;
    }
  }

  async getIntentWithConfidence(message, minConfidence = 0.7) {
    const result = await this.detectIntent(message);
    
    if (result && result.confidence >= minConfidence) {
      return result;
    }
    
    return null;
  }
}

// Dialogflow Provider Implementation
class DialogflowProvider {
  constructor(projectId, credentials) {
    this.projectId = projectId;
    this.credentials = credentials;
    this.sessionClient = null;
    this.initialize();
  }

  async initialize() {
    try {
      const { SessionsClient } = require('@google-cloud/dialogflow');
      this.sessionClient = new SessionsClient({
        credentials: this.credentials
      });
      console.log('✅ Dialogflow provider initialized');
    } catch (error) {
      console.warn('⚠️ Dialogflow provider not available:', error.message);
    }
  }

  async detectIntent(message, context = {}) {
    if (!this.sessionClient) {
      throw new Error('Dialogflow not initialized');
    }

    try {
      const sessionId = context.sessionId || 'default';
      const sessionPath = this.sessionClient.projectAgentSessionPath(this.projectId, sessionId);
      
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: message,
            languageCode: 'en-US',
          },
        },
      };

      const responses = await this.sessionClient.detectIntent(request);
      const result = responses[0].queryResult;
      
      return {
        intent: result.intent.displayName,
        confidence: result.intentDetectionConfidence || 0.8,
        entities: result.parameters || {},
        raw: result
      };
    } catch (error) {
      throw new Error(`Dialogflow error: ${error.message}`);
    }
  }
}

// Export for use in daivecrewai.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    MLIntentDetector, 
    RasaProvider, 
    DialogflowProvider 
  };
}
