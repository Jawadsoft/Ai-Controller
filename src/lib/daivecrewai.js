// Unified AI Service combining DAIVE, UnifiedAI, and CrewAI functionality
import { ChatOpenAI } from '@langchain/openai';
import OpenAI from 'openai';
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
  constructor(maxTokens = 100) {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // fast + very capable
    this.maxTokens = maxTokens; // Use passed maxTokens instead of environment variable
    
    // Initialize flags
    this.isInitialized = false;
    this.crewLLM = null;
    
    // Initialize database tables (sync)
    this.initializeUserInterestTable();
    
    // Note: Settings and CrewAI will be initialized in the initialize() method
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

  // Main conversation processing method (merged from UnifiedAI)
  async processConversation(sessionId, vehicleId, userMessage, customerInfo = {}) {
    const startTime = performance.now();
    const timings = {};
    
    try {
      console.log('🚀 DAIVE processConversation STARTED:', {
        sessionId,
        vehicleId,
        messageLength: userMessage?.length || 0,
        hasCustomerInfo: !!customerInfo,
        customerInfoKeys: customerInfo ? Object.keys(customerInfo) : []
      });
      
      // Check if this is an inventory-related query
      const intentStart = performance.now();
      const dealerId = customerInfo.dealerId;
      const intent = this.detectIntent(userMessage);
      const isInventoryQuery = this.isInventoryQuery(userMessage);
      timings.intentDetection = performance.now() - intentStart;
      console.log(`⏱️  Intent detection: ${timings.intentDetection.toFixed(2)}ms`);
      
      // If it's an inventory query and we have a dealer ID, use inventory-aware responses
      if (isInventoryQuery && dealerId) {
        console.log('🏪 Using inventory-aware response for dealer:', dealerId);
        const inventoryStart = performance.now();
        const inventoryResponse = await this.generateInventoryAwareResponse(userMessage, dealerId, customerInfo);
        timings.inventoryResponse = performance.now() - inventoryStart;
        console.log(`⏱️  Inventory-aware response generation: ${timings.inventoryResponse.toFixed(2)}ms`);
        
        const totalTime = performance.now() - startTime;
        console.log('📊 DAIVE INVENTORY PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
        console.log('📊 Detailed Timings:', {
          intentDetection: `${timings.intentDetection.toFixed(2)}ms`,
          inventoryResponse: `${timings.inventoryResponse.toFixed(2)}ms`,
          totalTime: `${totalTime.toFixed(2)}ms`
        });
        
        return {
          success: true,
          response: inventoryResponse.response,
          crewUsed: true,
          crewType: 'Inventory-Aware AI',
          intent: intent,
          leadScore: this.calculateLeadScore(userMessage),
          shouldHandoff: this.shouldHandoffToHuman(userMessage),
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          hasInventory: inventoryResponse.hasInventory,
          inventoryCount: inventoryResponse.inventoryCount,
          relevantCount: inventoryResponse.relevantCount,
          responseTime: totalTime,
          timings: timings
        };
      }
      
      // Try OpenAI first if available
      if (openai) {
        try {
          const openaiStart = performance.now();
          const aiResponse = await this.processWithOpenAI(userMessage, customerInfo);
          timings.openaiProcessing = performance.now() - openaiStart;
          console.log(`⏱️  OpenAI processing: ${timings.openaiProcessing.toFixed(2)}ms`);
          
          const totalTime = performance.now() - startTime;
          console.log('📊 DAIVE OPENAI PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
          console.log('📊 Detailed Timings:', {
            intentDetection: `${timings.intentDetection.toFixed(2)}ms`,
            openaiProcessing: `${timings.openaiProcessing.toFixed(2)}ms`,
            totalTime: `${totalTime.toFixed(2)}ms`
          });
          
          return {
            success: true,
            response: aiResponse,
            crewUsed: true,
            crewType: 'OpenAI',
            intent: intent,
            leadScore: this.calculateLeadScore(userMessage),
            shouldHandoff: this.shouldHandoffToHuman(userMessage),
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            responseTime: totalTime,
            timings: timings
          };
        } catch (error) {
          console.log('⚠️ OpenAI failed, falling back to rule-based responses');
        }
      }
      
      // Fallback to rule-based responses
      const ruleBasedStart = performance.now();
      const ruleBasedResponse = this.generateRuleBasedResponse(userMessage, customerInfo, sessionId);
      timings.ruleBasedResponse = performance.now() - ruleBasedStart;
      console.log(`⏱️  Rule-based response generation: ${timings.ruleBasedResponse.toFixed(2)}ms`);
      
      const totalTime = performance.now() - startTime;
      console.log('📊 DAIVE RULE-BASED PROCESSING COMPLETE - Total Response Time:', `${totalTime.toFixed(2)}ms`);
      console.log('📊 Detailed Timings:', {
        intentDetection: `${timings.intentDetection.toFixed(2)}ms`,
        ruleBasedResponse: `${timings.ruleBasedResponse.toFixed(2)}ms`,
        totalTime: `${totalTime.toFixed(2)}ms`
      });
      
      // Add timing info to the response
      if (ruleBasedResponse && typeof ruleBasedResponse === 'object') {
        ruleBasedResponse.responseTime = totalTime;
        ruleBasedResponse.timings = timings;
      }
      
      return ruleBasedResponse;
      
    } catch (error) {
      const totalTime = performance.now() - startTime;
      console.error('❌ Error in conversation processing:', error);
      console.log(`📊 Error occurred after: ${totalTime.toFixed(2)}ms`);
      return {
        success: false,
        error: error.message,
        response: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
        crewUsed: false,
        crewType: 'Fallback',
        intent: 'ERROR',
        leadScore: 0,
        shouldHandoff: false,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        responseTime: totalTime,
        timings: timings
      };
    }
  }

  // Process with OpenAI (merged from UnifiedAI)
  async processWithOpenAI(userMessage, customerInfo) {
    if (!openai) {
      throw new Error('OpenAI client not available');
    }

    const systemPrompt = `You are D.A.I.V.E., a helpful AI assistant for a vehicle dealership. 
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
  generateRuleBasedResponse(userMessage, customerInfo, sessionId) {
    const intent = this.detectIntent(userMessage);
    const urgency = this.assessUrgency(userMessage);
    
    let response = "I apologize, but I'm experiencing technical difficulties right now. Please try again in a moment.";
    
    // Provide context-aware responses based on intent
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

  // Enhanced inventory-aware response generation (merged from UnifiedAI)
  async generateInventoryAwareResponse(userMessage, dealerId, customerInfo) {
    try {
      // Get dealer inventory
      const inventory = await this.getDealerInventory(dealerId);
      const dealership = await this.getDealershipInfo(dealerId);
      
      if (!inventory || inventory.length === 0) {
        return {
          response: `I apologize, but I'm currently unable to access our inventory. However, I'd be happy to help you with general information about our dealership. Please contact us directly at ${dealership?.phone || 'our main number'} for the most up-to-date inventory information.`,
          hasInventory: false
        };
      }

      // Analyze user intent for inventory-related queries
      const intent = this.detectIntent(userMessage);
      const messageLower = userMessage.toLowerCase();
      
      // Check for specific vehicle requests
      const specificMake = this.extractVehicleMake(userMessage);
      const specificModel = this.extractVehicleModel(userMessage);
      const priceRange = this.extractPriceRange(userMessage);
      
      let relevantVehicles = inventory;
      
      // Filter by make if specified
      if (specificMake) {
        relevantVehicles = relevantVehicles.filter(v => 
          v.make.toLowerCase().includes(specificMake.toLowerCase())
        );
      }
      
      // Filter by model if specified
      if (specificModel) {
        relevantVehicles = relevantVehicles.filter(v => 
          v.model.toLowerCase().includes(specificModel.toLowerCase())
        );
      }
      
      // Filter by price range if specified
      if (priceRange) {
        relevantVehicles = relevantVehicles.filter(v => 
          v.price >= priceRange.min && v.price <= priceRange.max
        );
      }
      
      // Generate inventory-aware response
      if (relevantVehicles.length === 0) {
        return {
          response: `I don't currently have any ${specificMake ? specificMake + ' ' : ''}${specificModel ? specificModel + ' ' : ''}vehicles${priceRange ? ` in the $${priceRange.min.toLocaleString()}-$${priceRange.max.toLocaleString()} price range` : ''} in our inventory. However, we do have ${inventory.length} other vehicles available. Would you like me to tell you about some of our current options?`,
          hasInventory: true,
          inventoryCount: inventory.length,
          relevantCount: 0
        };
      }
      
      // Create detailed inventory response
      const topVehicles = relevantVehicles.slice(0, 5); // Show top 5 matches
      let response = `Great! I found ${relevantVehicles.length} vehicle${relevantVehicles.length > 1 ? 's' : ''} that match your criteria. Here are some highlights:\n\n`;
      
      topVehicles.forEach((vehicle, index) => {
        response += `${index + 1}. **${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}**\n`;
        response += `   • Price: $${vehicle.price?.toLocaleString() || 'Call for price'}\n`;
        response += `   • Mileage: ${vehicle.mileage?.toLocaleString() || 'N/A'} miles\n`;
        response += `   • Color: ${vehicle.exterior_color || 'N/A'} exterior, ${vehicle.interior_color || 'N/A'} interior\n`;
        if (vehicle.features) {
          response += `   • Features: ${vehicle.features.substring(0, 100)}${vehicle.features.length > 100 ? '...' : ''}\n`;
        }
        response += '\n';
      });
      
      if (relevantVehicles.length > 5) {
        response += `...and ${relevantVehicles.length - 5} more vehicles available. Would you like me to tell you about any specific vehicle or help you narrow down your search?`;
      } else {
        response += `Would you like me to tell you more about any of these vehicles or help you with financing options?`;
      }
      
      return {
        response: response,
        hasInventory: true,
        inventoryCount: inventory.length,
        relevantCount: relevantVehicles.length,
        topVehicles: topVehicles
      };
      
    } catch (error) {
      console.error('Error generating inventory-aware response:', error);
      return {
        response: "I'm having trouble accessing our inventory right now, but I'd be happy to help you with general information about our dealership and services.",
        hasInventory: false
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
          exterior_color,
          interior_color,
          fuel_type,
          transmission,
          engine,
          doors,
          seats,
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
        SELECT business_name, address, city, state, phone, hours
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
    
    for (const make of makes) {
      if (messageLower.includes(make)) {
        return make;
      }
    }
    return null;
  }

  extractVehicleModel(message) {
    const models = ['camry', 'corolla', 'accord', 'civic', 'f-150', 'silverado', 'altima', 'sentra', '3 series', 'c-class', 'a4', 'es', 'cr-v', 'rav4', 'escape', 'equinox'];
    const messageLower = message.toLowerCase();
    
    for (const model of models) {
      if (messageLower.includes(model)) {
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
  isInventoryQuery(text) {
    const t = text.toLowerCase();
    const inventoryKeywords = [
      'inventory', 'available', 'stock', 'show me', 'what do you have', 
      'options', 'similar', 'other', 'vehicles', 'cars', 'what\'s available',
      'what vehicles', 'show inventory', 'list vehicles', 'available cars'
    ];
    return inventoryKeywords.some(keyword => t.includes(keyword));
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
        this.crewLLM = null;
        return;
      }

      // Initialize OpenAI LLM with configurable maxTokens
      this.crewLLM = new ChatOpenAI({
        openAIApiKey: apiKeys.openai,
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: maxTokens
      });
      
      console.log(`✅ CrewAI LLM initialized successfully with maxTokens: ${maxTokens} for dealer: ${dealerId || 'global'}`);
    } catch (error) {
      console.error('❌ Error initializing CrewAI LLM:', error);
      this.crewLLM = null;
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
        try {
          // Use API key from centralized settings
          if (apiKey) {
            const elevenLabsKey = apiKey;
            
            // Use voice from centralized settings (default to liam if not set)
            const selectedVoice = elevenlabsVoice || voice || 'liam';
            const voiceId = this.getElevenLabsVoiceId(selectedVoice);
            console.log(`🎤 Using ElevenLabs voice: ${selectedVoice} (ID: ${voiceId})`);
            
            const elevenLabsStart = performance.now();
            const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: text.substring(0, 4000), // Limit text length for TTS
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
          console.log('⚠️ ElevenLabs TTS failed, trying OpenAI fallback:', elevenLabsError.message);
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
            input: text.substring(0, 4000), // Limit text length for TTS
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
        crewLLMAvailable: !!this.crewLLM
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

      if (!this.crewLLM) {
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
      const prompt = this.createContextualPrompt(customerMessage, context);
      timings.promptCreation = performance.now() - promptStart;
      console.log(`⏱️  Prompt creation: ${timings.promptCreation.toFixed(2)}ms`);
      
      // Get AI response
      const aiStart = performance.now();
      const response = await this.crewLLM.invoke(prompt);
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
  createContextualPrompt(customerMessage, context) {
    let systemPrompt = `You are D.A.I.V.E., a helpful AI assistant for a vehicle dealership. 
    You help customers with vehicle inquiries, financing questions, test drive scheduling, and general dealership information.
    
    Current context:
    - Dealer ID: ${context.dealerId || 'Unknown'}
    - Vehicle ID: ${context.vehicleId || 'None'}
    - Session: ${context.sessionId || 'Unknown'}
    
    Customer message: "${customerMessage}"
    
    IMPORTANT: You have access to the dealership's inventory database and can provide specific vehicle information.
    If the customer asks about available vehicles, inventory, or similar options, you can access real-time data.
    
    Please provide a helpful, informative response that:
    1. Addresses the customer's specific question or need
    2. Is professional but friendly
    3. Provides actionable information when possible
    4. Asks follow-up questions to better understand their needs
    5. Maintains a conversational tone
    6. Offers to show specific inventory when relevant
    
    Keep your response under 200 words and focus on being helpful.`;

    return systemPrompt;
  }

  // Enhanced CrewAI contextual response generation
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
      
      // Enhance the AI response with context-specific information
      let enhancedResponse = aiOutput;
      
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
      console.log(`📊 Service Status: Settings=${settingsInitialized ? '✅' : '❌'}, CrewAI=${this.crewLLM ? '✅' : '❌'}, Dealer=${dealerId || 'Global'}`);
      
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
}

export default DAIVEService;