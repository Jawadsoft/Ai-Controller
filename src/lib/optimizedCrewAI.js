// Optimized CrewAI Service - Performance-focused implementation
// Target: ≤700ms first token, ≤2s total response
// Features: Collapsed routing, context caching, parallel processing

import { ChatOpenAI } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import settingsManager from './settingsManager.js';
import { pool } from '../database/connection.js';

class OptimizedCrewAI {
  constructor() {
    this.llm = null;
    this.embeddings = null;
    this.vectorStore = null;
    this.contextCache = new Map();
    this.promptCache = new Map();
    this.inventoryCache = new Map();
    this.performanceMetrics = new Map();
    
    // Performance targets
    this.targets = {
      initialization: 200,    // ms
      contextLoading: 150,    // ms
      promptBuilding: 100,    // ms
      firstToken: 700,        // ms
      totalResponse: 2000     // ms
    };
  }

  // Initialize with performance optimizations
  async initialize(dealerId = null) {
    const tStart = performance.now();
    
    try {
      // Get API keys from centralized settings
      const apiKeys = await settingsManager.getAPIKeys(dealerId);
      
      if (!apiKeys.openai) {
        throw new Error('No OpenAI API key available');
      }

      // Initialize LLM with performance-optimized settings
      this.llm = new ChatOpenAI({
        openAIApiKey: apiKeys.openai,
        modelName: 'gpt-4o-mini', // Fastest model
        temperature: 0,            // Deterministic for speed
        maxTokens: 200,            // Limited for faster response
        streaming: true,           // Enable streaming
        timeout: 10000,            // 10s timeout
        maxRetries: 1              // Minimal retries
      });

      // Initialize embeddings for context retrieval
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKeys.openai,
        modelName: 'text-embedding-3-small', // Fastest embedding model
        maxConcurrency: 5
      });

      // Initialize vector store for context
      this.vectorStore = new MemoryVectorStore(this.embeddings);

      // Pre-load dealer context
      if (dealerId) {
        await this.preloadDealerContext(dealerId);
      }

      const tEnd = performance.now();
      this.trackPerformance('initialization', tEnd - tStart);
      
