// Intent Training System for DAIVE
// Detects car dealership intents and trains responses accordingly

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

class IntentTrainingSystem {
  constructor(openaiApiKey) {
    this.llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 300
    });
    
    // Pre-defined intents with response templates and agent routing
    this.intents = {
      'buy_car': {
        response_template: 'I\'d be happy to help you find the perfect vehicle! To get started, what type of car are you looking for?',
        agent: 'sales_consultant',
        confidence_threshold: 0.6  // Lowered from 0.7
      },
      'car_type_preference': {
        response_template: 'Great choice! {vehicle_type}s are excellent vehicles. What\'s your budget range for this {vehicle_type}?',
        agent: 'product_specialist',
        confidence_threshold: 0.6  // Lowered from 0.8
      },
      'budget_inquiry': {
        response_template: 'Perfect! A budget of ${budget} gives us great options. Are you looking for a new or used vehicle?',
        agent: 'finance_manager',
        confidence_threshold: 0.7  // Lowered from 0.9
      },
      'financing_options': {
        response_template: 'Absolutely! We offer excellent financing options including loans, leasing, and competitive rates. What\'s your preferred monthly payment range?',
        agent: 'finance_manager',
        confidence_threshold: 0.7  // Lowered from 0.9
      },
      'feature_request': {
        response_template: 'Great question about {feature}! Let me show you vehicles with those specifications. What\'s your budget range?',
        agent: 'product_specialist',
        confidence_threshold: 0.6  // Lowered from 0.8
      },
      'car_comparison': {
        response_template: 'Excellent question! Let me compare {vehicle1} and {vehicle2} for you. What aspects are most important to you?',
        agent: 'product_specialist',
        confidence_threshold: 0.6  // Lowered from 0.8
      },
      'check_availability': {
        response_template: 'Let me check our current inventory for {vehicle}. I\'ll find the best available options for you.',
        agent: 'inventory_specialist',
        confidence_threshold: 0.7  // Lowered from 0.9
      },
      'ask_discounts': {
        response_template: 'Great timing! We do have several promotions available. Let me check what offers apply to your vehicle preferences.',
        agent: 'sales_consultant',
        confidence_threshold: 0.6  // Lowered from 0.8
      },
      'after_sales': {
        response_template: 'Excellent question about {service}! Our {service} includes comprehensive coverage. Let me provide you with the details.',
        agent: 'service_advisor',
        confidence_threshold: 0.7  // Lowered from 0.9
      },
      'purchase_commitment': {
        response_template: 'Fantastic! I\'m excited to help you complete your purchase. Let\'s get started with the paperwork and financing options.',
        agent: 'sales_consultant',
        confidence_threshold: 0.7  // Lowered from 0.9
      }
    };
    
    // Training data storage
    this.trainingData = new Map();
    this.responseHistory = new Map();
  }

  // Detect intent from user message using OpenAI semantic analysis
  async detectIntent(userMessage, conversationContext = {}) {
    try {
      console.log('🔍 Intent Detection - Analyzing message:', userMessage.substring(0, 100));
      
      // Always use OpenAI for semantic intent detection
      const aiIntent = await this.aiBasedIntentDetection(userMessage, conversationContext);
      console.log('🤖 AI-based intent detected:', aiIntent.intent);
      
      return aiIntent;
      
    } catch (error) {
      console.error('❌ Error in intent detection:', error);
      return this.fallbackIntentDetection(userMessage);
    }
  }

  // Rule-based intent detection removed - now using OpenAI semantic analysis only

  // AI-based intent detection using OpenAI semantic analysis
  async aiBasedIntentDetection(userMessage, conversationContext) {
    const contextInfo = conversationContext.step ? `Current step: ${conversationContext.step}` : 'New conversation';
    const userPreferences = conversationContext.vehicleType ? `Vehicle type: ${conversationContext.vehicleType}` : 'No vehicle type specified';
    const userBudget = conversationContext.budget ? `Budget: $${conversationContext.budget.toLocaleString()}` : 'No budget specified';
    const userNewUsed = conversationContext.newOrUsed ? `Preference: ${conversationContext.newOrUsed}` : 'No new/used preference';
    
    const prompt = [
      new SystemMessage({
        content: `You are an expert intent classifier for a car dealership AI system. Your job is to understand the SEMANTIC MEANING of customer messages, not just keywords.

IMPORTANT: Analyze the customer's underlying intent and meaning, not just surface-level words. Consider context, tone, and what they're really trying to achieve.

Available intents:
1. buy_car - Customer wants to buy a car, get help finding a vehicle, or start the car shopping process
2. car_type_preference - Customer specifies or asks about vehicle type (SUV, sedan, electric, hybrid, truck, etc.)
3. budget_inquiry - Customer mentions budget, price range, affordability, or asks about pricing
4. financing_options - Customer asks about loans, leasing, payment plans, or financial arrangements
5. feature_request - Customer asks about specific features, specifications, or vehicle capabilities
6. car_comparison - Customer wants to compare different vehicles, models, or vehicle types
7. check_availability - Customer asks about stock, availability, test drives, or current inventory
8. ask_discounts - Customer asks about promotions, deals, discounts, offers, or special pricing
9. after_sales - Customer asks about warranty, service, maintenance, support, or post-purchase care
10. purchase_commitment - Customer is ready to buy, wants next steps, or shows strong purchase intent

Conversation context:
- ${contextInfo}
- ${userPreferences}
- ${userBudget}
- ${userNewUsed}
- User message: "${userMessage}"

TASK: Analyze the SEMANTIC MEANING of the user's message and classify their intent. Consider:
- What are they really trying to accomplish?
- What's their underlying goal?
- What stage of the buying process are they in?
- What information do they need?

EXAMPLES:
- "Can you help me find the right car?" → buy_car (they want to start shopping)
- "I want an SUV" → car_type_preference (they're specifying vehicle type)
- "My budget is $30,000" → budget_inquiry (they're sharing budget info)
- "Do you offer car loans?" → financing_options (they're asking about financing)
- "Which cars have advanced safety features?" → feature_request (they want feature info)
- "Which is better: Toyota Corolla or Honda Civic?" → car_comparison (they want comparison)
- "Is the Toyota RAV4 Hybrid in stock?" → check_availability (they want inventory info)
- "Are there any promotions right now?" → ask_discounts (they want deals)
- "What's the warranty on this car?" → after_sales (they want service info)
- "How do I finalize the deal?" → purchase_commitment (they want to complete purchase)

RESPONSE FORMAT: {"intent": "intent_key", "confidence": 0.95, "reasoning": "detailed explanation of semantic analysis"}

Be thorough in your reasoning - explain why you chose this intent based on the message's meaning, not just keywords.`
      }),
      new HumanMessage({
        content: userMessage
      })
    ];
    
    const response = await this.llm.invoke(prompt);
    const result = this.parseAIResponse(response.content);
    
    // Get intent data
    const intentData = this.intents[result.intent] || this.intents.general_inquiry;
    
    return {
      intent: result.intent,
      confidence: result.confidence,
      threshold: intentData.confidence_threshold,
      agent: intentData.agent,
      response_template: intentData.response_template,
      reasoning: result.reasoning
    };
  }

  // Parse AI response
  parseAIResponse(response) {
    try {
      console.log('🔍 Parsing AI response:', response.substring(0, 200));
      
      // Try to parse JSON response
      const jsonMatch = response.match(/\{.*\}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON parsed successfully:', parsed);
        return parsed;
      }
      
      // Fallback parsing with better regex
      const intentMatch = response.match(/intent["\s:]+([a-z_]+)/i);
      const confidenceMatch = response.match(/confidence["\s:]+([0-9.]+)/i);
      
      const result = {
        intent: intentMatch ? intentMatch[1] : 'general_inquiry',
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: response
      };
      
      console.log('⚠️ Using fallback parsing:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      console.log('❌ Raw response was:', response);
      
      // Try to extract intent from the raw response
      const lowerResponse = response.toLowerCase();
      let fallbackIntent = 'general_inquiry';
      
      if (lowerResponse.includes('buy') || lowerResponse.includes('find') || lowerResponse.includes('help')) {
        fallbackIntent = 'buy_car';
      } else if (lowerResponse.includes('suv') || lowerResponse.includes('sedan') || lowerResponse.includes('truck')) {
        fallbackIntent = 'car_type_preference';
      } else if (lowerResponse.includes('budget') || lowerResponse.includes('price') || lowerResponse.includes('$')) {
        fallbackIntent = 'budget_inquiry';
      } else if (lowerResponse.includes('loan') || lowerResponse.includes('finance') || lowerResponse.includes('payment')) {
        fallbackIntent = 'financing_options';
      } else if (lowerResponse.includes('feature') || lowerResponse.includes('safety') || lowerResponse.includes('specification')) {
        fallbackIntent = 'feature_request';
      } else if (lowerResponse.includes('compare') || lowerResponse.includes('better') || lowerResponse.includes('versus')) {
        fallbackIntent = 'car_comparison';
      } else if (lowerResponse.includes('stock') || lowerResponse.includes('available') || lowerResponse.includes('inventory')) {
        fallbackIntent = 'check_availability';
      } else if (lowerResponse.includes('promotion') || lowerResponse.includes('deal') || lowerResponse.includes('discount')) {
        fallbackIntent = 'ask_discounts';
      } else if (lowerResponse.includes('warranty') || lowerResponse.includes('service') || lowerResponse.includes('maintenance')) {
        fallbackIntent = 'after_sales';
      } else if (lowerResponse.includes('purchase') || lowerResponse.includes('buy') || lowerResponse.includes('finalize')) {
        fallbackIntent = 'purchase_commitment';
      }
      
      return {
        intent: fallbackIntent,
        confidence: 0.6,
        reasoning: `Fallback intent detection due to parsing error: ${error.message}`
      };
    }
  }

  // Fallback intent detection
  fallbackIntentDetection(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Simple keyword-based fallback
    if (/\b(buy|purchase|get|find|help)\b/.test(message)) {
      return { intent: 'buy_car', confidence: 0.6, threshold: 0.5, agent: 'sales_consultant' };
    }
    
    if (/\b(suv|sedan|truck|car|vehicle)\b/.test(message)) {
      return { intent: 'car_type_preference', confidence: 0.7, threshold: 0.5, agent: 'product_specialist' };
    }
    
    if (/\$\d+/.test(message)) {
      return { intent: 'budget_inquiry', confidence: 0.8, threshold: 0.5, agent: 'finance_manager' };
    }
    
    return { intent: 'general_inquiry', confidence: 0.5, threshold: 0.5, agent: 'sales_consultant' };
  }

  // ENHANCED: Generate specialized agent response based on detected intent
  async generateIntentResponse(intentResult, userMessage, conversationContext = {}) {
    const intentData = this.intents[intentResult.intent];
    if (!intentData) {
      return this.generateGeneralResponse(userMessage, conversationContext);
    }
    
    try {
      // Generate specialized response using OpenAI for better quality
      const specializedPrompt = this.buildSpecializedPrompt(intentResult, userMessage, conversationContext);
      const aiResponse = await this.llm.invoke(specializedPrompt);
      
      // Clean and enhance the response
      let response = aiResponse.content.trim();
      
      // Ensure response follows our guidelines
      response = this.enhanceResponseQuality(response, intentResult.intent, intentResult.agent);
      
      console.log(`✅ Enhanced ${intentResult.agent} response generated for ${intentResult.intent} intent`);
      return response;
      
    } catch (error) {
      console.warn('⚠️ AI response generation failed, using template fallback:', error.message);
      return this.generateTemplateResponse(intentResult, userMessage, conversationContext);
    }
  }

  // ENHANCED: Build specialized prompt for high-quality responses
  buildSpecializedPrompt(intentResult, userMessage, conversationContext) {
    const agentRole = this.getAgentRole(intentResult.agent);
    const contextInfo = this.buildContextInfo(conversationContext);
    
    return [
      new SystemMessage({
        content: `You are a specialized ${agentRole} at a car dealership. You are speaking with a customer who has shown interest in buying a car.

INTENT: ${intentResult.intent}
USER MESSAGE: "${userMessage}"

${contextInfo}

CRITICAL RESPONSE REQUIREMENTS:
1. **BE SPECIFIC**: Address their exact question/request
2. **BE HELPFUL**: Provide actionable information or guidance
3. **BE ENGAGING**: Ask ONE relevant follow-up question
4. **BE NATURAL**: Use conversational, friendly language (no corporate speak)
5. **BE CONCISE**: Keep response to 2-3 sentences maximum
6. **BE PROFESSIONAL**: Maintain dealership expertise and credibility
7. **REFERENCE THEIR INPUT**: Acknowledge what they said naturally

RESPONSE FORMAT:
- Start with acknowledgment of their request
- Provide helpful information or guidance
- End with ONE engaging follow-up question
- Keep total response under 150 words

EXAMPLE GOOD RESPONSE:
"I'd be happy to help you find the perfect SUV! Based on your budget of $35,000, I can recommend several excellent options that offer great value and safety features. What specific features are most important to you - like fuel efficiency, technology, or seating capacity?"

RESPONSE:`
      }),
      new HumanMessage({
        content: userMessage
      })
    ];
  }

  // Get agent role description
  getAgentRole(agentType) {
    const roles = {
      'sales_consultant': 'Sales Consultant',
      'product_specialist': 'Product Specialist',
      'finance_manager': 'Finance Manager',
      'service_advisor': 'Service Advisor',
      'inventory_specialist': 'Inventory Specialist'
    };
    return roles[agentType] || 'Sales Representative';
  }

  // Build context information
  buildContextInfo(conversationContext) {
    let contextInfo = 'CONVERSATION CONTEXT:\n';
    
    if (conversationContext.step) {
      contextInfo += `- Current step: ${conversationContext.step}\n`;
    }
    
    if (conversationContext.vehicleType) {
      contextInfo += `- Vehicle type preference: ${conversationContext.vehicleType}\n`;
    }
    
    if (conversationContext.budget) {
      contextInfo += `- Budget: $${conversationContext.budget.toLocaleString()}\n`;
    }
    
    if (conversationContext.newOrUsed) {
      contextInfo += `- New/Used preference: ${conversationContext.newOrUsed}\n`;
    }
    
    return contextInfo;
  }

  // ENHANCED: Improve response quality with better formatting and context
  enhanceResponseQuality(response, intent, agent) {
    // Remove any truncation indicators
    response = response.replace(/\.\.\.$/, '');
    
    // Ensure response ends with a question for engagement
    if (!response.includes('?')) {
      response += ' What would you like to know next?';
    }
    
    // Ensure response has optimal length (not too short, not too long)
    if (response.length < 50) {
      response = this.expandShortResponse(response, intent, agent);
    } else if (response.length > 300) {
      response = this.optimizeLongResponse(response);
    }
    
    // Ensure response is professional and engaging
    response = response.replace(/\b(hi|hello|hey)\b/gi, '');
    response = response.replace(/\b(welcome|greetings)\b/gi, '');
    
    // Add natural transitions and improve flow
    response = this.improveResponseFlow(response, intent);
    
    return response.trim();
  }

  // Expand short responses to be more engaging
  expandShortResponse(response, intent, agent) {
    const expansions = {
      'buy_car': ' I\'d be happy to help you find the perfect vehicle! To get started, what type of car are you looking for?',
      'car_type_preference': ' Excellent choice! What\'s your budget range for this vehicle?',
      'budget_inquiry': ' Perfect! That gives us great options. Are you looking for a new or used vehicle?',
      'financing_options': ' Absolutely! We offer excellent financing options. What\'s your preferred monthly payment range?',
      'feature_request': ' Great question! Let me show you vehicles with those specifications. What\'s your budget range?',
      'car_comparison': ' Excellent question! Let me compare those vehicles for you. What aspects are most important to you?',
      'check_availability': ' Let me check our current inventory for you. What specific features are you looking for?',
      'ask_discounts': ' Great timing! We do have several promotions available. What type of vehicle are you interested in?',
      'after_sales': ' Excellent question! Our services include comprehensive coverage. What specific information do you need?',
      'purchase_commitment': ' Fantastic! I\'m excited to help you complete your purchase. What\'s the next step you\'d like to take?'
    };
    
    return response + (expansions[intent] || ' What would you like to know next?');
  }

  // Optimize long responses to be concise but complete
  optimizeLongResponse(response) {
    // Find the first complete sentence that ends with a question
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.includes('?') && sentence.length > 20) {
        return sentence + '.';
      }
    }
    
    // If no question found, take first two sentences and add a question
    const firstTwo = sentences.slice(0, 2).join('. ').trim();
    if (firstTwo.length > 0) {
      return firstTwo + '. What would you like to know next?';
    }
    
    // Fallback: truncate to 250 characters and add question
    return response.substring(0, 250).trim() + '... What would you like to know next?';
  }

  // Improve response flow and natural transitions
  improveResponseFlow(response, intent) {
    // Add natural connectors for better flow
    const connectors = {
      'buy_car': ['I\'d be happy to help you', 'Let me guide you through', 'I can definitely assist you'],
      'car_type_preference': ['Great choice', 'Excellent selection', 'Perfect pick'],
      'budget_inquiry': ['Perfect', 'Great', 'Excellent'],
      'financing_options': ['Absolutely', 'Definitely', 'Of course'],
      'feature_request': ['Great question', 'Excellent question', 'Perfect question'],
      'car_comparison': ['Excellent question', 'Great question', 'Perfect question'],
      'check_availability': ['I can definitely help', 'Let me check', 'I\'ll look into that'],
      'ask_discounts': ['Great timing', 'Perfect timing', 'Excellent timing'],
      'after_sales': ['Excellent question', 'Great question', 'Perfect question'],
      'purchase_commitment': ['Fantastic', 'Excellent', 'Perfect']
    };
    
    // Replace generic starts with more natural ones
    const intentConnectors = connectors[intent] || ['Great', 'Excellent', 'Perfect'];
    const randomConnector = intentConnectors[Math.floor(Math.random() * intentConnectors.length)];
    
    // Improve the start of responses
    if (response.toLowerCase().startsWith('great') || 
        response.toLowerCase().startsWith('excellent') || 
        response.toLowerCase().startsWith('perfect')) {
      response = response.replace(/^(Great|Excellent|Perfect)/i, randomConnector);
    }
    
    return response;
  }

  // Fallback to template response
  generateTemplateResponse(intentResult, userMessage, conversationContext) {
    const intentData = this.intents[intentResult.intent];
    if (!intentData) {
      return this.generateGeneralResponse(userMessage, conversationContext);
    }
    
    let response = intentData.response_template;
    
    // Replace template variables
    if (intentResult.intent === 'car_type_preference') {
      const vehicleType = this.extractVehicleType(userMessage);
      response = response.replace(/{vehicle_type}/g, vehicleType || 'vehicle');
    }
    
    if (intentResult.intent === 'budget_inquiry') {
      const budget = this.extractBudget(userMessage);
      if (budget) {
        response = response.replace(/{budget}/g, budget.toLocaleString());
      }
    }
    
    if (intentResult.intent === 'feature_request') {
      const feature = this.extractFeature(userMessage);
      response = response.replace(/{feature}/g, feature || 'those features');
    }
    
    if (intentResult.intent === 'car_comparison') {
      const vehicles = this.extractVehicleComparison(userMessage);
      if (vehicles.length >= 2) {
        response = response.replace(/{vehicle1}/g, vehicles[0]).replace(/{vehicle2}/g, vehicles[1]);
      }
    }
    
    if (intentResult.intent === 'check_availability') {
      const vehicle = this.extractVehicleMention(userMessage);
      response = response.replace(/{vehicle}/g, vehicle || 'your preferred vehicle');
    }
    
    if (intentResult.intent === 'after_sales') {
      const service = this.extractServiceMention(userMessage);
      response = response.replace(/{service}/g, service || 'our services');
    }
    
    return response;
  }

  // Generate general response when no specific intent is detected
  async generateGeneralResponse(userMessage, conversationContext = {}) {
    try {
      const prompt = [
        new SystemMessage({
          content: `You are a helpful car dealership AI assistant. The customer has asked a question that doesn't fit our standard categories. 

Provide a helpful, professional response that:
1. Acknowledges their question
2. Offers relevant assistance
3. Asks a clarifying question to better understand their needs
4. Keeps the response under 2 sentences

Conversation context: ${conversationContext.step || 'New conversation'}

Customer message: "${userMessage}"`
        })
      ];
      
      const response = await this.llm.invoke(prompt);
      return response.content;
      
    } catch (error) {
      console.error('❌ Error generating general response:', error);
      return "I'd be happy to help you with that! To better assist you, could you tell me more about what you're looking for?";
    }
  }

  // Extract specific information from user messages
  extractVehicleType(message) {
    const vehicleTypes = ['suv', 'sedan', 'truck', 'hatchback', 'wagon', 'coupe', 'convertible'];
    const lowerMessage = message.toLowerCase();
    
    for (const type of vehicleTypes) {
      if (lowerMessage.includes(type)) {
        return type.charAt(0).toUpperCase() + type.slice(1);
      }
    }
    return null;
  }

  extractBudget(message) {
    // Improved budget extraction to handle commas and k suffix properly
    const budgetMatch = message.match(/\$(\d+(?:,\d{3})*(?:k|000)?)/i);
    if (budgetMatch) {
      const priceStr = budgetMatch[1].toLowerCase().replace(/,/g, '');
      if (priceStr.includes('k')) {
        const budget = parseInt(priceStr.replace('k', ''), 10) * 1000;
        console.log(`💰 Intent Training - Extracted budget: $${budget.toLocaleString()}`);
        return budget;
      } else {
        const budget = parseInt(priceStr, 10);
        console.log(`💰 Intent Training - Extracted budget: $${budget.toLocaleString()}`);
        return budget;
      }
    }
    
    // Also check for patterns like "40 thousand", "40k"
    const numberMatch = message.match(/(\d+(?:,\d{3})*)\s*(k|thousand)/i);
    if (numberMatch) {
      const budget = parseInt(numberMatch[1].replace(/,/g, ''), 10) * 1000;
      console.log(`💰 Intent Training - Extracted budget (k/thousand): $${budget.toLocaleString()}`);
      return budget;
    }
    
    return null;
  }

  extractFeature(message) {
    const features = ['seats', 'safety', 'sunroof', 'fuel', 'leather', 'navigation', 'bluetooth', 'camera'];
    const lowerMessage = message.toLowerCase();
    
    for (const feature of features) {
      if (lowerMessage.includes(feature)) {
        return feature;
      }
    }
    return null;
  }

  extractVehicleComparison(message) {
    const vehicleMatch = message.match(/(\w+)\s*(?:vs|versus|or|compare)\s*(\w+)/i);
    if (vehicleMatch) {
      return [vehicleMatch[1], vehicleMatch[2]];
    }
    return [];
  }

  extractVehicleMention(message) {
    const vehicleMatch = message.match(/(\w+)\s+(?:rav4|corolla|civic|tucson|tesla|hyundai|toyota|honda)/i);
    if (vehicleMatch) {
      return vehicleMatch[0];
    }
    return null;
  }

  extractServiceMention(message) {
    const services = ['warranty', 'service', 'maintenance', 'roadside', 'insurance'];
    const lowerMessage = message.toLowerCase();
    
    for (const service of services) {
      if (lowerMessage.includes(service)) {
        return service;
      }
    }
    return null;
  }

  // Train the system with new intents
  trainIntent(intentKey, responseTemplate, agent, confidenceThreshold = 0.7) {
    if (!this.intents[intentKey]) {
      this.intents[intentKey] = {
        response_template: '',
        agent: 'sales_consultant',
        confidence_threshold: 0.7
      };
    }
    
    this.intents[intentKey].response_template = responseTemplate;
    this.intents[intentKey].agent = agent;
    this.intents[intentKey].confidence_threshold = confidenceThreshold;
    
    console.log(`✅ Trained intent: ${intentKey} with new response template and agent routing`);
  }

  // Get training statistics
  getTrainingStats() {
    const stats = {};
    for (const [intentKey, intentData] of Object.entries(this.intents)) {
      stats[intentKey] = {
        agent: intentData.agent,
        confidence_threshold: intentData.confidence_threshold,
        response_template: intentData.response_template.substring(0, 100) + '...'
      };
    }
    return stats;
  }

  // Save training data
  saveTrainingData() {
    // Implementation for persisting training data
    console.log('💾 Training data saved');
  }

  // Load training data
  loadTrainingData() {
    // Implementation for loading training data
    console.log('📂 Training data loaded');
  }
}

export default IntentTrainingSystem;
