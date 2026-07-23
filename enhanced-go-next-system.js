// Enhanced Go Next Steps System
// Integrates with ML intent detection and database fields for intelligent conversation flow
// UPDATED: Now includes 8-step purchase journey with agent routing

import DAIVEService from './src/lib/daivecrewai.js';

class EnhancedGoNextSystem {
  constructor() {
    this.conversationHistory = new Map(); // sessionId -> conversation state
    this.preferenceSlots = {
      car_type: null,
      budget: null,
      features: null,
      brand: null,
      color: null,
      mileage: null,
      transmission: null,
      fuel_type: null,
      body_style: null,
      // NEW: Purchase journey preferences
      purchase_decision: null,
      trade_in_details: null,
      financing_preferences: null,
      delivery_preferences: null
    };
    this.completedSteps = new Set();
    this.currentStep = 1;
    this.stepDefinitions = this.defineSteps();
    this.agentRouting = this.defineAgentRouting();
  }

  defineSteps() {
    return {
      // PHASE 1: Lead Qualification & Vehicle Selection (Steps 1-8)
      1: {
        name: 'Greet & Qualify Lead',
        question: 'Hi! Are you looking for a new or used car?',
        intent: 'greeting',
        required: true,
        field: 'vehicle_condition',
        agent: 'sales_consultant'
      },
      2: {
        name: 'Identify Car Type',
        question: 'Do you have a type in mind — SUV, sedan, electric, hybrid, or luxury?',
        intent: 'car_type',
        required: true,
        field: 'body_style',
        database_search: ['body_style', 'vehicle_type'],
        agent: 'sales_consultant'
      },
      3: {
        name: 'Define Budget',
        question: 'What\'s your budget range?',
        intent: 'budget',
        required: true,
        field: 'price_range',
        database_search: ['price', 'msrp'],
        agent: 'sales_consultant'
      },
      4: {
        name: 'Select Features / Needs',
        question: 'What features matter most to you? (Safety, 7 seats, fuel economy, luxury interiors, etc.)',
        intent: 'features',
        required: true,
        field: 'features',
        database_search: ['features', 'options', 'amenities'],
        agent: 'sales_consultant'
      },
      5: {
        name: 'Check Preferred Brand',
        question: 'Do you prefer a specific brand or are you open to options?',
        intent: 'brand',
        required: false,
        field: 'make',
        database_search: ['make', 'brand'],
        agent: 'sales_consultant'
      },
      6: {
        name: 'Vehicle Recommendations',
        question: 'Based on your preferences, here are the best matches...',
        intent: 'recommendation',
        required: true,
        action: 'search_database',
        agent: 'sales_consultant'
      },
      7: {
        name: 'Test Drive & Selection',
        question: 'Would you like to schedule a test drive or have you already selected a vehicle?',
        intent: 'test_drive',
        required: false,
        action: 'schedule_test_drive',
        agent: 'sales_consultant'
      },
      8: {
        name: 'Purchase Decision',
        question: 'Are you ready to proceed with the purchase of your selected vehicle?',
        intent: 'purchase_commitment',
        required: true,
        action: 'confirm_purchase',
        agent: 'sales_consultant'
      },

      // PHASE 2: Purchase Journey (Steps 9-16) - NEW 8-Step Journey
      9: {
        name: 'Sale Confirmation',
        question: 'Perfect! Let me confirm your vehicle selection and review the details.',
        intent: 'sale_confirmation',
        required: true,
        action: 'confirm_vehicle_details',
        agent: 'sales_consultant',
        phase: 'purchase_journey'
      },
      10: {
        name: 'Contract Review',
        question: 'Now let\'s review the sales contract. I\'ll explain all terms and conditions.',
        intent: 'contract_review',
        required: true,
        action: 'review_contract',
        agent: 'sales_consultant',
        phase: 'purchase_journey'
      },
      11: {
        name: 'Trade-In Discussion',
        question: 'Do you have a trade-in vehicle? Let\'s discuss the details and valuation.',
        intent: 'trade_in',
        required: false,
        action: 'assess_trade_in',
        agent: 'sales_consultant',
        phase: 'purchase_journey'
      },
      12: {
        name: 'Finance Finalization',
        question: 'Let\'s finalize your financing. I\'ll explain all terms and get the paperwork ready.',
        intent: 'finance_finalization',
        required: true,
        action: 'finalize_financing',
        agent: 'finance',
        phase: 'purchase_journey'
      },
      13: {
        name: 'Vehicle Preparation',
        question: 'Great! Now our inventory crew will prepare your vehicle for delivery.',
        intent: 'vehicle_preparation',
        required: true,
        action: 'prepare_vehicle',
        agent: 'inventory_crew',
        phase: 'purchase_journey'
      },
      14: {
        name: 'Delivery & Handover',
        question: 'Your vehicle is ready! Let\'s complete the delivery and handover process.',
        intent: 'delivery_handover',
        required: true,
        action: 'deliver_vehicle',
        agent: 'sales_consultant',
        phase: 'purchase_journey'
      },
      15: {
        name: 'Customer Support',
        question: 'How are you feeling about your purchase? Let me ensure everything meets your expectations.',
        intent: 'customer_support',
        required: true,
        action: 'ensure_satisfaction',
        agent: 'customer_service',
        phase: 'purchase_journey'
      },
      16: {
        name: 'Follow-Up',
        question: 'I\'ll follow up with you to address any concerns and provide ongoing support.',
        intent: 'follow_up',
        required: true,
        action: 'schedule_follow_up',
        agent: 'customer_service',
        phase: 'purchase_journey'
      }
    };
  }

