import OpenAI from 'openai';
import { pool } from '../database/connection.js';
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
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 300; // Reduced for brief responses
  }

  // Generate a unique session ID
  generateSessionId() {
    return `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate fallback response when OpenAI is not available
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
        return dealerPrompts.financing || `Great question! We've got competitive rates starting at 3.9% APR. Would you like me to calculate a quick payment estimate, or would you prefer to speak with our finance team?`;
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
        return `I'm here exclusively for ${vehicleContext.business_name} and can only help with our inventory. However, I'd love to find the perfect vehicle for you from what we have available. What are you looking for?`;
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
        return dealerPrompts.financing || `Starting at 3.9% APR. Calculate payment?`;
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
- Be direct and concise
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

      // Add instruction to avoid repetition
      const enhancedSystemPrompt = systemPrompt + '\n\nIMPORTANT: Do not repeat information already mentioned. Be brief and direct.';
      openaiMessages[0].content = enhancedSystemPrompt;

                // Check if user is asking for alternatives or inventory
      const isAskingForAlternatives = userMessage.toLowerCase().includes('alternative') || 
                                    userMessage.toLowerCase().includes('other') || 
                                    userMessage.toLowerCase().includes('more') || 
                                    userMessage.toLowerCase().includes('options') || 
                                    userMessage.toLowerCase().includes('different') ||
                                    userMessage.toLowerCase().includes('similar') ||
                                    userMessage.toLowerCase().includes('compare') ||
                                    userMessage.toLowerCase().includes('inventory') ||
                                    userMessage.toLowerCase().includes('available') ||
                                    userMessage.toLowerCase().includes('vehicles') ||
                                    userMessage.toLowerCase().includes('cars') ||
                                    userMessage.toLowerCase().includes('what do you have') ||
                                    userMessage.toLowerCase().includes('show me') ||
                                    userMessage.toLowerCase().includes('selection') ||
                                    userMessage.toLowerCase().includes('family') ||
                                    userMessage.toLowerCase().includes('suv') ||
                                    userMessage.toLowerCase().includes('sedan') ||
                                    userMessage.toLowerCase().includes('truck') ||
                                    (!vehicleId && conversation.messages.length <= 3); // Show inventory for general conversations

      // Get AI response
      let aiResponse;
      if (openai) {
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
          const alternativesText = alternativeVehicles.map(vehicle => {
            const trim = vehicle.trim ? ` ${vehicle.trim}` : '';
            const color = vehicle.color || 'Color available upon request';
            const price = vehicle.price ? `$${vehicle.price.toLocaleString()}` : 'Price available upon request';
            const mileage = vehicle.mileage ? ` | ${vehicle.mileage.toLocaleString()} miles` : '';
            
            return `🚗 ${vehicle.year} ${vehicle.make} ${vehicle.model}${trim}
   Color: ${color}
   Price: ${price}${mileage}`;
          }).join('\n\n');
          
          aiResponse += `\n\nHere are some great options from ${vehicleContext.business_name}'s inventory:\n\n${alternativesText}\n\nWould you like to know more about any of these vehicles or schedule a test drive?`;
        } else {
          if (vehicleId) {
            aiResponse += `\n\nI don't have any other vehicles available in ${vehicleContext.business_name}'s inventory at the moment, but I'd be happy to help you with financing options or scheduling a test drive for this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}!`;
          } else {
            aiResponse += `\n\nI don't have any vehicles available in ${vehicleContext.business_name}'s inventory at the moment, but I'd be happy to help you with financing options or scheduling a test drive!`;
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