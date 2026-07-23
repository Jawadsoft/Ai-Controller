// 🚀 CrewAI + ML Integration - Seamless Agent Routing
// This script integrates ML intent detection with your existing CrewAI agents

import { MLIntentDetector, RasaProvider } from './ml-integration.js';

class CrewAIMLIntegration {
  constructor(options = {}) {
    this.mlDetector = new MLIntentDetector({
      fallbackThreshold: 0.7,
      cacheTimeout: 30000, // 30 seconds
      maxCacheSize: 1000
    });
    
    this.agents = new Map();
    this.agentCapabilities = new Map();
    this.responseCache = new Map();
    this.cacheTimeout = options.responseCacheTimeout || 60000; // 1 minute
    
    // Performance tracking
    this.performance = {
      totalRequests: 0,
      mlResponses: 0,
      crewAIResponses: 0,
      avgResponseTime: 0,
      agentUsage: new Map()
    };
    
    this.initialize();
  }

  // Initialize ML providers and agent mapping
  async initialize() {
    console.log('🚀 Initializing CrewAI + ML Integration...');
    
    // Add ML providers (Rasa, Dialogflow, etc.)
    try {
      // Rasa provider (most common)
      const rasaProvider = new RasaProvider('http://localhost:5005');
      this.mlDetector.addProvider('rasa', rasaProvider);
      console.log('✅ Rasa ML provider added');
    } catch (error) {
      console.warn('⚠️ Rasa provider not available:', error.message);
    }

    // Initialize agent capabilities
    this.initializeAgentCapabilities();
    
    console.log('✅ CrewAI + ML Integration initialized');
  }

  // Define agent capabilities and specializations
  initializeAgentCapabilities() {
    this.agentCapabilities.set('Sales Consultant', {
      intents: ['purchase', 'car_type', 'budget', 'purchase_commitment'],
      expertise: ['sales process', 'customer guidance', 'deal closing'],
      responseStyle: 'professional, step-by-step, one question at a time'
    });

    this.agentCapabilities.set('Product Specialist', {
      intents: ['features', 'comparison', 'availability'],
      expertise: ['vehicle specifications', 'feature comparison', 'inventory knowledge'],
      responseStyle: 'technical, detailed, feature-focused'
    });

    this.agentCapabilities.set('Finance & Insurance Manager', {
      intents: ['financing', 'discounts'],
      expertise: ['loan options', 'payment plans', 'promotions', 'insurance'],
      responseStyle: 'financial, options-focused, deal-oriented'
    });

    this.agentCapabilities.set('Service Advisor', {
      intents: ['after_sales'],
      expertise: ['warranty', 'maintenance', 'service packages', 'roadside assistance'],
      responseStyle: 'service-oriented, helpful, maintenance-focused'
    });

    console.log('✅ Agent capabilities initialized');
  }

  // Main integration method - processes customer message with ML + CrewAI
  async processCustomerMessage(message, context = {}) {
    const startTime = Date.now();
    this.performance.totalRequests++;

    try {
      console.log(`🤖 Processing customer message: "${message.substring(0, 50)}..."`);
      
      // Step 1: ML Intent Detection (Fast & Accurate)
      const mlResult = await this.mlDetector.detectIntent(message, context);
      
      if (mlResult.method === 'ml') {
        this.performance.mlResponses++;
        console.log(`🎯 ML detected intent: ${mlResult.intent} (confidence: ${mlResult.confidence})`);
      } else {
        this.performance.crewAIResponses++;
        console.log(`🔄 CrewAI fallback intent: ${mlResult.intent}`);
      }

      // Step 2: Agent Selection & Routing
      const selectedAgent = this.selectBestAgent(mlResult.intent, context);
      
      // Step 3: Generate Professional Response
      const response = await this.generateAgentResponse(selectedAgent, message, mlResult, context);
      
      // Step 4: Performance Tracking
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime, selectedAgent.role);
      
      console.log(`✅ Response generated in ${responseTime}ms by ${selectedAgent.role}`);
      
      return {
        response: response,
        intent: mlResult.intent,
        confidence: mlResult.confidence,
        agent: selectedAgent.role,
        method: mlResult.method,
        provider: mlResult.provider,
        responseTime: responseTime,
        nextStep: this.getNextStep(mlResult.intent),
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Error in CrewAI + ML processing:', error);
      return this.createErrorResponse(error);
    }
  }