  // NEW: Define agent routing for each step
  defineAgentRouting() {
    return {
      'sales_consultant': {
        name: 'Sales Consultant',
        capabilities: ['lead_qualification', 'vehicle_selection', 'sale_confirmation', 'contract_review', 'trade_in', 'delivery_handover'],
        expertise: 'Vehicle sales, customer consultation, contract review',
        next_agent: 'finance'
      },
      'finance': {
        name: 'Finance Specialist',
        capabilities: ['finance_finalization', 'loan_processing', 'payment_setup'],
        expertise: 'Financing options, loan terms, payment processing',
        next_agent: 'inventory_crew'
      },
      'inventory_crew': {
        name: 'Inventory Crew',
        capabilities: ['vehicle_preparation', 'quality_check', 'delivery_setup'],
        expertise: 'Vehicle preparation, quality assurance, delivery logistics',
        next_agent: 'customer_service'
      },
      'customer_service': {
        name: 'Customer Service',
        capabilities: ['customer_support', 'follow_up', 'ongoing_assistance'],
        expertise: 'Customer satisfaction, post-sale support, issue resolution',
        next_agent: null
      }
    };
  }

  // NEW: Route to appropriate agent based on step
  routeToAgent(stepNumber, conversation) {
    const step = this.stepDefinitions[stepNumber];
    if (!step || !step.agent) {
      return 'sales_consultant'; // Default to sales consultant
    }

    const agent = this.agentRouting[step.agent];
    if (!agent) {
      return 'sales_consultant'; // Fallback to sales consultant
    }

    console.log(`🔄 Routing to ${agent.name} for step ${stepNumber}: ${step.name}`);
    return step.agent;
  }

  // NEW: Get next agent in the journey
  getNextAgent(currentAgent) {
    const agent = this.agentRouting[currentAgent];
    return agent ? agent.next_agent : 'sales_consultant';
  }

  // NEW: Check if step is part of purchase journey
  isPurchaseJourneyStep(stepNumber) {
    const step = this.stepDefinitions[stepNumber];
    return step && step.phase === 'purchase_journey';
  }

  // NEW: Get agent transition message
  getAgentTransitionMessage(currentAgent, nextAgent, stepName) {
    if (currentAgent === nextAgent) {
      return `Let's continue with ${stepName}.`;
    }

    const currentAgentInfo = this.agentRouting[currentAgent];
    const nextAgentInfo = this.agentRouting[nextAgent];

    if (currentAgentInfo && nextAgentInfo) {
      return `Great! Now I'll hand you over to our ${nextAgentInfo.name} for ${stepName}. They specialize in ${nextAgentInfo.expertise}.`;
    }

    return `Now let's move to ${stepName}.`;
  }

