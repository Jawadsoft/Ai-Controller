// Conversation Flow Manager for DAIVE
// Fixes repetitive responses and improves conversation flow

class ConversationFlowManager {
  constructor() {
    this.conversationStates = new Map(); // sessionId -> conversation state
    this.intentHistory = new Map(); // sessionId -> intent progression
    this.userPreferences = new Map(); // sessionId -> user preferences
  }

  // Get or create conversation state for a session
  getConversationState(sessionId) {
    if (!this.conversationStates.has(sessionId)) {
      this.conversationStates.set(sessionId, {
        step: 'greeting',
        vehicleType: null,
        budget: null,
        newOrUsed: null,
        familySize: null,
        previousResponses: [],
        lastIntent: null,
        conversationProgress: 0
      });
    }
    return this.conversationStates.get(sessionId);
  }

  // Analyze user input and determine next step
  analyzeConversation(sessionId, userMessage, transcription = null) {
    const state = this.getConversationState(sessionId);
    const message = transcription || userMessage;
    const lowerMessage = message.toLowerCase();
    
    console.log('🔍 Analyzing conversation:', {
      sessionId,
      currentStep: state.step,
      message: message.substring(0, 100),
      hasTranscription: !!transcription
    });

    // Detect intent and update state
    const intent = this.detectIntent(lowerMessage, state);
    const nextStep = this.determineNextStep(state, intent, lowerMessage);
    
    // Update state
    state.lastIntent = intent;
    state.step = nextStep;
    state.conversationProgress = Math.min(state.conversationProgress + 1, 10);
    
    // Extract user preferences
    this.extractUserPreferences(state, lowerMessage);
    
    console.log('📊 Conversation analysis result:', {
      detectedIntent: intent,
      nextStep: nextStep,
      updatedState: { ...state }
    });
    
    return {
      intent,
      nextStep,
      state: { ...state },
      shouldAskFollowUp: this.shouldAskFollowUp(state, intent)
    };
  }

  // Detect user intent from message
  detectIntent(message, state) {
    // Vehicle type detection
    if (/\b(suv|sport utility|utility vehicle|crossover)\b/.test(message)) {
      return 'VEHICLE_TYPE_SUV';
    }
    if (/\b(sedan|car|passenger car)\b/.test(message)) {
      return 'VEHICLE_TYPE_SEDAN';
    }
    if (/\b(truck|pickup|pick-up)\b/.test(message)) {
      return 'VEHICLE_TYPE_TRUCK';
    }
    if (/\b(hybrid|electric|ev|phev)\b/.test(message)) {
      return 'VEHICLE_TYPE_ECO';
    }

    // Budget detection
    if (/\b(budget|price|cost|afford|spend)\b/.test(message)) {
      return 'BUDGET_INQUIRY';
    }
    if (/\$(\d+)/.test(message)) {
      return 'BUDGET_SPECIFIED';
    }

    // New vs Used
    if (/\b(new\b)/.test(message)) {
      return 'NEW_VEHICLE';
    }
    if (/\b(used\b)/.test(message)) {
      return 'USED_VEHICLE';
    }

    // Family considerations
    if (/\b(family|kids|children|baby|car seats)\b/.test(message)) {
      return 'FAMILY_NEEDS';
    }

    // Test drive
    if (/\b(test drive|test drive|drive|test)\b/.test(message)) {
      return 'TEST_DRIVE_REQUEST';
    }

    // Financing
    if (/\b(finance|financing|loan|payment|monthly|apr)\b/.test(message)) {
      return 'FINANCING_INQUIRY';
    }

    // Greeting/General
    if (/\b(hi|hello|hey|good morning|good afternoon)\b/.test(message)) {
      return 'GREETING';
    }

    return 'GENERAL_INQUIRY';
  }

