// Unified AI Service - Combines DAIVE and Crew AI functionality
import OpenAI from 'openai';
import { pool } from '../database/connection.js';

class UnifiedAIService {
  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 700;
    
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI client initialized successfully');
      } catch (error) {
        console.error('❌ OpenAI client initialization failed:', error.message);
        this.openai = null;
      }
    } else {
      console.warn('⚠️ OPENAI_API_KEY not found - AI will use fallback responses');
      this.openai = null;
    }
    
    this.initializeUserInterestTable();
  }

  // Initialize user interest tracking table
  async initializeUserInterestTable() {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS user_interests (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL,
          vehicle_id UUID,
          interest_type VARCHAR(100),
          interest_level INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await pool.query(query);
      console.log('✅ User interest tracking table initialized');
    } catch (error) {
      console.error('❌ Error initializing user interest table:', error);
    }
  }

  // Generate session ID
  generateSessionId() {
    return `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Main conversation processing method
  async processConversation(sessionId, vehicleId, userMessage, customerInfo = {}) {
    try {
      console.log('🤖 Processing conversation with Unified AI...');
      
      // Check if this is an inventory-related query
      const dealerId = customerInfo.dealerId;
      const intent = this.detectIntent(userMessage);
      const isInventoryQuery = this.isInventoryRelatedQuery(userMessage);
      
      // If it's an inventory query and we have a dealer ID, use inventory-aware responses
      if (isInventoryQuery && dealerId) {
        console.log('🏪 Using inventory-aware response for dealer:', dealerId);
        const inventoryResponse = await this.generateInventoryAwareResponse(userMessage, dealerId, customerInfo);
        
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
          relevantCount: inventoryResponse.relevantCount
        };
      }
      
      // Try OpenAI first if available
      if (this.openai) {
        try {
          const aiResponse = await this.processWithOpenAI(userMessage, customerInfo);
          return {
            success: true,
            response: aiResponse,
            crewUsed: true,
            crewType: 'OpenAI',
            intent: intent,
            leadScore: this.calculateLeadScore(userMessage),
            shouldHandoff: this.shouldHandoffToHuman(userMessage),
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.log('⚠️ OpenAI failed, falling back to rule-based responses');
        }
      }
      
      // Fallback to rule-based responses
      return this.generateRuleBasedResponse(userMessage, customerInfo, sessionId);
      
    } catch (error) {
      console.error('❌ Error in conversation processing:', error);
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
        timestamp: new Date().toISOString()
      };
    }
  }

  // Process with OpenAI
  async processWithOpenAI(userMessage, customerInfo) {
    if (!this.openai) {
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

    const completion = await this.openai.chat.completions.create({
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

  // Generate rule-based responses when AI is unavailable
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

  // Intent detection
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

  // Assess urgency
  assessUrgency(message) {
    const urgentKeywords = ['urgent', 'asap', 'today', 'immediately', 'now', 'quick', 'fast', 'emergency'];
    const urgent = urgentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    return urgent ? 'High' : 'Normal';
  }

  // Calculate lead score
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

  // Determine if customer should be handed off to human
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

  // Get or create conversation
  async getOrCreateConversation(vehicleId, sessionId, customerInfo = {}) {
    try {
      // Check if conversation exists
      const checkQuery = `
        SELECT id FROM daive_conversations 
        WHERE session_id = $1
      `;
      const checkResult = await pool.query(checkQuery, [sessionId]);
      
      if (checkResult.rows.length > 0) {
        return { id: checkResult.rows[0].id };
      }
      
      // Create new conversation
      const createQuery = `
        INSERT INTO daive_conversations (
          session_id, vehicle_id, dealer_id, customer_name, 
          customer_email, lead_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      
      const createResult = await pool.query(createQuery, [
        sessionId,
        vehicleId,
        customerInfo.dealerId || null,
        customerInfo.name || 'Anonymous',
        customerInfo.email || null,
        'new'
      ]);
      
      return { id: createResult.rows[0].id };
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return { id: null };
    }
  }

  // Save conversation message
  async saveConversationMessage(conversationId, role, content) {
    if (!conversationId) return;
    
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

  // Get vehicle details
  async getVehicleDetails(vehicleId) {
    try {
      const query = `
        SELECT v.*, d.business_name, d.contact_name, d.phone
        FROM vehicles v
        JOIN dealers d ON v.dealer_id = d.id
        WHERE v.id = $1
      `;
      const result = await pool.query(query, [vehicleId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting vehicle details:', error);
      return null;
    }
  }

  // Get dealership info
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

  // Get dealer inventory for AI responses
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

  // Enhanced inventory-aware response generation
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

  // Check if a message is inventory-related
  isInventoryRelatedQuery(message) {
    const messageLower = message.toLowerCase();
    const inventoryKeywords = [
      'inventory', 'available', 'have', 'stock', 'vehicles', 'cars', 'trucks', 'suvs',
      'show me', 'what do you have', 'available cars', 'current inventory',
      'toyota', 'honda', 'ford', 'chevrolet', 'nissan', 'bmw', 'mercedes', 'audi',
      'camry', 'corolla', 'accord', 'civic', 'f-150', 'silverado', 'altima', 'sentra',
      'price', 'cost', 'how much', 'budget', 'afford', 'financing'
    ];
    
    return inventoryKeywords.some(keyword => messageLower.includes(keyword));
  }

  // Helper methods for extracting vehicle information from user messages
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

  // Legacy method names for compatibility
  async processConversationWithCrew(sessionId, vehicleId, userMessage, customerInfo = {}) {
    return this.processConversation(sessionId, vehicleId, userMessage, customerInfo);
  }

  // Additional methods needed by routes
  async saveVoiceSession(conversationId, audioFileUrl, sessionId) {
    try {
      // This is a placeholder - implement actual voice session saving logic
      console.log('💾 Voice session saved:', { conversationId, audioFileUrl, sessionId });
      return true;
    } catch (error) {
      console.error('Error saving voice session:', error);
      return false;
    }
  }

  async getConversationHistory(sessionId) {
    try {
      const query = `
        SELECT 
          dc.*,
          v.make, v.model, v.year, v.vin,
          cm.role, cm.content, cm.created_at as message_time
        FROM daive_conversations dc
        LEFT JOIN vehicles v ON dc.vehicle_id = v.id
        LEFT JOIN conversation_messages cm ON dc.id = cm.conversation_id
        WHERE dc.session_id = $1
        ORDER BY cm.created_at ASC
      `;
      const result = await pool.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Group messages by conversation
      const conversation = {
        sessionId: sessionId,
        messages: result.rows.map(row => ({
          role: row.role,
          content: row.content,
          timestamp: row.message_time
        }))
      };
      
      return conversation;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return null;
    }
  }

  async getAnalytics(dealerId, startDate, endDate) {
    try {
      // This is a placeholder - implement actual analytics logic
      console.log('📊 Getting analytics for dealer:', dealerId, 'from', startDate, 'to', endDate);
      return {
        totalConversations: 0,
        totalLeads: 0,
        averageLeadScore: 0,
        topIntents: [],
        conversionRate: 0
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return null;
    }
  }
}

export default UnifiedAIService; 