  // Select the best agent for the detected intent
  selectBestAgent(intent, context = {}) {
    // Check if we have a cached agent selection
    const cacheKey = `agent_${intent}_${JSON.stringify(context)}`;
    const cachedAgent = this.responseCache.get(cacheKey);
    
    if (cachedAgent && Date.now() - cachedAgent.timestamp < this.cacheTimeout) {
      return cachedAgent.agent;
    }

    // Agent selection logic based on intent
    let selectedAgent;
    
    switch (intent) {
      case 'purchase':
      case 'car_type':
      case 'budget':
      case 'purchase_commitment':
        selectedAgent = {
          role: 'Sales Consultant',
          priority: 1,
          reason: 'Primary sales intent - Sales Consultant handles customer guidance'
        };
        break;
        
      case 'features':
      case 'comparison':
      case 'availability':
        selectedAgent = {
          role: 'Product Specialist',
          priority: 1,
          reason: 'Product-related intent - Product Specialist has technical expertise'
        };
        break;
        
      case 'financing':
      case 'discounts':
        selectedAgent = {
          role: 'Finance & Insurance Manager',
          priority: 1,
          reason: 'Financial intent - Finance Manager handles payment and deals'
        };
        break;
        
      case 'after_sales':
        selectedAgent = {
          role: 'Service Advisor',
          priority: 1,
          reason: 'Service intent - Service Advisor handles warranty and maintenance'
        };
        break;
        
      default:
        // Fallback to Sales Consultant for unknown intents
        selectedAgent = {
          role: 'Sales Consultant',
          priority: 2,
          reason: 'Unknown intent - Sales Consultant as general handler'
        };
    }

    // Cache the agent selection
    this.responseCache.set(cacheKey, {
      agent: selectedAgent,
      timestamp: Date.now()
    });

    return selectedAgent;
  }

  // Generate professional response using the selected agent
  async generateAgentResponse(agent, message, mlResult, context = {}) {
    const agentCapabilities = this.agentCapabilities.get(agent.role);
    
    // Create agent-specific prompt
    const agentPrompt = this.buildAgentPrompt(agent, message, mlResult, agentCapabilities, context);
    
    // Use CrewAI LLM to generate the actual response
    if (context.crewAI && typeof context.crewAI.invoke === 'function') {
      try {
        console.log(`🤖 Generating response using ${agent.role}...`);
        
        const result = await context.crewAI.invoke([
          { role: 'system', content: agentPrompt },
          { role: 'user', content: message }
        ]);
        
        return this.formatAgentResponse(result.content, agent, mlResult);
        
      } catch (error) {
        console.warn(`⚠️ CrewAI response generation failed: ${error.message}`);
        return this.generateFallbackResponse(agent, message, mlResult);
      }
    } else {
      // Fallback to template-based response
      return this.generateFallbackResponse(agent, message, mlResult);
    }
  }

  // Build agent-specific prompt for CrewAI
  buildAgentPrompt(agent, message, mlResult, capabilities, context = {}) {
    return `You are a ${agent.role} at a car dealership. 

Your expertise: ${capabilities.expertise.join(', ')}
Your response style: ${capabilities.responseStyle}

Customer message: "${message}"
Detected intent: ${mlResult.intent}
Confidence: ${mlResult.confidence}

Context: ${JSON.stringify(context)}

Generate a professional, helpful response that:
1. Acknowledges the customer's ${mlResult.intent} intent
2. Provides relevant information based on your expertise
3. Asks ONE focused question to move the conversation forward
4. Maintains a professional, sales-oriented tone
5. Is concise (1-2 sentences maximum)

Response:`;
  }

  // Format the agent's response
  formatAgentResponse(content, agent, mlResult) {
    // Clean and format the response
    let formattedResponse = content.trim();
    
    // Ensure it ends with a question or clear next step
    if (!formattedResponse.includes('?') && !formattedResponse.includes('.')) {
      formattedResponse += '.';
    }
    
    // Add agent signature if needed
    if (!formattedResponse.includes(agent.role)) {
      formattedResponse += ` (${agent.role})`;
    }
    
    return formattedResponse;
  }

