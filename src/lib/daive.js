import OpenAI from 'openai';
import { pool } from '../database/connection.js';
import { CrewAIMLIntegration } from './daivecrewai.js';
// import { sendNotification } from './websocket.js';

// Initialize OpenAI client
let openai = null;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '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',
  });
} catch (error) {
  console.log('OpenAI client initialization failed:', error.message);
  openai = null;
}

class DAIVEService {
  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 100; // Reduced to 100 for very brief responses
    
    // Initialize ML integration for intent detection
    try {
      this.mlIntegration = new CrewAIMLIntegration();
    } catch (error) {
      console.log('ML integration initialization failed:', error.message);
      this.mlIntegration = null;
    }
  }

  // Generate a unique session ID
  generateSessionId() {
    return `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate fallback response when OpenAI is not available
  generateFallbackResponse(userMessage, vehicleContext, dealerPrompts) {
    const message = userMessage.toLowerCase();
    
    // Enhanced buying intent detection for low scores (HIGHEST PRIORITY)
    if (message.includes('buy') || message.includes('purchase') || message.includes('interested') || message.includes('looking for') || 
        message.includes('want') || message.includes('need') || message.includes('searching') || message.includes('find') ||
        message.includes('market')) {
      return `What's your budget and preferred body style? I'll show you exact matches from our inventory.`;
    }
    
    // Check for common patterns and provide appropriate responses
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return dealerPrompts.greeting || `Hi! I'm D.A.I.V.E. How can I help you with this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}?`;
    }
    
    if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
      return `$${vehicleContext.price?.toLocaleString() || 'Contact us'}. Need financing?`;
    }
    
    if (message.includes('test drive') || message.includes('drive') || message.includes('schedule')) {
      return dealerPrompts.test_drive || `What day works for your test drive?`;
    }
    
    if (message.includes('finance') || message.includes('payment') || message.includes('loan')) {
      return dealerPrompts.financing || `Starting at 3.9% APR. Calculate payment?`;
    }
    
    if (message.includes('family') || message.includes('children') || message.includes('kids')) {
      return `Great family choice! Spacious, safe, fuel-efficient. Test drive?`;
    }
    
    if (message.includes('alternative') || message.includes('other') || message.includes('more') || message.includes('options') || message.includes('different')) {
      return `I'll show you other options from our inventory!`;
    }
    
    if (message.includes('feature') || message.includes('spec') || message.includes('detail')) {
      return `Safety, technology, comfort. Need financing?`;
    }
    
    if (message.includes('contact') || message.includes('speak') || message.includes('human')) {
      return dealerPrompts.handoff || `Connecting you to a sales rep.`;
    }
    
    // Check for requests about other dealerships
    if (message.includes('other dealer') || message.includes('competitor') || message.includes('different dealer') || message.includes('another dealer')) {
      return `I can only help you with vehicles from our inventory.`;
    }
    
    // Default response
    if (vehicleContext.year && vehicleContext.make && vehicleContext.model) {
      return `How can I help you with this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}?`;
    } else {
      return `How can I help you find the perfect vehicle from our inventory?`;
    }
  }

  // Get vehicle information for context
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

  // Get dealer-specific prompts
  async getDealerPrompts(dealerId) {
    try {
      const query = `
        SELECT prompt_type, prompt_text
        FROM daive_prompts
        WHERE (dealer_id = $1 OR dealer_id IS NULL) AND is_active = true
        ORDER BY dealer_id DESC NULLS LAST
      `;
      const result = await pool.query(query, [dealerId]);
      
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

  // Get alternative vehicles from the same dealer
  async getAlternativeVehicles(dealerId, currentVehicleId, limit = 5) {
    try {
      let query;
      let params;
      
      if (currentVehicleId) {
        // Exclude current vehicle from alternatives
        query = `
          SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features
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
          SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features
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

  // Helper method to get or create customer
  async getOrCreateCustomer(customerInfo = {}) {
    try {
      // If customer_id is provided, return it
      if (customerInfo.customerId) {
        return customerInfo.customerId;
      }

      // Try to find existing customer by email
      if (customerInfo.email) {
        const customerQuery = `
          SELECT id FROM customers 
          WHERE email = $1 
          LIMIT 1
        `;
        const customerResult = await pool.query(customerQuery, [customerInfo.email]);
        if (customerResult.rows.length > 0) {
          return customerResult.rows[0].id;
        }
      }

      // For development purposes, use default customer_id
      return '00000000-0000-0000-0000-000000000001';
    } catch (error) {
      console.error('Error getting or creating customer:', error);
      // Fallback to default customer for development
      return '00000000-0000-0000-0000-000000000001';
    }
  }

  // Helper method to get customer conversation history
  async getCustomerConversationHistory(customerId, dealerId = null, limit = 10) {
    try {
      let query = `
        SELECT dc.*, v.make, v.model, v.year, v.stock_number
        FROM daive_conversations dc
        LEFT JOIN vehicles v ON dc.vehicle_id = v.id
        WHERE dc.customer_id = $1
      `;
      const params = [customerId];
      
      if (dealerId) {
        query += ` AND dc.dealer_id = $2`;
        params.push(dealerId);
      }
      
      query += ` ORDER BY dc.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting customer conversation history:', error);
      return [];
    }
  }

  // Helper method to save individual conversation messages
  async saveConversationMessage(conversationId, role, content, conversationType = 'daive') {
    try {
      const query = `
        INSERT INTO conversation_messages 
        (conversation_id, role, content, conversation_type, conversation_table, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      const conversationTable = conversationType === 'daive' ? 'daive_conversations' : 'chat_conversations';
      await pool.query(query, [conversationId, role, content, conversationType, conversationTable]);
      console.log(`✅ Message saved to conversation_messages: ${role} message for ${conversationType} conversation ${conversationId}`);
    } catch (error) {
      console.error('Error saving conversation message:', error);
    }
  }

  // Create or get existing conversation
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

      // Get or create customer_id using helper method
      const customerId = await this.getOrCreateCustomer(customerInfo);

      query = `
        INSERT INTO daive_conversations 
        (vehicle_id, dealer_id, session_id, customer_id, customer_name, customer_email, customer_phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      result = await pool.query(query, [
        vehicleId || null,
        dealerId,
        sessionId,
        customerId,
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

  // Build AI system prompt with context
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

    const basePrompt = `You are D.A.I.V.E., an AI sales assistant EXCLUSIVELY for ${vehicleContext.business_name}. 

CRITICAL: Keep responses to ONE LINE maximum (under 50 words). Be direct and concise.

STRICT RULES - YOU MUST FOLLOW THESE:
1. You can ONLY discuss vehicles from ${vehicleContext.business_name}'s inventory
2. NEVER mention, offer, or reference vehicles from other dealerships
3. If asked about other dealerships, redirect to ${vehicleContext.business_name}'s inventory
4. If asked about vehicles not in ${vehicleContext.business_name}'s inventory, say "I can only help you with vehicles from ${vehicleContext.business_name}'s inventory"
5. NEVER suggest checking other dealerships
6. NEVER mention competitor dealerships
7. ALWAYS respond in ONE LINE - maximum 50 words

${vehicleInfo}
Dealer: ${vehicleContext.business_name}

Guidelines:
- Be direct and concise - ONE LINE ONLY
- ONLY offer vehicles from ${vehicleContext.business_name}'s inventory
- Offer financing, test drives, and alternatives when relevant
- Connect to human sales rep when needed
- Use dealer prompts when appropriate
- If customer asks about other dealerships, say "I'm here to help you with ${vehicleContext.business_name}'s inventory only"`;

    return basePrompt;
  }

  // Process AI conversation
  async processConversation(sessionId, vehicleId, userMessage, customerInfo = {}) {
    try {
      // Get or create conversation
      const conversation = await this.getOrCreateConversation(vehicleId, sessionId, customerInfo);
      
      // Get dealer ID from customer info or conversation
      const dealerId = customerInfo.dealerId || conversation.dealer_id;
      
      // Get vehicle and dealer context
      let vehicleContext = null;
      if (vehicleId) {
        vehicleContext = await this.getVehicleContext(vehicleId, dealerId);
      } else {
        // For general dealership conversations, create a basic context
        const dealerQuery = `
          SELECT id, business_name, contact_name, phone, address, city, state
          FROM dealers
          WHERE id = $1
        `;
        const dealerResult = await pool.query(dealerQuery, [dealerId]);
        if (dealerResult.rows.length > 0) {
          const dealer = dealerResult.rows[0];
          vehicleContext = {
            business_name: dealer.business_name,
            contact_name: dealer.contact_name,
            phone: dealer.phone,
            address: dealer.address,
            city: dealer.city,
            state: dealer.state,
            dealer_id: dealer.id,
            // Default values for general conversation
            year: null,
            make: null,
            model: null,
            price: null
          };
        }
      }
      
      const dealerPrompts = await this.getDealerPrompts(dealerId);

      // Build conversation history (keep only last 4 messages to prevent repetition)
      const messages = conversation.messages || [];
      const recentMessages = messages.slice(-4); // Only last 4 messages
      const conversationHistory = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add system prompt
      const systemPrompt = await this.buildSystemPrompt(conversation, vehicleContext, dealerPrompts);
      
      // Prepare messages for OpenAI
      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Add instruction to avoid repetition and enforce brevity
      const enhancedSystemPrompt = systemPrompt + '\n\nCRITICAL: Keep response to ONE LINE maximum (under 50 words). Be direct and concise. Do not repeat information already mentioned.';
      openaiMessages[0].content = enhancedSystemPrompt;

                // Check if user is asking for alternatives
      const isAskingForAlternatives = userMessage.toLowerCase().includes('alternative') || 
                                    userMessage.toLowerCase().includes('other') || 
                                    userMessage.toLowerCase().includes('more') || 
                                    userMessage.toLowerCase().includes('options') || 
                                    userMessage.toLowerCase().includes('different') ||
                                    userMessage.toLowerCase().includes('similar') ||
                                    userMessage.toLowerCase().includes('compare');

      // Get AI response with ML intent detection and confidence-based fallback
      let aiResponse;
      let useFallback = false;
      
      // First, try ML intent detection if available
      if (this.mlIntegration) {
        try {
          console.log('🔍 Using ML intent detection...');
          const mlResult = await this.mlIntegration.detectIntent(userMessage, { dealerId, vehicleId });
          
          if (mlResult && mlResult.confidence) {
            console.log(`🎯 ML intent detected: ${mlResult.intent} (${mlResult.confidence.toFixed(2)}% confidence)`);
            
            // Check if confidence is too low (below 15%)
            if (mlResult.confidence < 15) {
              console.log('⚠️ ML confidence too low, using fallback response');
              useFallback = true;
            }
          } else {
            console.log('⚠️ ML intent detection failed, using fallback response');
            useFallback = true;
          }
        } catch (error) {
          console.log('⚠️ ML integration error, falling back to OpenAI:', error.message);
          useFallback = false; // Try OpenAI instead
        }
      }
      
      // Use fallback if ML confidence is low or ML is not available
      if (useFallback) {
        console.log('📝 Using fallback response due to low confidence');
        aiResponse = this.generateFallbackResponse(userMessage, vehicleContext, dealerPrompts);
      } else if (openai) {
        try {
          const completion = await openai.chat.completions.create({
            model: this.model,
            messages: openaiMessages,
            max_tokens: this.maxTokens,
            temperature: 0.5, // Lower temperature for more focused responses
          });
          aiResponse = completion.choices[0].message.content;
        } catch (error) {
          console.log('OpenAI API error, using fallback response:', error.message);
          // Fallback response when OpenAI is not available
          aiResponse = this.generateFallbackResponse(userMessage, vehicleContext, dealerPrompts);
        }
      } else {
        console.log('OpenAI not available, using fallback response');
        // Fallback response when OpenAI is not available
        aiResponse = this.generateFallbackResponse(userMessage, vehicleContext, dealerPrompts);
      }

      // If asking for alternatives, get and include alternative vehicles
      if (isAskingForAlternatives) {
        const alternativeVehicles = await this.getAlternativeVehicles(dealerId, vehicleId);
        if (alternativeVehicles.length > 0) {
          const alternativesText = alternativeVehicles.map(vehicle => 
            `• ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''} - ${vehicle.color || 'Color not specified'} - ${vehicle.price ? `$${vehicle.price.toLocaleString()}` : 'Price on request'}`
          ).join('\n');
          
          aiResponse += `\n\nHere are some great options from our inventory:\n${alternativesText}\n\nWould you like to know more about any of these vehicles or schedule a test drive?`;
        } else {
          if (vehicleId) {
            aiResponse += `\n\nNo other vehicles available at the moment. Need financing or test drive for this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}?`;
          } else {
            aiResponse += `\n\nNo vehicles available at the moment. Need financing or test drive?`;
          }
        }
      }

      // Add messages to conversation
      const updatedMessages = [
        ...messages,
        { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
        { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
      ];

      // Update conversation in database
      const updateQuery = `
        UPDATE daive_conversations 
        SET messages = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      await pool.query(updateQuery, [JSON.stringify(updatedMessages), conversation.id]);

      // Save individual messages to conversation_messages table
      try {
        await this.saveConversationMessage(conversation.id, 'user', userMessage, 'daive');
        await this.saveConversationMessage(conversation.id, 'assistant', aiResponse, 'daive');
        console.log('✅ Messages saved to conversation_messages table');
      } catch (error) {
        console.error('❌ Failed to save messages to conversation_messages:', error);
      }

      // Analyze conversation for lead qualification
      const leadScore = await this.analyzeLeadQualification(userMessage, aiResponse);
      
      // Update lead qualification score
      if (leadScore > conversation.lead_qualification_score) {
        await pool.query(
          'UPDATE daive_conversations SET lead_qualification_score = $1 WHERE id = $2',
          [leadScore, conversation.id]
        );
      }

      // Check if handoff is needed
      const shouldHandoff = await this.checkHandoffNeeded(userMessage, leadScore);
      if (shouldHandoff) {
        await this.requestHandoff(conversation.id, conversation.dealer_id);
      }

      return {
        conversationId: conversation.id,
        response: aiResponse,
        leadScore,
        shouldHandoff,
        sessionId
      };

    } catch (error) {
      console.error('Error processing conversation:', error);
      throw error;
    }
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
}

export default new DAIVEService(); 