  // Determine next conversation step
  determineNextStep(state, intent, message) {
    // If this is a new conversation or greeting, start with vehicle type
    if (state.step === 'greeting' || intent === 'GREETING') {
      return 'vehicle_type_inquiry';
    }

    // If we know vehicle type, ask about budget
    if (state.vehicleType && state.step === 'vehicle_type_inquiry') {
      return 'budget_inquiry';
    }

    // If we know budget, ask about new vs used
    if (state.budget && state.step === 'budget_inquiry') {
      return 'new_used_inquiry';
    }

    // If we know new vs used, ask about family needs
    if (state.newOrUsed && state.step === 'new_used_inquiry') {
      return 'family_needs_inquiry';
    }

    // If we have all basic info, offer specific recommendations
    if (state.vehicleType && state.budget && state.newOrUsed) {
      return 'recommendations';
    }

    // Handle specific intents
    switch (intent) {
      case 'VEHICLE_TYPE_SUV':
        state.vehicleType = 'SUV';
        return 'budget_inquiry';
      case 'VEHICLE_TYPE_SEDAN':
        state.vehicleType = 'Sedan';
        return 'budget_inquiry';
      case 'VEHICLE_TYPE_TRUCK':
        state.vehicleType = 'Truck';
        return 'budget_inquiry';
      case 'VEHICLE_TYPE_ECO':
        state.vehicleType = 'Hybrid/Electric';
        return 'budget_inquiry';
      case 'BUDGET_SPECIFIED':
        const budgetMatch = message.match(/\$(\d+)/);
        if (budgetMatch) {
          state.budget = parseInt(budgetMatch[1]);
        }
        return 'new_used_inquiry';
      case 'NEW_VEHICLE':
        state.newOrUsed = 'new';
        return 'family_needs_inquiry';
      case 'USED_VEHICLE':
        state.newOrUsed = 'used';
        return 'family_needs_inquiry';
      case 'FAMILY_NEEDS':
        state.familySize = this.extractFamilySize(message);
        return 'recommendations';
      default:
        return state.step; // Stay on current step
    }
  }

  // Extract user preferences from message
  extractUserPreferences(state, message) {
    // Extract budget if mentioned - improved to handle commas and k suffix
    const budgetMatch = message.match(/\$(\d+(?:,\d{3})*(?:k|000)?)/i);
    if (budgetMatch && !state.budget) {
      const priceStr = budgetMatch[1].toLowerCase().replace(/,/g, '');
      if (priceStr.includes('k')) {
        state.budget = parseInt(priceStr.replace('k', ''), 10) * 1000;
      } else {
        state.budget = parseInt(priceStr, 10);
      }
      console.log(`💰 Extracted budget from "${message}": $${state.budget.toLocaleString()}`);
    }

    // Extract vehicle type if mentioned
    if (/\b(suv|sport utility)\b/.test(message) && !state.vehicleType) {
      state.vehicleType = 'SUV';
    } else if (/\b(sedan|car)\b/.test(message) && !state.vehicleType) {
      state.vehicleType = 'Sedan';
    } else if (/\b(truck|pickup)\b/.test(message) && !state.vehicleType) {
      state.vehicleType = 'Truck';
    }

    // Extract new vs used preference
    if (/\b(new\b)/.test(message) && !state.newOrUsed) {
      state.newOrUsed = 'new';
    } else if (/\b(used\b)/.test(message) && !state.newOrUsed) {
      state.newOrUsed = 'used';
    }
  }

  // Extract family size from message
  extractFamilySize(message) {
    if (/\b(family|kids|children)\b/.test(message)) {
      if (/\b(2|two)\b/.test(message)) return 2;
      if (/\b(3|three)\b/.test(message)) return 3;
      if (/\b(4|four)\b/.test(message)) return 4;
      if (/\b(5|five)\b/.test(message)) return 5;
      if (/\b(6|six)\b/.test(message)) return 6;
      return 4; // Default family size
    }
    return null;
  }

  // Determine if we should ask a follow-up question
  shouldAskFollowUp(state, intent) {
    // Don't ask follow-up if we're already moving to recommendations
    if (state.step === 'recommendations') {
      return false;
    }

    // Ask follow-up if we're missing key information
    if (!state.vehicleType && intent !== 'VEHICLE_TYPE_SUV' && intent !== 'VEHICLE_TYPE_SEDAN' && intent !== 'VEHICLE_TYPE_TRUCK') {
      return true;
    }

    if (!state.budget && intent !== 'BUDGET_SPECIFIED') {
      return true;
    }

    if (!state.newOrUsed && intent !== 'NEW_VEHICLE' && intent !== 'USED_VEHICLE') {
      return true;
    }

    return false;
  }