      console.log(`✅ Optimized CrewAI initialized in ${(tEnd - tStart).toFixed(2)}ms`);
      
    } catch (error) {
      console.error('❌ CrewAI initialization error:', error);
      throw error;
    }
  }

  // Pre-load dealer context for faster access
  async preloadDealerContext(dealerId) {
    const tStart = performance.now();
    
    try {
      // Load dealer info, prompts, and common queries in parallel
      const [dealerInfo, prompts, commonQueries] = await Promise.all([
        this.loadDealerInfo(dealerId),
        this.loadDealerPrompts(dealerId),
        this.loadCommonQueries(dealerId)
      ]);

      // Cache context
      this.contextCache.set(dealerId, {
        dealerInfo,
        prompts,
        commonQueries,
        loadedAt: Date.now()
      });

      const tEnd = performance.now();
      this.trackPerformance('context_loading', tEnd - tStart);
      
    } catch (error) {
      console.error('Error preloading dealer context:', error);
    }
  }

  // Load dealer information
  async loadDealerInfo(dealerId) {
    try {
      const result = await pool.query(`
        SELECT id, name, location, specialties, description, 
               business_hours, contact_info, website
        FROM dealers 
        WHERE id = $1
      `, [dealerId]);
      
      return result.rows[0] || {};
    } catch (error) {
      console.error('Error loading dealer info:', error);
      return {};
    }
  }

  // Load dealer prompts
  async loadDealerPrompts(dealerId) {
    try {
      const result = await pool.query(`
        SELECT prompt_type, prompt_content, is_active
        FROM daive_prompts 
        WHERE dealer_id = $1 AND is_active = true
        ORDER BY prompt_type, created_at DESC
      `, [dealerId]);
      
      // Group prompts by type
      const prompts = {};
      result.rows.forEach(row => {
        if (!prompts[row.prompt_type]) {
          prompts[row.prompt_type] = [];
        }
        prompts[row.prompt_type].push(row.prompt_content);
      });
      
      return prompts;
    } catch (error) {
      console.error('Error loading dealer prompts:', error);
      return {};
    }
  }

  // Load common queries for context
  async loadCommonQueries(dealerId) {
    try {
      const result = await pool.query(`
        SELECT query_text, response_text, frequency
        FROM common_queries 
        WHERE dealer_id = $1 
        ORDER BY frequency DESC 
        LIMIT 20
      `, [dealerId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error loading common queries:', error);
      return [];
    }
  }

  // Process conversation with optimized pipeline
  async processConversation(userMessage, context = {}) {
    const tStart = performance.now();
    const sessionId = context.sessionId || `session_${Date.now()}`;
    
    try {
      // 1. Fast intent detection (≤120ms)
      const intent = this.detectIntentFast(userMessage);
      
      // 2. Load relevant context in parallel with LLM initialization
      const contextPromise = this.loadRelevantContext(context.dealerId, intent, userMessage);
      
      // 3. Build optimized system prompt
      const systemPrompt = await this.buildOptimizedPrompt(context.dealerId, intent, userMessage);
      
      // 4. Wait for context to load
      const relevantContext = await contextPromise;
      
      // 5. Start LLM processing with streaming
      const response = await this.generateStreamingResponse(
        systemPrompt, 
        userMessage, 
        relevantContext,
        sessionId
      );
      
      const tEnd = performance.now();
      this.trackPerformance('total_response', tEnd - tStart);
      
      return {
        response,
        intent,
        context: relevantContext,
        performance: {
          totalTime: tEnd - tStart,
          intentDetection: this.getPerformanceMetric('intent_detection'),
          contextLoading: this.getPerformanceMetric('context_loading'),
          promptBuilding: this.getPerformanceMetric('prompt_building'),
          firstToken: this.getPerformanceMetric('llm_first_token')
        }
      };
      
    } catch (error) {
      console.error('Error processing conversation:', error);
      throw error;
    }
  }

  // Fast intent detection using lightweight classifier
  detectIntentFast(text) {
    const tStart = performance.now();
    
    const t = text.toLowerCase();
    
    // Optimized regex patterns for speed
    const patterns = {
      GREET: /\b(hi|hello|hey|good\s*(morning|afternoon|evening))\b/i,
      TEST_DRIVE: /\b(test\s*drive|schedule|drive|appointment)\b/i,
      PRICE: /\b(price|cost|how\s*much|o\.?t\.?d|out\s*the\s*door|pricing)\b/i,
      FINANCE: /\b(finance|payment|loan|apr|interest\s*rate|monthly\s*payment|down\s*payment)\b/i,
      FEATURES: /\b(feature|spec|details?|safety|mpg|mileage|specifications)\b/i,
      INVENTORY: /\b(inventory|available|stock|show\s*me|what\s*do\s*you\s*have|in\s*stock)\b/i,
      ALTERNATIVES: /\b(alternative|other|options|similar|compare|different)\b/i,
      TRADE_IN: /\b(trade[\s-]*in|tradein|valuation|trade-in|appraisal)\b/i,
      HANDOFF: /\b(human|agent|representative|talk\s*to|call\s*me|speak\s*to\s*someone)\b/i,
      URGENT: /\b(urgent|asap|today|immediately|now|quick|fast)\b/i
    };
    
    // Find first matching pattern
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(t)) {
        const tEnd = performance.now();
        this.trackPerformance('intent_detection', tEnd - tStart);
        return intent;
      }
    }
    
    const tEnd = performance.now();
    this.trackPerformance('intent_detection', tEnd - tStart);
    return 'GENERAL_INQUIRY';
  }

  // Load relevant context based on intent
  async loadRelevantContext(dealerId, intent, userMessage) {
    const tStart = performance.now();
    
    try {
      // Get cached context
      const cachedContext = this.contextCache.get(dealerId);
      if (!cachedContext) {
        return {};
      }

      // Load context based on intent
      let relevantContext = {
        dealerInfo: cachedContext.dealerInfo,
        prompts: cachedContext.prompts,
        commonQueries: cachedContext.commonQueries
      };

      // Load inventory context for inventory queries
      if (intent === 'INVENTORY') {
        const inventoryContext = await this.loadInventoryContext(dealerId, userMessage);
        relevantContext.inventory = inventoryContext;
      }

      // Load pricing context for price queries
      if (intent === 'PRICE') {
        const pricingContext = await this.loadPricingContext(dealerId, userMessage);
        relevantContext.pricing = pricingContext;
      }

      const tEnd = performance.now();
      this.trackPerformance('context_loading', tEnd - tStart);
      
      return relevantContext;
      
    } catch (error) {
      console.error('Error loading relevant context:', error);
      return {};
    }
  }

  // Load inventory context
  async loadInventoryContext(dealerId, userMessage) {
    try {
      // Check cache first
      const cacheKey = `inventory_${dealerId}_${Date.now()}`;
      if (this.inventoryCache.has(cacheKey)) {
        return this.inventoryCache.get(cacheKey);
      }

      // Extract vehicle preferences from message
      const preferences = this.extractVehiclePreferences(userMessage);
      
      // Build optimized query
      let query = `
        SELECT id, make, model, year, price, mileage, fuel_type, transmission, 
               exterior_color, interior_color, status, vin
        FROM vehicles 
        WHERE dealer_id = $1 AND status = 'available'
      `;
      
      const params = [dealerId];
      let paramIndex = 2;
      
      if (preferences.make) {
        query += ` AND LOWER(make) = LOWER($${paramIndex})`;
        params.push(preferences.make);
        paramIndex++;
      }
      
      if (preferences.model) {
        query += ` AND LOWER(model) LIKE LOWER($${paramIndex})`;
        params.push(`%${preferences.model}%`);
        paramIndex++;
      }
      
      if (preferences.maxPrice) {
        query += ` AND price <= $${paramIndex}`;
        params.push(preferences.maxPrice);
        paramIndex++;
      }
      
      query += ` ORDER BY year DESC, price ASC LIMIT 10`;
      
      const result = await pool.query(query, params);
      const inventory = result.rows;
      
      // Cache for 5 minutes
      this.inventoryCache.set(cacheKey, inventory);
      setTimeout(() => this.inventoryCache.delete(cacheKey), 5 * 60 * 1000);
      
      return inventory;
      
    } catch (error) {
      console.error('Error loading inventory context:', error);
      return [];
    }
  }

  // Load pricing context
  async loadPricingContext(dealerId, userMessage) {
    try {
      // Extract price-related information
      const priceInfo = this.extractPriceInfo(userMessage);
      
      // Get dealer pricing policies
      const result = await pool.query(`
        SELECT pricing_policy, financing_options, special_offers
        FROM dealer_pricing 
        WHERE dealer_id = $1
      `, [dealerId]);
      
      return {
        priceInfo,
        dealerPricing: result.rows[0] || {},
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('Error loading pricing context:', error);
      return {};
    }
  }

  // Extract vehicle preferences from message
  extractVehiclePreferences(message) {
    const t = message.toLowerCase();
    
    const preferences = {};
    
    // Extract make
    const makeMatch = t.match(/\b(toyota|honda|ford|chevrolet|bmw|mercedes|audi|lexus|nissan|hyundai|kia|volkswagen|mazda|subaru|jeep|dodge|chrysler|ram|gmc|buick|cadillac|lincoln|infiniti|acura|volvo|jaguar|land\s*rover|porsche|ferrari|lamborghini|maserati|bentley|rolls\s*royce)\b/i);
    if (makeMatch) {
      preferences.make = makeMatch[1];
    }
    
    // Extract model
    const modelMatch = t.match(/\b(camry|accord|civic|corolla|f-150|silverado|3\s*series|5\s*series|a4|a6|es|rx|altima|sonata|optima|passat|golf|cx-5|outback|wrangler|grand\s*cherokee|durango|ram\s*1500|sierra|enclave|xt5|escalade|navigator|q50|q60|tlx|rdx|s60|s90|xe|xf|range\s*rover|911|cayenne|488|huracan|ghibli|continental|phantom)\b/i);
    if (modelMatch) {
      preferences.model = modelMatch[1];
    }
    
    // Extract price range
    const priceMatch = t.match(/\b(\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?))\s*(?:to\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?))?\b/);
    if (priceMatch) {
      preferences.maxPrice = parseFloat(priceMatch[2].replace(/,/g, ''));
      if (priceMatch[3]) {
        preferences.minPrice = parseFloat(priceMatch[3].replace(/,/g, ''));
      }
    }
    
    // Extract vehicle type
    if (/\b(suv|crossover|truck|sedan|hatchback|wagon|coupe|convertible|minivan|van)\b/i.test(t)) {
      preferences.type = t.match(/\b(suv|crossover|truck|sedan|hatchback|wagon|coupe|convertible|minivan|van)\b/i)[1];
    }
    
    return preferences;
  }

  // Extract price information
  extractPriceInfo(message) {
    const t = message.toLowerCase();
    
    const priceInfo = {};
    
    // Extract specific price - improved to handle k suffix and larger numbers
    const specificPrice = t.match(/\b\$?(\d{1,3}(?:,\d{3})*(?:k|000)?(?:\.\d{2})?)\b/);
    if (specificPrice) {
      let priceStr = specificPrice[1].replace(/,/g, '');
      if (priceStr.includes('k')) {
        priceInfo.specificPrice = parseFloat(priceStr.replace('k', '')) * 1000;
      } else {
        priceInfo.specificPrice = parseFloat(priceStr);
      }
      console.log(`💰 OptimizedCrewAI - Extracted specific price: $${priceInfo.specificPrice.toLocaleString()}`);
    }
    
    // Extract price range - improved to handle k suffix
    const priceRange = t.match(/\b(\$?(\d{1,3}(?:,\d{3})*(?:k|000)?(?:\.\d{2})?))\s*(?:to\s*\$?(\d{1,3}(?:,\d{3})*(?:k|000)?(?:\.\d{2})?))\b/);
    if (priceRange) {
      let minPriceStr = priceRange[2].replace(/,/g, '');
      let maxPriceStr = priceRange[3].replace(/,/g, '');
      
      if (minPriceStr.includes('k')) {
        priceInfo.minPrice = parseFloat(minPriceStr.replace('k', '')) * 1000;
      } else {
        priceInfo.minPrice = parseFloat(minPriceStr);
      }
      
      if (maxPriceStr.includes('k')) {
        priceInfo.maxPrice = parseFloat(maxPriceStr.replace('k', '')) * 1000;
      } else {
        priceInfo.maxPrice = parseFloat(maxPriceStr);
      }
      
      console.log(`💰 OptimizedCrewAI - Extracted price range: $${priceInfo.minPrice.toLocaleString()} to $${priceInfo.maxPrice.toLocaleString()}`);
    }
    
    // Extract payment terms
    if (/\b(monthly|weekly|bi-weekly|annual|yearly)\b/i.test(t)) {
      priceInfo.paymentFrequency = t.match(/\b(monthly|weekly|bi-weekly|annual|yearly)\b/i)[1];
    }
    
    return priceInfo;
  }

  // Build optimized system prompt
  async buildOptimizedPrompt(dealerId, intent, userMessage) {
    const tStart = performance.now();
    
    try {
      // Check cache first
      const cacheKey = `prompt_${dealerId}_${intent}`;
      if (this.promptCache.has(cacheKey)) {
        const tEnd = performance.now();
        this.trackPerformance('prompt_building', tEnd - tStart);
        return this.promptCache.get(cacheKey);
      }

      // Get cached context
      const context = this.contextCache.get(dealerId);
      if (!context) {
        throw new Error('Dealer context not loaded');
      }

      // Build concise, focused prompt
      let prompt = `You are a helpful car dealership AI assistant for ${context.dealerInfo.name || 'our dealership'}.
Location: ${context.dealerInfo.location || 'Unknown'}
Specialties: ${context.dealerInfo.specialties?.join(', ') || 'General automotive'}

Current Intent: ${intent}
User Message: "${userMessage}"

Instructions:
- Keep responses under 200 words for speed
- Be helpful, professional, and conversational
- Focus on the specific intent (${intent})
- Use dealer-specific information when available
- Provide actionable next steps`;

      // Add intent-specific instructions
      switch (intent) {
        case 'INVENTORY':
          prompt += `\n\nFor inventory queries:
- Mention available vehicles that match user preferences
- Highlight key features and pricing
- Offer to show more options or schedule a viewing`;
          break;
        case 'PRICE':
          prompt += `\n\nFor pricing queries:
- Be transparent about pricing
- Mention any current specials or financing options
- Offer to provide detailed quote`;
          break;
        case 'TEST_DRIVE':
          prompt += `\n\nFor test drive requests:
- Confirm availability and scheduling process
- Mention required documents
- Offer to check current availability`;
          break;
        case 'FINANCE':
          prompt += `\n\nFor financing queries:
- Mention available financing options
- Highlight competitive rates
- Offer to connect with finance team`;
          break;
      }

      // Add dealer-specific prompts if available
      if (context.prompts[intent.toLowerCase()]) {
        prompt += `\n\nDealer-specific guidance: ${context.prompts[intent.toLowerCase()][0]}`;
      }

      // Cache the prompt
      this.promptCache.set(cacheKey, prompt);
      
      const tEnd = performance.now();
      this.trackPerformance('prompt_building', tEnd - tStart);
      
      return prompt;
      
    } catch (error) {
      console.error('Error building prompt:', error);
      return 'You are a helpful car dealership AI assistant. Keep responses concise and professional.';
    }
  }

  // Generate streaming response
  async generateStreamingResponse(systemPrompt, userMessage, context, sessionId) {
    const tStart = performance.now();
    
    try {
      // Prepare messages
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      // Add relevant context if available
      if (context.inventory && context.inventory.length > 0) {
        const inventorySummary = this.summarizeInventory(context.inventory);
        messages.push({
          role: 'system',
          content: `Available Inventory: ${inventorySummary}`
        });
      }

      // Start streaming response
      const stream = await this.llm.stream(messages);
      
      let responseText = '';
      let firstTokenReceived = false;
      
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          responseText += content;
          
          // Track first token timing
          if (!firstTokenReceived) {
            const tFirstToken = performance.now();
            this.trackPerformance('llm_first_token', tFirstToken - tStart);
            firstTokenReceived = true;
          }
        }
      }

      return responseText;
      
    } catch (error) {
      console.error('Error generating streaming response:', error);
      throw error;
    }
  }

  // Summarize inventory for prompt context
  summarizeInventory(inventory) {
    if (!inventory || inventory.length === 0) return 'No vehicles currently available.';
    
    const summary = inventory.slice(0, 5).map(vehicle => 
      `${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price?.toLocaleString() || 'N/A'}`
    ).join(', ');
    
    if (inventory.length > 5) {
      summary += ` and ${inventory.length - 5} more vehicles`;
    }
    
    return summary;
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
    console.log(`📊 CrewAI ${metric}: ${value.toFixed(2)}ms`);
    
    // Check against targets
    const target = this.targets[metric] || 1000;
    if (value > target) {
      console.warn(`⚠️ CrewAI ${metric} exceeded target: ${value.toFixed(2)}ms > ${target}ms`);
    }
  }

  // Get performance metric
  getPerformanceMetric(metric) {
    const metrics = this.performanceMetrics.get(metric);
    if (!metrics || metrics.length === 0) return 0;
    
    // Return average of last 10 measurements
    const recentMetrics = metrics.slice(-10);
    const sum = recentMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / recentMetrics.length;
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {};
    
    for (const [metric, measurements] of this.performanceMetrics.entries()) {
      if (measurements.length > 0) {
        const values = measurements.map(m => m.value);
        summary[metric] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    }
    
    return summary;
  }

  // Clear performance metrics
  clearPerformanceMetrics() {
    this.performanceMetrics.clear();
  }

  // Clear caches
  clearCaches() {
    this.contextCache.clear();
    this.promptCache.clear();
    this.inventoryCache.clear();
  }
}

export default OptimizedCrewAI;