  // Generate fallback response when CrewAI fails
  generateFallbackResponse(agent, message, mlResult) {
    const fallbackResponses = {
      'Sales Consultant': {
        'purchase': 'Great! I\'d be happy to help you find the perfect vehicle. What type of car are you looking for—sedan, SUV, or something else?',
        'car_type': 'Excellent choice! Do you have a budget range in mind for your vehicle?',
        'budget': 'Perfect! With that budget, I can show you some great options. What type of vehicle are you thinking?',
        'purchase_commitment': 'Excellent! I\'m excited to help you complete your purchase. Do you prefer financing or paying cash?'
      },
      'Product Specialist': {
        'features': 'Great question! I can show you vehicles with those features. Do you have a budget range in mind?',
        'comparison': 'I\'d be happy to compare those options for you. What\'s most important in your comparison?',
        'availability': 'Let me check the current availability for you. When would you like to test drive?'
      },
      'Finance & Insurance Manager': {
        'financing': 'Excellent question! We have several financing options available. Are you looking to lease or purchase?',
        'discounts': 'Great question about deals! We have several current promotions. What type of vehicle are you interested in?'
      },
      'Service Advisor': {
        'after_sales': 'Great question about service! I can explain our warranty and service options. What specific information do you need?'
      }
    };

    const agentResponses = fallbackResponses[agent.role] || {};
    const intentResponse = agentResponses[mlResult.intent] || 
      `Thank you for your inquiry! I'm here to help with your ${mlResult.intent} needs. How can I assist you further?`;

    return intentResponse;
  }

  // Get next step suggestion based on intent
  getNextStep(intent) {
    const nextSteps = {
      'purchase': 'Ask about vehicle type preferences',
      'car_type': 'Ask about budget range',
      'budget': 'Ask about specific features needed',
      'financing': 'Ask about lease vs. purchase preference',
      'features': 'Ask about budget constraints',
      'comparison': 'Ask about priorities in comparison',
      'availability': 'Schedule test drive or check inventory',
      'discounts': 'Ask about vehicle type for promotions',
      'after_sales': 'Explain warranty or service options',
      'purchase_commitment': 'Guide through purchase process'
    };

    return nextSteps[intent] || 'Continue conversation based on customer needs';
  }

  // Performance monitoring
  updatePerformanceStats(responseTime, agentRole) {
    const currentAvg = this.performance.avgResponseTime;
    const totalRequests = this.performance.totalRequests;
    
    this.performance.avgResponseTime = (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
    
    // Track agent usage
    if (!this.performance.agentUsage.has(agentRole)) {
      this.performance.agentUsage.set(agentRole, 0);
    }
    this.performance.agentUsage.set(agentRole, this.performance.agentUsage.get(agentRole) + 1);
  }

  // Get comprehensive performance statistics
  getPerformanceStats() {
    const mlStats = this.mlDetector.getStats();
    
    return {
      // ML Detection Stats
      mlDetection: mlStats,
      
      // CrewAI Integration Stats
      totalRequests: this.performance.totalRequests,
      mlResponses: this.performance.mlResponses,
      crewAIResponses: this.performance.crewAIResponses,
      avgResponseTime: `${this.performance.avgResponseTime.toFixed(1)}ms`,
      
      // Agent Usage
      agentUsage: Object.fromEntries(this.performance.agentUsage),
      
      // Cache Performance
      responseCacheSize: this.responseCache.size,
      
      // Overall Performance
      mlAccuracy: mlStats.mlAccuracy,
      fallbackRate: mlStats.fallbackRate,
      cacheHitRate: mlStats.cacheHitRate
    };
  }

  // Clear all caches
  clearCaches() {
    this.mlDetector.clearCache();
    this.responseCache.clear();
    console.log('🧹 All caches cleared');
  }

  // Create error response
  createErrorResponse(error) {
    return {
      response: 'I apologize, but I\'m experiencing technical difficulties. Please try again or contact our support team.',
      intent: 'error',
      confidence: 0,
      agent: 'System',
      method: 'error',
      provider: 'error',
      responseTime: 0,
      nextStep: 'Contact support',
      timestamp: Date.now(),
      error: error.message
    };
  }

  // Health check
  async healthCheck() {
    try {
      const mlStats = this.mlDetector.getStats();
      const hasMLProviders = mlStats.providers.length > 0;
      
      return {
        status: 'healthy',
        mlProviders: hasMLProviders ? 'available' : 'unavailable',
        agents: Array.from(this.agentCapabilities.keys()),
        cacheStatus: 'active',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

// Export for use in daivecrewai.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CrewAIMLIntegration };
}
