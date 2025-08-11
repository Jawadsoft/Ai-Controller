// Simplified CrewAI Service that provides AI functionality without problematic imports
import { ChatOpenAI } from '@langchain/openai';
import { pool } from '../database/connection.js';

class CrewAIService {
  constructor() {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OPENAI_API_KEY not found - Crew AI will use fallback responses');
      this.llm = null;
      return;
    }

    try {
      // Initialize OpenAI LLM
      this.llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000
      });
      
      console.log('✅ Simplified CrewAI Service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing CrewAI Service:', error);
      this.llm = null;
    }
  }

  // Simplified AI processing using direct OpenAI calls
  async processWithAI(customerMessage, context = {}) {
    try {
      if (!this.llm) {
        console.log('⚠️ LLM not available, using fallback response');
        return this.generateFallbackResponse(customerMessage, context);
      }

      // Create a context-aware prompt
      const prompt = this.createContextualPrompt(customerMessage, context);
      
      // Get AI response
      const response = await this.llm.invoke(prompt);
      
      // Analyze the response for intent and generate appropriate reply
      const aiResponse = await this.generateContextualResponse(customerMessage, response.content, context);
      
      // Analyze customer intent for lead scoring and handoff decisions
      const intent = this.detectIntent(customerMessage);
      const urgency = this.assessUrgency(customerMessage);
      const leadScore = this.calculateLeadScore({ intent, urgency, message: customerMessage });
      const shouldHandoff = this.shouldHandoffToHuman({ intent, urgency, leadScore });
      
      return {
        success: true,
        response: aiResponse, // Direct response field for compatibility
        crewUsed: true,
        crewType: 'AI Assistant',
        intent: intent,
        leadScore: leadScore,
        shouldHandoff: shouldHandoff,
        audioResponseUrl: null, // No TTS for now
        message: customerMessage,
        sessionId: context.sessionId || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing with AI:', error);
      return {
        success: false,
        error: error.message,
        fallback: true
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

  // Generate contextual response based on AI output and customer needs
  async generateContextualResponse(customerMessage, aiOutput, context) {
    try {
      // Analyze customer intent
      const intent = this.detectIntent(customerMessage);
      const urgency = this.assessUrgency(customerMessage);
      
      // Enhance the AI response with context-specific information
      let enhancedResponse = aiOutput;
      
      // Add vehicle-specific information if available
      if (context.vehicleId) {
        const vehicleInfo = await this.getVehicleDetails(context.vehicleId);
        if (vehicleInfo) {
          enhancedResponse += `\n\nRegarding the ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} you're asking about, I can provide more specific details if needed.`;
        }
      }
      
      // Add dealership-specific information and inventory access
      if (context.dealerId) {
        const dealerInfo = await this.getDealershipInfo(context.dealerId);
        if (dealerInfo) {
          enhancedResponse += `\n\nI'm here to help you with ${dealerInfo.business_name || 'our dealership'}. I have access to our current inventory and can show you available vehicles, pricing, and help you find the perfect match for your needs.`;
        }
      }
      
      // Check if this is an inventory-related query
      const inventoryKeywords = ['inventory', 'available', 'stock', 'show me', 'what do you have', 'options', 'similar', 'other'];
      const isInventoryQuery = inventoryKeywords.some(keyword => 
        customerMessage.toLowerCase().includes(keyword)
      );
      
      if (isInventoryQuery && context.dealerId) {
        enhancedResponse += `\n\nI'd be happy to show you our current inventory! I can see what vehicles we have available and help you find the perfect match.`;
        
        // Log inventory details to console
        console.log('🔍 INVENTORY QUERY DETECTED - Logging available vehicles...');
        try {
          const availableVehicles = await this.getAvailableVehicles(context.dealerId);
          if (availableVehicles && availableVehicles.length > 0) {
            console.log('📊 AVAILABLE INVENTORY:');
            availableVehicles.forEach((vehicle, index) => {
              console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
              console.log(`      Price: $${vehicle.price?.toLocaleString() || 'N/A'}`);
              console.log(`      Mileage: ${vehicle.mileage?.toLocaleString() || 'N/A'} miles`);
              console.log(`      Status: ${vehicle.status || 'N/A'}`);
              console.log(`      Features: ${vehicle.features?.join(', ') || 'N/A'}`);
              console.log(`      ---`);
            });
            console.log(`   Total: ${availableVehicles.length} vehicles available`);
          } else {
            console.log('⚠️ No available vehicles found for dealer:', context.dealerId);
          }
        } catch (error) {
          console.error('❌ Error fetching inventory for console log:', error);
        }
      }
      
      return enhancedResponse;
    } catch (error) {
      console.error('Error generating contextual response:', error);
      return aiOutput; // Return original AI response if enhancement fails
    }
  }

  // Intent detection (reusing your existing logic)
  detectIntent(text) {
    const t = text.toLowerCase();
    if (/\b(test\s*drive|schedule|drive)\b/.test(t)) return 'TEST_DRIVE';
    if (/\b(price|cost|how much|o\.t\.d|out the door)\b/.test(t)) return 'PRICE';
    if (/\b(finance|payment|loan|apr)\b/.test(t)) return 'FINANCE';
    if (/\b(alternative|other|options|similar|inventory|available|stock|show me)\b/.test(t)) return 'ALTERNATIVES';
    if (/\b(feature|spec|details?|safety|mpg|mileage)\b/.test(t)) return 'FEATURES';
    if (/\b(human|agent|representative|talk to|call me)\b/.test(t)) return 'HANDOFF';
    if (/\b(trade[\s-]*in|tradein|valuation)\b/.test(t)) return 'TRADE_IN';
    if (/\b(hi|hello|hey)\b/.test(t)) return 'GREET';
    return 'SMALL_TALK';
  }

  assessUrgency(message) {
    const urgentKeywords = ['urgent', 'asap', 'today', 'immediately', 'now'];
    const urgent = urgentKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    return urgent ? 'High' : 'Normal';
  }

  // Calculate lead score based on customer intent and urgency
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
      case 'ALTERNATIVES':
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

  // Database helper methods
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

  // Get available vehicles for a dealer
  async getAvailableVehicles(dealerId) {
    try {
      const query = `
        SELECT id, make, model, year, trim, color, price, mileage, status, features
        FROM vehicles
        WHERE dealer_id = $1 AND status = 'available'
        ORDER BY year DESC, price ASC
        LIMIT 20
      `;
      const result = await pool.query(query, [dealerId]);
      return result.rows || [];
    } catch (error) {
      console.error('Error getting available vehicles:', error);
      return [];
    }
  }

  // Legacy method names for compatibility
  async processWithCrewAI(customerMessage, context = {}) {
    return this.processWithAI(customerMessage, context);
  }

  createSalesCrew() {
    console.log('⚠️ Simplified AI service - using direct AI processing instead of crew');
    return null;
  }

  createCustomerServiceCrew() {
    console.log('⚠️ Simplified AI service - using direct AI processing instead of crew');
    return null;
  }

  // Generate fallback response when LLM is not available
  generateFallbackResponse(customerMessage, context) {
    const intent = this.detectIntent(customerMessage);
    
    let fallbackResponse = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
    
    // Provide context-aware fallback responses
    if (intent === 'TEST_DRIVE') {
      fallbackResponse = "I'd be happy to help you schedule a test drive! However, I'm experiencing some technical difficulties right now. Please contact our sales team directly or try again in a few minutes.";
    } else if (intent === 'PRICE') {
      fallbackResponse = "I understand you're asking about pricing, but I'm currently having technical issues. Please check our website for current pricing or contact our sales team for the most up-to-date information.";
    } else if (intent === 'FINANCE') {
      fallbackResponse = "I'd love to help with financing questions, but I'm experiencing some technical difficulties. Please contact our finance department directly or try again later.";
    } else if (intent === 'GREET') {
      fallbackResponse = "Hello! I'm D.A.I.V.E., your AI assistant. I'm currently experiencing some technical difficulties, but I'd be happy to help you once I'm back online. How can I assist you today?";
    }
    
    return {
      success: true,
      response: fallbackResponse, // Direct response field for compatibility
      crewUsed: false,
      crewType: 'Fallback',
      intent: intent,
      leadScore: 0,
      shouldHandoff: false,
      audioResponseUrl: null,
      message: customerMessage,
      sessionId: context.sessionId || 'unknown',
      timestamp: new Date().toISOString()
    };
  }
}

export default CrewAIService; 