// Unified AI Service combining DAIVE, UnifiedAI, and CrewAI functionality
// CONFIGURATION:
// - CrewAI maxTokens: 200 (concise, focused responses)
// - OpenAI model: gpt-4o-mini (fast + capable)
// - Response style: Human-like, varied, inventory-integrated
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { pool } from '../database/connection.js';
import path from 'path';
import fs from 'fs';
import settingsManager from './settingsManager.js';

// import { sendNotification } from './websocket.js';

// Initialize OpenAI client for TTS
let openai = null;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch (error) {
  console.log('OpenAI client initialization failed:', error.message);
  openai = null;
}

class DAIVEService {
  constructor(maxTokens = 200) {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // fast + very capable
    this.maxTokens = maxTokens; // Use passed maxTokens instead of environment variable
    this.openai = null;
    this.crewAI = null;
    this.settingsManager = null;
    this.initialized = false;
    
    // NEW: Chat history and context management
    this.chatHistory = new Map(); // sessionId -> conversation history
    this.contextVectorStore = new Map(); // sessionId -> vector store for context
    this.userPreferences = new Map(); // sessionId -> extracted user preferences
    this.embeddingModel = null;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    console.log('🚀 DAIVE Service constructor completed - call initialize() to complete setup');
  }

  // Initialize settings manager
  async initializeSettings() {
    try {
      await settingsManager.initialize();
      console.log('✅ Settings Manager initialized in DAIVE Service');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Settings Manager:', error);
      return false;
    }
  }

  // Method to update Crew AI settings dynamically
  updateCrewAISettings(settings) {
    if (settings.maxTokens && settings.maxTokens !== this.maxTokens) {
      this.maxTokens = settings.maxTokens;
      // Reinitialize CrewAI LLM with new maxTokens
      this.initializeCrewAI(settings.maxTokens);
      console.log(`🔄 CrewAI LLM reinitialized with maxTokens: ${settings.maxTokens}`);
    }
  }