  // Generate appropriate response based on conversation state
  generateResponse(state, intent, dealerInfo) {
    const dealershipName = dealerInfo?.business_name || 'our dealership';
    
    switch (state.step) {
      case 'greeting':
        return `Hello! Welcome to ${dealershipName}! I'm here to help you find the perfect vehicle. What type of vehicle are you looking for today?`;
      
      case 'vehicle_type_inquiry':
        if (state.vehicleType) {
          return `Great choice! ${state.vehicleType}s are excellent vehicles. What's your budget range for this ${state.vehicleType.toLowerCase()}?`;
        }
        return `What type of vehicle are you interested in? We have SUVs, sedans, trucks, and hybrid/electric options.`;
      
      case 'budget_inquiry':
        if (state.budget) {
          return `Perfect! A budget of $${state.budget.toLocaleString()} gives us great options. Are you looking for a new or used vehicle?`;
        }
        return `What's your budget range for this vehicle? This will help me show you the best options available.`;
      
      case 'new_used_inquiry':
        if (state.newOrUsed) {
          return `Excellent! ${state.newOrUsed.charAt(0).toUpperCase() + state.newOrUsed.slice(1)} vehicles often offer great value. Is this for your family? How many passengers do you need to accommodate?`;
        }
        return `Are you looking for a new or used vehicle? Both have their advantages, and I can help you decide.`;
      
      case 'family_needs_inquiry':
        if (state.familySize) {
          return `Perfect! A ${state.familySize}-passenger vehicle will give you plenty of space. Let me show you some great ${state.vehicleType} options within your $${state.budget.toLocaleString()} budget.`;
        }
        return `Is this vehicle for your family? How many passengers do you need to accommodate?`;
      
      case 'recommendations':
        return `Based on your preferences, I have some excellent ${state.vehicleType} options for you! Let me show you what we have available.`;
      
      default:
        return `I'm here to help you find the perfect vehicle. What would you like to know more about?`;
    }
  }

  // Check if conversation is stuck in a loop
  isConversationStuck(sessionId, currentMessage) {
    const state = this.getConversationState(sessionId);
    const recentResponses = state.previousResponses.slice(-3);
    
    // Check if the same response pattern is repeating
    const hasRepetition = recentResponses.some((response, index) => {
      if (index === 0) return false;
      return response === recentResponses[index - 1];
    });
    
    // NEW: Check for specific repetitive patterns that indicate the bot is stuck
    const repetitivePatterns = [
      'Hi! Are you looking for a new or used car?',
      'Are you looking for a new or used car?',
      'What type of vehicle are you looking for?',
      'Can you tell me what you\'re looking for?'
    ];
    
    const hasRepetitivePattern = repetitivePatterns.some(pattern => {
      return recentResponses.some(response => 
        response.toLowerCase().includes(pattern.toLowerCase())
      );
    });
    
    // NEW: Check if user has already provided the information the bot keeps asking for
    const userHasProvidedInfo = this.userHasProvidedRequiredInfo(state, currentMessage);
    
    if (hasRepetition || hasRepetitivePattern || userHasProvidedInfo) {
      console.log('⚠️ Conversation loop or repetitive pattern detected, resetting state');
      console.log('🔍 Loop detection details:', {
        hasRepetition,
        hasRepetitivePattern,
        userHasProvidedInfo,
        recentResponses: recentResponses.map(r => r.substring(0, 50))
      });
      this.resetConversationState(sessionId);
      return true;
    }
    
    return false;
  }
  
  // NEW: Check if user has already provided the information the bot keeps asking for
  userHasProvidedRequiredInfo(state, currentMessage) {
    const message = currentMessage.toLowerCase();
    
    // Check if user has already specified vehicle type
    const hasSpecifiedVehicleType = /\b(suv|sedan|truck|car|vehicle)\b/.test(message);
    
    // Check if user has already specified new/used preference
    const hasSpecifiedNewUsed = /\b(new|used)\b/.test(message);
    
    // Check if user has already specified budget
    const hasSpecifiedBudget = /\$(\d+)/.test(message) || /\b(budget|under|around)\b/.test(message);
    
    // If user has provided info but bot is still asking basic questions, it's stuck
    if ((hasSpecifiedVehicleType && state.step === 'greeting') ||
        (hasSpecifiedNewUsed && state.step === 'vehicle_type_inquiry') ||
        (hasSpecifiedBudget && state.step === 'vehicle_type_inquiry')) {
      console.log('⚠️ User has provided info but bot is asking basic questions - conversation stuck');
      return true;
    }
    
    return false;
  }

  // Reset conversation state if stuck
  resetConversationState(sessionId) {
    this.conversationStates.delete(sessionId);
    console.log('🔄 Conversation state reset for session:', sessionId);
  }

  // Get conversation summary for debugging
  getConversationSummary(sessionId) {
    const state = this.getConversationState(sessionId);
    return {
      sessionId,
      currentStep: state.step,
      vehicleType: state.vehicleType,
      budget: state.budget,
      newOrUsed: state.newOrUsed,
      familySize: state.familySize,
      conversationProgress: state.conversationProgress,
      lastIntent: state.lastIntent
    };
  }
}

export default ConversationFlowManager;
