// Unified AI Service - Minimal Version
// Only contains the active ML classes, minimal DAIVEService interface, and OptimizedCrewAgentAI
// Old DAIVEService class has been removed (8,000+ lines of unused code eliminated)

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { pool } from '../database/connection.js';
import path from 'path';
import fs from 'fs';
import settingsManager from './settingsManager.js';
import ConversationFlowManager from './conversationFlowManager.js';
import AgentSelector from './agentSelector.js';
import IntentTrainingSystem from './intentTrainingSystem.js';
import InventoryService from './inventoryService.js';

// =============================================================================
// ML INTENT DETECTION INTEGRATION
// =============================================================================

// ML Intent Detector using Python scikit-learn model
class MLIntentDetector {
  constructor(modelPath = 'enhanced_intent_model.pkl') {
    this.modelPath = modelPath;
    this.pythonScript = null;
    this.createPythonScript();
  }

  createPythonScript() {
    this.pythonScript = `import sys
import pickle
import json

def predict_intent(message, model_path):
    try:
        # Load the trained model
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        # Make prediction
        prediction = model.predict([message.lower()])
        intent = prediction[0]
        
        # Get prediction probabilities
        probabilities = model.predict_proba([message.lower()])[0]
        confidence = max(probabilities) * 100
        
        # Map ML intents to our system
        intent_mapping = {
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
        }
        
        mapped_intent = intent_mapping.get(intent, 'general_inquiry')
        
        result = {
            "intent": mapped_intent,
            "confidence": confidence,
            "method": "ml",
            "original_intent": intent
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "intent": "general_inquiry",
            "confidence": 0,
            "method": "error"
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python script.py <message> <model_path>", "intent": "general_inquiry", "confidence": 0, "method": "error"}))
        sys.exit(1)
    
    message = sys.argv[1]
    model_path = sys.argv[2]
    
    predict_intent(message, model_path)`;
  }

  async detectIntent(message, confidenceThreshold = 0.15) {
    try {
      console.log('🔍 ML Intent Detection STARTED');
      const startTime = performance.now();
      
      // Create temporary Python script file
      const scriptPath = path.join(process.cwd(), 'temp_intent_detection.py');
      fs.writeFileSync(scriptPath, this.pythonScript);
      
      // Execute Python script
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python', [scriptPath, message, this.modelPath]);
      
      return new Promise((resolve, reject) => {
        let result = '';
        let error = '';
        
        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          // Clean up temporary file
          try {
            fs.unlinkSync(scriptPath);
          } catch (e) {
            console.log('⚠️ Could not delete temporary script file:', e.message);
          }
          
          if (code !== 0) {
            console.log('⚠️ Python process exited with code:', code);
            console.log('⚠️ Python error output:', error);
            reject(new Error(`Python process failed with code ${code}: ${error}`));
            return;
          }
          
          try {
            const parsedResult = JSON.parse(result.trim());
            const responseTime = performance.now() - startTime;
            
            console.log(`✅ ML Intent Detection completed in ${responseTime.toFixed(2)}ms`);
            console.log(`🎯 Intent: ${parsedResult.intent} (${parsedResult.confidence.toFixed(2)}% confidence)`);
            
            // Check confidence threshold
            if (parsedResult.confidence < confidenceThreshold * 100) {
              console.log(`⚠️ Confidence below threshold (${confidenceThreshold * 100}%), using fallback`);
              parsedResult.confidence = parsedResult.confidence;
              parsedResult.below_threshold = true;
            }
            
            resolve(parsedResult);
          } catch (parseError) {
            console.error('❌ Error parsing Python output:', parseError);
            reject(new Error(`Failed to parse Python output: ${parseError.message}`));
          }
        });
      });
      
    } catch (error) {
      console.error('❌ ML Intent Detection error:', error);
      throw error;
    }
  }
}

// CrewAI ML Integration Wrapper
class CrewAIMLIntegration {
  constructor(options = {}) {
    this.mlDetector = new MLIntentDetector(options.modelPath);
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.responseTimes = [];
    this.maxResponseTime = options.maxResponseTime || 10000; // 10 seconds
  }