  // Initialize conversation for a new session
  initializeConversation(sessionId, customerInfo = {}) {
    const conversationState = {
      sessionId,
      customerInfo,
      preferences: { ...this.preferenceSlots },
      completedSteps: new Set(),
      currentStep: 1,
      conversationHistory: [],
      databaseFilters: {},
      lastUpdated: new Date()
    };
    
    this.conversationHistory.set(sessionId, conversationState);
    return conversationState;
  }

  // Process user message and determine next step
  async processMessage(sessionId, userMessage, context = {}) {
    const conversation = this.conversationHistory.get(sessionId);
    if (!conversation) {
      throw new Error('Conversation not initialized');
    }

    // Add message to history
    conversation.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    // Use ML intent detection (with fallback)
    let detectedIntent = 'general_inquiry';
    try {
      const daiveService = new DAIVEService();
      // Initialize the service first
      await daiveService.initializeSettings();
      await daiveService.initializeCrewAI();
      
      if (daiveService.salesCrew && daiveService.salesCrew.detectIntent) {
        detectedIntent = await daiveService.salesCrew.detectIntent(userMessage, context);
      }
    } catch (error) {
      console.log(`⚠️ ML detection failed, using fallback: ${error.message}`);
      // Use simple keyword-based intent detection as fallback
      detectedIntent = this.fallbackIntentDetection(userMessage);
    }
    
    // Extract preferences from message
    const extractedPreferences = this.extractPreferences(userMessage, detectedIntent);
    
    // Update conversation state
    this.updateConversationState(conversation, extractedPreferences, detectedIntent);
    
         // Check if we should progress to the next step based on current user input
     const shouldProgress = this.shouldProgressToNextStep(conversation, conversation.currentStep, userMessage);
     
     if (shouldProgress) {
       // Mark current step as completed and move to next
       conversation.completedSteps.add(conversation.currentStep);
       conversation.currentStep = this.determineNextStep(conversation);
     }
     
     // Generate response for the current/next step
     const response = await this.generateStepResponse(conversation, conversation.currentStep, userMessage);
     
     // Determine the next step for the response
     const nextStep = this.determineNextStep(conversation);
    
    // Add response to history
    conversation.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });

         return {
       response,
       nextStep,
       currentPreferences: conversation.preferences,
       completedSteps: Array.from(conversation.completedSteps),
       databaseFilters: conversation.databaseFilters,
       enhancedSystem: true, // Mark as enhanced system response
       shouldAutoplay: true  // Enable autoplay for enhanced responses
     };
  }

  // Fallback intent detection using simple keywords
  fallbackIntentDetection(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('suv') || lowerMessage.includes('sedan') || lowerMessage.includes('truck')) {
      return 'car_type';
    }
    
    if (lowerMessage.includes('$') || lowerMessage.includes('budget') || lowerMessage.includes('price')) {
      return 'budget';
    }
    
    if (lowerMessage.includes('safety') || lowerMessage.includes('feature') || lowerMessage.includes('seat')) {
      return 'features';
    }
    
    if (lowerMessage.includes('compare') || lowerMessage.includes('vs') || lowerMessage.includes('difference')) {
      return 'comparison';
    }
    
    if (lowerMessage.includes('test drive') || lowerMessage.includes('schedule')) {
      return 'test_drive';
    }
    
    if (lowerMessage.includes('financing') || lowerMessage.includes('loan') || lowerMessage.includes('payment')) {
      return 'financing';
    }
    
    return 'general_inquiry';
  }

  // Extract preferences from user message using ML intent
  extractPreferences(userMessage, detectedIntent) {
    const preferences = {};
    const lowerMessage = userMessage.toLowerCase();

    // Extract vehicle condition preference (new/used) - PRIORITY 1
    if (lowerMessage.includes('new') || lowerMessage.includes('used')) {
      preferences.vehicle_condition = lowerMessage.includes('new') ? 'new' : 'used';
    }

    // Extract car type preferences - PRIORITY 2
    if (detectedIntent === 'car_type' || lowerMessage.includes('suv') || lowerMessage.includes('sedan') || lowerMessage.includes('truck') || lowerMessage.includes('car')) {
      if (lowerMessage.includes('suv') || lowerMessage.includes('crossover')) {
        preferences.body_style = 'SUV';
      } else if (lowerMessage.includes('sedan')) {
        preferences.body_style = 'Sedan';
      } else if (lowerMessage.includes('truck')) {
        preferences.body_style = 'Truck';
      } else if (lowerMessage.includes('electric') || lowerMessage.includes('ev')) {
        preferences.fuel_type = 'Electric';
      } else if (lowerMessage.includes('hybrid')) {
        preferences.fuel_type = 'Hybrid';
      } else if (lowerMessage.includes('car') || lowerMessage.includes('vehicle')) {
        // Generic car preference - don't set specific body style yet
        preferences.has_car_preference = true;
      }
    }

    // Extract budget preferences
    if (detectedIntent === 'budget' || lowerMessage.includes('$') || lowerMessage.includes('budget')) {
      const priceMatch = lowerMessage.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
      if (priceMatch) {
        const maxPrice = Math.max(...priceMatch.map(p => parseFloat(p.replace(/[$,]/g, ''))));
        preferences.price_range = { max: maxPrice };
      }
    }

         // Extract features
     if (detectedIntent === 'features') {
       const featureKeywords = {
         'safety': ['safety', 'backup camera', 'lane departure', 'blind spot', 'airbag', 'abs', 'brake'],
         'seating': ['7 seat', '7-seat', '8 seat', '8-seat', 'seating', 'seat'],
         'luxury': ['leather', 'luxury', 'premium', 'heated seats', 'leather'],
         'technology': ['apple carplay', 'android auto', 'navigation', 'wireless charging', 'bluetooth']
       };

       for (const [category, keywords] of Object.entries(featureKeywords)) {
         if (keywords.some(keyword => lowerMessage.includes(keyword))) {
           preferences.features = preferences.features || [];
           preferences.features.push(category);
         }
       }
     }

    // Extract color preferences
    if (detectedIntent === 'color' || lowerMessage.includes('color')) {
      const colors = ['black', 'white', 'red', 'blue', 'silver', 'gray', 'green'];
      for (const color of colors) {
        if (lowerMessage.includes(color)) {
          preferences.color = color;
          break;
        }
      }
    }

    // Extract mileage preferences
    if (lowerMessage.includes('mile') || lowerMessage.includes('odometer')) {
      if (lowerMessage.includes('new') || lowerMessage.includes('0 mile')) {
        preferences.mileage = { max: 100 };
      } else {
        const mileageMatch = lowerMessage.match(/(\d+(?:,\d{3})*)\s*miles?/i);
        if (mileageMatch) {
          preferences.mileage = { max: parseInt(mileageMatch[1].replace(/,/g, '')) };
        }
      }
    }

    return preferences;
  }

  // Update conversation state with new preferences
  updateConversationState(conversation, preferences, detectedIntent) {
    // Update preferences
    for (const [key, value] of Object.entries(preferences)) {
      if (value !== null && value !== undefined) {
        conversation.preferences[key] = value;
      }
    }

    // Mark steps as completed based on detected intent and preferences
    const intentToStepMap = {
      'car_type': 2,
      'budget': 3,
      'features': 4,
      'brand': 5,
      'color': 6,
      'mileage': 7,
      'financing': 11,
      'availability': 10,
      'test_drive': 13,
      'purchase_commitment': 14
    };

    if (intentToStepMap[detectedIntent]) {
      conversation.completedSteps.add(intentToStepMap[detectedIntent]);
    }

         // Also mark steps as completed based on collected preferences
     if (conversation.preferences.vehicle_condition) {
       conversation.completedSteps.add(1); // Greeting step completed
     }
     
     if (conversation.preferences.body_style && conversation.preferences.body_style !== 'generic') {
       conversation.completedSteps.add(2); // Car type step
     }
    
    if (conversation.preferences.price_range) {
      conversation.completedSteps.add(3); // Budget step
    }
    
    if (conversation.preferences.features && conversation.preferences.features.length > 0) {
      conversation.completedSteps.add(4); // Features step
    }
    
    if (conversation.preferences.color) {
      conversation.completedSteps.add(6); // Color step
    }
    
    if (conversation.preferences.mileage) {
      conversation.completedSteps.add(7); // Mileage step
    }

    // Update database filters
    this.updateDatabaseFilters(conversation);
  }

  // Update database filters based on collected preferences
  updateDatabaseFilters(conversation) {
    const filters = {};

    if (conversation.preferences.body_style) {
      filters.body_style = conversation.preferences.body_style;
    }

    if (conversation.preferences.price_range) {
      filters.max_price = conversation.preferences.price_range.max;
    }

    if (conversation.preferences.features && conversation.preferences.features.length > 0) {
      filters.features = conversation.preferences.features;
    }

    if (conversation.preferences.color) {
      filters.color = conversation.preferences.color;
    }

    if (conversation.preferences.mileage) {
      filters.max_mileage = conversation.preferences.mileage.max;
    }

    if (conversation.preferences.fuel_type) {
      filters.fuel_type = conversation.preferences.fuel_type;
    }

    conversation.databaseFilters = filters;
  }

  // Enhanced step progression logic
  shouldProgressToNextStep(conversation, currentStep, userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    switch (currentStep) {
      case 1: // Greeting step
        // Progress if they provide vehicle condition (new/used)
        return conversation.preferences.vehicle_condition;
      
      case 2: // Car type step
        // Progress if they provide body style or fuel type
        return conversation.preferences.body_style || conversation.preferences.fuel_type;
      
      case 3: // Budget step
        // Progress if they provide price range
        return conversation.preferences.price_range;
      
      case 4: // Features step
        // Progress if they provide features
        return conversation.preferences.features && conversation.preferences.features.length > 0;
      
      case 5: // Brand step
        // Progress if they provide brand preference
        return conversation.preferences.brand;
      
      case 6: // Vehicle recommendations
        // Progress if they've seen recommendations
        return conversation.preferences.vehicle_recommendations_shown;
      
      case 7: // Test drive & selection
        // Progress if they've selected a vehicle or scheduled test drive
        return conversation.preferences.vehicle_selected || conversation.preferences.test_drive_scheduled;
      
      case 8: // Purchase decision
        // Progress if they confirm purchase intent
        return lowerMessage.includes('yes') || lowerMessage.includes('ready') || lowerMessage.includes('proceed') || 
               lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('confirm');
      
      // Purchase Journey Steps (9-16)
      case 9: // Sale confirmation
        // Progress if they confirm vehicle details
        return conversation.preferences.vehicle_details_confirmed;
      
      case 10: // Contract review
        // Progress if they understand contract terms
        return conversation.preferences.contract_understood;
      
      case 11: // Trade-in discussion
        // Progress if trade-in is discussed or declined
        return conversation.preferences.trade_in_discussed || conversation.preferences.no_trade_in;
      
      case 12: // Finance finalization
        // Progress if financing is finalized
        return conversation.preferences.financing_finalized;
      
      case 13: // Vehicle preparation
        // Progress if vehicle preparation is confirmed
        return conversation.preferences.vehicle_preparation_confirmed;
      
      case 14: // Delivery & handover
        // Progress if delivery is completed
        return conversation.preferences.delivery_completed;
      
      case 15: // Customer support
        // Progress if customer satisfaction is confirmed
        return conversation.preferences.customer_satisfied;
      
      case 16: // Follow-up
        // Progress if follow-up is scheduled
        return conversation.preferences.follow_up_scheduled;
      
      default:
        return false;
    }
  }

  // Determine next step based on completed steps and preferences
  determineNextStep(conversation) {
    // If we have all required preferences for vehicle selection, move to recommendations
    if (conversation.preferences.body_style && 
        conversation.preferences.price_range && 
        conversation.preferences.features && 
        conversation.preferences.features.length > 0 &&
        !conversation.completedSteps.has(6)) {
      return 6; // Vehicle recommendations step
    }
    
    // If vehicle is selected and purchase is confirmed, start purchase journey
    if (conversation.preferences.vehicle_selected && 
        conversation.preferences.purchase_confirmed &&
        !conversation.completedSteps.has(9)) {
      return 9; // Start purchase journey
    }
    
    // Define step order for the conversation flow
    const stepOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    
    // Find the next step that should be asked
    for (const step of stepOrder) {
      if (!conversation.completedSteps.has(step)) {
        return step;
      }
    }

    return 16; // Follow-up if all steps completed
  }

  // Generate response for current step
  async generateStepResponse(conversation, stepNumber, userMessage) {
    const step = this.stepDefinitions[stepNumber];
    if (!step) {
      return 'I\'m not sure what the next step should be. Let me help you find the right vehicle.';
    }

    // Check if we can skip this step based on user message
    if (this.canSkipStep(conversation, stepNumber, userMessage)) {
      conversation.completedSteps.add(stepNumber);
      const nextStep = this.determineNextStep(conversation);
      return this.generateStepResponse(conversation, nextStep, userMessage);
    }

    // Get current agent and next agent for routing
    const currentAgent = this.routeToAgent(stepNumber, conversation);
    const nextStep = this.determineNextStep(conversation);
    const nextAgent = this.routeToAgent(nextStep, conversation);

    // Generate step-specific response
    let response = '';
    switch (stepNumber) {
      case 1:
        response = step.question;
        break;
      
      case 2:
        response = this.generateCarTypeQuestion(conversation);
        break;
      
      case 3:
        response = this.generateBudgetQuestion(conversation);
        break;
      
      case 4:
        response = this.generateFeaturesQuestion(conversation);
        break;
      
      case 6:
        response = await this.generateRecommendations(conversation);
        break;
      
      case 8:
        response = this.generatePurchaseDecisionQuestion(conversation);
        break;
      
      // Purchase Journey Steps
      case 9:
        response = this.generateSaleConfirmationResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 10:
        response = this.generateContractReviewResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 11:
        response = this.generateTradeInResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 12:
        response = this.generateFinanceFinalizationResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 13:
        response = this.generateVehiclePreparationResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 14:
        response = this.generateDeliveryHandoverResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 15:
        response = this.generateCustomerSupportResponse(conversation, currentAgent, nextAgent);
        break;
      
      case 16:
        response = this.generateFollowUpResponse(conversation, currentAgent, nextAgent);
        break;
      
      default:
        response = step.question;
        break;
    }

    // Add agent transition message if moving to a different agent
    if (currentAgent !== nextAgent && this.isPurchaseJourneyStep(stepNumber)) {
      const transitionMessage = this.getAgentTransitionMessage(currentAgent, nextAgent, this.stepDefinitions[nextStep]?.name || 'the next step');
      response += `\n\n${transitionMessage}`;
    }

    return response;
  }

  // Check if step can be skipped based on user input
  canSkipStep(conversation, stepNumber, userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    switch (stepNumber) {
             case 1: // Greet & Qualify Lead
         // Skip if step 1 is already completed or if they explicitly mention new/used condition AND are asking about a specific vehicle
         if (conversation.completedSteps.has(1)) {
           return true; // Step 1 already completed
         }
         
         // Only skip if they explicitly mention new/used condition AND are asking about a specific vehicle
         // This prevents skipping the greeting for general inquiries like "I am looking for a new car"
         const hasNewUsed = lowerMessage.includes('new') || lowerMessage.includes('used');
         const hasSpecificVehicle = lowerMessage.includes('suv') || lowerMessage.includes('sedan') || 
                                  lowerMessage.includes('truck') || lowerMessage.includes('hyundai') || 
                                  lowerMessage.includes('toyota') || lowerMessage.includes('honda');
         
         // Only skip if they have both new/used AND specific vehicle preference
         return hasNewUsed && hasSpecificVehicle;
      
      case 2: // Car type
        return conversation.preferences.body_style || 
               lowerMessage.includes('suv') || 
               lowerMessage.includes('sedan') ||
               lowerMessage.includes('truck');
      
      case 3: // Budget
        return conversation.preferences.price_range || 
               lowerMessage.includes('$') ||
               lowerMessage.includes('budget');
      
      case 4: // Features
        return conversation.preferences.features && 
               conversation.preferences.features.length > 0;
      
      default:
        return false;
    }
  }

  // Generate car type question with context
  generateCarTypeQuestion(conversation) {
    if (conversation.preferences.body_style) {
      return `I see you're interested in ${conversation.preferences.body_style}s. Do you have a specific type in mind — electric, hybrid, or traditional fuel?`;
    }
    return this.stepDefinitions[2].question;
  }

  // Generate budget question with context
  generateBudgetQuestion(conversation) {
    if (conversation.preferences.price_range) {
      return `Great! I see your budget is around $${conversation.preferences.price_range.max.toLocaleString()}. Are you flexible with this range, or would you like to stick to it?`;
    }
    return this.stepDefinitions[3].question;
  }

  // Generate features question with context
  generateFeaturesQuestion(conversation) {
    if (conversation.preferences.features && conversation.preferences.features.length > 0) {
      const features = conversation.preferences.features.join(', ');
      return `Perfect! I've noted your interest in ${features}. Are there any other specific features that matter to you?`;
    }
    return this.stepDefinitions[4].question;
  }

  // NEW: Generate purchase decision question
  generatePurchaseDecisionQuestion(conversation) {
    if (conversation.preferences.vehicle_selected) {
      const vehicle = conversation.preferences.selected_vehicle;
      return `Excellent! I can see you've selected the ${vehicle.make} ${vehicle.model}. Are you ready to proceed with the purchase? I'll guide you through the entire process step by step.`;
    }
    return this.stepDefinitions[8].question;
  }

  // NEW: Purchase Journey Response Methods

  // Step 9: Sale Confirmation
  generateSaleConfirmationResponse(conversation, currentAgent, nextAgent) {
    const vehicle = conversation.preferences.selected_vehicle;
    let response = `Perfect! Let me confirm your vehicle selection:\n\n`;
    
    if (vehicle) {
      response += `• **Vehicle:** ${vehicle.make} ${vehicle.model}\n`;
      response += `• **Year:** ${vehicle.year}\n`;
      response += `• **Price:** $${vehicle.price?.toLocaleString()}\n`;
      response += `• **Features:** ${vehicle.features?.join(', ') || 'Standard features'}\n\n`;
    }
    
    response += `Is this correct? Once confirmed, I'll guide you through the contract review process.`;
    
    return response;
  }

  // Step 10: Contract Review
  generateContractReviewResponse(conversation, currentAgent, nextAgent) {
    let response = `Now let's review the sales contract. Here's what we'll cover:\n\n`;
    response += `• **Purchase Price:** Final vehicle cost\n`;
    response += `• **Taxes & Fees:** Registration, documentation, etc.\n`;
    response += `• **Warranty Options:** Available coverage plans\n`;
    response += `• **Terms & Conditions:** Important details to understand\n\n`;
    response += `Do you have any questions about the contract terms?`;
    
    return response;
  }

  // Step 11: Trade-In Discussion
  generateTradeInResponse(conversation, currentAgent, nextAgent) {
    let response = `Let's discuss your trade-in vehicle:\n\n`;
    response += `• **Current Vehicle:** Make, model, year\n`;
    response += `• **Condition:** Mileage, maintenance history\n`;
    response += `• **Valuation:** Fair market assessment\n`;
    response += `• **Trade-In Credit:** Applied to your purchase\n\n`;
    response += `Do you have a trade-in vehicle, or would you prefer to discuss this later?`;
    
    return response;
  }

  // Step 12: Finance Finalization
  generateFinanceFinalizationResponse(conversation, currentAgent, nextAgent) {
    let response = `Now let's finalize your financing:\n\n`;
    response += `• **Loan Options:** Available terms and rates\n`;
    response += `• **Payment Plans:** Monthly payment options\n`;
    response += `• **Credit Application:** Quick approval process\n`;
    response += `• **Documentation:** Required paperwork\n\n`;
    response += `I'll explain all the financing terms and get your paperwork ready.`;
    
    return response;
  }

  // Step 13: Vehicle Preparation
  generateVehiclePreparationResponse(conversation, currentAgent, nextAgent) {
    let response = `Excellent! Now our inventory crew will prepare your vehicle:\n\n`;
    response += `• **Quality Check:** Full inspection and testing\n`;
    response += `• **Cleaning:** Interior and exterior detailing\n`;
    response += `• **Fuel:** Full tank of gas\n`;
    response += `• **Documentation:** Owner's manual and paperwork\n\n`;
    response += `Your vehicle will be ready for delivery in about 1-2 hours.`;
    
    return response;
  }

  // Step 14: Delivery & Handover
  generateDeliveryHandoverResponse(conversation, currentAgent, nextAgent) {
    let response = `Your vehicle is ready for delivery!\n\n`;
    response += `• **Final Walkthrough:** Vehicle features and controls\n`;
    response += `• **Key Handover:** All keys and remotes\n`;
    response += `• **Documentation:** Title, registration, warranty\n`;
    response += `• **Contact Info:** Service and support details\n\n`;
    response += `Let's complete the delivery process and get you on the road!`;
    
    return response;
  }

  // Step 15: Customer Support
  generateCustomerSupportResponse(conversation, currentAgent, nextAgent) {
    let response = `How are you feeling about your purchase experience?\n\n`;
    response += `• **Satisfaction Check:** Overall experience rating\n`;
    response += `• **Questions:** Any remaining concerns\n`;
    response += `• **Support:** Ongoing assistance available\n`;
    response += `• **Feedback:** Suggestions for improvement\n\n`;
    response += `I want to ensure everything meets your expectations.`;
    
    return response;
  }

  // Step 16: Follow-Up
  generateFollowUpResponse(conversation, currentAgent, nextAgent) {
    let response = `Thank you for choosing us! Here's your follow-up plan:\n\n`;
    response += `• **24-Hour Check:** Call to ensure everything is working\n`;
    response += `• **1-Week Follow-up:** Address any questions or concerns\n`;
    response += `• **1-Month Review:** Service reminder and satisfaction check\n`;
    response += `• **Ongoing Support:** Available whenever you need us\n\n`;
    response += `Your journey with us doesn't end here - we're here for the long haul!`;
    
    return response;
  }

  // Generate vehicle recommendations based on preferences
  async generateRecommendations(conversation) {
    const filters = conversation.databaseFilters;
    
    // This would integrate with your actual database
    // For now, return a structured response
    let response = 'Based on your preferences, here are the best matches:\n\n';
    
    if (filters.body_style) {
      response += `• Vehicle Type: ${filters.body_style}\n`;
    }
    
    if (filters.max_price) {
      response += `• Budget: Up to $${filters.max_price.toLocaleString()}\n`;
    }
    
    if (filters.features) {
      response += `• Features: ${filters.features.join(', ')}\n`;
    }
    
    if (filters.color) {
      response += `• Color: ${filters.color}\n`;
    }
    
    response += '\nWould you like me to show you specific vehicles that match these criteria?';
    
    return response;
  }

  // Generate conversation summary
  generateSummary(conversation) {
    const prefs = conversation.preferences;
    
    let summary = '**Here\'s a summary of your preferences:**\n\n';
    
    if (prefs.body_style) summary += `• **Vehicle Type:** ${prefs.body_style}\n`;
    if (prefs.price_range) summary += `• **Budget:** Up to $${prefs.price_range.max.toLocaleString()}\n`;
    if (prefs.features) summary += `• **Features:** ${prefs.features.join(', ')}\n`;
    if (prefs.color) summary += `• **Color:** ${prefs.color}\n`;
    if (prefs.mileage) summary += `• **Mileage:** Up to ${prefs.mileage.max.toLocaleString()} miles\n`;
    
    summary += '\n**Next Steps:**\n';
    summary += '1. Review vehicle recommendations\n';
    summary += '2. Schedule test drive\n';
    summary += '3. Discuss financing options\n';
    
    return summary;
  }

  // Get conversation state
  getConversationState(sessionId) {
    return this.conversationHistory.get(sessionId);
  }

  // Clear conversation history
  clearConversation(sessionId) {
    this.conversationHistory.delete(sessionId);
  }
}

// Export the enhanced system
export default EnhancedGoNextSystem;