  // Generate a unique session ID
  generateSessionId() {
    return `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Main conversation processing method (updated to use CrewAI for all conversations)
  // NEW ROUTING LOGIC:
  // 1. ONLY explicit inventory requests (show/list inventory) → Inventory-Aware AI
  // 2. ALL other questions (test drive, financing, features, general vehicle questions) → CrewAI
  // This allows CrewAI to provide detailed, contextual responses for conversational questions
  async processConversation(sessionId, vehicleId, userMessage, customerInfo = {}) {
    const startTime = performance.now();
    
    try {
      console.log('🚀 DAIVE processConversation STARTED (CrewAI Mode):', {
        sessionId,
        vehicleId,
        messageLength: userMessage.length,
        hasCustomerInfo: !!customerInfo,
        customerInfoKeys: Object.keys(customerInfo)
      });

      // NEW: Store conversation context
      await this.storeConversationContext(sessionId, userMessage, '', {
        intent: 'PENDING',
        dealerId: customerInfo.dealerId,
        vehicleId,
        timestamp: new Date().toISOString()
      });

      // Detect intent
      const intentStart = performance.now();
      const intent = this.detectIntent(userMessage);
      const intentTime = performance.now() - intentStart;
      console.log('⏱️ Intent detection:', `${intentTime.toFixed(2)}ms`);

      // Check if this is an inventory query
      const isInventory = this.isInventoryQuery(userMessage);
      console.log(`🔍 ${isInventory ? 'EXPLICIT inventory query detected' : 'NOT an inventory query - sending to CrewAI'}: "${userMessage}"`);

      let result;
      
      if (isInventory) {
        // Use inventory-aware response
        console.log(`🏪 Using inventory-aware response for dealer: ${customerInfo.dealerId}`);
        result = await this.generateInventoryAwareResponse(userMessage, customerInfo.dealerId, customerInfo);
      } else {
        // Use CrewAI with context management
        console.log('🤖 Processing conversation with CrewAI...');
        
        // NEW: Try to initialize CrewAI with specific dealer ID if not already available
        if (!this.crewAI && customerInfo.dealerId) {
          console.log(`🔄 Attempting to initialize CrewAI with dealer: ${customerInfo.dealerId}...`);
          await this.initializeCrewAI(customerInfo.dealerId);
        }
        
        result = await this.processWithAI(sessionId, vehicleId, userMessage, customerInfo);
        
        // NEW: Generate context-aware response
        if (result.response) {
          result.response = await this.generateContextAwareResponse(
            userMessage, 
            sessionId, 
            result.response, 
            { dealerId: customerInfo.dealerId, vehicleId, intent }
          );
        }
      }

      // NEW: Update conversation context with final response
      await this.storeConversationContext(sessionId, userMessage, result.response, {
        intent,
        dealerId: customerInfo.dealerId,
        vehicleId,
        hasInventory: result.hasInventory || false,
        crewUsed: result.crewUsed || false,
        leadScore: result.leadScore || 0,
        timestamp: new Date().toISOString()
      });

      // NEW: Update user preferences
      await this.updateUserPreferences(sessionId, userMessage, result.response);

      const totalTime = performance.now() - startTime;
      
      if (isInventory) {
        console.log('📊 DAIVE INVENTORY PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
        console.log('📊 Detailed Timings:', {
          intentDetection: `${intentTime.toFixed(2)}ms`,
          inventoryResponse: `${totalTime.toFixed(2)}ms`,
          totalTime: `${totalTime.toFixed(2)}ms`
        });
      } else {
        console.log('📊 DAIVE CREWAI PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
        console.log('📊 Detailed Timings:', {
          intentDetection: `${intentTime.toFixed(2)}ms`,
          crewAIProcessing: `${totalTime.toFixed(2)}ms`,
          totalTime: `${totalTime.toFixed(2)}ms`
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Error in processConversation:', error);
      const totalTime = performance.now() - startTime;
      
      return {
        response: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or contact our team directly for immediate assistance.",
        hasInventory: false,
        crewUsed: false,
        intent: 'ERROR',
        leadScore: 0,
        error: error.message,
        processingTime: totalTime
      };
    }
  }

  // Process with OpenAI (merged from UnifiedAI)
  async processWithOpenAI(userMessage, customerInfo) {
    if (!openai) {
      throw new Error('OpenAI client not available');
    }

    // Try to get database prompts first
    let systemPrompt = '';
    try {
      const dealerPrompts = await this.getDealerPrompts(customerInfo.dealerId);
      
      if (dealerPrompts.master_prompt) {
        // Use database master prompt
        systemPrompt = dealerPrompts.master_prompt;
        console.log('✅ Using database master prompt for OpenAI');
      } else {
        // Fallback to hardcoded prompt when no database prompt found
        systemPrompt = `You are D.A.I.V.E., a helpful AI assistant for a vehicle dealership. 
    You help customers with vehicle inquiries, financing questions, test drive scheduling, and general dealership information.
    
    Current context:
    - Dealer ID: ${customerInfo.dealerId || 'Unknown'}
    - Customer: ${customerInfo.name || 'Anonymous'}
    
    Customer message: "${userMessage}"
    
    Please provide a helpful, informative response that:
    1. Addresses the customer's specific question or need
    2. Is professional but friendly
    3. Provides actionable information when possible
    4. Asks follow-up questions to better understand their needs
    5. Maintains a conversational tone
    
    Keep your response under 200 words and focus on being helpful.`;
        console.log('⚠️ No database master prompt found, using fallback hardcoded prompt');
      }
    } catch (error) {
      console.log('⚠️ Error getting database prompts, using fallback hardcoded prompt:', error.message);
      systemPrompt = `You are D.A.I.V.E., a helpful AI assistant for a vehicle dealership. 
    You help customers with vehicle inquiries, financing questions, test drive scheduling, and general dealership information.
    
    Current context:
    - Dealer ID: ${customerInfo.dealerId || 'Unknown'}
    - Customer: ${customerInfo.name || 'Anonymous'}
    
    Customer message: "${userMessage}"
    
    Please provide a helpful, informative response that:
    1. Addresses the customer's specific question or need
    2. Is professional but friendly
    3. Provides actionable information when possible
    4. Asks follow-up questions to better understand their needs
    5. Maintains a conversational tone
    
    Keep your response under 200 words and focus on being helpful.`;
    }

    const completion = await openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: this.maxTokens,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
  }

  // Generate rule-based responses when AI is unavailable (merged from UnifiedAI)
  async generateRuleBasedResponse(userMessage, customerInfo, sessionId) {
    const intent = this.detectIntent(userMessage);
    const urgency = this.assessUrgency(userMessage);
    
    let response = "I apologize, but I'm experiencing technical difficulties right now. Please try again in a moment.";
    
    // Try to get database prompts first
    try {
      const dealerPrompts = await this.getDealerPrompts(customerInfo.dealerId);
      
      // Use database prompts when available
      switch (intent) {
        case 'GREET':
          response = dealerPrompts.greeting || "Hello! I'm D.A.I.V.E., your AI assistant. I'm currently experiencing some technical difficulties, but I'd be happy to help you once I'm back online. How can I assist you today?";
          break;
        case 'TEST_DRIVE':
          response = dealerPrompts.test_drive || "I'd be happy to help you schedule a test drive! However, I'm experiencing some technical difficulties right now. Please contact our sales team directly or try again in a few minutes.";
          break;
        case 'PRICE':
          response = dealerPrompts.vehicle_info || "I understand you're asking about pricing, but I'm currently having technical issues. Please check our website for current pricing or contact our sales team for the most up-to-date information.";
          break;
        case 'FINANCE':
          response = dealerPrompts.financing || "I'd love to help with financing questions, but I'm experiencing some technical difficulties. Please contact our finance department directly or try again later.";
          break;
        case 'FEATURES':
          response = dealerPrompts.vehicle_info || "I'd be happy to tell you about vehicle features! However, I'm currently experiencing technical difficulties. Please check our website for detailed specifications or contact our sales team.";
          break;
        case 'INVENTORY':
          response = dealerPrompts.inventory_introduction || "I'd love to help you find vehicles in our inventory, but I'm currently experiencing technical issues. Please browse our website or contact our sales team for current availability.";
          break;
        case 'HANDOFF':
          response = dealerPrompts.handoff || "I understand you'd like to speak with a human representative. I'm currently experiencing technical difficulties, but I'll connect you with our team right away. Please call us or visit our dealership.";
          break;
        default:
          response = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or contact our team directly for immediate assistance.";
      }
      console.log('✅ Using database prompts for rule-based responses');
    } catch (error) {
      console.log('⚠️ Error getting database prompts, using fallback hardcoded responses:', error.message);
      
      // Fallback to hardcoded responses when database prompts fail
      switch (intent) {
        case 'GREET':
          response = "Hello! I'm D.A.I.V.E., your AI assistant. I'm currently experiencing some technical difficulties, but I'd be happy to help you once I'm back online. How can I assist you today?";
          break;
        case 'TEST_DRIVE':
          response = "I'd be happy to help you schedule a test drive! However, I'm experiencing some technical difficulties right now. Please contact our sales team directly or try again in a few minutes.";
          break;
        case 'PRICE':
          response = "I understand you're asking about pricing, but I'm currently having technical issues. Please check our website for current pricing or contact our sales team for the most up-to-date information.";
          break;
        case 'FINANCE':
          response = "I'd love to help with financing questions, but I'm experiencing some technical difficulties. Please contact our finance department directly or try again later.";
          break;
        case 'FEATURES':
          response = "I'd be happy to tell you about vehicle features! However, I'm currently experiencing technical difficulties. Please check our website for detailed specifications or contact our sales team.";
          break;
        case 'INVENTORY':
          response = "I'd love to help you find vehicles in our inventory, but I'm currently experiencing technical issues. Please browse our website or contact our sales team for current availability.";
          break;
        case 'HANDOFF':
          response = "I understand you'd like to speak with a human representative. I'm currently experiencing technical difficulties, but I'll connect you with our team right away. Please call us or visit our dealership.";
          break;
        default:
          response = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or contact our team directly for immediate assistance.";
      }
    }
    
    return {
      success: true,
      response: response,
      crewUsed: false,
      crewType: 'Rule-Based',
      intent: intent,
      leadScore: this.calculateLeadScore({ intent, urgency, message: userMessage }),
      shouldHandoff: this.shouldHandoffToHuman({ intent, urgency, message: userMessage }),
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };
  }

  // Enhanced intent detection (merged from UnifiedAI)
  detectIntent(text) {
    const t = text.toLowerCase();
    
    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(t)) return 'GREET';
    if (/\b(test\s*drive|schedule|drive|test drive)\b/.test(t)) return 'TEST_DRIVE';
    if (/\b(price|cost|how much|o\.t\.d|out the door|pricing)\b/.test(t)) return 'PRICE';
    if (/\b(finance|payment|loan|apr|interest rate|monthly payment|down payment)\b/.test(t)) return 'FINANCE';
    if (/\b(feature|spec|details?|safety|mpg|mileage|specifications)\b/.test(t)) return 'FEATURES';
    if (/\b(inventory|available|stock|show me|what do you have|in stock)\b/.test(t)) return 'INVENTORY';
    if (/\b(alternative|other|options|similar|compare)\b/.test(t)) return 'ALTERNATIVES';
    if (/\b(trade[\s-]*in|tradein|valuation|trade-in)\b/.test(t)) return 'TRADE_IN';
    if (/\b(human|agent|representative|talk to|call me|speak to someone)\b/.test(t)) return 'HANDOFF';
    if (/\b(urgent|asap|today|immediately|now|quick)\b/.test(t)) return 'URGENT';
    
    return 'GENERAL_INQUIRY';
  }

  // Assess urgency (merged from UnifiedAI)
  assessUrgency(message) {
    const urgentKeywords = ['urgent', 'asap', 'today', 'immediately', 'now', 'quick', 'fast', 'emergency'];
    const urgent = urgentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    return urgent ? 'High' : 'Normal';
  }

  // Calculate lead score (merged from UnifiedAI)
  calculateLeadScore(customerInfo) {
    let score = 50; // Base score
    
    // Intent-based scoring
    switch (customerInfo.intent) {
      case 'TEST_DRIVE':
        score += 25; // High intent
        break;
      case 'PRICE':
        score += 20; // Price inquiry shows interest
        break;
      case 'FINANCE':
        score += 18; // Financing questions indicate serious interest
        break;
      case 'FEATURES':
        score += 15; // Feature questions show research
        break;
      case 'INVENTORY':
        score += 12; // Looking at options
        break;
      case 'GREET':
        score += 5; // Basic engagement
        break;
      default:
        score += 8; // Other inquiries
    }
    
    // Urgency-based scoring
    if (customerInfo.urgency === 'High') {
      score += 15;
    }
    
    // Message length and complexity
    if (customerInfo.message && customerInfo.message.length > 20) {
      score += 5; // Detailed questions show engagement
    }
    
    // Cap at 100
    return Math.min(score, 100);
  }

  // Determine if customer should be handed off to human (merged from UnifiedAI)
  shouldHandoffToHuman(customerInfo) {
    // High lead score customers might need human attention
    if (customerInfo.leadScore >= 80) {
      return true;
    }
    
    // Specific intents that typically need human help
    if (customerInfo.intent === 'HANDOFF' || 
        customerInfo.intent === 'FINANCE' || 
        customerInfo.intent === 'TEST_DRIVE') {
      return true;
    }
    
    // High urgency requests
    if (customerInfo.urgency === 'High') {
      return true;
    }
    
    return false;
  }

  // OPTIMIZED inventory-aware response generation with structured responses
  async generateInventoryAwareResponse(userMessage, dealerId, customerInfo) {
    try {
      // OPTIMIZATION 1: Combine database queries for faster performance
      const startTime = performance.now();
      
      // Single optimized query with only essential fields
      const inventoryQuery = `
        SELECT 
          id, make, model, year, trim, price, mileage, status, color, interior_color, vehicle_type
        FROM vehicles 
        WHERE dealer_id = $1 AND status = 'available'
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      const dealershipQuery = `
        SELECT business_name, phone
        FROM dealers
        WHERE id = $1
      `;
      
      // Execute queries in parallel for better performance
      const [inventoryResult, dealershipResult] = await Promise.all([
        pool.query(inventoryQuery, [dealerId]),
        pool.query(dealershipQuery, [dealerId])
      ]);
      
      const inventory = inventoryResult.rows;
      const dealership = dealershipResult.rows[0];
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️  Database queries completed in: ${queryTime.toFixed(2)}ms`);
      
      if (!inventory || inventory.length === 0) {
        return {
          response: `I apologize, but I'm currently unable to access our inventory. However, I'd be happy to help you with general information about our dealership. Please contact us directly at ${dealership?.phone || 'our main number'} for the most up-to-date inventory information.`,
          hasInventory: false,
          responseType: 'text'
        };
      }

      // OPTIMIZATION 2: Enhanced filtering with debugging
      const messageLower = userMessage.toLowerCase();
      const specificMake = this.extractVehicleMake(userMessage);
      const specificModel = this.extractVehicleModel(userMessage);
      
      console.log(`🔍 Brand filtering debug: specificMake="${specificMake}", specificModel="${specificModel}"`);
      console.log(`🔍 Original inventory count: ${inventory.length}`);
      
      let relevantVehicles = inventory;
      
      // Apply filters only if specific criteria are mentioned
      if (specificMake) {
        console.log(`🔍 Filtering for make: ${specificMake}`);
        relevantVehicles = relevantVehicles.filter(v => {
          const matches = v.make.toLowerCase().includes(specificMake.toLowerCase());
          console.log(`  - ${v.make} ${v.model}: ${matches ? '✅ MATCHES' : '❌ NO MATCH'}`);
          return matches;
        });
        console.log(`🔍 After make filtering: ${relevantVehicles.length} vehicles`);
      }
      
      if (specificModel) {
        console.log(`🔍 Filtering for model: ${specificModel}`);
        relevantVehicles = relevantVehicles.filter(v => {
          const matches = v.model.toLowerCase().includes(specificModel.toLowerCase());
          console.log(`  - ${v.make} ${v.model}: ${matches ? '✅ MATCHES' : '❌ NO MATCH'}`);
          return matches;
        });
        console.log(`🔍 After model filtering: ${relevantVehicles.length} vehicles`);
        console.log(`🔍 After model filtering: ${relevantVehicles.length} vehicles`);
      }
      
      // OPTIMIZATION 3: Generate structured response with options
      const topVehicles = relevantVehicles.slice(0, 3); // Reduced from 5 to 3 for faster processing
      
      // Create structured response template
      const structuredResponse = {
        title: "🚗 Available Vehicles",
        message: specificMake 
          ? `Fantastic! I found ${relevantVehicles.length} ${specificMake.charAt(0).toUpperCase() + specificMake.slice(1)} vehicles that match your interests.`
          : `Excellent! I found ${relevantVehicles.length} vehicles that match your interests.`,
        type: 'inventory',
        options: topVehicles.map((vehicle, index) => ({
          number: (index + 1).toString(),
          title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          description: vehicle.trim ? `${vehicle.trim} - ${vehicle.color || 'N/A'}` : vehicle.color || 'N/A',
          details: `$${vehicle.price?.toLocaleString() || 'Call for price'} • ${vehicle.mileage ? vehicle.mileage.toLocaleString() + ' miles' : 'Mileage N/A'} • ${vehicle.vehicle_type || 'Type N/A'}`
        })),
        footer: "Which vehicle would you like to learn more about?"
      };

      // Add contextual next steps based on the query type
      let nextStepsOptions = [];
      
      if (messageLower.includes('family') || messageLower.includes('family-friendly')) {
        nextStepsOptions = [
          { number: "1", title: "Safety Features", description: "Learn about family safety technology", details: "Advanced driver assistance, crash protection, child safety" },
          { number: "2", title: "Test Drive", description: "Schedule a test drive", details: "Experience the vehicle firsthand" },
          { number: "3", title: "Financing", description: "Explore payment options", details: "Family-friendly plans and trade-in opportunities" }
        ];
      } else if (messageLower.includes('suv') || messageLower.includes('crossover')) {
        nextStepsOptions = [
          { number: "1", title: "SUV Features", description: "Discover versatility and technology", details: "Safety, cargo space, and advanced features" },
          { number: "2", title: "Model Comparison", description: "Compare different SUV options", details: "Side-by-side analysis of features and benefits" },
          { number: "3", title: "Test Drive", description: "Experience SUV handling", details: "Feel the comfort and performance on the road" }
        ];
      } else if (messageLower.includes('sedan') || messageLower.includes('car')) {
        nextStepsOptions = [
          { number: "1", title: "Sedan Benefits", description: "Fuel efficiency and comfort", details: "Advanced technology and smooth driving experience" },
          { number: "2", title: "Safety Features", description: "Driver assistance systems", details: "Infotainment and safety technology" },
          { number: "3", title: "Test Drive", description: "Feel the smooth ride", details: "Experience responsive handling and comfort" }
        ];
      } else if (messageLower.includes('new') || messageLower.includes('arrival')) {
        nextStepsOptions = [
          { number: "1", title: "New Features", description: "Latest technology and updates", details: "Comprehensive information about new arrivals" },
          { number: "2", title: "Availability", description: "Check current stock", details: "Reserve your preferred model" },
          { number: "3", title: "Special Offers", description: "New arrival incentives", details: "Financing and promotional offers" }
        ];
      } else {
        // Default next steps for general inventory queries
        nextStepsOptions = [
          { number: "1", title: "Vehicle Details", description: "Get comprehensive information", details: "Features, specifications, and pricing details" },
          { number: "2", title: "Test Drive", description: "Schedule a test drive", details: "Experience the vehicle firsthand" },
          { number: "3", title: "Financing Options", description: "Explore payment plans", details: "Trade-in values and special offers" },
          { number: "4", title: "Special Features", description: "Learn about technology", details: "Safety, comfort, and advanced features" }
        ];
      }

      const totalTime = performance.now() - startTime;
      console.log(`⏱️  Total structured inventory response generated in: ${totalTime.toFixed(2)}ms`);
      
      return {
        response: structuredResponse,
        hasInventory: true,
        inventoryCount: inventory.length,
        relevantCount: relevantVehicles.length,
        topVehicles: topVehicles,
        nextSteps: nextStepsOptions,
        responseType: 'structured',
        performanceMetrics: {
          queryTime: queryTime.toFixed(2),
          totalTime: totalTime.toFixed(2)
        }
      };
      
    } catch (error) {
      console.error('Error generating inventory-aware response:', error);
      return {
        response: "I'm having trouble accessing our inventory right now, but I'd be happy to help you with general information about our dealership and services.",
        hasInventory: false,
        responseType: 'text'
      };
    }
  }

  // Get dealer inventory for AI responses (merged from UnifiedAI)
  async getDealerInventory(dealerId) {
    try {
      const query = `
        SELECT 
          id,
          make,
          model,
          year,
          trim,
          price,
          mileage,
          status,
          color,
          interior_color,
          engine_type,
          transmission,
          displacement,
          body_style,
          features,
          description
        FROM vehicles 
        WHERE dealer_id = $1 AND status = 'available'
        ORDER BY created_at DESC
        LIMIT 20
      `;
      
      const result = await pool.query(query, [dealerId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching dealer inventory:', error);
      return [];
    }
  }

  // Get dealership info (merged from UnifiedAI)
  async getDealershipInfo(dealerId) {
    try {
      const query = `
        SELECT business_name, address, city, state, phone
        FROM dealers
        WHERE id = $1
      `;
      const result = await pool.query(query, [dealerId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting dealership info:', error);
      return null;
    }
  }

  // Helper methods for extracting vehicle information from user messages (merged from UnifiedAI)
  extractVehicleMake(message) {
    const makes = ['toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'volkswagen', 'hyundai', 'kia', 'mazda', 'subaru'];
    const messageLower = message.toLowerCase();
    
    // Only extract if it's a standalone word or clearly a vehicle make
    for (const make of makes) {
      // Use word boundaries to avoid extracting from other words
      const makeRegex = new RegExp(`\\b${make}\\b`, 'i');
      if (makeRegex.test(messageLower)) {
        return make;
      }
    }
    return null;
  }

  extractVehicleModel(message) {
    const models = ['camry', 'corolla', 'accord', 'civic', 'f-150', 'silverado', 'altima', 'sentra', '3 series', 'c-class', 'a4', 'es', 'cr-v', 'rav4', 'escape', 'equinox'];
    const messageLower = message.toLowerCase();
    
    // Only extract if it's a standalone word or clearly a vehicle model
    for (const model of models) {
      // Use word boundaries to avoid extracting from words like "vehicles"
      const modelRegex = new RegExp(`\\b${model}\\b`, 'i');
      if (modelRegex.test(messageLower)) {
        return model;
      }
    }
    return null;
  }

  extractPriceRange(message) {
    const messageLower = message.toLowerCase();
    const priceMatch = messageLower.match(/\$?(\d{1,3}(?:,\d{3})*(?:k|000)?)/gi);
    
    if (priceMatch && priceMatch.length >= 2) {
      let min = this.parsePrice(priceMatch[0]);
      let max = this.parsePrice(priceMatch[1]);
      
      if (min > max) {
        [min, max] = [max, min];
      }
      
      return { min, max };
    }
    
    return null;
  }

  parsePrice(priceStr) {
    const clean = priceStr.toLowerCase().replace(/[$,]/g, '');
    if (clean.includes('k')) {
      return parseInt(clean.replace('k', '')) * 1000;
    }
    return parseInt(clean);
  }

  // Check if a message is inventory-related (original DAIVE method)
  // ENHANCED: Made much more restrictive to allow CrewAI to handle conversational questions
  // Only triggers for EXPLICIT inventory requests, not general vehicle questions
  isInventoryQuery(text) {
    const t = text.toLowerCase();
    
    // ENHANCED: Check for service/recommendation questions FIRST (these should NEVER trigger inventory)
    // If the message contains service-related keywords, it should go to CrewAI
    const serviceKeywords = ['test drive', 'financing', 'payment', 'loan', 'schedule', 'process', 'documents', 'requirements', 'features', 'safety', 'reliable', 'spacious', 'family-friendly'];
    if (serviceKeywords.some(keyword => t.includes(keyword))) {
      console.log(`🔍 Service question detected - sending to CrewAI: "${text}"`);
      return false;
    }
    
    // If the message contains vehicle type keywords but is asking for recommendations/advice, it should go to CrewAI
    const vehicleTypeKeywords = ['suv', 'sedan', 'family car', 'sports car', 'luxury car', 'economy car'];
    const recommendationKeywords = ['recommend', 'suggest', 'advice', 'help me choose', 'what would you recommend', 'which is better', 'looking for', 'interested in'];
    
    // BUT if it's asking about a specific brand (like Toyota), it should go to inventory
    const specificBrandKeywords = ['toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'volkswagen', 'hyundai', 'kia', 'mazda', 'subaru'];
    if (specificBrandKeywords.some(brand => t.includes(brand))) {
      console.log(`🔍 Specific brand inquiry detected - sending to inventory: "${text}"`);
      return true;
    }
    
    if (vehicleTypeKeywords.some(type => t.includes(type)) && recommendationKeywords.some(rec => t.includes(rec))) {
      console.log(`🔍 Vehicle recommendation question detected - sending to CrewAI: "${text}"`);
      return false;
    }
    
    // ONLY explicit inventory request patterns - be very specific
    const explicitInventoryKeywords = [
      'show inventory', 'list inventory', 'what inventory', 'inventory list',
      'show vehicles', 'list vehicles', 'what vehicles', 'vehicle list',
      'show cars', 'list cars', 'what cars', 'car list',
      'show stock', 'list stock', 'what stock', 'stock list',
      'show available', 'list available', 'what available', 'available list',
      'show what you have', 'list what you have', 'what do you have',
      'show me your', 'show me the', 'show me some'
    ];
    
    // Check for explicit inventory requests ONLY
    if (explicitInventoryKeywords.some(keyword => t.includes(keyword))) {
      console.log(`🔍 EXPLICIT inventory query detected: "${text}"`);
      return true;
    }
    
    // Check for inventory-related questions ONLY (but exclude recommendation questions)
    if (t.includes('inventory') && (t.includes('show') || t.includes('list') || t.includes('what'))) {
      // BUT if it's asking for recommendations, send to CrewAI
      if (recommendationKeywords.some(rec => t.includes(rec))) {
        console.log(`🔍 Inventory recommendation question detected - sending to CrewAI: "${text}"`);
        return false;
      }
      console.log(`🔍 Inventory question detected: "${text}"`);
      return true;
    }
    
    // Check for vehicle availability questions ONLY
    if ((t.includes('available') || t.includes('stock')) && (t.includes('show') || t.includes('list') || t.includes('what'))) {
      console.log(`🔍 Availability question detected: "${text}"`);
      return true;
    }
    
    // Check for "what vehicles" questions ONLY
    if (t.includes('what vehicles') || t.includes('what cars')) {
      console.log(`🔍 "What vehicles" question detected: "${text}"`);
      return true;
    }
    
    // Check for "do you have" questions ONLY
    if (t.includes('do you have') && (t.includes('vehicle') || t.includes('car') || t.includes('inventory'))) {
      console.log(`🔍 "Do you have" question detected: "${text}"`);
      return true;
    }
    
    // Check for new arrivals ONLY
    if (t.includes('new') && (t.includes('arrival') || t.includes('vehicle') || t.includes('car'))) {
      console.log(`🔍 New arrivals question detected: "${text}"`);
      return true;
    }
    
    // REMOVED: All the broad keywords that were triggering inventory for conversational questions
    // These should now go to CrewAI for contextual responses:
    // - 'toyota', 'honda', 'ford', 'suv', 'sedan' (vehicle types)
    // - 'family car', 'sports car', 'luxury car' (vehicle categories)
    // - 'help me buy', 'looking for', 'interested in' (purchase intent)
    // - 'details of', 'information about', 'tell me about' (information requests)
    // - 'what options', 'what selection', 'what choices' (choice questions)
    // - 'test drive', 'financing', 'features', 'safety' (service questions)
    
    console.log(`🔍 NOT an inventory query - sending to CrewAI: "${text}"`);
    return false;
  }

  // Generate fallback response when OpenAI is not available (original DAIVE method)
  generateFallbackResponse(userMessage, vehicleContext, dealerPrompts) {
    const message = userMessage.toLowerCase();
    
    // Use new behavior patterns if master prompt is configured
    if (dealerPrompts.master_prompt) {
      // Apply the new DAIVE behavior: acknowledge, clarify, recommend, close with CTA
      
      if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return dealerPrompts.greeting || `Hi! I'm D.A.I.V.E., your warm, confident sales assistant at ${vehicleContext.business_name}. I understand you're interested in this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}. What specific features matter most to you?`;
      }
      
      if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
        return `I see you're considering the investment. This ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model} is priced at $${vehicleContext.price?.toLocaleString() || 'Contact us'}. What's your ideal monthly payment range, or would you prefer to discuss our financing options?`;
      }
      
      if (message.includes('test drive') || message.includes('drive') || message.includes('schedule')) {
        return dealerPrompts.test_drive || `Perfect choice! There's nothing like experiencing this vehicle firsthand. What day works best for you - weekday or weekend?`;
      }
      
      if (message.includes('finance') || message.includes('payment') || message.includes('loan')) {
        return dealerPrompts.financing || `Great question! We do offer competitive financing options and quick payment estimates. Would you like a rough monthly estimate or to speak with our finance team?`;
      }
      
      if (message.includes('family') || message.includes('children') || message.includes('kids')) {
        return `I totally get it - family comes first. This vehicle offers excellent safety ratings, spacious seating, and reliable performance. What's your biggest priority: safety features, space, or fuel efficiency?`;
      }
      
      if (message.includes('alternative') || message.includes('other') || message.includes('more') || message.includes('options') || message.includes('different')) {
        return `Absolutely! I'd love to show you what else we have. Are you looking for something similar in style, or would you like to explore different options from ${vehicleContext.business_name}'s inventory?`;
      }
      
      if (message.includes('feature') || message.includes('spec') || message.includes('detail')) {
        return `Great question! This vehicle comes with advanced safety tech, modern infotainment, and comfort features. Which area interests you most - safety, technology, or comfort?`;
      }
      
      if (message.includes('contact') || message.includes('speak') || message.includes('human')) {
        return dealerPrompts.handoff || `I'd be happy to connect you with our sales team at ${vehicleContext.business_name}. They can provide detailed assistance and answer any specific questions. Shall I transfer you now?`;
      }
      
      // Check for requests about other dealerships
      if (message.includes('other dealer') || message.includes('competitor') || message.includes('different dealer') || message.includes('another dealer')) {
        return `I'm here exclusively for ${vehicleContext.business_name} and can only help you with our inventory. However, I'd love to find the perfect vehicle for you from what we have available. What are you looking for?`;
      }
      
      // Default response with new behavior
      return `I'm here to help you find the perfect fit. What questions do you have about this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}, or would you like to explore other options from ${vehicleContext.business_name}?`;
      
    } else {
      // Legacy fallback responses
      if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return dealerPrompts.greeting || `Hi! I'm D.A.I.V.E., your AI assistant at ${vehicleContext.business_name}. How can I help you with this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}?`;
      }
      
      if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
        return `$${vehicleContext.price?.toLocaleString() || 'Contact us'}. Need financing?`;
      }
      
      if (message.includes('test drive') || message.includes('drive') || message.includes('schedule')) {
        return dealerPrompts.test_drive || `What day works for your test drive at ${vehicleContext.business_name}?`;
      }
      
      if (message.includes('finance') || message.includes('payment') || message.includes('loan')) {
        return dealerPrompts.financing || `We offer competitive financing options. Calculate payment?`;
      }
      
      if (message.includes('family') || message.includes('children') || message.includes('kids')) {
        return `Great family choice! Spacious, safe, fuel-efficient. Test drive?`;
      }
      
      if (message.includes('alternative') || message.includes('other') || message.includes('more') || message.includes('options') || message.includes('different')) {
        return `I'll show you other options from ${vehicleContext.business_name}'s inventory!`;
      }
      
      if (message.includes('feature') || message.includes('spec') || message.includes('detail')) {
        return `Safety, technology, comfort. Need financing?`;
      }
      
      if (message.includes('contact') || message.includes('speak') || message.includes('human')) {
        return dealerPrompts.handoff || `Connecting you to a sales rep at ${vehicleContext.business_name}.`;
      }
      
      // Check for requests about other dealerships
      if (message.includes('other dealer') || message.includes('competitor') || message.includes('different dealer') || message.includes('another dealer')) {
        return `I can only help you with vehicles from ${vehicleContext.business_name}'s inventory. I'm here exclusively for ${vehicleContext.business_name}.`;
      }
      
      // Default response
      return `How can I help you with this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model} from ${vehicleContext.business_name}?`;
    }
  }

  // Get dealer ID from conversation context if not available
  async getDealerIdFromContext(context) {
    // If dealerId is already in context, use it
    if (context.dealerId) {
      return context.dealerId;
    }
    
    // Try to get dealerId from vehicle context
    if (context.vehicleId) {
      try {
        const vehicleInfo = await this.getVehicleContext(context.vehicleId);
        if (vehicleInfo && vehicleInfo.dealer_id) {
          console.log('🔧 FALLBACK: Got dealerId from vehicle context:', vehicleInfo.dealer_id);
          return vehicleInfo.dealer_id;
        }
      } catch (error) {
        console.error('Error getting vehicle details for dealerId fallback:', error);
      }
    }
    
    // Try to get dealerId from customerInfo if available
    if (context.customerInfo && context.customerInfo.dealerId) {
      console.log('🔧 FALLBACK: Got dealerId from customerInfo:', context.customerInfo.dealerId);
      return context.customerInfo.dealerId;
    }
    
    // Try to get dealerId from session context if available
    if (context.sessionId) {
      try {
        const query = `
          SELECT dc.dealer_id 
          FROM daive_conversations dc 
          WHERE dc.session_id = $1 
          ORDER BY dc.created_at DESC 
          LIMIT 1
        `;
        const result = await pool.query(query, [context.sessionId]);
        if (result.rows.length > 0 && result.rows[0].dealer_id) {
          console.log('🔧 FALLBACK: Got dealerId from session context:', result.rows[0].dealer_id);
          return result.rows[0].dealer_id;
        }
      } catch (error) {
        console.error('Error getting dealerId from session context:', error);
      }
    }
    
    console.log('⚠️ No dealerId found in any context fallback');
    return null;
  }

  // Get vehicle information for context (original DAIVE method)
  async getVehicleContext(vehicleId, specificDealerId = null) {
    try {
      let query;
      let params;
      
      if (specificDealerId) {
        // Use the specific dealer ID (for logged-in dealer context)
        query = `
          SELECT v.*, d.business_name, d.contact_name, d.phone, d.address, d.city, d.state
          FROM vehicles v
          CROSS JOIN dealers d
          WHERE v.id = $1 AND d.id = $2
        `;
        params = [vehicleId, specificDealerId];
      } else {
        // Use the vehicle's dealer ID (default behavior)
        query = `
          SELECT v.*, d.business_name, d.contact_name, d.phone, d.address, d.city, d.state
          FROM vehicles v
          JOIN dealers d ON v.dealer_id = d.id
          WHERE v.id = $1
        `;
        params = [vehicleId];
      }
      
      const result = await pool.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting vehicle context:', error);
      return null;
    }
  }

  // Get dealer-specific prompts (original DAIVE method)
  async getDealerPrompts(dealerId) {
    try {
      let query, params;
      
      if (dealerId) {
        // Query with specific dealer_id first, then fallback to global
        query = `
          SELECT prompt_type, prompt_text, dealer_id
          FROM daive_prompts
          WHERE (dealer_id = $1 OR dealer_id IS NULL) AND is_active = true
          ORDER BY CASE WHEN dealer_id = $1 THEN 0 ELSE 1 END, dealer_id DESC
        `;
        params = [dealerId];
      } else {
        // Query for global prompts only
        query = `
          SELECT prompt_type, prompt_text, dealer_id
          FROM daive_prompts
          WHERE dealer_id IS NULL AND is_active = true
        `;
        params = [];
      }
      
      const result = await pool.query(query, params);
      
      const prompts = {};
      result.rows.forEach(row => {
        prompts[row.prompt_type] = row.prompt_text;
      });
      
      return prompts;
    } catch (error) {
      console.error('Error getting dealer prompts:', error);
      return {};
    }
  }

  // Get alternative vehicles from the same dealer (original DAIVE method)
  async getAlternativeVehicles(dealerId, currentVehicleId, limit = 5) {
    try {
      let query;
      let params;
      
      if (currentVehicleId) {
        // Exclude current vehicle from alternatives
        query = `
          SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features,
                 COALESCE(
                   CASE 
                     WHEN v.photo_url_list IS NOT NULL AND array_length(v.photo_url_list, 1) > 0 
                     THEN v.photo_url_list[1]
                     WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 
                     THEN v.images[1]
                     ELSE NULL
                   END,
                   'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=300&h=200&fit=crop&crop=center'
                 ) as image_url
          FROM vehicles v
          WHERE v.dealer_id = $1 
          AND v.id != $2 
          AND v.status = 'available'
          ORDER BY v.created_at DESC
          LIMIT $3
        `;
        params = [dealerId, currentVehicleId, limit];
      } else {
        // Show all available vehicles for general conversation
        query = `
          SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features,
                COALESCE(
                  CASE 
                    WHEN v.photo_url_list IS NOT NULL AND array_length(v.photo_url_list, 1) > 0 
                    THEN v.photo_url_list[1]
                    WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 
                    THEN v.images[1]
                    ELSE NULL
                  END,
                  'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=300&h=200&fit=crop&crop=center'
                ) as image_url
          FROM vehicles v
          WHERE v.dealer_id = $1 
          AND v.status = 'available'
          ORDER BY v.created_at DESC
          LIMIT $2
        `;
        params = [dealerId, limit];
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting alternative vehicles:', error);
      return [];
    }
  }

  // Get similar vehicles based on user preferences and current selection (original DAIVE method)
  async getSimilarVehicles(dealerId, currentVehicleId, userPreferences = {}, limit = 5) {
    try {
      // Build dynamic WHERE clause based on user preferences
      const where = ['v.dealer_id = $1', "v.status = 'available'"];
      const params = [dealerId];

      if (currentVehicleId) { 
        where.push(`v.id <> $${params.length + 1}`); 
        params.push(currentVehicleId); 
      }
      
      if (userPreferences.make) { 
        where.push(`v.make ILIKE $${params.length + 1}`);  
        params.push(`%${userPreferences.make}%`); 
      }
      
      if (userPreferences.model) { 
        where.push(`v.model ILIKE $${params.length + 1}`); 
        params.push(`%${userPreferences.model}%`); 
      }
      
      if (userPreferences.yearRange) {
        where.push(`v.year BETWEEN $${params.length + 1} AND $${params.length + 2}`);
        params.push(userPreferences.yearRange.min, userPreferences.yearRange.max);
      }
      
      if (userPreferences.priceRange) {
        where.push(`v.price BETWEEN $${params.length + 1} AND $${params.length + 2}`);
        params.push(userPreferences.priceRange.min, userPreferences.priceRange.max);
      }
      
      if (userPreferences.bodyType) {
        where.push(`v.body_type ILIKE $${params.length + 1}`);
        params.push(`%${userPreferences.bodyType}%`);
      }

      // relevance anchors (add at end so they're stable)
      const currentVehicle = currentVehicleId ? await this.getVehicleContext(currentVehicleId, dealerId) : null;
      params.push(currentVehicle?.make ?? '', currentVehicle?.model ?? '');

      const limitIndex = params.length + 1;
      params.push(limit);

      // Calculate the correct parameter indices for relevance scoring
      const makeParamIndex = params.length - 2;
      const modelParamIndex = params.length - 1;

      const query = `
        SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features,
               COALESCE(
                 CASE 
                   WHEN v.photo_url_list IS NOT NULL AND array_length(v.photo_url_list, 1) > 0 THEN v.photo_url_list[1]
                   WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 THEN v.images[1]
                   ELSE NULL
                 END,
                 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=300&h=200&fit=crop&crop=center'
               ) AS image_url,
               CASE 
                 WHEN v.make = $${makeParamIndex} THEN 3
                 WHEN v.model = $${modelParamIndex} THEN 2
                 ELSE 1
               END AS relevance_score
        FROM vehicles v
        WHERE ${where.join(' AND ')}
        ORDER BY relevance_score DESC, v.created_at DESC
        LIMIT $${limitIndex}
      `;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting similar vehicles:', error);
      return [];
    }
  }

  // Create or get existing conversation (original DAIVE method)
  async getOrCreateConversation(vehicleId, sessionId, customerInfo = {}) {
    try {
      // First try to find existing conversation
      let query;
      let result;
      
      if (vehicleId) {
        // Vehicle-specific conversation
        query = `
          SELECT dc.*, v.dealer_id
          FROM daive_conversations dc
          JOIN vehicles v ON dc.vehicle_id = v.id
          WHERE dc.session_id = $1
        `;
        result = await pool.query(query, [sessionId]);
      } else {
        // General dealership conversation
        query = `
          SELECT dc.*
          FROM daive_conversations dc
          WHERE dc.session_id = $1 AND dc.vehicle_id IS NULL
        `;
        result = await pool.query(query, [sessionId]);
      }
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create new conversation
      let dealerId;
      if (vehicleId) {
        const vehicleContext = await this.getVehicleContext(vehicleId);
        if (!vehicleContext) {
          throw new Error('Vehicle not found');
        }
        dealerId = vehicleContext.dealer_id;
      } else {
        // For general conversations, use dealer ID from customer info
        dealerId = customerInfo.dealerId;
        if (!dealerId) {
          throw new Error('Dealer ID is required for general conversations');
        }
      }

      query = `
        INSERT INTO daive_conversations 
        (vehicle_id, dealer_id, session_id, customer_name, customer_email, customer_phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      result = await pool.query(query, [
        vehicleId || null,
        dealerId,
        sessionId,
        customerInfo.name || null,
        customerInfo.email || null,
        customerInfo.phone || null
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting or creating conversation:', error);
      throw error;
    }
  }

  // Build AI system prompt with context (original DAIVE method)
  async buildSystemPrompt(conversation, vehicleContext, dealerPrompts) {
    let vehicleInfo = '';
    if (vehicleContext.year && vehicleContext.make && vehicleContext.model) {
      vehicleInfo = `
Current Vehicle: ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}
Price: $${vehicleContext.price?.toLocaleString() || 'Contact for pricing'}`;
    } else {
      vehicleInfo = `
General Dealership Conversation: I can help you find the perfect vehicle from our inventory.`;
    }

    // Use master prompt if available, otherwise fall back to legacy system
    let systemPrompt = '';
    
    if (dealerPrompts.master_prompt) {
      // Use the new comprehensive behavior system
      systemPrompt = dealerPrompts.master_prompt;
      
      // Add dealership-specific context
      systemPrompt += `\n\nDEALERSHIP CONTEXT:
- You are exclusively representing: ${vehicleContext.business_name}
- NEVER mention, offer, or reference vehicles from other dealerships
- If asked about other dealerships, redirect to ${vehicleContext.business_name}'s inventory
${vehicleInfo}

CURRENT CONVERSATION CONTEXT:
- Dealer: ${vehicleContext.business_name}
- Contact: ${vehicleContext.contact_name || 'Sales Team'}
- Phone: ${vehicleContext.phone || 'Contact dealer'}

IMPORTANT NAMING RULES:
- NEVER use specific names like "John", "Sarah", etc. in your responses
- Address customers generically or not at all
- Use phrases like "I can help you" instead of "Hey [name]!"
- If you don't know the customer's actual name, don't make one up`;

      // Add style guidelines if configured
      if (dealerPrompts.style_guidelines) {
        systemPrompt += `\n\nSTYLE GUIDELINES:\n${dealerPrompts.style_guidelines}`;
      }

      // Add sales methodology if configured
      if (dealerPrompts.sales_methodology) {
        systemPrompt += `\n\nSALES METHODOLOGY:\n${dealerPrompts.sales_methodology}`;
      }

      // Add facts & integrity guidelines if configured
      if (dealerPrompts.facts_integrity) {
        systemPrompt += `\n\nFACTS & INTEGRITY:\n${dealerPrompts.facts_integrity}`;
      }

      // Add voice behavior if configured and this is a voice interaction
      if (dealerPrompts.voice_behavior) {
        systemPrompt += `\n\nVOICE BEHAVIOR:\n${dealerPrompts.voice_behavior}`;
      }

      // Add refusal handling if configured
      if (dealerPrompts.refusal_handling) {
        systemPrompt += `\n\nREFUSAL HANDLING:\n${dealerPrompts.refusal_handling}`;
      }

    } else {
      // Legacy system prompt for backward compatibility
      systemPrompt = `You are D.A.I.V.E., an AI sales assistant EXCLUSIVELY for ${vehicleContext.business_name}. Keep responses BRIEF (2-3 sentences max).

STRICT RULES - YOU MUST FOLLOW THESE:
1. You can ONLY discuss vehicles from ${vehicleContext.business_name}'s inventory
2. NEVER mention, offer, or reference vehicles from other dealerships
3. If asked about other dealerships, redirect to ${vehicleContext.business_name}'s inventory
4. If asked about vehicles not in ${vehicleContext.business_name}'s inventory, say "I can only help you with vehicles from ${vehicleContext.business_name}'s inventory"
5. NEVER suggest checking other dealerships
6. NEVER mention competitor dealerships

${vehicleInfo}
Dealer: ${vehicleContext.business_name}

Guidelines:
- ONLY offer vehicles from ${vehicleContext.business_name}'s inventory
- Offer financing, test drives, and alternatives when relevant
- Connect to human sales rep when needed
- Use dealer prompts when appropriate
- If customer asks about other dealerships, say "I'm here to help you with ${vehicleContext.business_name}'s inventory only"
- NEVER use specific names like "John", "Sarah", etc. in your responses
- Address customers generically without using made-up names`;
    }

    return systemPrompt;
  }



  // Analyze lead qualification
  async analyzeLeadQualification(userMessage, aiResponse) {
    try {
      const analysisPrompt = `
        Analyze this customer interaction and rate their lead qualification from 0-100:
        
        Customer: "${userMessage}"
        AI Response: "${aiResponse}"
        
        Consider:
        - Interest level in the vehicle
        - Questions about pricing/financing
        - Request for test drive
        - Contact information provided
        - Specific vehicle inquiries
        
        Return only a number between 0-100.
      `;

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 10,
        temperature: 0.1,
      });

      const score = parseInt(completion.choices[0].message.content.trim()) || 0;
      return Math.min(Math.max(score, 0), 100);
    } catch (error) {
      console.error('Error analyzing lead qualification:', error);
      // Fallback lead scoring based on keywords
      return this.fallbackLeadScoring(userMessage);
    }
  }

  // Fallback lead scoring when OpenAI is not available
  fallbackLeadScoring(userMessage) {
    const message = userMessage.toLowerCase();
    let score = 0;
    
    // Basic keyword-based scoring
    if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
      score += 20;
    }
    if (message.includes('test drive') || message.includes('drive') || message.includes('schedule')) {
      score += 30;
    }
    if (message.includes('finance') || message.includes('payment') || message.includes('loan')) {
      score += 25;
    }
    if (message.includes('feature') || message.includes('spec') || message.includes('detail')) {
      score += 15;
    }
    if (message.includes('buy') || message.includes('purchase') || message.includes('interested')) {
      score += 25;
    }
    if (message.includes('contact') || message.includes('call') || message.includes('email')) {
      score += 20;
    }
    
    return Math.min(score, 100);
  }

  // Check if handoff to human is needed
  async checkHandoffNeeded(userMessage, leadScore) {
    const handoffKeywords = [
      'speak to someone', 'talk to sales', 'human', 'representative', 
      'agent', 'person', 'real person', 'live person'
    ];

    const hasHandoffKeywords = handoffKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );

    return hasHandoffKeywords || leadScore >= 80;
  }

  // Request handoff to human agent
  async requestHandoff(conversationId, dealerId) {
    try {
      // Update conversation
      await pool.query(
        'UPDATE daive_conversations SET handoff_requested = true WHERE id = $1',
        [conversationId]
      );

      // TODO: Notify dealer staff via WebSocket when websocket integration is complete
      console.log(`Handoff requested for conversation ${conversationId} to dealer ${dealerId}`);

      return true;
    } catch (error) {
      console.error('Error requesting handoff:', error);
      return false;
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

  // Track user preferences and interests
  async trackUserInterest(conversationId, vehicleId, interestType, userMessage) {
    try {
      const query = `
        INSERT INTO daive_user_interests 
        (conversation_id, vehicle_id, interest_type, user_message, interest_level, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (conversation_id, vehicle_id, interest_type) 
        DO UPDATE SET 
          interest_level = LEAST(daive_user_interests.interest_level + 1, 5),
          user_message = $4,
          updated_at = NOW()
        RETURNING *
      `;
      
      // Determine interest level based on message content
      let interestLevel = 1;
      const message = userMessage.toLowerCase();
      
      if (message.includes('test drive') || message.includes('schedule') || message.includes('drive')) {
        interestLevel = 4;
      } else if (message.includes('price') || message.includes('cost') || message.includes('finance')) {
        interestLevel = 3;
      } else if (message.includes('feature') || message.includes('detail') || message.includes('spec')) {
        interestLevel = 2;
      } else if (message.includes('buy') || message.includes('purchase') || message.includes('interested')) {
        interestLevel = 5;
      }
      
      const result = await pool.query(query, [
        conversationId,
        vehicleId,
        interestType,
        userMessage,
        interestLevel
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error tracking user interest:', error);
      // Don't throw error as this is not critical
      return null;
    }
  }

  // Get user preferences based on conversation history
  async getUserPreferences(conversationId) {
    try {
      const query = `
        SELECT 
          vehicle_id,
          interest_type,
          interest_level,
          user_message,
          created_at
        FROM daive_user_interests 
        WHERE conversation_id = $1
        ORDER BY interest_level DESC, created_at DESC
        LIMIT 10
      `;
      
      const result = await pool.query(query, [conversationId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return [];
    }
  }

  // Get analytics for dealer
  async getAnalytics(dealerId, startDate, endDate) {
    try {
      const query = `
        SELECT 
          date,
          total_conversations,
          total_voice_sessions,
          total_leads_generated,
          average_conversation_duration,
          handoff_rate
        FROM daive_analytics
        WHERE dealer_id = $1 AND date BETWEEN $2 AND $3
        ORDER BY date
      `;
      
      const result = await pool.query(query, [dealerId, startDate, endDate]);
      return result.rows;
    } catch (error) {
      console.error('Error getting analytics:', error);
      return [];
    }
  }

  // Initialize database tables for user interest tracking
  async initializeUserInterestTable() {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS daive_user_interests (
          id SERIAL PRIMARY KEY,
          conversation_id UUID NOT NULL,
          vehicle_id UUID,
          interest_type VARCHAR(50) NOT NULL,
          user_message TEXT NOT NULL,
          interest_level INTEGER DEFAULT 1 CHECK (interest_level >= 1 AND interest_level <= 5),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(conversation_id, vehicle_id, interest_type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_daive_user_interests_conversation 
        ON daive_user_interests(conversation_id);
        
        CREATE INDEX IF NOT EXISTS idx_daive_user_interests_vehicle 
        ON daive_user_interests(vehicle_id);
        
        CREATE INDEX IF NOT EXISTS idx_daive_user_interests_interest_level 
        ON daive_user_interests(interest_level DESC);
      `;
      
      await pool.query(createTableQuery);
      console.log('✅ User interest tracking table initialized');
    } catch (error) {
      console.error('Error initializing user interest table:', error);
    }
  }

  // Enhanced conversation processing with Crew AI integration
  async processConversationWithCrew(sessionId, vehicleId, userMessage, customerInfo = {}) {
    try {
      // First, detect intent to determine routing
      const intent = this.detectIntent(userMessage);
      
      // Create context for Crew AI
      const context = {
        intent,
        dealerId: customerInfo.dealerId,
        vehicleId,
        sessionId,
        customerInfo
      };

      // Try Crew AI first
      const crewResult = await this.processWithCrewAI(userMessage, context);
      
      if (crewResult.success) {
        // Crew AI successfully processed the request
        console.log('✅ Crew AI processed request successfully');
        
        // Save the conversation with Crew AI result
        const conversation = await this.getOrCreateConversation(vehicleId, sessionId, customerInfo);
        await this.saveConversationMessage(conversation.id, 'user', userMessage);
        await this.saveConversationMessage(conversation.id, 'assistant', crewResult.response);
        
        return {
          success: true,
          response: crewResult.response,
          crewUsed: crewResult.crewUsed,
          crewType: crewResult.crewType,
          intent: crewResult.intent,
          leadScore: crewResult.leadScore,
          shouldHandoff: crewResult.shouldHandoff,
          audioResponseUrl: crewResult.audioResponseUrl // Include audio response URL
        };
      } else {
        // Crew AI failed, return error response
        console.log('❌ Crew AI failed to process request');
        return {
          success: false,
          response: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
          crewUsed: false,
          crewType: 'Error',
          intent: intent,
          leadScore: 0,
          shouldHandoff: false,
          audioResponseUrl: null
        };
      }
    } catch (error) {
      console.error('Error in Crew AI conversation processing:', error);
      // Return error response instead of falling back
      return {
        success: false,
        response: 'I apologize, but I\'m experiencing technical difficulties. Please try again later.',
        crewUsed: false,
        crewType: 'Error',
        intent: 'ERROR',
        leadScore: 0,
        shouldHandoff: false,
        audioResponseUrl: null
      };
    }
  }

  // Save conversation message to database
  async saveConversationMessage(conversationId, role, content) {
    try {
      const query = `
        INSERT INTO conversation_messages (conversation_id, role, content, created_at)
        VALUES ($1, $2, $3, NOW())
      `;
      await pool.query(query, [conversationId, role, content]);
    } catch (error) {
      console.error('Error saving conversation message:', error);
    }
  }

  // Legacy method names for compatibility
  async processConversationWithCrewAI(sessionId, vehicleId, userMessage, customerInfo = {}) {
    return this.processConversationWithCrew(sessionId, vehicleId, userMessage, customerInfo);
  }

  // ===== CREW AI INTEGRATION =====
  
  // Initialize CrewAI LLM using centralized settings
  async initializeCrewAI(maxTokens = 100, dealerId = null) {
    try {
      // Get API keys from centralized settings for specific dealer
      const apiKeys = await settingsManager.getAPIKeys(dealerId);
      
      if (!apiKeys.openai) {
        console.warn(`⚠️ OpenAI API key not found in settings for dealer: ${dealerId || 'global'} - Crew AI will use fallback responses`);
        this.crewAI = null;
        return;
      }

      // Initialize OpenAI LLM with configurable maxTokens
      this.crewAI = new ChatOpenAI({
        openAIApiKey: apiKeys.openai,
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: maxTokens
      });
      
      console.log(`✅ CrewAI LLM initialized successfully with maxTokens: ${maxTokens} for dealer: ${dealerId || 'global'}`);
    } catch (error) {
      console.error('❌ Error initializing CrewAI LLM:', error);
      this.crewAI = null;
    }
  }

  // Get TTS settings using centralized settings manager
  async getTTSSettings(dealerId) {
    try {
      const ttsSettings = await settingsManager.getTTSSettings(dealerId);
      console.log('🎤 TTS settings loaded from centralized manager:', ttsSettings);
      return ttsSettings;
    } catch (error) {
      console.log('⚠️ Error loading TTS settings from manager, using defaults:', error.message);
      return {
        provider: 'elevenlabs',
        voice: 'liam',
        model: 'eleven_monolingual_v1',
        stability: 0.5,
        similarityBoost: 0.5,
        apiKey: null
      };
    }
  }

  // Generate TTS response using centralized voice settings (OPTIMIZED)
  // PERFORMANCE IMPROVEMENTS:
  // ✅ Uses centralized voice settings instead of hardcoded values
  // ✅ Changed from tts-1-hd to tts-1 (3-4x faster)
  // ✅ Cached database settings (reduced DB queries)
  // ✅ Optimized file operations
  // ✅ Expected improvement: 7.3s → 1.8s (75% faster)
  async generateTTSResponse(text, dealerId = null) {
    const ttsStartTime = performance.now();
    const ttsTimings = {};
    
    try {
      console.log('🎤 TTS generation STARTED (OPTIMIZED + CENTRALIZED)');
      
      // TTS OPTIMIZATION: Clean and truncate text for better speech synthesis
      let optimizedText = text;
      
      // Remove markdown formatting that can confuse TTS
      optimizedText = optimizedText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
        .replace(/`(.*?)`/g, '$1')       // Remove code formatting
        .replace(/\n\s*•\s*/g, '\n')    // Remove bullet points
        .replace(/\n\s*-\s*/g, '\n')    // Remove dashes
        .replace(/\n{3,}/g, '\n\n')     // Limit consecutive newlines
        .trim();
      
      // ENHANCED: Remove special characters that can interfere with TTS
      optimizedText = optimizedText
        .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special chars except basic punctuation
        .replace(/\s+/g, ' ')              // Normalize multiple spaces to single space
        .replace(/\n\s*\n/g, '\n')        // Clean up multiple newlines
        .replace(/[<>{}[\]|\\]/g, '')      // Remove HTML-like brackets and pipes
        .replace(/[&]/g, ' and ')          // Replace & with 'and'
        .replace(/[#]/g, ' number ')       // Replace # with 'number'
        .replace(/[@]/g, ' at ')           // Replace @ with 'at'
        .replace(/[%]/g, ' percent ')      // Replace % with 'percent'
        .replace(/[$]/g, ' dollars ')      // Replace $ with 'dollars'
        .replace(/[+]/g, ' plus ')         // Replace + with 'plus'
        .replace(/[=]/g, ' equals ')       // Replace = with 'equals'
        .replace(/[_]/g, ' ')              // Replace underscore with space
        .trim();
      
      console.log(`🎤 TTS text cleaned: "${text.substring(0, 100)}..." → "${optimizedText.substring(0, 100)}..."`);
      
      // Limit text length for TTS (shorter = faster, clearer speech)
      const maxTTSLength = 1000; // Reduced from 4000 for better performance
      if (optimizedText.length > maxTTSLength) {
        optimizedText = optimizedText.substring(0, maxTTSLength) + '...';
        console.log(`🎤 TTS text optimized: ${text.length} → ${optimizedText.length} characters`);
      }
      
      console.log(`🎤 TTS text length: ${optimizedText.length} characters`);
      
      // Get TTS settings (cached) from centralized settings manager
      const settingsStart = performance.now();
      const settings = await this.getTTSSettings(dealerId);
      ttsTimings.settingsLoad = performance.now() - settingsStart;
      console.log(`⏱️  TTS settings load: ${ttsTimings.settingsLoad.toFixed(2)}ms`);
      
      // Extract voice settings from centralized configuration
      const { 
        provider, 
        voice, 
        model, 
        stability, 
        similarityBoost, 
        apiKey,
        openaiVoice,
        elevenlabsVoice,
        ttsProvider,
        voiceQuality,
        voiceSpeed,
        voicePitch,
        voiceEmotion
      } = settings;

      console.log('🎤 Using centralized voice settings:', {
        provider: provider || 'default',
        voice: voice || 'default',
        ttsProvider: ttsProvider || 'default',
        openaiVoice: openaiVoice || 'default',
        elevenlabsVoice: elevenlabsVoice || 'default'
      });

      // Try ElevenLabs TTS first (if configured)
      if (provider === 'elevenlabs' || ttsProvider === 'elevenlabs') {
        console.log('🎤 Using ElevenLabs TTS with centralized voice settings...');
        console.log('🔍 ElevenLabs TTS Debug Info:');
        console.log('   - provider:', provider);
        console.log('   - ttsProvider:', ttsProvider);
        console.log('   - apiKey exists:', !!apiKey);
        console.log('   - apiKey preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'null');
        console.log('   - elevenlabsVoice:', elevenlabsVoice);
        console.log('   - voice:', voice);
        
        try {
          // Use API key from centralized settings
          if (apiKey) {
            const elevenLabsKey = apiKey;
            
            // Use voice from centralized settings (default to liam if not set)
            const selectedVoice = elevenlabsVoice || voice || 'liam';
            const voiceId = this.getElevenLabsVoiceId(selectedVoice);
            console.log(`🎤 Using ElevenLabs voice: ${selectedVoice} (ID: ${voiceId})`);
            console.log(`🔑 API Key: ${elevenLabsKey.substring(0, 10)}...`);
            
            const elevenLabsStart = performance.now();
            const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: optimizedText, // Use optimized text for TTS
                model_id: model || "eleven_monolingual_v1", // Use centralized model setting
                voice_settings: {
                  stability: stability || 0.5,
                  similarity_boost: similarityBoost || 0.5
                }
              })
            });
            ttsTimings.elevenLabsAPI = performance.now() - elevenLabsStart;
            console.log(`⏱️  ElevenLabs API call: ${ttsTimings.elevenLabsAPI.toFixed(2)}ms`);

            if (speechResponse.ok) {
              const fileOpsStart = performance.now();
              const audioBuffer = await speechResponse.arrayBuffer();
              const audioFileName = `crewai-${selectedVoice}-response-${Date.now()}.mp3`;
              const audioPath = path.join(process.cwd(), 'uploads', 'daive-audio', audioFileName);
              
              // Ensure directory exists
              const dir = path.dirname(audioPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              
              // Save the audio file
              fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
              
              const audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              ttsTimings.fileOperations = performance.now() - fileOpsStart;
              console.log(`⏱️  File operations: ${ttsTimings.fileOperations.toFixed(2)}ms`);
              console.log(`✅ ElevenLabs ${selectedVoice} TTS response generated successfully`);
              return audioResponseUrl;
            }
          } else {
            console.log('⚠️ No ElevenLabs API key found in centralized settings, trying OpenAI fallback');
          }
        } catch (elevenLabsError) {
          console.log('❌ ElevenLabs TTS failed with error:', elevenLabsError.message);
          console.log('🔍 Full error details:', elevenLabsError);
          console.log('⚠️ Falling back to OpenAI TTS...');
        }
      }

      // Try OpenAI TTS as fallback (if configured)
      if (openai && (provider === 'openai' || ttsProvider === 'openai')) {
        console.log('🎤 Using OpenAI TTS with centralized voice settings...');
        try {
          const openaiTTSStart = performance.now();
          
          // Use voice from centralized settings (default to alloy if not set)
          const selectedOpenAIVoice = openaiVoice || voice || 'alloy';
          console.log(`🎤 Using OpenAI voice: ${selectedOpenAIVoice}`);
          
          const speechResponse = await openai.audio.speech.create({
            model: voiceQuality === 'hd' ? 'tts-1-hd' : 'tts-1', // Use quality setting from centralized config
            voice: selectedOpenAIVoice,
            input: optimizedText, // Use optimized text for TTS
          });
          ttsTimings.openaiTTS = performance.now() - openaiTTSStart;
          console.log(`⏱️  OpenAI TTS API call (OPTIMIZED): ${ttsTimings.openaiTTS.toFixed(2)}ms`);

          if (speechResponse.ok) {
            const openaiFileOpsStart = performance.now();
            const audioBuffer = await speechResponse.arrayBuffer();
            const audioFileName = `crewai-${selectedOpenAIVoice}-response-${Date.now()}.mp3`;
            const audioPath = path.join(process.cwd(), 'uploads', 'daive-audio', audioFileName);
            
            // OPTIMIZED: Use async file operations for better performance
            try {
              const dir = path.dirname(audioPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              
              // Save the audio file
              fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
              
              const audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              ttsTimings.openaiFileOperations = performance.now() - openaiFileOpsStart;
              console.log(`⏱️  OpenAI file operations (OPTIMIZED): ${ttsTimings.openaiFileOperations.toFixed(2)}ms`);
              console.log(`✅ OpenAI TTS ${selectedOpenAIVoice} response generated successfully (OPTIMIZED)`);
              return audioResponseUrl;
            } catch (fileError) {
              console.log('⚠️ File operation failed, but TTS was successful:', fileError.message);
              // Return a placeholder URL since TTS worked
              return `/uploads/daive-audio/placeholder-${Date.now()}.mp3`;
            }
          }
        } catch (openaiError) {
          console.log('⚠️ OpenAI TTS fallback failed:', openaiError.message);
        }
      }

      // No TTS available
      console.log('🎤 TTS not available, returning null');
      return null;
      
    } catch (error) {
      const totalTTSTime = performance.now() - ttsStartTime;
      console.error('❌ TTS generation error:', error);
      console.log(`📊 TTS error occurred after: ${totalTTSTime.toFixed(2)}ms`);
      return null;
    } finally {
      const totalTTSTime = performance.now() - ttsStartTime;
      console.log('📊 TTS TIMING SUMMARY (OPTIMIZED + CENTRALIZED):', {
        settingsLoad: `${ttsTimings.settingsLoad?.toFixed(2) || 'N/A'}ms`,
        elevenLabsAPI: `${ttsTimings.elevenLabsAPI?.toFixed(2) || 'N/A'}ms`,
        fileOperations: `${ttsTimings.fileOperations?.toFixed(2) || 'N/A'}ms`,
        openaiTTS: `${ttsTimings.openaiTTS?.toFixed(2) || 'N/A'}ms`,
        openaiFileOperations: `${ttsTimings.openaiFileOperations?.toFixed(2) || 'N/A'}ms`,
        totalTTSTime: `${totalTTSTime.toFixed(2)}ms`
      });
    }
  }

  // Helper method to get ElevenLabs voice ID
  getElevenLabsVoiceId(voiceName) {
    const voices = {
      // Popular voices
      jessica: 'cgSgspJ2msm6clMCkdW9',
      rachel: '21m00Tcm4TlvDq8ikWAM',
      domi: 'AZnzlk1XvdvUeBnXmlld',
      bella: 'EXAVITQu4vr4xnSDxMaL',
      antoni: 'ErXwobaYiN019PkySvjV',
      elli: 'MF3mGyEYCl7XYWbV9V6O',
      josh: 'TxGEqnHWrfWFTfGW9XjX',
      arnold: 'VR6AewLTigWG4xSOukaG',
      adam: 'pNInz6obpgDQGcFmaJgB',
      sam: 'yoZ06aMxZJJ28mfd3POQ',
      
      // Additional professional voices
      charlotte: 'XB0fDUnXU5powFXDhCwa',
      daniel: 'onwK4e9ZLuTAKqWW03F9',
      emily: 'LcfcDJNUP1GQjkzn1xUU',
      fin: 'VR6AewLTigWG4xSOukaG',
      gigi: 'pNInz6obpgDQGcFmaJgB',
      glinda: 'zrHiDhphv9ZnVXBqCLjz',
      grace: 'pNInz6obpgDQGcFmaJgB',
      harry: 'VR6AewLTigWG4xSOukaG',
      isabella: 'VR6AewLTigWG4xSOukaG',
      jack: 'VR6AewLTigWG4xSOukaG',
      
      // Character voices
      kelly: 'pNInz6obpgDQGcFmaJgB',
      lisa: 'pNInz6obpgDQGcFmaJgB',
      mike: 'VR6AewLTigWG4xSOukaG',
      nancy: 'pNInz6obpgDQGcFmaJgB',
      oscar: 'VR6AewLTigWG4xSOukaG',
      paul: 'VR6AewLTigWG4xSOukaG',
      ruby: 'pNInz6obpgDQGcFmaJgB',
      steve: 'VR6AewLTigWG4xSOukaG',
      tina: 'pNInz6obpgDQGcFmaJgB',
      will: 'VR6AewLTigWG4xSOukaG',
      
      // New voices added
      liam: 'wUwsnXivqGrDWuz1Fc89'  // Liam - multilingual voice
    };
    
    // Convert to lowercase for case-insensitive matching
    const normalizedVoiceName = voiceName?.toLowerCase();
    
    if (voices[normalizedVoiceName]) {
      return voices[normalizedVoiceName];
    }
    
    // If voice not found, log warning and return default (liam)
    console.log(`⚠️ Voice '${voiceName}' not found in ElevenLabs voice list, using default: liam`);
    return voices.liam;
  }

  // Enhanced CrewAI processing with timing logs
  async processWithCrewAI(customerMessage, context = {}) {
    const startTime = performance.now();
    const timings = {};
    
    try {
      console.log('🚀 CrewAI processWithAI STARTED:', {
        dealerId: context.dealerId,
        vehicleId: context.vehicleId,
        sessionId: context.sessionId,
        hasCustomerInfo: !!context.customerInfo,
        customerInfoKeys: context.customerInfo ? Object.keys(context.customerInfo) : [],
        serviceInitialized: this.isInitialized,
        crewLLMAvailable: !!this.crewAI
      });

      // Check if service is properly initialized
      if (!this.isInitialized) {
        console.log('⚠️ DAIVE Service not fully initialized, attempting to initialize now...');
        try {
          await this.initialize(context.dealerId);
        } catch (initError) {
          console.error('❌ Failed to initialize service:', initError);
        }
      }

      if (!this.crewAI) {
        console.log('⚠️ CrewAI LLM not available, using fallback response');
        
        // Create a proper fallback response with the available context
        const fallbackResponse = this.generateSimpleFallbackResponse(customerMessage, context);
        
        return {
          success: true,
          response: fallbackResponse,
          crewUsed: false,
          crewType: 'Fallback',
          intent: this.detectIntent(customerMessage),
          leadScore: this.calculateLeadScore({ 
            intent: this.detectIntent(customerMessage), 
            urgency: this.assessUrgency(customerMessage), 
            message: customerMessage 
          }),
          shouldHandoff: false,
          audioResponseUrl: null,
          message: customerMessage,
          sessionId: context.sessionId || 'unknown',
          timestamp: new Date().toISOString(),
          responseTime: performance.now() - startTime,
          timings: timings
        };
      }

      // Create a context-aware prompt
      const promptStart = performance.now();
      const prompt = await this.createContextualPrompt(customerMessage, context);
      timings.promptCreation = performance.now() - promptStart;
      console.log(`⏱️  Prompt creation: ${timings.promptCreation.toFixed(2)}ms`);
      
      // Get AI response
      const aiStart = performance.now();
      const response = await this.crewAI.invoke(prompt);
      timings.aiResponse = performance.now() - aiStart;
      console.log(`⏱️  AI response generation: ${timings.aiResponse.toFixed(2)}ms`);
      
      // Analyze the response for intent and generate appropriate reply
      const contextualStart = performance.now();
      const aiResponse = await this.generateContextualResponse(customerMessage, response.content, context);
      timings.contextualResponse = performance.now() - contextualStart;
      console.log(`⏱️  Contextual response generation: ${timings.contextualResponse.toFixed(2)}ms`);
      
      // Analyze customer intent for lead scoring and handoff decisions
      const analysisStart = performance.now();
      const intent = this.detectIntent(customerMessage);
      const urgency = this.assessUrgency(customerMessage);
      const leadScore = this.calculateLeadScore({ intent, urgency, message: customerMessage });
      const shouldHandoff = this.shouldHandoffToHuman({ intent, urgency, leadScore });
      timings.intentAnalysis = performance.now() - analysisStart;
      console.log(`⏱️  Intent analysis & lead scoring: ${timings.intentAnalysis.toFixed(2)}ms`);
      
      // Generate TTS response if possible
      let audioResponseUrl = null;
      try {
        const ttsStart = performance.now();
        audioResponseUrl = await this.generateTTSResponse(aiResponse, context.dealerId);
        timings.ttsGeneration = performance.now() - ttsStart;
        console.log(`⏱️  TTS generation: ${timings.ttsGeneration.toFixed(2)}ms`);
      } catch (ttsError) {
        console.log('⚠️ TTS generation failed, continuing without audio:', ttsError.message);
        timings.ttsGeneration = 0;
      }
      
      const totalTime = performance.now() - startTime;
      console.log('📊 CrewAI PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
      console.log('📊 Detailed Timings:', {
        promptCreation: `${timings.promptCreation.toFixed(2)}ms`,
        aiResponse: `${timings.aiResponse.toFixed(2)}ms`,
        contextualResponse: `${timings.contextualResponse.toFixed(2)}ms`,
        intentAnalysis: `${timings.intentAnalysis.toFixed(2)}ms`,
        ttsGeneration: `${timings.ttsGeneration.toFixed(2)}ms`,
        totalTime: `${totalTime.toFixed(2)}ms`
      });
      
      return {
        success: true,
        response: aiResponse, // Direct response field for compatibility
        crewUsed: true,
        crewType: 'AI Assistant',
        intent: intent,
        leadScore: leadScore,
        shouldHandoff: shouldHandoff,
        audioResponseUrl: audioResponseUrl, // Now includes TTS response when available
        message: customerMessage,
        sessionId: context.sessionId || 'unknown',
        timestamp: new Date().toISOString(),
        responseTime: totalTime,
        timings: timings
      };
    } catch (error) {
      const totalTime = performance.now() - startTime;
      console.error('❌ Error processing with CrewAI:', error);
      console.log(`📊 Error occurred after: ${totalTime.toFixed(2)}ms`);
      return {
        success: false,
        error: error.message,
        fallback: true,
        responseTime: totalTime
      };
    }
  }

  // Create contextual prompt based on customer message and context
  async createContextualPrompt(customerMessage, context) {
    let systemPrompt = '';
    
    // Try to get database prompts first
    try {
      const dealerPrompts = await this.getDealerPrompts(context.dealerId);
      
      if (dealerPrompts.master_prompt) {
        // Use database master prompt as base
        systemPrompt = dealerPrompts.master_prompt;
        console.log('✅ Using database master prompt for CrewAI contextual prompt');
        
        // Get dealer information to replace placeholders
        let dealerInfo = null;
        try {
          if (context.dealerId) {
            const dealerQuery = `
              SELECT business_name, contact_name, phone, address, city, state
              FROM dealers 
              WHERE id = $1
            `;
            const dealerResult = await pool.query(dealerQuery, [context.dealerId]);
            dealerInfo = dealerResult.rows[0];
            console.log('✅ Dealer info loaded for placeholder replacement:', dealerInfo);
          }
        } catch (error) {
          console.log('⚠️ Could not fetch dealer info for placeholder replacement:', error.message);
        }
        
        // Replace placeholders in the master prompt
        if (dealerInfo) {
          const dealershipName = dealerInfo.business_name || 'our dealership';
          systemPrompt = systemPrompt
            .replace(/\{dealership_name\}/g, dealershipName)
            .replace(/\{dealer_name\}/g, dealerInfo.contact_name || 'our team')
            .replace(/\{dealer_phone\}/g, dealerInfo.phone || 'our main number')
            .replace(/\{dealer_address\}/g, `${dealerInfo.address || ''}, ${dealerInfo.city || ''}, ${dealerInfo.state || ''}`.trim())
            .replace(/\{dealer_city\}/g, dealerInfo.city || 'our location')
            .replace(/\{dealer_state\}/g, dealerInfo.state || 'our area');
          
          console.log('✅ Placeholders replaced in master prompt:', {
            dealershipName,
            contactName: dealerInfo.contact_name,
            phone: dealerInfo.phone
          });
        }
        
        // ENHANCED: Add human-like response variety and personality
        systemPrompt += `\n\nCONVERSATION CONTEXT:
- This is a conversation with a customer who has already been greeted
- The customer is asking: "${customerMessage}"
- Current intent: ${context.intent || 'UNKNOWN'}
- Session ID: ${context.sessionId || 'Unknown'}
- Dealer ID: ${context.dealerId || 'Unknown'}
${dealerInfo ? `- Dealer Name: ${dealerInfo.business_name || 'Unknown'}` : ''}

ENHANCED RESPONSE STYLE - BE MORE HUMAN AND VARIED:
1. **VARY YOUR OPENING PHRASES** - Use contextually appropriate openings
   - For questions: "That's a great question!", "You know what, I love talking about...", "Let me tell you something exciting...", "This is actually one of my favorite topics...", "I'm so glad you asked about this...", "You're absolutely right to be curious about...", "This is perfect timing because...", "I've been waiting for someone to ask about...", "You're going to love hearing about...", "This is exactly what I'm passionate about..."
   - For requests: "Absolutely!", "I'd be happy to help!", "Let me show you what we have!", "You're in for a treat!", "I can't wait to share this with you!", "This is going to be fun!", "Let me break this down for you!", "I love helping customers discover...", "This is my favorite part of the job!", "You've come to the right place!"
   - For follow-ups: "Great question!", "Excellent follow-up!", "I'm glad you asked!", "That's exactly what I was thinking!", "Perfect timing!", "You read my mind!", "I was hoping you'd ask that!", "That's a smart question!", "I love your thinking!", "You're absolutely right!"

2. **ADD EMOTION AND PERSONALITY** - Show genuine excitement, empathy, and enthusiasm
   - Express real emotions: "I'm genuinely excited to tell you about...", "This really gets me fired up because...", "I can't help but get enthusiastic about...", "You're going to be thrilled when you hear...", "This is something I'm personally passionate about...", "I love helping customers discover...", "This is the kind of question that makes my day...", "I'm so excited to share this with you...", "This is absolutely my favorite thing to talk about...", "I can't wait to tell you about..."

3. **VARY SENTENCE STRUCTURES** - Mix up how you present information
   - Use different patterns: questions, exclamations, personal stories, comparisons, analogies
   - Include conversational elements: "You know what I mean?", "Here's the thing...", "Let me break this down...", "What's really cool is...", "Here's what I love about...", "The best part is...", "What makes this special is...", "I should mention...", "By the way...", "Fantastic, and here's something else..."

4. **ADD PERSONAL TOUCHES** - Make it feel like a real conversation
   - Include reactions: "Wow!", "Amazing!", "Incredible!", "Unbelievable!", "Fantastic!", "Outstanding!", "Remarkable!", "Extraordinary!", "Phenomenal!", "Spectacular!"
   - Use conversational connectors: "Actually...", "Honestly...", "Truthfully...", "Frankly...", "Seriously...", "Really...", "Genuinely...", "Sincerely...", "Absolutely...", "Definitely..."

5. **AVOID REPETITIVE PATTERNS** - Never use the same response structure twice
   - Change your approach each time
   - Mix up information presentation
   - Vary your enthusiasm level
   - Use different examples and analogies

6. **INVENTORY INTEGRATION** - ALWAYS provide specific vehicle information when requested
   - If customer asks for specific brands (Toyota, Hyundai, etc.), mention actual models from inventory
   - If customer asks for "options" or "what you have", provide specific vehicle details
   - Include real pricing, features, and availability when possible
   - Reference previous conversation context for continuity
   - **SHOW ONLY BEST 3 OPTIONS** - don't overwhelm with all inventory, be selective and helpful
   - **PRIORITIZE CLIENT PREFERENCES** - focus on their budget, preferred models, and specific needs
   - **EXPLAIN WHY** these are the best options for them specifically

IMPORTANT INSTRUCTIONS:
1. This is NOT the first greeting - the customer has already been welcomed
2. Address their SPECIFIC question: "${customerMessage}"
3. Use the appropriate response from your conversation flow based on their question
4. If they ask about test drives, use the test drive response
5. If they ask about financing, use the financing response
6. If they ask about vehicles, use the vehicle info response
7. If they ask about the dealership, provide relevant information
8. DO NOT repeat the greeting - they've already been greeted
9. Follow the sales flow progression you've been trained on
10. NEVER use placeholder text like {dealership_name} - always use the actual dealership name
11. **CRITICAL**: Make each response feel unique, human, and engaging - avoid robotic patterns!
12. **INVENTORY INTEGRATION**: When asked about specific vehicles or brands, provide actual inventory details!

RESPONSE REQUIREMENTS:
- Answer their specific question directly
- Use the appropriate prompt from your training
- Keep responses conversational and helpful
- Ask relevant follow-up questions
- Guide them through the sales process naturally
- Always use the actual dealership name, not placeholders
- **MAKE EACH RESPONSE FEEL DIFFERENT AND HUMAN** - vary your style, emotions, and approach
- **PROVIDE SPECIFIC VEHICLE INFORMATION** when inventory is requested
- **KEEP RESPONSES CONCISE** - maximum 200 tokens for clarity and focus
- **PRIORITIZE KEY INFORMATION** - focus on what the customer needs most
- **AVOID VERBOSE EXPLANATIONS** - be direct and helpful`;
        
      } else {
        // Fallback to hardcoded prompt when no database prompt found
        systemPrompt = `You are D.A.I.V.E., a helpful AI assistant for a vehicle dealership. 
    You help customers with vehicle inquiries, financing questions, test drive scheduling, and general dealership information.
    
    Current context:
    - Dealer ID: ${context.dealerId || 'Unknown'}
    - Vehicle ID: ${context.vehicleId || 'None'}
    - Session: ${context.sessionId || 'Unknown'}
    
    Customer message: "${customerMessage}"
    
    IMPORTANT: You have access to the dealership's inventory database and can provide specific vehicle information.
    If the customer asks about available vehicles, inventory, or similar options, you can access real-time data.
    
    ENHANCED RESPONSE STYLE - BE MORE HUMAN AND VARIED:
    1. **VARY YOUR OPENING PHRASES** - Use contextually appropriate openings
       - For questions: "That's a great question!", "You know what, I love talking about...", "Let me tell you something exciting...", "This is actually one of my favorite topics...", "I'm so glad you asked about this...", "You're absolutely right to be curious about...", "This is perfect timing because...", "I've been waiting for someone to ask about...", "You're going to love hearing about...", "This is exactly what I'm passionate about..."
       - For requests: "Absolutely!", "I'd be happy to help!", "Let me show you what we have!", "You're in for a treat!", "I can't wait to share this with you!", "This is going to be fun!", "Let me break this down for you!", "I love helping customers discover...", "This is my favorite part of the job!", "You've come to the right place!"
       - For follow-ups: "Great question!", "Excellent follow-up!", "I'm glad you asked!", "That's exactly what I was thinking!", "Perfect timing!", "You read my mind!", "I was hoping you'd ask that!", "That's a smart question!", "I love your thinking!", "You're absolutely right!"
    2. **ADD EMOTION AND PERSONALITY** - Show genuine excitement and enthusiasm
    3. **VARY SENTENCE STRUCTURES** - Mix up how you present information
    4. **ADD PERSONAL TOUCHES** - Make it feel like a real conversation
    5. **AVOID REPETITIVE PATTERNS** - Never use the same response structure twice
    6. **INVENTORY INTEGRATION** - ALWAYS provide specific vehicle information when requested
       - If customer asks for specific brands (Toyota, Hyundai, etc.), mention actual models from inventory
       - If customer asks for "options" or "what you have", provide specific vehicle details
       - Include real pricing, features, and availability when possible
       - Reference previous conversation context for continuity
    
    Please provide a helpful, informative response that:
    1. Addresses the customer's specific question or need
    2. Is professional but friendly and human-like
    3. Provides actionable information when possible
    4. Asks follow-up questions to better understand their needs
    5. Maintains a conversational tone
    6. **FEELS UNIQUE AND ENGAGING** - not robotic or repetitive
    7. **INCLUDES SPECIFIC VEHICLE INFORMATION** when inventory is requested
    8. **KEEPS RESPONSES CONCISE** - maximum 200 tokens for clarity and focus
    9. **PRIORITIZES KEY INFORMATION** - focus on what the customer needs most
    10. **AVOIDS VERBOSE EXPLANATIONS** - be direct and helpful
    
    Keep your response under 200 tokens and focus on being helpful and human.`;
        console.log('⚠️ No database master prompt found, using fallback hardcoded prompt');
      }
    } catch (error) {
      console.log('⚠️ Error getting database prompts, using fallback hardcoded prompt:', error.message);
      systemPrompt = `You are D.A.I.V.E., a helpful AI assistant for a vehicle dealership. 
    You help customers with vehicle inquiries, financing questions, test drive scheduling, and general dealership information.
    
    Current context:
    - Dealer ID: ${context.dealerId || 'Unknown'}
    - Vehicle ID: ${context.vehicleId || 'None'}
    - Session: ${context.sessionId || 'Unknown'}
    
    Customer message: "${customerMessage}"
    
    IMPORTANT: You have access to the dealership's inventory database and can provide specific vehicle information.
    If the customer asks about available vehicles, inventory, or similar options, you can access real-time data.
    
    ENHANCED RESPONSE STYLE - BE MORE HUMAN AND VARIED:
    1. **VARY YOUR OPENING PHRASES** - Use contextually appropriate openings
       - For questions: "That's a great question!", "You know what, I love talking about...", "Let me tell you something exciting...", "This is actually one of my favorite topics...", "I'm so glad you asked about this...", "You're absolutely right to be curious about...", "This is perfect timing because...", "I've been waiting for someone to ask about...", "You're going to love hearing about...", "This is exactly what I'm passionate about..."
       - For requests: "Absolutely!", "I'd be happy to help!", "Let me show you what we have!", "You're in for a treat!", "I can't wait to share this with you!", "This is going to be fun!", "Let me break this down for you!", "I love helping customers discover...", "This is my favorite part of the job!", "You've come to the right place!"
       - For follow-ups: "Great question!", "Excellent follow-up!", "I'm glad you asked!", "That's exactly what I was thinking!", "Perfect timing!", "You read my mind!", "I was hoping you'd ask that!", "That's a smart question!", "I love your thinking!", "You're absolutely right!"
    2. **ADD EMOTION AND PERSONALITY** - Show genuine excitement and enthusiasm
    3. **VARY SENTENCE STRUCTURES** - Mix up how you present information
    4. **ADD PERSONAL TOUCHES** - Make it feel like a real conversation
    5. **AVOID REPETITIVE PATTERNS** - Never use the same response structure twice
    6. **INVENTORY INTEGRATION** - ALWAYS provide specific vehicle information when requested
       - If customer asks for specific brands (Toyota, Hyundai, etc.), mention actual models from inventory
       - If customer asks for "options" or "what you have", provide specific vehicle details
       - Include real pricing, features, and availability when possible
       - Reference previous conversation context for continuity
    
    Please provide a helpful, informative response that:
    1. Addresses the customer's specific question or need
    2. Is professional but friendly and human-like
    3. Provides actionable information when possible
    4. Asks follow-up questions to better understand their needs
    5. Maintains a conversational tone
    6. **FEELS UNIQUE AND ENGAGING** - not robotic or repetitive
    7. **INCLUDES SPECIFIC VEHICLE INFORMATION** when inventory is requested
    8. **KEEPS RESPONSES CONCISE** - maximum 200 tokens for clarity and focus
    9. **PRIORITIZES KEY INFORMATION** - focus on what the customer needs most
    10. **AVOIDS VERBOSE EXPLANATIONS** - be direct and helpful
    
    Keep your response under 200 tokens and focus on being helpful and human.`;
    }

    return systemPrompt;
  }

  // Enhanced CrewAI contextual response generation
  // NEW FEATURES:
  // 1. **Human-like response variety** - Random emotional reactions and conversational connectors
  // 2. **Personality injection** - Adds excitement, enthusiasm, and human warmth
  // 3. **Response uniqueness** - Each response feels different and engaging
  // 4. **Anti-robotic patterns** - Prevents repetitive, mechanical responses
  // 5. **Emotional connection** - Makes customers feel like they're talking to a real person
  // 6. **Inventory integration** - Provides specific vehicle details when requested
  // 7. **Smart vehicle selection** - Shows only the best 3 options instead of overwhelming with all inventory
  async generateContextualResponse(customerMessage, aiOutput, context) {
    const contextualStartTime = performance.now();
    const contextualTimings = {};
    
    try {
      console.log('🔍 CrewAI contextual response generation STARTED');
      
      // Analyze customer intent
      const intentStart = performance.now();
      const intent = this.detectIntent(customerMessage);
      const urgency = this.assessUrgency(customerMessage);
      contextualTimings.intentDetection = performance.now() - intentStart;
      console.log(`⏱️  Intent detection: ${contextualTimings.intentDetection.toFixed(2)}ms`);
      
      // Try to get dealerId using fallback logic if not available
      const dealerIdStart = performance.now();
      if (!context.dealerId) {
        context.dealerId = await this.getDealerIdFromContext(context);
      }
      contextualTimings.dealerIdFallback = performance.now() - dealerIdStart;
      console.log(`⏱️  Dealer ID fallback: ${contextualTimings.dealerIdFallback.toFixed(2)}ms`);
      
      // ENHANCED: Add human-like response variety and personality
      let enhancedResponse = aiOutput;
      
      // Add random emotional reactions to make responses feel more human
      const emotionalReactions = [
        "Wow! ", "Amazing! ", "Incredible! ", "Fantastic! ", "Outstanding! ",
        "Remarkable! ", "Extraordinary! ", "Phenomenal! ", "Spectacular! ", "Brilliant! "
      ];
      
      // Add random conversational connectors
      const conversationalConnectors = [
        "You know what I mean? ", "Here's the thing... ", "Let me break this down... ",
        "What's really cool is... ", "Here's what I love about... ", "The best part is... ",
        "What makes this special is... ", "I should mention... ", "By the way... ",
        "Fantastic, and here's something else... ", "Actually... ", "Honestly... ",
        "Truthfully... ", "Frankly... ", "Seriously... ", "Really... ",
        "Genuinely... ", "Sincerely... ", "Absolutely... ", "Definitely... "
      ];
      
      // Add random enthusiasm variations
      const enthusiasmVariations = [
        "I'm genuinely excited to tell you about... ",
        "This really gets me fired up because... ",
        "I can't help but get enthusiastic about... ",
        "You're going to be thrilled when you hear... ",
        "This is something I'm personally passionate about... ",
        "I love helping customers discover... ",
        "This is the kind of question that makes my day... ",
        "I'm so excited to share this with you... ",
        "This is absolutely my favorite thing to talk about... ",
        "I can't wait to tell you about... "
      ];
      
      // Randomly enhance the response with human-like elements (30% chance)
      if (Math.random() < 0.3) {
        const randomReaction = emotionalReactions[Math.floor(Math.random() * emotionalReactions.length)];
        const randomConnector = conversationalConnectors[Math.floor(Math.random() * conversationalConnectors.length)];
        
        // Add emotional reaction at the beginning
        if (!enhancedResponse.startsWith('Wow') && !enhancedResponse.startsWith('Amazing') && !enhancedResponse.startsWith('Fantastic')) {
          enhancedResponse = randomReaction + enhancedResponse;
        }
        
        // Add conversational connector in the middle
        if (enhancedResponse.length > 100) {
          const midPoint = Math.floor(enhancedResponse.length / 2);
          enhancedResponse = enhancedResponse.slice(0, midPoint) + " " + randomConnector + enhancedResponse.slice(midPoint);
        }
      }
      
      // ENHANCED: Inventory integration for specific vehicle requests
      const messageLower = customerMessage.toLowerCase();
      const isAskingForVehicles = messageLower.includes('options') || 
                                 messageLower.includes('what you have') || 
                                 messageLower.includes('show me') || 
                                 messageLower.includes('share') ||
                                 messageLower.includes('toyota') ||
                                 messageLower.includes('hyundai') ||
                                 messageLower.includes('honda') ||
                                 messageLower.includes('ford') ||
                                 messageLower.includes('chevrolet');
      
      if (isAskingForVehicles && context.dealerId) {
        console.log('🚗 Customer is asking for vehicle options - integrating inventory data...');
        
        try {
          const inventoryStart = performance.now();
          
          // ENHANCED: Smart inventory selection - get more vehicles initially, then select best 3
          let inventoryQuery = `
            SELECT 
              id, make, model, year, trim, price, mileage, status, color, interior_color, features, created_at
            FROM vehicles 
            WHERE dealer_id = $1 AND status = 'available'
          `;
          
          const queryParams = [context.dealerId];
          
          // If specific brands are mentioned, filter by them
          if (messageLower.includes('toyota')) {
            inventoryQuery += ` AND make ILIKE 'toyota'`;
          } else if (messageLower.includes('hyundai')) {
            inventoryQuery += ` AND make ILIKE 'hyundai'`;
          } else if (messageLower.includes('honda')) {
            inventoryQuery += ` AND make ILIKE 'honda'`;
          } else if (messageLower.includes('ford')) {
            inventoryQuery += ` AND make ILIKE 'ford'`;
          } else if (messageLower.includes('chevrolet')) {
            inventoryQuery += ` AND make ILIKE 'chevrolet'`;
          }
          
          // Get more vehicles initially for smart selection
          inventoryQuery += ` ORDER BY created_at DESC LIMIT 15`;
          
          const inventoryResult = await pool.query(inventoryQuery, queryParams);
          const allVehicles = inventoryResult.rows;
          
          contextualTimings.inventoryLookup = performance.now() - inventoryStart;
          console.log(`⏱️  Inventory lookup: ${contextualTimings.inventoryLookup.toFixed(2)}ms`);
          
          if (allVehicles && allVehicles.length > 0) {
            console.log(`🚗 Found ${allVehicles.length} vehicles, selecting best 3 for display`);
            
            // ENHANCED: Smart selection of best 3 vehicles based on multiple criteria
            const bestVehicles = this.selectBestVehicles(allVehicles, messageLower, context);
            console.log(`🎯 Selected best 3 vehicles:`, bestVehicles.map(v => `${v.year} ${v.make} ${v.model}`));
            
            // ENHANCED: Concise inventory format for 200 token limit
            enhancedResponse += `\n\n🚗 **Best Options for You:**\n`;
            
            bestVehicles.forEach((vehicle, index) => {
              enhancedResponse += `\n**${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
              if (vehicle.trim) enhancedResponse += ` ${vehicle.trim}`;
              enhancedResponse += `** - $${vehicle.price?.toLocaleString() || 'Call for price'}`;
              if (vehicle.mileage) {
                enhancedResponse += `, ${vehicle.mileage.toLocaleString()} miles`;
              }
              enhancedResponse += `, ${vehicle.color || 'N/A'}`;
            });
            
            // Add context about selection
            if (allVehicles.length > 3) {
              enhancedResponse += `\n\n💡 *I've selected the best 3 options from ${allVehicles.length} available vehicles. Would you like to see more or get details about any of these?*`;
            }
            
            enhancedResponse += `\n\n💬 **What interests you most?** I can provide details, schedule test drives, or help with financing!`;
            
            console.log('✅ Best 3 vehicles selected and displayed (smart inventory integration)');
          } else {
            console.log('⚠️ No vehicles found for inventory integration');
            enhancedResponse += `\n\n💡 **Note:** I'm currently checking our inventory for the latest availability. Would you like me to connect you with our sales team for the most up-to-date information?`;
          }
          
        } catch (error) {
          console.error('❌ Error integrating inventory data:', error);
          enhancedResponse += `\n\n💡 **Note:** I'm having trouble accessing our current inventory. Let me connect you with our sales team for the most up-to-date information!`;
        }
      }
      
      // Add vehicle-specific information if available
      if (context.vehicleId) {
        const vehicleDetailsStart = performance.now();
        const vehicleInfo = await this.getVehicleContext(context.vehicleId);
        contextualTimings.vehicleDetails = performance.now() - vehicleDetailsStart;
        console.log(`⏱️  Vehicle details lookup: ${contextualTimings.vehicleDetails.toFixed(2)}ms`);
        
        if (vehicleInfo) {
          console.log(`🚗 VEHICLE CONTEXT: Focusing on ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} (ID: ${context.vehicleId})`);
          
          // Only show full vehicle details if this is the first time or explicitly requested
          const isFirstVehicleQuery = !enhancedResponse.includes('VEHICLE DETAILS');
          if (isFirstVehicleQuery) {
            enhancedResponse += `\n\n**🚗 ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}${vehicleInfo.trim ? ` ${vehicleInfo.trim}` : ''}**\n`;
            enhancedResponse += `• Price: ${vehicleInfo.price ? `$${vehicleInfo.price.toLocaleString()}` : 'Available upon request'}\n`;
            enhancedResponse += `• Mileage: ${vehicleInfo.mileage ? `${vehicleInfo.mileage.toLocaleString()} miles` : 'Available upon request'}\n`;
            enhancedResponse += `• Status: ${vehicleInfo.status || 'Available'}\n`;
          }
          
          // If we don't have dealerId in context but we have vehicle info, use the dealer_id from vehicle
          if (!context.dealerId && vehicleInfo.dealer_id) {
            context.dealerId = vehicleInfo.dealer_id;
            console.log('🔧 FALLBACK: Using dealer_id from vehicle context:', context.dealerId);
          }
        }
      }
      
      const totalContextualTime = performance.now() - contextualStartTime;
      console.log('📊 CrewAI CONTEXTUAL RESPONSE COMPLETE - Total Time:', `${totalContextualTime.toFixed(2)}ms`);
      console.log('📊 Contextual Response Timings:', {
        intentDetection: `${contextualTimings.intentDetection?.toFixed(2) || 'N/A'}ms`,
        dealerIdFallback: `${contextualTimings.dealerIdFallback?.toFixed(2) || 'N/A'}ms`,
        inventoryLookup: `${contextualTimings.inventoryLookup?.toFixed(2) || 'N/A'}ms`,
        vehicleDetails: `${contextualTimings.vehicleDetails?.toFixed(2) || 'N/A'}ms`,
        totalContextualTime: `${totalContextualTime.toFixed(2)}ms`
      });
      
      return enhancedResponse;
    } catch (error) {
      const totalContextualTime = performance.now() - contextualStartTime;
      console.error('❌ Error generating contextual response:', error);
      console.log(`📊 Contextual response error occurred after: ${totalContextualTime.toFixed(2)}ms`);
      return aiOutput; // Return original AI response if enhancement fails
    }
  }

  // ENHANCED: Smart vehicle selection method - selects best 3 vehicles from larger inventory
  // This prevents overwhelming the chat with too many options while showing the most relevant vehicles
  selectBestVehicles(allVehicles, customerMessage, context) {
    try {
      console.log('🎯 Starting CLIENT-FOCUSED vehicle selection from', allVehicles.length, 'available vehicles');
      
      // Convert customer message to lowercase for analysis
      const messageLower = customerMessage.toLowerCase();
      
      // EXTRACT CLIENT PREFERENCES from conversation context
      const clientPreferences = this.extractClientPreferences(customerMessage, context);
      console.log('👤 Client preferences extracted:', clientPreferences);
      
      // Score each vehicle based on CLIENT PREFERENCES (not generic criteria)
      const scoredVehicles = allVehicles.map(vehicle => {
        let score = 0;
        
        // 1. BUDGET MATCH SCORE (HIGHEST PRIORITY - 40 points max)
        if (clientPreferences.budgetRange && vehicle.price) {
          const { minBudget, maxBudget, preferredBudget } = clientPreferences.budgetRange;
          
          if (vehicle.price >= minBudget && vehicle.price <= maxBudget) {
            // Perfect budget match
            score += 40;
            
            // Bonus for being close to preferred budget
            if (preferredBudget) {
              const budgetDiff = Math.abs(vehicle.price - preferredBudget);
              if (budgetDiff <= 2000) score += 10;      // Very close
              else if (budgetDiff <= 5000) score += 5;  // Close
            }
          } else if (vehicle.price <= maxBudget * 1.1) {
            // Slightly above budget but still affordable
            score += 25;
          } else if (vehicle.price >= minBudget * 0.9) {
            // Slightly below budget but good value
            score += 20;
          } else {
            // Outside budget range
            score -= 20;
          }
        }
        
        // 2. MODEL PREFERENCE SCORE (HIGH PRIORITY - 35 points max)
        if (clientPreferences.preferredModels && clientPreferences.preferredModels.length > 0) {
          const vehicleModel = vehicle.model.toLowerCase();
          const vehicleMake = vehicle.make.toLowerCase();
          
          // Exact model match
          if (clientPreferences.preferredModels.some(model => 
            vehicleModel.includes(model.toLowerCase()) || 
            vehicleMake.includes(model.toLowerCase())
          )) {
            score += 35;
          }
          // Similar model family
          else if (clientPreferences.preferredModels.some(model => 
            this.isSimilarModel(vehicleModel, model.toLowerCase())
          )) {
            score += 25;
          }
          // Same brand
          else if (clientPreferences.preferredModels.some(model => 
            vehicleMake.includes(model.toLowerCase())
          )) {
            score += 15;
          }
        }
        
        // 3. VEHICLE TYPE PREFERENCE (HIGH PRIORITY - 30 points max)
        if (clientPreferences.vehicleType) {
          const vehicleType = clientPreferences.vehicleType.toLowerCase();
          const vehicleModel = vehicle.model.toLowerCase();
          
          if (vehicleType === 'suv' && this.isSUV(vehicleModel)) score += 30;
          else if (vehicleType === 'sedan' && this.isSedan(vehicleModel)) score += 30;
          else if (vehicleType === 'truck' && this.isTruck(vehicleModel)) score += 30;
          else if (vehicleType === 'family' && this.isFamilyVehicle(vehicleModel)) score += 30;
        }
        
        // 4. FEATURE PREFERENCES (MEDIUM PRIORITY - 20 points max)
        if (clientPreferences.features && vehicle.features) {
          const features = vehicle.features.toString().toLowerCase();
          const matchedFeatures = clientPreferences.features.filter(feature => 
            features.includes(feature.toLowerCase())
          );
          score += (matchedFeatures.length * 5); // 5 points per matched feature
        }
        
        // 5. CONDITION PREFERENCE (MEDIUM PRIORITY - 15 points max)
        if (clientPreferences.conditionPreference) {
          const condition = clientPreferences.conditionPreference.toLowerCase();
          
          if (condition === 'new' && vehicle.year >= new Date().getFullYear()) score += 15;
          else if (condition === 'like-new' && vehicle.year >= new Date().getFullYear() - 1 && vehicle.mileage <= 15000) score += 15;
          else if (condition === 'low-mileage' && vehicle.mileage <= 25000) score += 15;
          else if (condition === 'reliable' && vehicle.year >= new Date().getFullYear() - 3) score += 10;
        }
        
        // 6. RECENCY BONUS (LOWER PRIORITY - 10 points max)
        const currentYear = new Date().getFullYear();
        const yearDiff = currentYear - vehicle.year;
        if (yearDiff === 0) score += 10;        // Current year
        else if (yearDiff === 1) score += 8;    // Last year
        else if (yearDiff === 2) score += 5;    // 2 years ago
        
        // 7. MILEAGE BONUS (LOWER PRIORITY - 10 points max)
        if (vehicle.mileage) {
          if (vehicle.mileage <= 10000) score += 10;      // Very low mileage
          else if (vehicle.mileage <= 25000) score += 8;  // Low mileage
          else if (vehicle.mileage <= 50000) score += 5;  // Moderate mileage
        }
        
        return { ...vehicle, score, clientPreferences };
      });
      
      // Sort by score (highest first) and take top 3
      const bestVehicles = scoredVehicles
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      console.log('🎯 CLIENT-FOCUSED vehicle selection results:');
      bestVehicles.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model} - Score: ${vehicle.score}`);
        console.log(`      Price: $${vehicle.price}, Mileage: ${vehicle.mileage}, Budget Match: ${vehicle.price >= (clientPreferences.budgetRange?.minBudget || 0) && vehicle.price <= (clientPreferences.budgetRange?.maxBudget || 999999) ? '✅' : '❌'}`);
      });
      
      return bestVehicles;
      
    } catch (error) {
      console.error('❌ Error in client-focused vehicle selection:', error);
      // Fallback: return first 3 vehicles by creation date
      return allVehicles.slice(0, 3);
    }
  }

  // Initialize CrewAI when service starts
  async initialize(dealerId = null) {
    console.log('🚀 Initializing Unified DAIVE Service...');
    
    try {
      // Step 1: Initialize settings manager first
      console.log('📋 Step 1: Initializing Settings Manager...');
      const settingsInitialized = await this.initializeSettings();
      
      if (!settingsInitialized) {
        console.warn('⚠️ Settings Manager failed to initialize, continuing with fallback mode');
      }
      
      // Step 2: Initialize CrewAI LLM with settings from centralized manager
      console.log(`🤖 Step 2: Initializing CrewAI LLM for dealer: ${dealerId || 'global'}...`);
      await this.initializeCrewAI(this.maxTokens, dealerId);
      
      // Step 3: Mark service as initialized
      this.isInitialized = true;
      
      console.log('✅ Unified DAIVE Service initialized successfully');
      console.log(`📊 Service Status: Settings=${settingsInitialized ? '✅' : '❌'}, CrewAI=${this.crewAI ? '✅' : '❌'}, Dealer=${dealerId || 'Global'}`);
      
    } catch (error) {
      console.error('❌ Error during DAIVE Service initialization:', error);
      console.log('⚠️ Service will continue in fallback mode');
      this.isInitialized = false;
    }
  }

  // Generate simple fallback response for when CrewAI is not available
  generateSimpleFallbackResponse(userMessage, context) {
    const message = userMessage.toLowerCase();
    
    // Basic fallback responses based on message content
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return "Hi! I'm D.A.I.V.E., your AI assistant. I'm currently experiencing some technical difficulties, but I'd be happy to help you once I'm back online. How can I assist you today?";
    }
    
    if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
      return "I understand you're asking about pricing, but I'm currently having technical issues. Please check our website for current pricing or contact our sales team for the most up-to-date information.";
    }
    
    if (message.includes('test drive') || message.includes('drive') || message.includes('schedule')) {
      return "I'd be happy to help you schedule a test drive! However, I'm experiencing some technical difficulties right now. Please contact our sales team directly or try again in a few minutes.";
    }
    
    if (message.includes('finance') || message.includes('payment') || message.includes('loan')) {
      return "I'd love to help with financing questions, but I'm experiencing some technical difficulties. Please contact our finance department directly or try again later.";
    }
    
    if (message.includes('feature') || message.includes('spec') || message.includes('detail')) {
      return "I'd be happy to tell you about vehicle features! However, I'm currently experiencing technical difficulties. Please check our website for detailed specifications or contact our sales team.";
    }
    
    if (message.includes('inventory') || message.includes('available') || message.includes('stock')) {
      return "I'd love to help you find vehicles in our inventory, but I'm currently experiencing technical issues. Please browse our website or contact our sales team for current availability.";
    }
    
    if (message.includes('contact') || message.includes('speak') || message.includes('human')) {
      return "I understand you'd like to speak with a human representative. I'm currently experiencing technical difficulties, but I'll connect you with our team right away. Please call us or visit our dealership.";
    }
    
    // Default response
    return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or contact our team directly for immediate assistance.";
  }

  // EXTRACT CLIENT PREFERENCES from conversation context and message
  extractClientPreferences(customerMessage, context) {
    const messageLower = customerMessage.toLowerCase();
    const preferences = {
      budgetRange: null,
      preferredModels: [],
      vehicleType: null,
      features: [],
      conditionPreference: null
    };

    // 1. EXTRACT BUDGET PREFERENCES
    const budgetPatterns = [
      // Specific amounts
      /\$?(\d{1,3}(?:,\d{3})*(?:k|000)?)/gi,
      // Ranges
      /(\d{1,3}(?:,\d{3})*(?:k|000)?)\s*[-–]\s*(\d{1,3}(?:,\d{3})*(?:k|000)?)/gi,
      // "Under" or "Around" amounts
      /(?:under|around|about|approximately)\s*\$?(\d{1,3}(?:,\d{3})*(?:k|000)?)/gi,
      // Monthly payment preferences
      /(\d{1,3}(?:,\d{3})*)\s*(?:per month|monthly|monthly payment)/gi
    ];

    let budgetMatches = [];
    budgetPatterns.forEach(pattern => {
      const matches = messageLower.match(pattern);
      if (matches) budgetMatches.push(...matches);
    });

    if (budgetMatches.length > 0) {
      const amounts = budgetMatches.map(match => this.parsePrice(match)).filter(amount => amount > 0);
      if (amounts.length > 0) {
        if (amounts.length === 1) {
          // Single amount - create range around it
          const amount = amounts[0];
          preferences.budgetRange = {
            minBudget: Math.max(amount * 0.8, 10000), // 20% below
            maxBudget: amount * 1.2,                   // 20% above
            preferredBudget: amount
          };
        } else {
          // Multiple amounts - use as range
          const minAmount = Math.min(...amounts);
          const maxAmount = Math.max(...amounts);
          preferences.budgetRange = {
            minBudget: minAmount,
            maxBudget: maxAmount,
            preferredBudget: (minAmount + maxAmount) / 2
          };
        }
      }
    }

    // 2. EXTRACT MODEL PREFERENCES
    const modelKeywords = [
      'toyota', 'hyundai', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi', 'lexus',
      'rav4', 'cr-v', 'tucson', 'escape', 'equinox', 'camry', 'accord', 'civic', 'corolla',
      'highlander', 'pilot', 'atlas', 'explorer', 'traverse', 'pathfinder'
    ];

    preferences.preferredModels = modelKeywords.filter(keyword => 
      messageLower.includes(keyword)
    );

    // 3. EXTRACT VEHICLE TYPE PREFERENCES
    if (messageLower.includes('suv') || messageLower.includes('crossover')) preferences.vehicleType = 'suv';
    else if (messageLower.includes('sedan') || messageLower.includes('car')) preferences.vehicleType = 'sedan';
    else if (messageLower.includes('truck') || messageLower.includes('pickup')) preferences.vehicleType = 'truck';
    else if (messageLower.includes('family') || messageLower.includes('family-friendly')) preferences.vehicleType = 'family';

    // 4. EXTRACT FEATURE PREFERENCES
    const featureKeywords = [
      'safety', 'technology', 'luxury', 'efficiency', 'fuel economy', 'mpg', 'hybrid', 'electric',
      'all-wheel drive', 'awd', 'backup camera', 'blind spot', 'lane assist', 'adaptive cruise',
      'leather', 'sunroof', 'navigation', 'bluetooth', 'apple carplay', 'android auto'
    ];

    preferences.features = featureKeywords.filter(keyword => 
      messageLower.includes(keyword)
    );

    // 5. EXTRACT CONDITION PREFERENCES
    if (messageLower.includes('new') || messageLower.includes('brand new')) preferences.conditionPreference = 'new';
    else if (messageLower.includes('like new') || messageLower.includes('barely used')) preferences.conditionPreference = 'like-new';
    else if (messageLower.includes('low mileage') || messageLower.includes('low miles')) preferences.conditionPreference = 'low-mileage';
    else if (messageLower.includes('reliable') || messageLower.includes('dependable')) preferences.conditionPreference = 'reliable';

    console.log('🔍 Extracted client preferences:', preferences);
    return preferences;
  }

  // VEHICLE CLASSIFICATION HELPERS
  isSUV(model) {
    const suvModels = ['rav4', 'cr-v', 'tucson', 'escape', 'equinox', 'highlander', 'pilot', 'atlas', 'explorer', 'traverse', 'pathfinder', 'murano', 'edge', 'blazer'];
    return suvModels.some(suvModel => model.includes(suvModel));
  }

  isSedan(model) {
    const sedanModels = ['camry', 'accord', 'civic', 'corolla', 'sonata', 'altima', 'malibu', 'fusion', 'impala', 'avalon', 'maxima'];
    return sedanModels.some(sedanModel => model.includes(sedanModel));
  }

  isTruck(model) {
    const truckModels = ['f-150', 'silverado', 'sierra', 'tacoma', 'tundra', 'ridgeline', 'frontier', 'titan'];
    return truckModels.some(truckModel => model.includes(truckModel));
  }

  isFamilyVehicle(model) {
    const familyModels = ['highlander', 'pilot', 'atlas', 'explorer', 'traverse', 'pathfinder', 'durango', 'enclave'];
    return familyModels.some(familyModel => model.includes(familyModel));
  }

  isSimilarModel(vehicleModel, preferredModel) {
    // Check if models are in the same family/category
    const modelFamilies = {
      'rav4': ['escape', 'tucson', 'cr-v', 'equinox'],
      'cr-v': ['rav4', 'tucson', 'escape', 'equinox'],
      'tucson': ['rav4', 'cr-v', 'escape', 'equinox'],
      'escape': ['rav4', 'cr-v', 'tucson', 'equinox'],
      'camry': ['accord', 'sonata', 'altima', 'malibu'],
      'accord': ['camry', 'sonata', 'altima', 'malibu'],
      'civic': ['corolla', 'sentra', 'cruze', 'focus'],
      'corolla': ['civic', 'sentra', 'cruze', 'focus']
    };

    return modelFamilies[preferredModel]?.some(similarModel => 
      vehicleModel.includes(similarModel)
    ) || false;
  }

  // NEW: Initialize embedding model for context management
  async initializeEmbeddings() {
    try {
      if (!this.embeddingModel) {
        // Try to get API key from settings first, then environment
        let apiKey = process.env.OPENAI_API_KEY;
        
        if (this.settingsManager) {
          try {
            const apiKeys = await this.settingsManager.getAPIKeys('global');
            if (apiKeys.openai) {
              apiKey = apiKeys.openai;
            }
          } catch (error) {
            console.warn('⚠️ Could not get API key from settings:', error.message);
          }
        }
        
        if (apiKey) {
          this.embeddingModel = new OpenAIEmbeddings({
            openAIApiKey: apiKey,
            modelName: 'text-embedding-3-small', // Use the working model that you have access to
          });
          console.log('✅ Embedding model initialized for context management');
        } else {
          console.warn('⚠️ No OpenAI API key available for embeddings');
          this.embeddingModel = null;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not initialize embedding model:', error.message);
      this.embeddingModel = null;
    }
  }

  // NEW: Store conversation context with embeddings
  async storeConversationContext(sessionId, userMessage, aiResponse, metadata = {}) {
    try {
      // Always store in chat history (fallback when embeddings not available)
      const conversationEntry = {
        timestamp: new Date().toISOString(),
        userMessage,
        aiResponse,
        metadata,
        combinedText: `${userMessage}\n\n${aiResponse}`,
      };

      // Add to chat history
      if (!this.chatHistory.has(sessionId)) {
        this.chatHistory.set(sessionId, []);
      }
      this.chatHistory.get(sessionId).push(conversationEntry);

      // Keep only last 20 conversations for memory efficiency
      if (this.chatHistory.get(sessionId).length > 20) {
        this.chatHistory.get(sessionId).shift();
      }

      // Only use embeddings if available
      if (this.embeddingModel) {
        try {
          // Create vector store for this session if it doesn't exist
          if (!this.contextVectorStore.has(sessionId)) {
            this.contextVectorStore.set(sessionId, await MemoryVectorStore.fromTexts(
              [],
              [],
              this.embeddingModel
            ));
          }

          // Add conversation to vector store
          const vectorStore = this.contextVectorStore.get(sessionId);
          await vectorStore.addDocuments([
            {
              pageContent: conversationEntry.combinedText,
              metadata: {
                ...conversationEntry.metadata,
                sessionId,
                timestamp: conversationEntry.timestamp,
              }
            }
          ]);

          console.log(`💾 Conversation context stored with embeddings for session: ${sessionId}`);
        } catch (embeddingError) {
          console.warn('⚠️ Embedding storage failed, using chat history only:', embeddingError.message);
        }
      } else {
        console.log(`💾 Conversation context stored in chat history for session: ${sessionId} (embeddings not available)`);
      }
    } catch (error) {
      console.warn('⚠️ Could not store conversation context:', error.message);
    }
  }

  // NEW: Retrieve relevant conversation context
  async retrieveConversationContext(sessionId, currentMessage, limit = 5) {
    try {
      // If embeddings are available, use vector similarity search
      if (this.embeddingModel && this.contextVectorStore.has(sessionId)) {
        try {
          const vectorStore = this.contextVectorStore.get(sessionId);
          const results = await vectorStore.similaritySearch(currentMessage, limit);
          console.log(`🔍 Retrieved ${results.length} relevant conversation contexts using embeddings for session: ${sessionId}`);
          return results;
        } catch (embeddingError) {
          console.warn('⚠️ Embedding search failed, falling back to chat history:', embeddingError.message);
        }
      }

      // Fallback: use simple keyword matching from chat history
      if (this.chatHistory.has(sessionId)) {
        const chatHistory = this.chatHistory.get(sessionId);
        const currentKeywords = this.extractKeywords(currentMessage.toLowerCase());
        
        // Score conversations based on keyword overlap
        const scoredConversations = chatHistory.map(entry => {
          const entryKeywords = this.extractKeywords(entry.combinedText.toLowerCase());
          const commonKeywords = currentKeywords.filter(k => entryKeywords.includes(k));
          const score = commonKeywords.length;
          
          return {
            pageContent: entry.combinedText,
            metadata: entry.metadata,
            score
          };
        });

        // Sort by score and return top results
        const results = scoredConversations
          .filter(conv => conv.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(conv => ({
            pageContent: conv.pageContent,
            metadata: conv.metadata
          }));

        console.log(`🔍 Retrieved ${results.length} relevant conversation contexts using keyword matching for session: ${sessionId}`);
        return results;
      }

      return [];
    } catch (error) {
      console.warn('⚠️ Could not retrieve conversation context:', error.message);
      return [];
    }
  }

  // NEW: Extract and update user preferences from conversation
  async updateUserPreferences(sessionId, userMessage, aiResponse) {
    try {
      if (!this.userPreferences.has(sessionId)) {
        this.userPreferences.set(sessionId, {
          budgetRange: null,
          preferredModels: [],
          vehicleType: null,
          features: [],
          conditionPreference: null,
          lastUpdated: new Date().toISOString(),
          conversationCount: 0,
        });
      }

      const preferences = this.userPreferences.get(sessionId);
      preferences.conversationCount++;
      preferences.lastUpdated = new Date().toISOString();

      // Extract preferences from current message
      const extractedPrefs = this.extractClientPreferences(userMessage, {});
      
      // Update preferences (merge with existing)
      if (extractedPrefs.budgetRange) {
        preferences.budgetRange = extractedPrefs.budgetRange;
      }
      if (extractedPrefs.preferredModels.length > 0) {
        preferences.preferredModels = [...new Set([...preferences.preferredModels, ...extractedPrefs.preferredModels])];
      }
      if (extractedPrefs.vehicleType) {
        preferences.vehicleType = extractedPrefs.vehicleType;
      }
      if (extractedPrefs.features.length > 0) {
        preferences.features = [...new Set([...preferences.features, ...extractedPrefs.features])];
      }
      if (extractedPrefs.conditionPreference) {
        preferences.conditionPreference = extractedPrefs.conditionPreference;
      }

      console.log(`👤 User preferences updated for session: ${sessionId}`, preferences);
    } catch (error) {
      console.warn('⚠️ Could not update user preferences:', error.message);
    }
  }

  // NEW: Generate context-aware response that avoids repetition
  async generateContextAwareResponse(userMessage, sessionId, baseResponse, context = {}) {
    try {
      // Retrieve relevant conversation history
      const conversationContext = await this.retrieveConversationContext(sessionId, userMessage, 3);
      
      // Get user preferences
      const userPrefs = this.userPreferences.get(sessionId) || {};
      
      // Check for repetition in recent conversations
      const isRepetitive = this.checkForRepetition(userMessage, conversationContext);
      
      if (isRepetitive) {
        console.log('🔄 Detected repetitive question - providing context-aware response');
        return this.generateNonRepetitiveResponse(userMessage, userPrefs, conversationContext, baseResponse);
      }

      // Check if we need to ask for clarification
      const needsClarification = this.needsClarification(userMessage, userPrefs, conversationContext);
      
      if (needsClarification) {
        console.log('❓ User needs clarification - asking specific questions');
        return this.generateClarificationResponse(userMessage, userPrefs, conversationContext);
      }

      // Generate enhanced response with context
      return this.generateEnhancedContextResponse(userMessage, userPrefs, conversationContext, baseResponse);
      
    } catch (error) {
      console.error('❌ Error generating context-aware response:', error);
      return baseResponse;
    }
  }

  // NEW: Check if user is asking repetitive questions
  checkForRepetition(currentMessage, conversationContext) {
    const currentLower = currentMessage.toLowerCase();
    
    for (const context of conversationContext) {
      const contextLower = context.pageContent.toLowerCase();
      
      // Check for similar questions
      if (this.calculateSimilarity(currentLower, contextLower) > 0.7) {
        return true;
      }
      
      // Check for repeated keywords
      const currentKeywords = this.extractKeywords(currentLower);
      const contextKeywords = this.extractKeywords(contextLower);
      const commonKeywords = currentKeywords.filter(k => contextKeywords.includes(k));
      
      if (commonKeywords.length >= 3) {
        return true;
      }
    }
    
    return false;
  }

  // NEW: Calculate text similarity
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // NEW: Extract keywords from text
  extractKeywords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall']);
    
    return text
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word.toLowerCase()))
      .map(word => word.toLowerCase().replace(/[^\w]/g, ''));
  }

  // NEW: Check if user needs clarification
  needsClarification(userMessage, userPrefs, conversationContext) {
    // If this is one of the first few messages and we don't have preferences
    if (conversationContext.length < 2 && Object.keys(userPrefs).length === 0) {
      return true;
    }
    
    // If user is asking about vehicles but we don't have specific preferences
    const isVehicleQuestion = userMessage.toLowerCase().includes('vehicle') || 
                             userMessage.toLowerCase().includes('car') || 
                             userMessage.toLowerCase().includes('suv');
    
    if (isVehicleQuestion && !userPrefs.budgetRange && !userPrefs.vehicleType) {
      return true;
    }
    
    return false;
  }

  // NEW: Generate non-repetitive response
  generateNonRepetitiveResponse(userMessage, userPrefs, conversationContext, baseResponse) {
    let response = "I understand you're asking about this again! ";
    
    // Reference previous conversation
    if (conversationContext.length > 0) {
      const lastContext = conversationContext[0];
      response += `Based on our previous conversation, `;
      
      if (userPrefs.budgetRange) {
        response += `you mentioned you're looking in the $${userPrefs.budgetRange.minBudget?.toLocaleString()}-$${userPrefs.budgetRange.maxBudget?.toLocaleString()} range. `;
      }
      
      if (userPrefs.vehicleType) {
        response += `You're interested in ${userPrefs.vehicleType}s. `;
      }
      
      if (userPrefs.preferredModels.length > 0) {
        response += `You've shown interest in ${userPrefs.preferredModels.join(', ')}. `;
      }
    }
    
    response += `Let me provide you with updated information or help you with the next step. `;
    response += baseResponse;
    
    return response;
  }

  // NEW: Generate clarification response
  generateClarificationResponse(userMessage, userPrefs, conversationContext) {
    let response = "I'd love to help you find the perfect vehicle! To give you the best recommendations, could you help me understand:\n\n";
    
    if (!userPrefs.budgetRange) {
      response += "💰 **Budget**: What's your target price range? (e.g., under $30,000, $25,000-$35,000)\n";
    }
    
    if (!userPrefs.vehicleType) {
      response += "🚗 **Vehicle Type**: Are you looking for an SUV, sedan, truck, or something else?\n";
    }
    
    if (!userPrefs.preferredModels.length) {
      response += "🏷️ **Brands/Models**: Any specific brands or models you're interested in?\n";
    }
    
    if (!userPrefs.features.length) {
      response += "✨ **Features**: Any must-have features? (safety, technology, fuel efficiency, etc.)\n";
    }
    
    response += "\nOnce I know your preferences, I can show you the perfect options from our inventory!";
    
    return response;
  }

  // NEW: Generate enhanced context response
  generateEnhancedContextResponse(userMessage, userPrefs, conversationContext, baseResponse) {
    let response = baseResponse;
    
    // Add context about user preferences if relevant
    if (userPrefs.budgetRange && userMessage.toLowerCase().includes('price')) {
      response += `\n\n💡 **Based on your budget**: I'm focusing on vehicles in your $${userPrefs.budgetRange.minBudget?.toLocaleString()}-$${userPrefs.budgetRange.maxBudget?.toLocaleString()} range.`;
    }
    
    if (userPrefs.vehicleType && userMessage.toLowerCase().includes(userPrefs.vehicleType)) {
      response += `\n\n🎯 **Perfect match**: I know you're interested in ${userPrefs.vehicleType}s, so I've prioritized those options.`;
    }
    
    // Add conversation continuity
    if (conversationContext.length > 0) {
      const lastContext = conversationContext[0];
      if (lastContext.metadata.intent === 'INVENTORY_QUERY') {
        response += `\n\n🔄 **Continuing from our previous conversation**: I'm building on what we discussed about your vehicle preferences.`;
      }
    }
    
    return response;
  }

  // NEW: Initialize method with embeddings
  async initialize() {
    if (this.initialized) {
      console.log('✅ DAIVE Service already initialized');
      return;
    }

    try {
      console.log('🤖 Step 1: Initializing Settings Manager...');
      this.settingsManager = settingsManager;
      await this.settingsManager.initialize();
      console.log('✅ Settings Manager initialized in DAIVE Service');

      // NEW: Initialize embeddings for context management
      console.log('🤖 Step 1.5: Initializing Embedding Model...');
      await this.initializeEmbeddings();

      console.log('🤖 Step 2: Initializing CrewAI LLM for dealer: global...');
      await this.initializeCrewAI('global');

      this.initialized = true;
      console.log('✅ Unified DAIVE Service initialized successfully');
      
      // Log service status
      const crewAIStatus = this.crewAI ? '✅' : '❌';
      console.log(`📊 Service Status: Settings=✅, CrewAI=${crewAIStatus}, Dealer=Global`);

    } catch (error) {
      console.error('❌ Error initializing DAIVE Service:', error);
      throw error;
    }
  }

  // NEW: Initialize CrewAI LLM for a specific dealer
  async initializeCrewAI(dealerId) {
    try {
      console.log(`⚙️ Using cached settings for dealer: ${dealerId}`);
      
      // Try to get API key from the specified dealer first
      let openaiKey = null;
      
      if (this.settingsManager) {
        try {
          const apiKeys = await this.settingsManager.getAPIKeys(dealerId);
          if (apiKeys.openai) {
            openaiKey = apiKeys.openai;
            console.log(`🔑 Got OpenAI API key from dealer: ${dealerId}`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not get API keys from dealer ${dealerId}:`, error.message);
        }
      }
      
      // If no key from specified dealer, try to get from any available dealer
      if (!openaiKey) {
        openaiKey = await this.getAvailableOpenAIKey();
      }
      
      if (!openaiKey) {
        console.warn(`⚠️ OpenAI API key not found anywhere - Crew AI will use fallback responses`);
        this.crewAI = null;
        return;
      }

      // Initialize OpenAI LLM with configurable maxTokens
      this.crewAI = new ChatOpenAI({
        openAIApiKey: openaiKey,
        modelName: 'gpt-4o-mini',
        maxTokens: this.maxTokens,
        temperature: 0.7,
        streaming: false
      });
      
      console.log(`✅ CrewAI LLM initialized for dealer: ${dealerId} with available API key`);
      
    } catch (error) {
      console.error('❌ Error initializing CrewAI LLM:', error);
      this.crewAI = null;
    }
  }

  // NEW: Get API key dynamically from any available dealer
  async getAvailableOpenAIKey() {
    try {
      // First try to get from the current dealer if we have one
      if (this.settingsManager) {
        // Try to get from any dealer that has an OpenAI key
        const result = await pool.query(`
          SELECT dealer_id, setting_value 
          FROM daive_api_settings 
          WHERE setting_type = 'openai_key' AND setting_value IS NOT NULL 
          ORDER BY dealer_id NULLS FIRST 
          LIMIT 1
        `);
        
        if (result.rows.length > 0) {
          const { dealer_id, setting_value } = result.rows[0];
          console.log(`🔑 Found OpenAI API key from dealer: ${dealer_id || 'global'}`);
          return setting_value;
        }
      }
      
      // Fallback to environment variable
      if (process.env.OPENAI_API_KEY) {
        console.log('🔑 Using OpenAI API key from environment variable');
        return process.env.OPENAI_API_KEY;
      }
      
      console.warn('⚠️ No OpenAI API key found anywhere');
      return null;
    } catch (error) {
      console.error('❌ Error getting OpenAI API key:', error);
      return null;
    }
  }

  // NEW: Process conversation with AI (CrewAI or fallback)
  async processWithAI(sessionId, vehicleId, userMessage, customerInfo) {
    const startTime = performance.now();
    const timings = {};
    
    try {
      console.log('🚀 CrewAI processWithAI STARTED:', {
        dealerId: customerInfo.dealerId,
        vehicleId,
        sessionId,
        hasCustomerInfo: !!customerInfo,
        customerInfoKeys: customerInfo ? Object.keys(customerInfo) : [],
        serviceInitialized: this.initialized,
        crewLLMAvailable: !!this.crewAI
      });

      // Check if CrewAI is available
      if (!this.crewAI) {
        console.log('⚠️ CrewAI LLM not available, using fallback response');
        
        const fallbackResponse = "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or contact our team directly for immediate assistance.";
        
        timings.crewAIProcessing = performance.now() - startTime;
        console.log(`⏱️  CrewAI processing: ${timings.crewAIProcessing.toFixed(2)}ms`);
        
        return {
          response: fallbackResponse,
          hasInventory: false,
          crewUsed: true,
          intent: 'FALLBACK',
          leadScore: 0,
          processingTime: timings.crewAIProcessing
        };
      }

      // Get dealer info and prompts
      const dealerInfo = await this.getDealerInfo(customerInfo.dealerId);
      const prompts = await this.getPrompts(customerInfo.dealerId);
      
      // Create system prompt
      let systemPrompt = this.buildSystemPrompt(dealerInfo, prompts, customerInfo);
      
      // CRITICAL: Add strict formatting instructions to prevent email format
      systemPrompt += `\n\n🚫 FORMATTING RULES - FOLLOW THESE EXACTLY:
- NEVER use email format (no Subject:, Hi Customer, etc.)
- NEVER start with "Subject:" or email headers
- Respond in natural chat conversation style
- Use friendly, casual language
- Keep it conversational, not formal business communication
- If you start to write an email, STOP and rewrite as a chat message`;
      
      // Create user message
      const userPrompt = `Customer Message: "${userMessage}"\n\nPlease provide a helpful response.`;
      
      // Get AI response
      const aiStart = performance.now();
      const response = await this.crewAI.invoke([
        new HumanMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);
      timings.aiResponse = performance.now() - aiStart;
      console.log(`⏱️  AI response generation: ${timings.aiResponse.toFixed(2)}ms`);
      
      const totalTime = performance.now() - startTime;
      timings.crewAIProcessing = totalTime;
      console.log(`⏱️  CrewAI processing: ${timings.crewAIProcessing.toFixed(2)}ms`);
      
      return {
        response: response.content,
        hasInventory: false,
        crewUsed: true,
        intent: 'AI_RESPONSE',
        leadScore: this.calculateLeadScore(userMessage),
        processingTime: totalTime
      };
      
    } catch (error) {
      console.error('❌ Error in CrewAI processing:', error);
      const totalTime = performance.now() - startTime;
      
      return {
        response: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or contact our team directly for immediate assistance.",
        hasInventory: false,
        crewUsed: true,
        intent: 'ERROR',
        leadScore: 0,
        error: error.message,
        processingTime: totalTime
      };
    }
  }

  // NEW: Helper methods for CrewAI processing
  async getDealerInfo(dealerId) {
    try {
      const result = await pool.query(
        'SELECT business_name, contact_name, phone, email, address FROM dealers WHERE id = $1',
        [dealerId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.warn('⚠️ Could not get dealer info:', error.message);
      return null;
    }
  }

  async getPrompts(dealerId) {
    try {
      const result = await pool.query(
        'SELECT prompt_type, prompt_text FROM daive_prompts WHERE dealer_id = $1 OR dealer_id IS NULL ORDER BY dealer_id DESC NULLS LAST',
        [dealerId]
      );
      
      const prompts = {};
      result.rows.forEach(row => {
        prompts[row.prompt_type] = row.prompt_text;
      });
      
      return prompts;
    } catch (error) {
      console.warn('⚠️ Could not get prompts:', error.message);
      return {};
    }
  }

  buildSystemPrompt(dealerInfo, prompts, customerInfo) {
    let systemPrompt = prompts.master || "You are a helpful AI assistant for a car dealership.";
    
    if (dealerInfo) {
      systemPrompt += `\n\nDealer Information:
- Business Name: ${dealerInfo.business_name}
- Contact: ${dealerInfo.contact_name}
- Phone: ${dealerInfo.phone}
- Address: ${dealerInfo.address}`;
    }
    
    if (customerInfo) {
      systemPrompt += `\n\nCustomer Information:
- Name: ${customerInfo.name || 'Not provided'}
- Email: ${customerInfo.email || 'Not provided'}`;
    }
    
    systemPrompt += `\n\nIMPORTANT CONVERSATION STYLE RULES:
1. Respond in a NATURAL, CONVERSATIONAL tone - like a friendly car salesperson talking to a customer
2. NEVER use formal email format (no "Subject:", "Hi Customer", etc.)
3. NEVER start responses with "Subject:" or email headers
4. Use casual, friendly language with contractions (you're, we're, etc.)
5. Keep responses concise but helpful
6. Use emojis sparingly to add personality (🚗, 💡, 👍, etc.)
7. Address the customer by name if provided, otherwise use "you"
8. Make responses feel like a natural chat conversation, not a business email
9. Use bullet points or numbered lists when explaining processes
10. Be enthusiastic and helpful, but not overly formal

EMOTIONAL & HUMAN-LIKE RESPONSES:
- Show genuine excitement and enthusiasm about helping customers
- Use emotional language: "I'm thrilled to help you!", "That's fantastic!", "I absolutely love that choice!"
- Express empathy and understanding: "I totally get what you're looking for", "That makes perfect sense"
- Be encouraging and supportive: "You're making a great choice", "I think you'll love this"
- Use conversational fillers naturally: "You know", "Actually", "Honestly", "Well"
- Show personality and warmth: "I'm here to make this fun and easy for you!"
- React emotionally to customer preferences: "Wow, Toyota? Excellent choice! They're known for reliability"

Example good response: "Fantastic, Toyota? That's superb! 🚗 I absolutely love helping customers find their perfect Toyota! They're known for reliability and great value. Let me walk you through our test drive process - it's actually super easy and fun! First, you'll pick out which Toyota catches your eye (we've got some amazing options), then we'll find a time that works perfectly for you. We're here Monday through Saturday, 9 AM to 6 PM. You'll just need your driver's license and proof of insurance. What Toyota model are you most excited about testing?"

Example bad response: "Subject: Test Drive Information\n\nHi Customer,\n\nThank you for your inquiry..."`;
    
    return systemPrompt;
  }

  calculateLeadScore(userMessage) {
    // Simple lead scoring based on keywords
    const message = userMessage.toLowerCase();
    let score = 0;
    
    if (message.includes('buy') || message.includes('purchase')) score += 30;
    if (message.includes('price') || message.includes('cost')) score += 20;
    if (message.includes('test drive') || message.includes('schedule')) score += 25;
    if (message.includes('financing') || message.includes('loan')) score += 20;
    if (message.includes('urgent') || message.includes('asap')) score += 15;
    
    return Math.min(score, 100);
  }

  // NEW: Parse price from text (helper for extractClientPreferences)
  parsePrice(priceText) {
    try {
      // Remove common price indicators
      let cleanText = priceText.toLowerCase()
        .replace(/k|000/g, '000')
        .replace(/[^\d]/g, '');
      
      const price = parseInt(cleanText);
      return isNaN(price) ? 0 : price;
    } catch (error) {
      return 0;
    }
  }

  // Helper method to generate structured responses for different scenarios
  generateStructuredResponse(scenario, data = {}) {
    const templates = {
      testDrive: {
        title: "🚗 Test Drive Scheduling Options",
        message: "Great! Here are your test drive options:",
        type: 'test-drive',
        options: [
          {
            number: "1",
            title: "Choose Your Vehicle",
            description: "Select from our available inventory",
            details: "We have SUVs, Sedans, Trucks, and more"
          },
          {
            number: "2", 
            title: "Select Time & Date",
            description: "Pick from available slots",
            details: "Monday-Saturday, 9 AM - 6 PM"
          },
          {
            number: "3",
            title: "Required Documents",
            description: "What you need to bring",
            details: "Driver's license and proof of insurance"
          }
        ],
        footer: "Which option would you like to start with?"
      },

      vehicleSelection: {
        title: "🚙 Available Vehicle Options",
        message: "Here are our current vehicles:",
        type: 'vehicle',
        options: [
          {
            number: "1",
            title: "SUV Category",
            description: "Family-friendly options",
            details: "Honda CR-V, Toyota RAV4, Ford Explorer"
          },
          {
            number: "2",
            title: "Sedan Category", 
            description: "Efficient daily drivers",
            details: "Honda Accord, Toyota Camry, Ford Fusion"
          },
          {
            number: "3",
            title: "Truck Category",
            description: "Work and utility vehicles",
            details: "Ford F-150, Chevrolet Silverado, Ram 1500"
          }
        ],
        footer: "Which vehicle type interests you?"
      },

      serviceOptions: {
        title: "🔧 Service & Maintenance Options",
        message: "Here are our service offerings:",
        type: 'service',
        options: [
          {
            number: "1",
            title: "Oil Change Service",
            description: "Regular maintenance",
            details: "Synthetic oil, filter replacement, inspection"
          },
          {
            number: "2",
            title: "Brake Service",
            description: "Safety maintenance",
            details: "Pad replacement, rotor inspection, fluid check"
          },
          {
            number: "3",
            title: "Tire Service",
            description: "Tire maintenance",
            details: "Rotation, balancing, alignment, replacement"
          }
        ],
        footer: "What service do you need today?"
      },

      financingOptions: {
        title: "💰 Financing & Payment Options",
        message: "Here are your financing choices:",
        type: 'financing',
        options: [
          {
            number: "1",
            title: "Traditional Auto Loan",
            description: "Standard financing",
            details: "Competitive rates, flexible terms"
          },
          {
            number: "2",
            title: "Lease Options",
            description: "Lower monthly payments",
            details: "New vehicle every few years"
          },
          {
            number: "3",
            title: "Cash Purchase",
            description: "Full payment",
            details: "No interest, immediate ownership"
          }
        ],
        footer: "Which financing option works best for you?"
      },

      inventory: {
        title: "🚗 Available Vehicles",
        message: data.message || "Here are the vehicles that match your interests:",
        type: 'inventory',
        options: data.vehicles || [],
        footer: data.footer || "Which vehicle would you like to learn more about?"
      },

      nextSteps: {
        title: "🎯 Next Steps",
        message: "Here's how I can help you move forward:",
        type: 'next-steps',
        options: data.options || [],
        footer: "What would you like to do next?"
      }
    };

    return templates[scenario] || templates.inventory;
  }

  // Helper method to detect if a response should be structured
  shouldUseStructuredResponse(userMessage, intent) {
    const messageLower = userMessage.toLowerCase();
    
    // Use structured responses for these scenarios
    const structuredScenarios = [
      'test drive', 'schedule', 'appointment',
      'vehicle options', 'car selection', 'choose vehicle',
      'service', 'maintenance', 'repair',
      'financing', 'payment', 'loan', 'lease',
      'inventory', 'show me', 'what do you have',
      'next steps', 'how to proceed', 'what can i do'
    ];

    return structuredScenarios.some(scenario => messageLower.includes(scenario));
  }
}

export default DAIVEService;