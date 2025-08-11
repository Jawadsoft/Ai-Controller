import OpenAI from 'openai';
import { pool } from '../database/connection.js';
import CrewAIService from './crewAI.js';
// import { sendNotification } from './websocket.js';

// Initialize OpenAI client
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
  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // fast + very capable
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 700; // Increased for better responses
    
    // Initialize Crew AI service
    this.crewAI = new CrewAIService();
    
    // Initialize database tables
    this.initializeUserInterestTable();
  }

  // Generate a unique session ID
  generateSessionId() {
    return `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Detect user intent for better response routing
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

  // Get similar vehicles based on user preferences and current selection
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
                 WHEN v.make = $${params.length - 1} THEN 3
                 WHEN v.model = $${params.length} THEN 2
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

      // Check for repetition with previous assistant message
      const prevAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
      let repetitionDetected = false;

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

      // Check if user is asking about a specific vehicle (not alternatives)
      const isAskingAboutSpecificVehicle = vehicleId && (
        userMessage.toLowerCase().includes('this specific') ||
        userMessage.toLowerCase().includes('this vehicle') ||
        userMessage.toLowerCase().includes('this car') ||
        userMessage.toLowerCase().includes('features') ||
        userMessage.toLowerCase().includes('pricing') ||
        userMessage.toLowerCase().includes('availability')
      );

      // Get AI response
      let aiResponse;
      if (openai) {
        try {
          const temperature = Number(process.env.OPENAI_TEMP ?? 0.6);
          const presence_penalty = 0.2;   // reduce repetition, encourage new info
          const frequency_penalty = 0.3;  // reduce verbatim repeats
          
          const completion = await openai.chat.completions.create({
            model: this.model,
            messages: openaiMessages,
            max_tokens: this.maxTokens,
            temperature,
            presence_penalty,
            frequency_penalty
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

      // Check for repetition with previous assistant message (now that aiResponse is defined)
      if (prevAssistant && aiResponse) {
        // Check if response ends with same content as previous assistant
        const lastSentence = aiResponse.slice(-80);
        const prevLastSentence = prevAssistant.slice(-80);
        if (lastSentence === prevLastSentence && lastSentence.length > 12) {
          repetitionDetected = true;
          console.log('Repetition detected, response may need regeneration');
        }
      }

      // If asking for alternatives, get and include alternative vehicles
      if (isAskingForAlternatives && !isAskingAboutSpecificVehicle) {
        // Get user preferences to provide better recommendations
        const userPreferences = await this.getUserPreferences(conversation.id);
        
        // Use similar vehicles if we have user preferences, otherwise use alternative vehicles
        let recommendedVehicles;
        if (userPreferences.length > 0 && vehicleId) {
          // Build preferences object from user interests
          const preferences = {};
          for (const pref of userPreferences) {
            if (pref.vehicle_id) {
              const vehicle = await this.getVehicleContext(pref.vehicle_id);
              if (vehicle) {
                if (!preferences.make && vehicle.make) preferences.make = vehicle.make;
                if (!preferences.model && vehicle.model) preferences.model = vehicle.model;
                if (!preferences.yearRange) preferences.yearRange = { min: vehicle.year - 2, max: vehicle.year + 2 };
                if (!preferences.priceRange && vehicle.price) {
                  const priceRange = vehicle.price * 0.8;
                  preferences.priceRange = { min: priceRange, max: vehicle.price * 1.2 };
                }
              }
            }
          }
          
          recommendedVehicles = await this.getSimilarVehicles(dealerId, vehicleId, preferences, 6);
        } else {
          recommendedVehicles = await this.getAlternativeVehicles(dealerId, vehicleId, 6);
        }
        
        if (recommendedVehicles.length > 0) {
          const vehicleItems = recommendedVehicles.map(vehicle => {
            const trim = vehicle.trim ? ` ${vehicle.trim}` : '';
            const color = vehicle.color || 'Color available upon request';
            const price = vehicle.price ? `$${vehicle.price.toLocaleString()}` : 'Price available upon request';
            const mileage = vehicle.mileage ? ` • ${vehicle.mileage.toLocaleString()} miles` : '';
            const imageUrl = vehicle.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=300&h=200&fit=crop&crop=center';
            
            return `<li class="vehicle-compact-card" data-vehicle-id="${vehicle.id}">
              <div class="vehicle-compact-image">
                <img src="${imageUrl}" alt="${vehicle.year} ${vehicle.make} ${vehicle.model}" class="vehicle-cover-compact" />
              </div>
              <div class="vehicle-compact-info">
                <div class="vehicle-compact-header">
                  <div class="vehicle-compact-name">🚗 <strong>${vehicle.year} ${vehicle.make} ${vehicle.model}${trim}</strong></div>
                  <div class="vehicle-compact-price">${price}</div>
                </div>
                <div class="vehicle-compact-details">
                  <span class="color-compact">${color}</span>
                  <span class="mileage-compact">${mileage}</span>
                </div>
                <div class="vehicle-compact-actions">
                  <button class="btn-test-drive-compact" onclick="handleVehicleAction('${vehicle.id}', 'test-drive')">Test Drive</button>
                  <button class="btn-contact-sales-compact" onclick="handleVehicleAction('${vehicle.id}', 'contact-sales')">Contact Sales</button>
                </div>
              </div>
            </li>`;
          }).join('');
          
          const inventoryList = `<div class="inventory-grid">${vehicleItems}</div>`;
          
          if (userPreferences.length > 0) {
            aiResponse += `\n\nBased on your interests, here are some similar vehicles that match your preferences from ${vehicleContext.business_name}'s inventory:\n\n${inventoryList}\n\nThese vehicles are selected based on what you've shown interest in. Would you like to know more about any of these or schedule a test drive?`;
          } else {
            aiResponse += `\n\nHere are some great options from ${vehicleContext.business_name}'s inventory:\n\n${inventoryList}\n\nWould you like to know more about any of these vehicles or schedule a test drive?`;
          }
        } else {
          if (vehicleId) {
            aiResponse += `\n\nI don't have any other vehicles available in ${vehicleContext.business_name}'s inventory at the moment, but I'd be happy to help you with financing options or scheduling a test drive for this ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}!`;
          } else {
            aiResponse += `\n\nI don't have any vehicles available in ${vehicleContext.business_name}'s inventory at the moment, but I'd be happy to help you with financing options or scheduling a test drive!`;
          }
        }
      }

      // Track user interest if they're asking about a specific vehicle
      if (vehicleId && (userMessage.toLowerCase().includes('tell me more') || isAskingAboutSpecificVehicle)) {
        await this.trackUserInterest(conversation.id, vehicleId, 'vehicle_inquiry', userMessage);
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

      // Detect intent for better response structure
      const intent = this.detectIntent(userMessage);

      return {
        conversationId: conversation.id,
        response: aiResponse,
        leadScore,
        shouldHandoff,
        sessionId,
        intent: intent
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
      const crewResult = await this.crewAI.processWithCrewAI(userMessage, context);
      
      if (crewResult.success) {
        // Crew AI successfully processed the request
        console.log('✅ Crew AI processed request successfully');
        
        // Save the conversation with Crew AI result
        const conversation = await this.getOrCreateConversation(vehicleId, sessionId, customerInfo);
        await this.saveConversationMessage(conversation.id, 'user', userMessage);
        await this.saveConversationMessage(conversation.id, 'assistant', crewResult.data.response);
        
        return {
          success: true,
          response: crewResult.data.response,
          crewUsed: crewResult.data.crewUsed,
          crewType: crewResult.data.crewType,
          intent: crewResult.data.intent,
          leadScore: crewResult.data.leadScore,
          shouldHandoff: crewResult.data.shouldHandoff
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
          shouldHandoff: false
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
        shouldHandoff: false
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
}

export default new DAIVEService(); 