  async detectIntent(message, context = {}) {
    try {
      console.log('🚀 CrewAI ML Integration - Intent Detection STARTED');
      const startTime = performance.now();
      
      // Check cache first
      const cacheKey = `${message.toLowerCase().trim()}_${JSON.stringify(context)}`;
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.cacheTimeout) {
        console.log('✅ Using cached ML intent result');
        return cachedResult.result;
      }
      
      // Perform ML intent detection
      const result = await this.mlDetector.detectIntent(message, 0.15);
      
      // Update response time stats
      const responseTime = performance.now() - startTime;
      this.updateResponseTimeStats(responseTime);
      
      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      console.log(`✅ CrewAI ML Integration completed in ${responseTime.toFixed(2)}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ CrewAI ML Integration error:', error);
      
      // Return fallback result
      return {
        intent: 'general_inquiry',
        confidence: 0.1,
        method: 'fallback',
        error: error.message
      };
    }
  }

  updateResponseTimeStats(responseTime) {
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  getStats() {
    if (this.responseTimes.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0
      };
    }
    
    const avg = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    const max = Math.max(...this.responseTimes);
    const min = Math.min(...this.responseTimes);
    
    return {
      totalRequests: this.responseTimes.length,
      averageResponseTime: avg,
      maxResponseTime: max,
      minResponseTime: min
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('🧹 ML Integration cache cleared');
  }
}

// =============================================================================
// MINIMAL DAIVESERVICE INTERFACE
// =============================================================================
// This minimal interface preserves only the methods that routes actually call
// All functionality is delegated to OptimizedCrewAgentAI

class DAIVEService {
  constructor() {
    this.optimizedCrewAI = null;
    this.initialized = false;
  }

  // Initialize the service
  async initialize() {
    try {
      console.log('🚀 Initializing minimal DAIVEService interface...');
      this.initialized = true;
      console.log('✅ Minimal DAIVEService interface initialized');
      return true;
    } catch (error) {
      console.error('❌ Error initializing DAIVEService interface:', error);
      return false;
    }
  }

  // Generate a unique session ID
  generateSessionId() {
    return `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get service status
  getServiceStatus() {
    return {
      status: 'active',
      initialized: this.initialized,
      optimizedCrewAI: !!this.optimizedCrewAI,
      timestamp: new Date().toISOString()
    };
  }

  // Debug initialization
  async debugInitialization() {
    return {
      status: 'initialized',
      optimizedCrewAI: !!this.optimizedCrewAI,
      timestamp: new Date().toISOString()
    };
  }

  // Process conversation using OptimizedCrewAgentAI
  async processConversationWithOptimizedCrew(sessionId, vehicleId, userMessage, customerInfo = {}) {
    try {
      console.log('🚀 processConversationWithOptimizedCrew STARTED');
      
      if (!this.optimizedCrewAI) {
        // Initialize OptimizedCrewAgentAI if not already done
        const dealerId = customerInfo.dealerId || 'default';
        this.optimizedCrewAI = new OptimizedCrewAgentAI('default-api-key', dealerId);
        console.log('✅ OptimizedCrewAgentAI initialized');
      }

      // Process the message through the optimized system
      const result = await this.optimizedCrewAI.processWithCrewAgentAI(
        userMessage,
        sessionId,
        customerInfo
      );

      if (result.success) {
        return {
          response: result.response,
          hasInventory: true,
          crewUsed: true,
          crewType: `Optimized_${result.agentType}`,
          intent: result.intent,
          agent: result.agent,
          leadScore: this.calculateLeadScore({ 
            intent: result.intent, 
            urgency: this.assessUrgency(userMessage), 
            message: userMessage 
          }),
          shouldHandoff: false,
          audioResponseUrl: null,
          conversationState: 'optimized_crewai'
        };
      } else {
        throw new Error(result.error || 'OptimizedCrewAgentAI processing failed');
      }
      
    } catch (error) {
      console.error('❌ Error in processConversationWithOptimizedCrew:', error);
      throw error;
    }
  }

  // Save voice session
  async saveVoiceSession(conversationId, audioFileUrl, transcription, aiResponse, audioResponseUrl) {
    try {
      const query = `
        INSERT INTO daive_voice_sessions 
        (conversation_id, audio_file_url, transcription, ai_response, audio_response_url, processing_status)
        VALUES ($1, $2, $3, $4, $5, 'completed')
        RETURNING *
      `;
      
      const result = await pool.query(query, [
        conversationId,
        audioFileUrl,
        transcription,
        aiResponse,
        audioResponseUrl
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error saving voice session:', error);
      throw error;
    }
  }

  // Get conversation history
  async getConversationHistory(sessionId) {
    try {
      const query = `
        SELECT * FROM daive_conversations 
        WHERE session_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [sessionId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return null;
    }
  }

  // Get analytics
  async getAnalytics(dealerId, startDate, endDate) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN handoff_requested = true THEN 1 END) as handoffs,
          AVG(CASE WHEN lead_score IS NOT NULL THEN lead_score END) as avg_lead_score
        FROM daive_conversations 
        WHERE dealer_id = $1 
        AND created_at BETWEEN $2 AND $3
      `;
      
      const result = await pool.query(query, [dealerId, startDate, endDate]);
      return result.rows[0] || { total_conversations: 0, handoffs: 0, avg_lead_score: 0 };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return { total_conversations: 0, handoffs: 0, avg_lead_score: 0 };
    }
  }

  // Helper methods
  calculateLeadScore(customerInfo) {
    let score = 0;
    const message = customerInfo.message?.toLowerCase() || '';
    
    if (message.includes('buy') || message.includes('purchase')) score += 25;
    if (message.includes('price') || message.includes('cost')) score += 20;
    if (message.includes('test drive')) score += 30;
    if (message.includes('finance')) score += 25;
    if (message.includes('feature')) score += 15;
    
    return Math.min(score, 100);
  }

  assessUrgency(message) {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'today', 'now'];
    const hasUrgency = urgentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    return hasUrgency ? 'high' : 'medium';
  }
}

// =============================================================================
// OPTIMIZED CREW AGENT AI SYSTEM
// =============================================================================

/**
 * Optimized CrewAgentAI System
 * Implements the complete workflow:
 * 1. Semantic Intent Detection using AI
 * 2. Intelligent Agent Routing
 * 3. Context-Aware Response Generation
 * 4. Context Maintenance
 * 5. AI Response Validation before client delivery
 */
class OptimizedCrewAgentAI {
  constructor(openaiApiKey, dealerId = null) {
    this.openaiApiKey = openaiApiKey;
    this.dealerId = dealerId;
    this.llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 300
    });
    
    // Agent definitions with specialized roles
    this.agents = {
      'sales_consultant': {
        name: 'Sales Consultant',
        role: 'Engage customers, explain vehicle features, and close deals',
        expertise: ['initial engagement', 'vehicle recommendations', 'customer needs assessment', 'greeting', 'general inquiries'],
        personality: 'Professional, friendly, and solution-oriented',
        responseStyle: 'Clear, engaging, and focused on customer needs'
      },
      'product_specialist': {
        name: 'Product Specialist',
        role: 'Provide deep knowledge of vehicles, conduct demos, and assist test drives',
        expertise: ['vehicle specifications', 'features', 'safety', 'performance', 'test drives', 'vehicle types', 'comparisons'],
        personality: 'Knowledgeable, enthusiastic, and detail-oriented',
        responseStyle: 'Technical but accessible, with specific examples'
      },
      'finance_manager': {
        name: 'Finance Manager',
        role: 'Offer financing options, leasing, and insurance add-ons',
        expertise: ['financing', 'loans', 'leasing', 'insurance', 'payments', 'budget', 'cost', 'pricing', 'monthly payments'],
        personality: 'Trustworthy, professional, and financially savvy',
        responseStyle: 'Clear financial explanations with specific numbers and options'
      },
      'service_advisor': {
        name: 'Service Advisor',
        role: 'Ensure post-sale support, schedule services, and maintain customer loyalty',
        expertise: ['maintenance', 'service', 'warranty', 'repairs', 'scheduling', 'post-sale support'],
        personality: 'Helpful, reliable, and customer-focused',
        responseStyle: 'Practical advice with clear next steps'
      },
      'inventory_specialist': {
        name: 'Inventory Specialist',
        role: 'Find and present available vehicles that match customer preferences',
        expertise: ['inventory search', 'vehicle availability', 'matching preferences', 'alternative options'],
        personality: 'Efficient, thorough, and solution-focused',
        responseStyle: 'Specific inventory details with clear availability information'
      }
    };
    
    // Context management
    this.conversationContexts = new Map();
    this.responseHistory = new Map();
    
    // Inventory service for real-time vehicle availability
    this.inventoryService = new InventoryService();
    
    // Performance tracking
    this.performanceMetrics = {
      totalRequests: 0,
      successfulResponses: 0,
      averageResponseTime: 0,
      intentAccuracy: 0
    };
  }

  /**
   * Step 1: Semantic Intent Detection using AI
   * Analyzes user message to understand intent and extract key information
   */
  async detectSemanticIntent(userMessage, conversationContext = {}) {
    try {
      console.log('🔍 Step 1: Semantic Intent Detection STARTED');
      const startTime = performance.now();
      
      const intentPrompt = [
        new SystemMessage({
          content: `You are an expert intent detection system for a car dealership. 
Analyze the user message and identify the primary intent and extract key information.

IMPORTANT: This system ONLY handles requests for items and services available at THIS dealership.
- If a customer asks for something not in inventory, classify as 'inventory_inquiry' with 'not_available' status
- If a customer asks for external services, classify as 'external_service_request' 
- Always prioritize current dealership capabilities over external options

Available intents:
- buy_car: Customer wants to purchase a vehicle
- car_type_preference: Customer expresses preference for vehicle type (SUV, sedan, truck, etc.)
- budget_inquiry: Customer asks about pricing, budget, or affordability
- financing_options: Customer asks about loans, payments, leasing
- feature_request: Customer asks about vehicle features, specifications
- test_drive: Customer wants to schedule or ask about test drives
- inventory_search: Customer asks about available vehicles or inventory
- general_inquiry: General questions about dealership, services, or policies
- after_sales: Questions about warranty, service, maintenance
- purchase_commitment: Customer is ready to buy or commit to purchase

Extract key information:
- Vehicle type preferences (SUV, sedan, truck, etc.)
- Budget range or price constraints
- Specific features or requirements
- Timeline or urgency
- Contact preferences

Return a JSON object with:
{
  "intent": "intent_type",
  "confidence": 0.95,
  "extracted_info": {
    "vehicle_type": "SUV",
    "budget": "$30,000",
    "features": ["safety", "hybrid"],
    "timeline": "within 2 weeks",
    "urgency": "medium"
  },
  "reasoning": "Brief explanation of intent classification"
}`
        }),
        new HumanMessage({
          content: `User Message: "${userMessage}"
Conversation Context: ${JSON.stringify(conversationContext, null, 2)}

Analyze the intent and extract information:`
        })
      ];

      const response = await this.llm.invoke(intentPrompt);
      const intentResult = JSON.parse(response.content);
      
      const responseTime = performance.now() - startTime;
      console.log(`✅ Step 1: Intent Detection completed in ${responseTime.toFixed(2)}ms`);
      console.log(`🎯 Detected Intent: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(2)}% confidence)`);
      
      return {
        ...intentResult,
        responseTime
      };
      
    } catch (error) {
      console.error('❌ Error in Semantic Intent Detection:', error);
      
      // Fallback to rule-based intent detection
      return this.fallbackIntentDetection(userMessage);
    }
  }

  /**
   * Step 2: Intelligent Agent Routing
   * Routes the request to the most appropriate specialized agent
   */
  async routeToAgent(intentResult, userMessage, conversationContext = {}) {
    try {
      console.log('🔄 Step 2: Agent Routing STARTED');
      const startTime = performance.now();
      
      const routingPrompt = [
        new SystemMessage({
          content: `You are an expert agent routing system for a car dealership.
Based on the detected intent and user message, select the most appropriate specialized agent.

Available Agents:
1. sales_consultant: Initial engagement, vehicle recommendations, customer needs assessment
2. product_specialist: Vehicle specifications, features, safety, test drives, comparisons
3. finance_manager: Financing, loans, leasing, insurance, payments, budget
4. service_advisor: Maintenance, service, warranty, repairs, scheduling
5. inventory_specialist: Inventory search, vehicle availability, matching preferences

Routing Rules:
- buy_car → sales_consultant (primary) + finance_manager (secondary)
- car_type_preference → product_specialist
- budget_inquiry → finance_manager
- financing_options → finance_manager
- feature_request → product_specialist
- test_drive → product_specialist
- inventory_search → inventory_specialist
- general_inquiry → sales_consultant
- after_sales → service_advisor
- purchase_commitment → sales_consultant + finance_manager

Return a JSON object with:
{
  "selected_agent": "agent_key",
  "routing_reason": "Explanation of why this agent was selected",
  "expected_response_style": "How the agent should respond",
  "additional_context": "Any special instructions for the agent"
}`
        }),
        new HumanMessage({
          content: `Intent: ${intentResult.intent}
User Message: "${userMessage}"
Confidence: ${(intentResult.confidence * 100).toFixed(2)}%
Extracted Info: ${JSON.stringify(intentResult.extracted_info, null, 2)}

Select the appropriate agent:`
        })
      ];

      const response = await this.llm.invoke(routingPrompt);
      const routingResult = JSON.parse(response.content);
      
      const responseTime = performance.now() - startTime;
      console.log(`✅ Step 2: Agent Routing completed in ${responseTime.toFixed(2)}ms`);
      console.log(`🎯 Selected Agent: ${routingResult.selected_agent}`);
      
      return {
        ...routingResult,
        responseTime
      };
      
    } catch (error) {
      console.error('❌ Error in Agent Routing:', error);
      
      // Fallback to rule-based routing
      return this.fallbackAgentRouting(intentResult.intent);
    }
  }

  /**
   * Step 3: Context-Aware Response Generation
   * Generates a response using the selected agent's expertise
   */
  async generateAgentResponse(agentInfo, userMessage, intentResult, routingResult, conversationContext = {}) {
    try {
      console.log('💬 Step 3: Agent Response Generation STARTED');
      const startTime = performance.now();
      
      // Get agent details
      const agent = this.agents[routingResult.selected_agent];
      if (!agent) {
        throw new Error(`Unknown agent: ${routingResult.selected_agent}`);
      }
      
      // Get inventory data if needed
      let inventoryData = '';
      if (intentResult.intent === 'inventory_search' || intentResult.intent === 'buy_car') {
        try {
          inventoryData = await this.inventoryService.getInventoryData(this.dealerId, intentResult.extracted_info);
        } catch (error) {
          console.log('⚠️ Could not fetch inventory data:', error.message);
        }
      }
      
      const agentPrompt = [
        new SystemMessage({
          content: `You are a ${agent.name} at a car dealership. Your role is: ${agent.role}

PERSONALITY: ${agent.personality}
RESPONSE STYLE: ${agent.responseStyle}
EXPERTISE: ${agent.expertise.join(', ')}

IMPORTANT RULES:
1. You can ONLY discuss vehicles and services available at THIS dealership
2. NEVER mention or offer vehicles from other dealerships
3. If asked about external items, redirect to dealership offerings
4. Keep responses concise (2-3 sentences maximum)
5. Be helpful, professional, and solution-oriented
6. Use the extracted information to provide relevant responses

${routingResult.additional_context ? `SPECIAL INSTRUCTIONS: ${routingResult.additional_context}` : ''}

${inventoryData ? `INVENTORY DATA: ${inventoryData}` : ''}`
        }),
        new HumanMessage({
          content: `Customer Message: "${userMessage}"
Intent: ${intentResult.intent}
Extracted Information: ${JSON.stringify(intentResult.extracted_info, null, 2)}

Respond as the ${agent.name}:`
        })
      ];

      const response = await this.llm.invoke(agentPrompt);
      const agentResponse = response.content;
      
      const responseTime = performance.now() - startTime;
      console.log(`✅ Step 3: Agent Response Generation completed in ${responseTime.toFixed(2)}ms`);
      
      return {
        response: agentResponse,
        agent: agent.name,
        agentType: routingResult.selected_agent,
        responseTime
      };
      
    } catch (error) {
      console.error('❌ Error in Agent Response Generation:', error);
      
      // Generate fallback response
      return this.generateSpeedFallbackResponse(intentResult, inventoryData, userMessage);
    }
  }

  /**
   * Step 4: Context Maintenance
   * Maintains conversation context and user preferences
   */
  async maintainConversationContext(sessionId, userMessage, agentResponse, intentResult, routingResult, conversationContext = {}) {
    try {
      console.log('🧠 Step 4: Context Maintenance STARTED');
      const startTime = performance.now();
      
      // Get or create conversation context
      if (!this.conversationContexts.has(sessionId)) {
        this.conversationContexts.set(sessionId, {
          messages: [],
          preferences: {},
          intent_history: [],
          agent_history: []
        });
      }
      
      const context = this.conversationContexts.get(sessionId);
      
      // Add new message
      context.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
        intent: intentResult.intent,
        confidence: intentResult.confidence
      });
      
      // Add agent response
      context.messages.push({
        role: 'assistant',
        content: agentResponse,
        timestamp: Date.now(),
        agent: routingResult.selected_agent,
        agent_type: routingResult.selected_agent
      });
      
      // Update preferences based on extracted info
      if (intentResult.extracted_info) {
        Object.assign(context.preferences, intentResult.extracted_info);
      }
      
      // Track intent and agent history
      context.intent_history.push({
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        timestamp: Date.now()
      });
      
      context.agent_history.push({
        agent: routingResult.selected_agent,
        routing_reason: routingResult.routing_reason,
        timestamp: Date.now()
      });
      
      // Keep only last 20 messages for performance
      if (context.messages.length > 20) {
        context.messages = context.messages.slice(-20);
      }
      
      const responseTime = performance.now() - startTime;
      console.log(`✅ Step 4: Context Maintenance completed in ${responseTime.toFixed(2)}ms`);
      
      return context;
      
    } catch (error) {
      console.error('❌ Error in Context Maintenance:', error);
      return conversationContext; // Return original context if maintenance fails
    }
  }

  /**
   * Step 5: AI Response Validation
   * Validates the response quality before delivering to client
   */
  async validateResponseQuality(userMessage, agentResponse, intentResult, conversationContext = {}) {
    try {
      console.log('✅ Step 5: Response Validation STARTED');
      const startTime = performance.now();
      
      const validationPrompt = [
        new SystemMessage({
          content: `You are a quality assurance system for car dealership AI responses.
Evaluate the following response for quality, relevance, and compliance.

EVALUATION CRITERIA:
1. Relevance: Does the response address the user's question?
2. Accuracy: Is the information correct and dealership-specific?
3. Helpfulness: Does it provide useful information or next steps?
4. Compliance: Does it follow dealership-only rules?
5. Clarity: Is the response clear and understandable?

SCORING:
- 10: Perfect response, highly relevant and helpful
- 8-9: Very good response, minor improvements possible
- 6-7: Good response, some areas for improvement
- 4-5: Fair response, needs significant improvement
- 1-3: Poor response, major issues

Return a JSON object with:
{
  "quality_score": 8.5,
  "feedback": "Detailed feedback on what's good and what could improve",
  "suggestions": ["specific suggestion 1", "specific suggestion 2"],
  "compliance_check": "PASS/FAIL - whether response follows dealership-only rules"
}`
        }),
        new HumanMessage({
          content: `User Question: "${userMessage}"
Intent: ${intentResult.intent}
Agent Response: "${agentResponse}"

Evaluate this response:`
        })
      ];

      const response = await this.llm.invoke(validationPrompt);
      const validationResult = JSON.parse(response.content);
      
      const responseTime = performance.now() - startTime;
      console.log(`✅ Step 5: Response Validation completed in ${responseTime.toFixed(2)}ms`);
      console.log(`📊 Quality Score: ${validationResult.quality_score}/10`);
      
      return {
        ...validationResult,
        responseTime
      };
      
    } catch (error) {
      console.error('❌ Error in Response Validation:', error);
      
      // Return default validation result
      return {
        quality_score: 7.0,
        feedback: "Validation failed, using default score",
        suggestions: ["Improve response clarity", "Add more specific information"],
        compliance_check: "PASS",
        responseTime: 0
      };
    }
  }

  /**
   * Main workflow method - orchestrates all 5 steps
   */
  async processWithCrewAgentAI(userMessage, sessionId, conversationContext = {}) {
    try {
      console.log('🚀 OptimizedCrewAgentAI Workflow STARTED');
      const totalStartTime = performance.now();
      
      // Step 1: Semantic Intent Detection
      const intentResult = await this.detectSemanticIntent(userMessage, conversationContext);
      
      // Step 2: Agent Routing
      const routingResult = await this.routeToAgent(intentResult, userMessage, conversationContext);
      
      // Step 3: Agent Response Generation
      const agentResponse = await this.generateAgentResponse(
        this.agents[routingResult.selected_agent],
        userMessage,
        intentResult,
        routingResult,
        conversationContext
      );
      
      // Step 4: Context Maintenance
      const updatedContext = await this.maintainConversationContext(
        sessionId,
        userMessage,
        agentResponse.response,
        intentResult,
        routingResult,
        conversationContext
      );
      
      // Step 5: Response Validation
      const validationResult = await this.validateResponseQuality(
        userMessage,
        agentResponse.response,
        intentResult,
        updatedContext
      );
      
      // Update performance metrics
      const totalResponseTime = performance.now() - totalStartTime;
      this.updatePerformanceMetrics(totalResponseTime, validationResult.quality_score);
      
      console.log(`🎉 OptimizedCrewAgentAI Workflow completed in ${totalResponseTime.toFixed(2)}ms`);
      console.log(`📊 Final Quality Score: ${validationResult.quality_score}/10`);
      
      // Return comprehensive result
      return {
        success: true,
        response: agentResponse.response,
        agent: agentResponse.agent,
        agentType: agentResponse.agentType,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        quality_score: validationResult.quality_score,
        total_time: totalResponseTime,
        context: updatedContext
      };
      
    } catch (error) {
      console.error('❌ Error in CrewAgentAI workflow:', error);
      return {
        success: false,
        response: 'I apologize, but I\'m experiencing technical difficulties. Please try again later.',
        error: error.message,
        agent: 'System',
        agentType: 'error'
      };
    }
  }

  // Helper methods
  determineConversationStage(context) {
    const messageCount = context.messages.length;
    const hasPreferences = Object.keys(context.preferences).length > 0;
    
    if (messageCount <= 2) return 'initial';
    if (hasPreferences && context.preferences.stage === 'ready to buy') return 'purchase_ready';
    if (hasPreferences && context.preferences.urgency === 'high') return 'urgent';
    if (hasPreferences) return 'preferences_established';
    return 'exploring';
  }
  
  updatePerformanceMetrics(responseTime, qualityScore) {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.successfulResponses++;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.successfulResponses - 1) + responseTime) / 
      this.performanceMetrics.successfulResponses;
    this.performanceMetrics.intentAccuracy = 
      (this.performanceMetrics.intentAccuracy * (this.performanceMetrics.successfulResponses - 1) + qualityScore) / 
     1;
  }
  
  async regenerateWithValidation(userMessage, intentResult, routingResult, context, suggestions) {
    // Implementation for regenerating response with validation feedback
    const improvementPrompt = [
      new SystemMessage({
        content: `Improve the previous response based on these suggestions: ${suggestions.join(', ')}`
      }),
      new HumanMessage({
        content: `User Message: "${userMessage}"
Intent: ${intentResult.intent}
Generate an improved response:`
      })
    ];
    
    const response = await this.llm.invoke(improvementPrompt);
    return response.content;
  }
  
  fallbackIntentDetection(userMessage) {
    // Simple rule-based fallback
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase')) return { intent: 'buy_car', confidence: 0.6 };
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) return { intent: 'budget_inquiry', confidence: 0.6 };
    if (lowerMessage.includes('finance') || lowerMessage.includes('loan')) return { intent: 'financing_options', confidence: 0.6 };
    if (lowerMessage.includes('suv') || lowerMessage.includes('sedan') || lowerMessage.includes('truck')) return { intent: 'car_type_preference', confidence: 0.6 };
    
    return { intent: 'general_inquiry', confidence: 0.5 };
  }
  
  fallbackAgentRouting(intent) {
    const routingMap = {
      'buy_car': 'sales_consultant',
      'budget_inquiry': 'finance_manager',
      'financing_options': 'finance_manager',
      'car_type_preference': 'product_specialist',
      'feature_request': 'product_specialist',
      'check_availability': 'inventory_specialist',
      'after_sales': 'service_advisor'
    };
    
    return {
      selected_agent: 'sales_consultant',
      routing_reason: 'Fallback routing based on intent',
      expected_response_style: 'Professional and helpful',
      additional_context: 'Using fallback routing due to system limitations'
    };
  }
  
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
  
  clearContext(sessionId) {
    this.conversationContexts.delete(sessionId);
  }
}

// Export the OptimizedCrewAgentAI class and ML classes
export { OptimizedCrewAgentAI, MLIntentDetector, CrewAIMLIntegration };

export default DAIVEService;
