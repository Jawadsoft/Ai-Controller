// Client Journey Tracker for DAIVE
// Tracks and manages the 16-step client journey during conversations
// Integrates with DAIVEService and conversation flow

class ClientJourneyTracker {
  constructor() {
    this.journeySteps = this.defineJourneySteps();
    this.sessionJourneys = new Map(); // sessionId -> journey state
    this.stepValidationRules = this.defineStepValidationRules();
  }

  // Define the 11-step client journey structure (Customer Revised Flow)
  defineJourneySteps() {
    return {
      // REVISED CUSTOMER FLOW: 11 Steps
      1: {
        name: 'Inquiry',
        description: 'Initial customer inquiry and greeting',
        question: 'Hi! How can I help you today?',
        intent: 'inquiry',
        required: true,
        field: 'initial_contact',
        agent: 'sales_consultant',
        phase: 'inquiry',
        completionCriteria: ['greeting_response', 'inquiry_received'],
        mandatory: true
      },
      2: {
        name: 'Lead Capture',
        description: 'Capture lead information and contact details',
        question: 'Could I get your name and contact information?',
        intent: 'lead_capture',
        required: true,
        field: 'contact_info',
        agent: 'sales_consultant',
        phase: 'lead_capture',
        completionCriteria: ['contact_info_captured', 'lead_qualified'],
        mandatory: true
      },
      3: {
        name: 'Vehicle Selection',
        description: 'Help customer select appropriate vehicle',
        question: 'What type of vehicle are you looking for?',
        intent: 'vehicle_selection',
        required: true,
        field: 'vehicle_preferences',
        database_search: ['make', 'model', 'type', 'features'],
        agent: 'sales_consultant',
        phase: 'vehicle_selection',
        completionCriteria: ['vehicle_selected', 'preferences_identified'],
        mandatory: true
      },
      4: {
        name: 'Test Drive',
        description: 'Schedule and conduct test drive',
        question: 'Would you like to schedule a test drive?',
        intent: 'test_drive',
        required: true,
        action: 'schedule_test_drive',
        agent: 'sales_consultant',
        phase: 'test_drive',
        completionCriteria: ['test_drive_scheduled', 'test_drive_completed'],
        mandatory: true
      },
      5: {
        name: 'Trade Evaluation',
        description: 'Evaluate trade-in vehicle if applicable',
        question: 'Do you have a trade-in vehicle?',
        intent: 'trade_evaluation',
        required: false,
        action: 'evaluate_trade',
        agent: 'sales_consultant',
        phase: 'trade_evaluation',
        completionCriteria: ['trade_evaluated', 'valuation_provided'],
        mandatory: false
      },
      6: {
        name: 'Qualification (Down/Finance/Term)',
        description: 'Qualify customer for financing and terms',
        question: 'Let\'s discuss your financing options and terms.',
        intent: 'qualification',
        required: true,
        action: 'qualify_financing',
        agent: 'finance_specialist',
        phase: 'qualification',
        completionCriteria: ['financing_qualified', 'terms_discussed'],
        mandatory: true
      },
      7: {
        name: 'Purchase Commitment',
        description: 'Secure purchase commitment from customer',
        question: 'Are you ready to proceed with the purchase?',
        intent: 'purchase_commitment',
        required: true,
        action: 'secure_commitment',
        agent: 'sales_consultant',
        phase: 'purchase_commitment',
        completionCriteria: ['commitment_secured', 'purchase_confirmed'],
        mandatory: true
      },
      8: {
        name: 'Vehicle Prep',
        description: 'Prepare vehicle for delivery',
        question: 'We\'ll prepare your vehicle for delivery.',
        intent: 'vehicle_prep',
        required: true,
        action: 'prepare_vehicle',
        agent: 'inventory_crew',
        phase: 'vehicle_prep',
        completionCriteria: ['vehicle_prepared', 'quality_checked'],
        mandatory: true
      },
      9: {
        name: 'Finance Manager',
        description: 'Complete financing paperwork with finance manager',
        question: 'Our finance manager will complete your paperwork.',
        intent: 'finance_manager',
        required: true,
        action: 'complete_financing',
        agent: 'finance_manager',
        phase: 'finance_manager',
        completionCriteria: ['financing_completed', 'paperwork_signed'],
        mandatory: true
      },
      10: {
        name: 'Delivery',
        description: 'Complete vehicle delivery and handover',
        question: 'Your vehicle is ready for delivery!',
        intent: 'delivery',
        required: true,
        action: 'deliver_vehicle',
        agent: 'sales_consultant',
        phase: 'delivery',
        completionCriteria: ['vehicle_delivered', 'handover_completed'],
        mandatory: true
      },
      11: {
        name: 'CSI & Follow-ups',
        description: 'Customer satisfaction survey and follow-up',
        question: 'How was your experience? We\'ll follow up with you.',
        intent: 'csi_followup',
        required: true,
        action: 'csi_survey',
        agent: 'customer_service',
        phase: 'csi_followup',
        completionCriteria: ['csi_completed', 'follow_up_scheduled'],
        mandatory: true
      }
    };
  }

  // Define validation rules for each step (Revised 11-Step Flow)
  defineStepValidationRules() {
    return {
      // Step 1: Inquiry - SUPER FLEXIBLE validation
      1: {
        validate: (preferences, message) => {
          const hasGreeting = /^(hi|hello|hey|good|greetings|i want|i need|i'm looking|can you help)/i.test(message);
          const hasVehicleInterest = /(car|vehicle|suv|sedan|truck|electric|hybrid|ev)/i.test(message);
          const hasTechnologyInterest = /(technology|features|advanced|modern)/i.test(message);
          
          // Step 1 completes with ANY of these
          return hasGreeting || hasVehicleInterest || hasTechnologyInterest;
        },
        requiredFields: ['initial_contact']
      },
      
      // Step 2: Lead Capture - Contact information validation
      2: {
        validate: (preferences, message) => {
          // More flexible validation for lead capture
          const hasContactInfo = preferences.name || preferences.email || preferences.phone ||
                                /(name|email|phone|contact|number|reach|call)/i.test(message);
          const hasBudget = /(\$?\d+k?|\d+,\d+|\d+ thousand)/i.test(message);
          const hasVehicleMention = /(tucson|santa fe|hyundai|toyota|honda|ford|chevrolet)/i.test(message);
          
          // Skip lead capture if customer mentions vehicles or budget
          if (hasVehicleMention || hasBudget) {
            return false; // Don't complete this step, move to next
          }
          
          return hasContactInfo;
        },
        requiredFields: ['name', 'email', 'phone']
      },
      
      // Step 3: Vehicle Selection - Vehicle preferences validation
      3: {
        validate: (preferences, message) => {
          const hasVehiclePrefs = preferences.vehicleType || preferences.make || preferences.model ||
                                 /(suv|sedan|truck|hatchback|coupe|convertible|wagon|minivan|car|electric|hybrid|ev)/i.test(message);
          const hasSpecificModels = /(tucson|santa fe|palisade|elantra|sonata|accent|veloster)/i.test(message);
          return hasVehiclePrefs || hasSpecificModels;
        },
        requiredFields: ['vehicleType', 'make', 'model']
      },
      
      // Step 4: Test Drive - Test drive scheduling validation
      4: {
        validate: (preferences, message) => {
          const hasTestDrive = preferences.testDriveScheduled ||
                              preferences.testDriveCompleted ||
                              /(test drive|schedule|drive|test|keys|got the keys|received the keys)/i.test(message);
          return hasTestDrive;
        },
        requiredFields: ['testDriveScheduled', 'testDriveCompleted']
      },
      
      // Step 5: Trade Evaluation - Trade-in validation (optional)
      5: {
        validate: (preferences, message) => {
          const hasTradeIn = preferences.tradeInAssessed ||
                             preferences.tradeInValuation ||
                             /(trade|trade-in|old car|current vehicle|evaluate)/i.test(message);
          return hasTradeIn;
        },
        requiredFields: ['tradeInAssessed', 'tradeInValuation'],
        optional: true
      },
      
      // Step 6: Qualification (Down/Finance/Term) - Financing validation
      6: {
        validate: (preferences, message) => {
          const hasFinancing = preferences.financingQualified ||
                              preferences.termsDiscussed ||
                              /(finance|financing|loan|payment|terms|down payment|\$?\d+k?)/i.test(message);
          return hasFinancing;
        },
        requiredFields: ['financingQualified', 'termsDiscussed']
      },
      
      // Step 7: Purchase Commitment - Commitment validation
      7: {
        validate: (preferences, message) => {
          const hasCommitment = preferences.purchaseCommitted ||
                               preferences.commitmentSecured ||
                               /(ready|proceed|purchase|buy|commit|deal|yes)/i.test(message);
          return hasCommitment;
        },
        requiredFields: ['purchaseCommitted', 'commitmentSecured']
      },
      
      // Step 8: Vehicle Prep - Vehicle preparation validation
      8: {
        validate: (preferences, message) => {
          const hasPreparation = preferences.vehiclePrepared ||
                                preferences.qualityChecked ||
                                /(prepare|ready|quality|check|inspection|prep|pick.*up|delivery|clean|wash|detail|tomorrow|ready.*for.*delivery|vehicle.*ready|delivery.*ready|pick.*up.*tomorrow|clean.*up|wash.*up|detail.*up|prepare.*for.*delivery|ready.*to.*pick.*up|ready.*for.*pickup|delivery.*preparation|vehicle.*preparation|clean.*before.*delivery|wash.*before.*delivery|detail.*before.*delivery)/i.test(message);
          return hasPreparation;
        },
        requiredFields: ['vehiclePrepared', 'qualityChecked']
      },
      
      // Step 9: Finance Manager - Finance completion validation
      9: {
        validate: (preferences, message) => {
          const hasFinanceComplete = preferences.financingCompleted ||
                                    preferences.paperworkSigned ||
                                    /(finance|financing|paperwork|signed|complete|gap.*coverage|gap.*insurance|explain.*gap|coverage|insurance|warranty|extended.*warranty|service.*contract|protection.*plan|finance.*manager|financing.*options|payment.*options|loan.*terms|lease.*terms|credit.*application|pre.*approval|financing.*paperwork|finance.*paperwork|complete.*paperwork|sign.*paperwork|financing.*complete|finance.*complete)/i.test(message);
          return hasFinanceComplete;
        },
        requiredFields: ['financingCompleted', 'paperworkSigned']
      },
      
      // Step 10: Delivery - Delivery completion validation
      10: {
        validate: (preferences, message) => {
          const hasDelivery = preferences.vehicleDelivered ||
                              preferences.handoverCompleted ||
                              /(deliver|delivery|handover|complete|finished|ready|paperwork|let.*s.*do.*paperwork|do.*paperwork|sign.*paperwork|complete.*paperwork|finish.*paperwork|finalize.*paperwork|delivery.*ready|ready.*for.*delivery|pick.*up.*ready|vehicle.*ready|delivery.*complete|handover.*complete|delivery.*finished|handover.*finished)/i.test(message);
          return hasDelivery;
        },
        requiredFields: ['vehicleDelivered', 'handoverCompleted']
      },
      
      // Step 11: CSI & Follow-ups - Customer satisfaction validation
      11: {
        validate: (preferences, message) => {
          const hasCSI = preferences.csiCompleted ||
                        preferences.followUpScheduled ||
                        /(satisfied|happy|experience|follow|follow-up|schedule|support|great|excellent|wonderful|amazing|fantastic|perfect|love.*it|love.*the|thanks|thank.*you|appreciate|help|helped|everything.*was.*great|everything.*was.*good|everything.*was.*excellent|everything.*was.*wonderful|everything.*was.*amazing|everything.*was.*fantastic|everything.*was.*perfect|everything.*was.*good|everything.*was.*satisfied|everything.*was.*happy|everything.*was.*love|everything.*was.*thanks|everything.*was.*thank.*you|everything.*was.*appreciate|everything.*was.*help|everything.*was.*helped)/i.test(message);
          return hasCSI;
        },
        requiredFields: ['csiCompleted', 'followUpScheduled']
      }
    };
  }

  // Initialize or get journey state for a session
  getJourneyState(sessionId) {
    if (!this.sessionJourneys.has(sessionId)) {
      this.sessionJourneys.set(sessionId, {
        sessionId,
        currentStep: 1,
        completedSteps: new Set(),
        skippedSteps: new Set(),
        stepProgress: {},
        preferences: {},
        conversationHistory: [],
        lastUpdated: new Date().toISOString(),
        phase: 'inquiry',
        mandatoryStepsCompleted: 0,
        totalMandatorySteps: 10, // Steps 1-4, 6-11 (Step 5 is optional)
        journeyStartTime: new Date().toISOString(),
        vehicleOptions: [], // Array to store multiple vehicle options
        selectedVehicle: null // Store selected vehicle
      });
    }
    return this.sessionJourneys.get(sessionId);
  }

  // Enhanced vehicle selection with multiple options
  processVehicleSelection(message, preferences) {
    const messageLower = message.toLowerCase();
    const vehicleOptions = [];
    
    console.log(`🔍 Processing vehicle selection: "${message}"`);
    
    // Extract multiple vehicle mentions
    if (messageLower.includes('tucson') && messageLower.includes('santa fe')) {
      vehicleOptions.push({
        make: 'Hyundai',
        model: 'Tucson',
        year: 2023,
        price: 17999,
        color: 'White',
        stockNumber: 'TUCSON001',
        selected: false
      });
      vehicleOptions.push({
        make: 'Hyundai',
        model: 'Santa Fe',
        year: 2023,
        price: 28999,
        color: 'Silver',
        stockNumber: 'SANTAFE001',
        selected: false
      });
      console.log(`✅ Found multiple vehicles: Tucson and Santa Fe`);
    } else if (messageLower.includes('tucson')) {
      vehicleOptions.push({
        make: 'Hyundai',
        model: 'Tucson',
        year: 2023,
        price: 17999,
        color: 'White',
        stockNumber: 'TUCSON001',
        selected: true
      });
      console.log(`✅ Found single vehicle: Tucson`);
    } else if (messageLower.includes('santa fe')) {
      vehicleOptions.push({
        make: 'Hyundai',
        model: 'Santa Fe',
        year: 2023,
        price: 28999,
        color: 'Silver',
        stockNumber: 'SANTAFE001',
        selected: true
      });
      console.log(`✅ Found single vehicle: Santa Fe`);
    }
    
    return vehicleOptions;
  }

  // Update journey state based on user message and detected intent
  updateJourneyState(sessionId, userMessage, detectedIntent, preferences = {}) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    const stepInfo = this.journeySteps[currentStep];
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 JOURNEY STEP ${currentStep}: ${stepInfo.name.toUpperCase()}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📝 Customer Message: "${userMessage}"`);
    console.log(`🎯 Detected Intent: ${detectedIntent}`);
    console.log(`👤 Assigned Agent: ${stepInfo.agent}`);
    console.log(`📊 Current Phase: ${stepInfo.phase}`);
    console.log(`❓ Step Question: ${stepInfo.question}`);
    
    // Process vehicle selection if in step 3 or if vehicle mentioned
    if (currentStep === 3 || (userMessage.toLowerCase().includes('tucson') || userMessage.toLowerCase().includes('santa fe'))) {
      const vehicleOptions = this.processVehicleSelection(userMessage, preferences);
      if (vehicleOptions.length > 0) {
        journeyState.vehicleOptions = vehicleOptions;
        console.log(`🚗 Vehicle Options Stored: ${vehicleOptions.length}`);
        vehicleOptions.forEach((vehicle, index) => {
          console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price.toLocaleString()} - ${vehicle.color} - Stock# ${vehicle.stockNumber}`);
        });
        
        // Update preferences with vehicle selection
        preferences.vehicle_selected = true;
        preferences.preferences_identified = true;
        preferences.vehicleType = 'SUV';
        preferences.make = 'Hyundai';
        preferences.model = vehicleOptions.length === 1 ? vehicleOptions[0].model : 'Multiple';
      }
    }
    
    // Process budget information
    if (userMessage.match(/\$?\d+k?|\d+,\d+|\d+ thousand/i)) {
      const budgetMatch = userMessage.match(/(\d+)/);
      if (budgetMatch) {
        const budget = parseInt(budgetMatch[1]) * (userMessage.toLowerCase().includes('k') ? 1000 : 1);
        preferences.budgetAmount = budget;
        preferences.budgetRange = budget;
        preferences.financingQualified = true;
        preferences.termsDiscussed = true;
        console.log(`💰 Budget detected: $${budget.toLocaleString()}`);
      }
    }
    
    // Process test drive confirmation
    if (userMessage.toLowerCase().includes('keys') || userMessage.toLowerCase().includes('got') || userMessage.toLowerCase().includes('received')) {
      preferences.testDriveCompleted = true;
      preferences.testDriveScheduled = true;
      console.log(`🔑 Test drive confirmation detected`);
    }
    
    // Process test drive completion and satisfaction
    if (userMessage.toLowerCase().includes('wonderful') || userMessage.toLowerCase().includes('glad') || 
        userMessage.toLowerCase().includes('great') || userMessage.toLowerCase().includes('excellent') ||
        userMessage.toLowerCase().includes('amazing') || userMessage.toLowerCase().includes('fantastic') ||
        userMessage.toLowerCase().includes('loved it') || userMessage.toLowerCase().includes('love it') ||
        userMessage.toLowerCase().includes('perfect') || userMessage.toLowerCase().includes('happy') ||
        userMessage.toLowerCase().includes('satisfied')) {
      preferences.testDriveCompleted = true;
      preferences.testDriveSatisfied = true;
      preferences.readyToProceed = true;
      console.log(`🎉 Test drive satisfaction detected`);
    }
    
    // Process next steps inquiry after test drive
    if (userMessage.toLowerCase().includes('next procedure') || userMessage.toLowerCase().includes('next step') ||
        userMessage.toLowerCase().includes('what\'s next') || userMessage.toLowerCase().includes('what next') ||
        userMessage.toLowerCase().includes('now what') || userMessage.toLowerCase().includes('proceed')) {
      preferences.readyToProceed = true;
      preferences.testDriveCompleted = true;
      console.log(`🚀 Next steps inquiry detected - ready to proceed`);
    }
    
    // Update preferences
    Object.assign(journeyState.preferences, preferences);
    
    // Add message to conversation history
    journeyState.conversationHistory.push({
      timestamp: new Date().toISOString(),
      step: currentStep,
      message: userMessage,
      intent: detectedIntent,
      preferences: { ...preferences }
    });
    
    // Check if current step is completed
    const isCompleted = this.isStepCompleted(currentStep, journeyState.preferences, userMessage);
    console.log(`✅ Step Completion Status: ${isCompleted ? 'COMPLETED' : 'NOT COMPLETED'}`);
    
    if (isCompleted) {
      this.completeStep(sessionId, currentStep);
      console.log(`🎉 STEP ${currentStep} COMPLETED! Moving to next step...`);
    } else {
      // Check if we should advance based on content
      this.checkForStepAdvancement(sessionId, currentStep, detectedIntent, preferences, userMessage);
    }
    
    // Update phase if needed
    this.updatePhase(sessionId);
    
    // Show current journey status
    this.showJourneyStatus(sessionId);
    
    // Update last updated timestamp
    journeyState.lastUpdated = new Date().toISOString();
    
    return journeyState;
  }

  // Check if a step is completed based on validation rules
  isStepCompleted(stepNumber, preferences, message) {
    const validationRule = this.stepValidationRules[stepNumber];
    if (!validationRule) {
      console.warn(`⚠️ No validation rule found for step ${stepNumber}`);
      return false;
    }
    
    try {
      const isValid = validationRule.validate(preferences, message);
      
      // Enhanced logging for step validation
      console.log(`\n🔍 STEP ${stepNumber} VALIDATION DETAILS:`);
      console.log(`   Step Name: ${this.journeySteps[stepNumber]?.name || 'Unknown'}`);
      console.log(`   Message: "${message}"`);
      console.log(`   Validation Result: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
      
      // Check required fields status
      if (validationRule.requiredFields) {
        console.log(`   Required Fields Check:`);
        validationRule.requiredFields.forEach(field => {
          const hasField = preferences[field] !== undefined && preferences[field] !== null && preferences[field] !== '';
          console.log(`     - ${field}: ${hasField ? '✅ Present' : '❌ Missing'}`);
        });
      }
      
      // Log specific validation criteria for debugging
      this.logValidationCriteria(stepNumber, preferences, message, validationRule);
      
      return isValid;
    } catch (error) {
      console.error(`❌ Error validating step ${stepNumber}:`, error);
      return false;
    }
  }

  // Log detailed validation criteria for debugging
  logValidationCriteria(stepNumber, preferences, message, validationRule) {
    const messageLower = message.toLowerCase();
    
    switch (stepNumber) {
      case 1: // Inquiry
        const hasGreeting = /^(hi|hello|hey|good|greetings|i want|i need|i'm looking|can you help)/i.test(message);
        const hasVehicleInterest = /(car|vehicle|suv|sedan|truck|electric|hybrid|ev)/i.test(message);
        const hasTechnologyInterest = /(technology|features|advanced|modern)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Greeting detected: ${hasGreeting ? '✅' : '❌'}`);
        console.log(`     - Vehicle interest: ${hasVehicleInterest ? '✅' : '❌'}`);
        console.log(`     - Technology interest: ${hasTechnologyInterest ? '✅' : '❌'}`);
        break;
        
      case 2: // Lead Capture
        const hasContactInfo = preferences.name || preferences.email || preferences.phone ||
                              /(name|email|phone|contact|number|reach|call)/i.test(message);
        const hasBudget = /(\$?\d+k?|\d+,\d+|\d+ thousand)/i.test(message);
        const hasVehicleMention = /(tucson|santa fe|hyundai|toyota|honda|ford|chevrolet)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Contact info: ${hasContactInfo ? '✅' : '❌'}`);
        console.log(`     - Budget mentioned: ${hasBudget ? '✅' : '❌'}`);
        console.log(`     - Vehicle mentioned: ${hasVehicleMention ? '✅' : '❌'}`);
        if (hasVehicleMention || hasBudget) {
          console.log(`     - ⚠️ Skipping lead capture due to vehicle/budget mention`);
        }
        break;
        
      case 3: // Vehicle Selection
        const hasVehiclePrefs = preferences.vehicleType || preferences.make || preferences.model ||
                               /(suv|sedan|truck|hatchback|coupe|convertible|wagon|minivan|car|electric|hybrid|ev)/i.test(message);
        const hasSpecificModels = /(tucson|santa fe|palisade|elantra|sonata|accent|veloster)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Vehicle preferences: ${hasVehiclePrefs ? '✅' : '❌'}`);
        console.log(`     - Specific models: ${hasSpecificModels ? '✅' : '❌'}`);
        console.log(`     - Vehicle type: ${preferences.vehicleType || 'Not set'}`);
        console.log(`     - Make: ${preferences.make || 'Not set'}`);
        console.log(`     - Model: ${preferences.model || 'Not set'}`);
        break;
        
      case 4: // Test Drive
        const hasTestDrive = preferences.testDriveScheduled ||
                            preferences.testDriveCompleted ||
                            /(test drive|schedule|drive|test|keys|got the keys|received the keys)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Test drive scheduled: ${preferences.testDriveScheduled ? '✅' : '❌'}`);
        console.log(`     - Test drive completed: ${preferences.testDriveCompleted ? '✅' : '❌'}`);
        console.log(`     - Test drive keywords: ${hasTestDrive ? '✅' : '❌'}`);
        break;
        
      case 5: // Trade Evaluation
        const hasTradeIn = preferences.tradeInAssessed ||
                          preferences.tradeInValuation ||
                          /(trade|trade-in|old car|current vehicle|evaluate)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Trade-in assessed: ${preferences.tradeInAssessed ? '✅' : '❌'}`);
        console.log(`     - Trade-in valuation: ${preferences.tradeInValuation ? '✅' : '❌'}`);
        console.log(`     - Trade-in keywords: ${hasTradeIn ? '✅' : '❌'}`);
        break;
        
      case 6: // Qualification
        const hasFinancing = preferences.financingQualified ||
                            preferences.termsDiscussed ||
                            /(finance|financing|loan|payment|terms|down payment|\$?\d+k?)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Financing qualified: ${preferences.financingQualified ? '✅' : '❌'}`);
        console.log(`     - Terms discussed: ${preferences.termsDiscussed ? '✅' : '❌'}`);
        console.log(`     - Finance keywords: ${hasFinancing ? '✅' : '❌'}`);
        break;
        
      case 7: // Purchase Commitment
        const hasCommitment = preferences.purchaseCommitted ||
                             preferences.commitmentSecured ||
                             /(ready|proceed|purchase|buy|commit|deal|yes)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Purchase committed: ${preferences.purchaseCommitted ? '✅' : '❌'}`);
        console.log(`     - Commitment secured: ${preferences.commitmentSecured ? '✅' : '❌'}`);
        console.log(`     - Commitment keywords: ${hasCommitment ? '✅' : '❌'}`);
        break;
        
      case 8: // Vehicle Prep
        const hasPreparation = preferences.vehiclePrepared ||
                              preferences.qualityChecked ||
                              /(prepare|ready|quality|check|inspection|prep)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Vehicle prepared: ${preferences.vehiclePrepared ? '✅' : '❌'}`);
        console.log(`     - Quality checked: ${preferences.qualityChecked ? '✅' : '❌'}`);
        console.log(`     - Preparation keywords: ${hasPreparation ? '✅' : '❌'}`);
        break;
        
      case 9: // Finance Manager
        const hasFinanceComplete = preferences.financingCompleted ||
                                  preferences.paperworkSigned ||
                                  /(finance|financing|paperwork|signed|complete)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Financing completed: ${preferences.financingCompleted ? '✅' : '❌'}`);
        console.log(`     - Paperwork signed: ${preferences.paperworkSigned ? '✅' : '❌'}`);
        console.log(`     - Finance completion keywords: ${hasFinanceComplete ? '✅' : '❌'}`);
        break;
        
      case 10: // Delivery
        const hasDelivery = preferences.vehicleDelivered ||
                           preferences.handoverCompleted ||
                           /(deliver|delivery|handover|complete|finished|ready)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - Vehicle delivered: ${preferences.vehicleDelivered ? '✅' : '❌'}`);
        console.log(`     - Handover completed: ${preferences.handoverCompleted ? '✅' : '❌'}`);
        console.log(`     - Delivery keywords: ${hasDelivery ? '✅' : '❌'}`);
        break;
        
      case 11: // CSI & Follow-ups
        const hasCSI = preferences.csiCompleted ||
                      preferences.followUpScheduled ||
                      /(satisfied|happy|experience|follow|follow-up|schedule|support)/i.test(message);
        console.log(`   Validation Criteria:`);
        console.log(`     - CSI completed: ${preferences.csiCompleted ? '✅' : '❌'}`);
        console.log(`     - Follow-up scheduled: ${preferences.followUpScheduled ? '✅' : '❌'}`);
        console.log(`     - CSI keywords: ${hasCSI ? '✅' : '❌'}`);
        break;
        
      default:
        console.log(`   Validation Criteria: Standard validation applied`);
    }
  }

  // Mark a step as completed
  completeStep(sessionId, stepNumber) {
    const journeyState = this.getJourneyState(sessionId);
    const stepInfo = this.journeySteps[stepNumber];
    
    // Add to completed steps
    journeyState.completedSteps.add(stepNumber);
    
    // Update step progress with detailed completion info
    journeyState.stepProgress[stepNumber] = {
      completedAt: new Date().toISOString(),
      completionMethod: 'automatic',
      preferences: { ...journeyState.preferences },
      validationCriteria: this.getStepValidationSummary(stepNumber, journeyState.preferences),
      requiredFieldsStatus: this.getRequiredFieldsStatus(stepNumber, journeyState.preferences)
    };
    
    // Update mandatory steps count
    if (stepInfo.mandatory) {
      journeyState.mandatoryStepsCompleted++;
    }
    
    console.log(`\n🎉 STEP ${stepNumber} COMPLETION SUMMARY:`);
    console.log(`   Step: ${stepInfo.name}`);
    console.log(`   Phase: ${stepInfo.phase}`);
    console.log(`   Completion Time: ${new Date().toISOString()}`);
    console.log(`   Mandatory: ${stepInfo.mandatory ? 'Yes' : 'No'}`);
    console.log(`   Total Mandatory Completed: ${journeyState.mandatoryStepsCompleted}/${journeyState.totalMandatorySteps}`);
    
    // Move to next step if current step is completed
    if (journeyState.currentStep === stepNumber) {
      this.moveToNextStep(sessionId);
    }
    
    // Update phase if needed
    this.updatePhase(sessionId);
  }

  // Get step validation summary for completion tracking
  getStepValidationSummary(stepNumber, preferences) {
    const validationRule = this.stepValidationRules[stepNumber];
    if (!validationRule) return null;
    
    const summary = {
      stepNumber,
      stepName: this.journeySteps[stepNumber]?.name || 'Unknown',
      validationPassed: validationRule.validate(preferences, ''),
      requiredFields: validationRule.requiredFields || [],
      optional: validationRule.optional || false
    };
    
    return summary;
  }
  
  // Get required fields status for a step
  getRequiredFieldsStatus(stepNumber, preferences) {
    const validationRule = this.stepValidationRules[stepNumber];
    if (!validationRule || !validationRule.requiredFields) return null;
    
    const status = {};
    validationRule.requiredFields.forEach(field => {
      status[field] = {
        present: preferences[field] !== undefined && preferences[field] !== null && preferences[field] !== '',
        value: preferences[field] || null
      };
    });
    
    return status;
  }
  
  // Get step progress details for analytics
  getStepProgressDetails(sessionId, stepNumber) {
    const journeyState = this.getJourneyState(sessionId);
    const stepProgress = journeyState.stepProgress[stepNumber];
    
    if (!stepProgress) return null;
    
    return {
      stepNumber,
      stepName: this.journeySteps[stepNumber]?.name || 'Unknown',
      isCompleted: journeyState.completedSteps.has(stepNumber),
      completedAt: stepProgress.completedAt,
      completionMethod: stepProgress.completionMethod,
      validationCriteria: stepProgress.validationCriteria,
      requiredFieldsStatus: stepProgress.requiredFieldsStatus,
      preferences: stepProgress.preferences
    };
  }
  
  // Get step-specific guidance for agents
  getStepSpecificGuidance(currentStep, currentPhase) {
    const stepGuidance = {
      1: { // Inquiry
        focus: 'Build rapport and understand customer needs',
        questions: ['What brings you in today?', 'How can I help you?', 'What type of vehicle are you looking for?'],
        avoid: ['Asking for contact info too early', 'Being too sales-focused'],
        nextAction: 'Move to lead capture or vehicle selection based on customer response'
      },
      2: { // Lead Capture
        focus: 'Collect contact information and qualify the lead',
        questions: ['Could I get your name and contact information?', 'What\'s the best way to reach you?'],
        avoid: ['Being pushy about contact info', 'Skipping if customer mentions vehicles/budget'],
        nextAction: 'Proceed to vehicle selection once contact info is collected'
      },
      3: { // Vehicle Selection
        focus: 'Help customer select appropriate vehicle based on needs',
        questions: ['What type of vehicle are you looking for?', 'Do you have a preferred make or model?', 'What features are important to you?'],
        avoid: ['Showing too many options at once', 'Not listening to customer preferences'],
        nextAction: 'Present vehicle options and move to test drive scheduling'
      },
      4: { // Test Drive
        focus: 'Schedule and conduct test drive',
        questions: ['Would you like to schedule a test drive?', 'What day works best for you?', 'What time would you prefer?'],
        avoid: ['Scheduling without confirming vehicle selection', 'Not following up after test drive'],
        nextAction: 'Schedule test drive and prepare for qualification phase'
      },
      5: { // Trade Evaluation
        focus: 'Evaluate trade-in vehicle if applicable',
        questions: ['Do you have a vehicle to trade in?', 'What year, make, and model is your current vehicle?', 'What\'s the mileage?'],
        avoid: ['Being pushy about trade-in', 'Not providing accurate estimates'],
        nextAction: 'Complete trade-in evaluation and move to qualification'
      },
      6: { // Qualification
        focus: 'Qualify customer for financing and terms',
        questions: ['What\'s your primary use for this vehicle?', 'How many miles do you drive annually?', 'What\'s your budget range?'],
        avoid: ['Being too personal with financial questions', 'Not explaining financing options clearly'],
        nextAction: 'Complete qualification and move to purchase commitment'
      },
      7: { // Purchase Commitment
        focus: 'Secure purchase commitment from customer',
        questions: ['Are you ready to proceed with the purchase?', 'Do you have any questions about the vehicle?', 'What would you like to do next?'],
        avoid: ['Being too pushy', 'Not addressing customer concerns'],
        nextAction: 'Secure commitment and move to vehicle preparation'
      },
      8: { // Vehicle Prep
        focus: 'Prepare vehicle for delivery',
        questions: ['We\'ll prepare your vehicle for delivery', 'Is there anything specific you\'d like us to check?'],
        avoid: ['Rushing the preparation process', 'Not communicating progress'],
        nextAction: 'Complete vehicle preparation and move to finance manager'
      },
      9: { // Finance Manager
        focus: 'Complete financing paperwork',
        questions: ['Our finance manager will complete your paperwork', 'Do you have any questions about the financing?'],
        avoid: ['Not explaining paperwork clearly', 'Rushing through important documents'],
        nextAction: 'Complete financing and move to delivery'
      },
      10: { // Delivery
        focus: 'Complete vehicle delivery and handover',
        questions: ['Your vehicle is ready for delivery!', 'Would you like a walkthrough of the features?'],
        avoid: ['Not explaining vehicle features', 'Rushing through delivery process'],
        nextAction: 'Complete delivery and move to CSI follow-up'
      },
      11: { // CSI & Follow-ups
        focus: 'Customer satisfaction survey and follow-up',
        questions: ['How was your experience?', 'Is there anything we could improve?', 'We\'ll follow up with you soon'],
        avoid: ['Not listening to feedback', 'Being defensive about criticism'],
        nextAction: 'Complete CSI and schedule follow-up'
      }
    };
    
    return stepGuidance[currentStep] || stepGuidance[1];
  }

  // Move to the next step in the journey
  moveToNextStep(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    
    // Find next available step
    let nextStep = currentStep + 1;
    while (nextStep <= 11 && this.shouldSkipStep(nextStep, journeyState)) {
      nextStep++;
    }
    
    if (nextStep <= 11) {
      journeyState.currentStep = nextStep;
      console.log(`➡️ Moved to step ${nextStep}: ${this.journeySteps[nextStep].name}`);
    } else {
      console.log(`🎉 Journey completed for session ${sessionId}`);
    }
  }

  // Check if a step should be skipped
  shouldSkipStep(stepNumber, journeyState) {
    const stepInfo = this.journeySteps[stepNumber];
    
    // Skip if step is not mandatory and previous step was skipped
    if (!stepInfo.mandatory) {
      const previousStep = stepNumber - 1;
      if (previousStep > 0 && journeyState.skippedSteps.has(previousStep)) {
        return true;
      }
    }
    
    return false;
  }

  // Enhanced step advancement logic
  checkForStepAdvancement(sessionId, currentStep, detectedIntent, preferences, userMessage) {
    const journeyState = this.getJourneyState(sessionId);
    const messageLower = userMessage.toLowerCase();
    
    // Advance from Inquiry (Step 1) to Lead Capture (Step 2) when customer provides basic info
    if (currentStep === 1 && (messageLower.includes('preown') || messageLower.includes('pre-owned') || messageLower.includes('new') || messageLower.includes('used'))) {
      console.log(`🚀 Auto-advancing from Inquiry to Lead Capture due to vehicle condition mention`);
      this.advanceToStep(sessionId, 2);
      return;
    }
    
    // Advance from Lead Capture (Step 2) to Vehicle Selection (Step 3) when customer provides budget
    if (currentStep === 2 && (/\$?\d+k?/i.test(userMessage) || messageLower.includes('budget'))) {
      console.log(`🚀 Auto-advancing from Lead Capture to Vehicle Selection due to budget mention`);
      this.advanceToStep(sessionId, 3);
      return;
    }
    
    // Skip lead capture if customer mentions vehicles or budget
    if (currentStep === 2 && (messageLower.includes('tucson') || messageLower.includes('santa fe') || messageLower.includes('hyundai') || messageLower.includes('elantra') || messageLower.includes('palisade') || /\$?\d+k?/i.test(userMessage))) {
      console.log(`🚀 Auto-advancing from Lead Capture due to vehicle/budget mention`);
      this.advanceToStep(sessionId, 3);
      return;
    }
    
    // Advance from Vehicle Selection (Step 3) to Test Drive (Step 4) when customer confirms interest
    if (currentStep === 3 && (messageLower.includes('yes') || messageLower.includes('interested') || messageLower.includes('test drive') || messageLower.includes('drive'))) {
      console.log(`🚀 Auto-advancing from Vehicle Selection to Test Drive due to interest confirmation`);
      this.advanceToStep(sessionId, 4);
      return;
    }
    
    // Advance to test drive if customer mentions test drive
    if (currentStep === 3 && (messageLower.includes('test drive') || messageLower.includes('drive'))) {
      console.log(`🚀 Auto-advancing to Test Drive due to test drive mention`);
      this.advanceToStep(sessionId, 4);
      return;
    }
    
    // Advance from test drive to trade evaluation when test drive is completed
    if (currentStep === 4 && preferences.testDriveCompleted && preferences.readyToProceed) {
      console.log(`🚀 Auto-advancing from Test Drive to Trade Evaluation due to test drive completion`);
      this.advanceToStep(sessionId, 5);
      return;
    }
    
    // Advance to qualification if customer mentions budget (but not during qualification questions)
    if (currentStep < 6 && /\$?\d+k?/i.test(userMessage) && !messageLower.includes('miles') && !messageLower.includes('annually') && !messageLower.includes('yearly')) {
      console.log(`🚀 Auto-advancing to Qualification due to budget mention`);
      this.advanceToStep(sessionId, 6);
      return;
    }
    
    // AGGRESSIVE Step 1 advancement: Any vehicle-related content advances to step 2
    if (currentStep === 1 && (
        preferences.vehicleType || 
        /(suv|sedan|truck|car|electric|hybrid|ev|technology|features)/i.test(messageLower) ||
        detectedIntent === 'buy_car' ||
        detectedIntent === 'car_type_preference'
    )) {
      console.log(`🚀 Auto-advancing from step 1 to step 2 due to vehicle/technology interest`);
      this.advanceToStep(sessionId, 2);
      return;
    }
    
    // AGGRESSIVE Step 2 advancement: Any specific vehicle type or budget mention advances to step 3
    if (currentStep === 2 && (
        preferences.vehicleType || 
        preferences.budgetAmount || 
        preferences.budgetRange ||
        /(suv|sedan|truck|car|electric|hybrid|ev|\$?\d+)/i.test(messageLower) ||
        detectedIntent === 'budget_inquiry'
    )) {
      console.log(`🚀 Auto-advancing from step 2 to step 3 due to vehicle type or budget mention`);
      this.advanceToStep(sessionId, 3);
      return;
    }
    
    // Step 3 advancement: Only advance to test drive when vehicle selection is actually completed
    // Vehicle selection is complete when we have: make, model, type, and customer shows clear interest
    if (currentStep === 3 && (
        (preferences.make && preferences.model && preferences.vehicleType) &&
        (messageLower.includes('yes') || messageLower.includes('interested') || messageLower.includes('go ahead') ||
         messageLower.includes('sure') || messageLower.includes('love to') || messageLower.includes('want to') ||
         messageLower.includes('ready') || messageLower.includes('let\'s') || messageLower.includes('sounds good') ||
         messageLower.includes('test drive') || messageLower.includes('drive'))
    )) {
      console.log(`🚀 Auto-advancing from step 3 to step 4 due to completed vehicle selection with customer interest`);
      this.advanceToStep(sessionId, 4);
      return;
    }
    
    // AGGRESSIVE Step 4 advancement: Any feature mention or comparison advances to step 6
    if (currentStep === 4 && (
        preferences.features && preferences.features.length > 0 ||
        /(features|technology|fast-charging|sunroof|panoramic|compare|better|which)/i.test(messageLower) ||
        detectedIntent === 'car_comparison'
    )) {
      console.log(`🚀 Auto-advancing from step 4 to step 6 due to features or comparison`);
      this.advanceToStep(sessionId, 6);
      return;
    }
    
    // AGGRESSIVE Step 5 advancement: Any brand mention advances to step 6
    if (currentStep === 5 && (
        preferences.make ||
        /(tesla|hyundai|toyota|honda|ford|chevrolet|kia|nissan|bmw|mercedes|audi)/i.test(messageLower) ||
        detectedIntent === 'brand'
    )) {
      console.log(`🚀 Auto-advancing from step 5 to step 6 due to brand mention`);
      this.advanceToStep(sessionId, 6);
      return;
    }
    
    // SUPER AGGRESSIVE: If user asks for inventory or recommendations, jump to step 6
    if (currentStep < 6 && (
        /(available|inventory|what do you have|show|recommend|suggest)/i.test(messageLower) ||
        detectedIntent === 'check_availability' ||
        detectedIntent === 'inventory_inquiry'
    )) {
      console.log(`🚀 SUPER AGGRESSIVE: Jumping from step ${currentStep} to step 6 due to inventory request`);
      this.advanceToStep(sessionId, 6);
      return;
    }
    
    // General advancement based on intent
    if (detectedIntent === 'buy_car' && currentStep < 6) {
      console.log(`🚀 Auto-advancing due to buy_car intent from step ${currentStep} to step 6`);
      this.advanceToStep(sessionId, 6);
      return;
    }
  }

  // Manually advance to a specific step
  advanceToStep(sessionId, targetStep) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    
    if (targetStep > currentStep && targetStep <= 11) {
      // Mark intermediate steps as completed if they're not critical
      for (let step = currentStep; step < targetStep; step++) {
        if (step < targetStep && !this.journeySteps[step].mandatory) {
          journeyState.completedSteps.add(step);
          console.log(`✅ Auto-completed step ${step}: ${this.journeySteps[step].name}`);
        }
      }
      
      journeyState.currentStep = targetStep;
      console.log(`➡️ Manually advanced from step ${currentStep} to step ${targetStep}: ${this.journeySteps[targetStep].name}`);
      
      // Update phase if needed
      this.updatePhase(sessionId);
    }
  }

  // Update journey phase based on current step
  updatePhase(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    
    if (currentStep <= 3) {
      journeyState.phase = 'inquiry';
    } else if (currentStep === 4) {
      journeyState.phase = 'vehicle_selection';
    } else {
      journeyState.phase = 'purchase_journey';
    }
  }

  // Show current journey status with detailed logging
  showJourneyStatus(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    const stepInfo = this.journeySteps[currentStep];
    
    const totalSteps = 11;
    const completedCount = journeyState.completedSteps.size;
    const progressPercentage = Math.round((completedCount / totalSteps) * 100);
    const mandatoryProgress = Math.round((journeyState.mandatoryStepsCompleted / journeyState.totalMandatorySteps) * 100);
    
    console.log(`\n📊 JOURNEY STATUS:`);
    console.log(`   Current Step: ${currentStep}/11 - ${stepInfo.name}`);
    console.log(`   Phase: ${journeyState.phase}`);
    console.log(`   Agent: ${stepInfo.agent}`);
    console.log(`   Progress: ${progressPercentage}% (${completedCount}/${totalSteps} steps)`);
    console.log(`   Mandatory Progress: ${mandatoryProgress}% (${journeyState.mandatoryStepsCompleted}/${journeyState.totalMandatorySteps})`);
    console.log(`   Completed Steps: [${Array.from(journeyState.completedSteps).join(', ')}]`);
    console.log(`   Remaining Steps: ${totalSteps - completedCount}`);
    
    // Show detailed step validation status
    console.log(`\n🔍 STEP VALIDATION TRACKING:`);
    for (let step = 1; step <= 11; step++) {
      const isCompleted = journeyState.completedSteps.has(step);
      const stepName = this.journeySteps[step].name;
      const stepProgress = journeyState.stepProgress[step];
      
      if (isCompleted && stepProgress) {
        console.log(`   Step ${step} (${stepName}): ✅ COMPLETED at ${stepProgress.completedAt}`);
        if (stepProgress.requiredFieldsStatus) {
          const completedFields = Object.values(stepProgress.requiredFieldsStatus).filter(field => field.present).length;
          const totalFields = Object.keys(stepProgress.requiredFieldsStatus).length;
          console.log(`     Required Fields: ${completedFields}/${totalFields} completed`);
        }
      } else if (step === currentStep) {
        console.log(`   Step ${step} (${stepName}): 🔄 IN PROGRESS`);
        // Show current step validation criteria
        const validationRule = this.stepValidationRules[step];
        if (validationRule && validationRule.requiredFields) {
          console.log(`     Required Fields: ${validationRule.requiredFields.join(', ')}`);
        }
      } else {
        console.log(`   Step ${step} (${stepName}): ⏳ PENDING`);
      }
    }
    
    if (journeyState.vehicleOptions.length > 0) {
      console.log(`\n🚗 Vehicle Options: ${journeyState.vehicleOptions.length} available`);
      journeyState.vehicleOptions.forEach((vehicle, index) => {
        console.log(`     ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price.toLocaleString()}`);
      });
    }
  }

  // Get current journey status
  getJourneyStatus(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    const stepInfo = this.journeySteps[currentStep];
    
    const totalSteps = 11;
    const completedCount = journeyState.completedSteps.size;
    const skippedCount = journeyState.skippedSteps.size;
    const progressPercentage = Math.round((completedCount / totalSteps) * 100);
    
    // Calculate mandatory progress
    const mandatoryProgress = Math.round((journeyState.mandatoryStepsCompleted / journeyState.totalMandatorySteps) * 100);
    
    return {
      sessionId,
      currentStep,
      currentStepName: stepInfo.name,
      currentStepDescription: stepInfo.description,
      currentStepQuestion: stepInfo.question,
      currentStepIntent: stepInfo.intent,
      currentStepAgent: stepInfo.agent,
      currentPhase: journeyState.phase,
      completedSteps: Array.from(journeyState.completedSteps).sort((a, b) => a - b),
      skippedSteps: Array.from(journeyState.skippedSteps).sort((a, b) => a - b),
      totalSteps,
      completedCount,
      skippedCount,
      progressPercentage,
      mandatoryProgress,
      mandatoryStepsCompleted: journeyState.mandatoryStepsCompleted,
      totalMandatorySteps: journeyState.totalMandatorySteps,
      nextSteps: this.getNextSteps(sessionId),
      journeyStartTime: journeyState.journeyStartTime,
      lastUpdated: journeyState.lastUpdated,
      estimatedTimeRemaining: this.estimateTimeRemaining(sessionId),
      preferences: { ...journeyState.preferences },
      remainingSteps: totalSteps - completedCount,
      vehicleOptions: journeyState.vehicleOptions
    };
  }

  // Get next steps information
  getNextSteps(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const currentStep = journeyState.currentStep;
    const nextSteps = [];
    
    for (let i = currentStep + 1; i <= Math.min(currentStep + 3, 11); i++) {
      const stepInfo = this.journeySteps[i];
      if (stepInfo) {
        nextSteps.push({
          step: i,
          name: stepInfo.name,
          description: stepInfo.description,
          required: stepInfo.required,
          mandatory: stepInfo.mandatory,
          agent: stepInfo.agent,
          phase: stepInfo.phase
        });
      }
    }
    
    return nextSteps;
  }

  // Estimate time remaining in journey
  estimateTimeRemaining(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const completedCount = journeyState.completedSteps.size;
    const remainingSteps = 11 - completedCount;
    
    // Rough estimate: 2-5 minutes per step
    const avgTimePerStep = 3.5; // minutes
    const estimatedMinutes = remainingSteps * avgTimePerStep;
    
    return {
      remainingSteps,
      estimatedMinutes: Math.round(estimatedMinutes),
      estimatedTimeString: this.formatTimeEstimate(estimatedMinutes)
    };
  }

  // Format time estimate for display
  formatTimeEstimate(minutes) {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`;
      }
    }
  }

  // Skip a step (for non-mandatory steps)
  skipStep(sessionId, stepNumber) {
    const journeyState = this.getJourneyState(sessionId);
    const stepInfo = this.journeySteps[stepNumber];
    
    if (stepInfo.mandatory) {
      console.warn(`⚠️ Cannot skip mandatory step ${stepNumber}: ${stepInfo.name}`);
      return false;
    }
    
    journeyState.skippedSteps.add(stepNumber);
    journeyState.stepProgress[stepNumber] = {
      skippedAt: new Date().toISOString(),
      completionMethod: 'skipped',
      reason: 'user_request'
    };
    
    console.log(`⏭️ Step ${stepNumber} (${stepInfo.name}) skipped for session ${sessionId}`);
    
    // Move to next step
    this.moveToNextStep(sessionId);
    return true;
  }

  // Go back to a previous step
  goBackToStep(sessionId, stepNumber) {
    const journeyState = this.getJourneyState(sessionId);
    
    if (stepNumber < 1 || stepNumber > 11) {
      console.warn(`⚠️ Invalid step number: ${stepNumber}`);
      return false;
    }
    
    if (stepNumber >= journeyState.currentStep) {
      console.warn(`⚠️ Cannot go back to current or future step: ${stepNumber}`);
      return false;
    }
    
    journeyState.currentStep = stepNumber;
    console.log(`⬅️ Went back to step ${stepNumber}: ${this.journeySteps[stepNumber].name}`);
    
    return true;
  }

  // Get comprehensive step tracking analytics
  getStepTrackingAnalytics(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const analytics = {
      sessionId,
      totalSteps: 11,
      completedSteps: Array.from(journeyState.completedSteps),
      currentStep: journeyState.currentStep,
      stepProgress: {},
      validationSummary: {},
      requiredFieldsSummary: {},
      completionTimeline: [],
      bottlenecks: [],
      recommendations: []
    };
    
    // Analyze each step
    for (let step = 1; step <= 11; step++) {
      const stepInfo = this.journeySteps[step];
      const isCompleted = journeyState.completedSteps.has(step);
      const stepProgress = journeyState.stepProgress[step];
      
      analytics.stepProgress[step] = {
        stepNumber: step,
        stepName: stepInfo.name,
        phase: stepInfo.phase,
        isCompleted,
        isCurrent: step === journeyState.currentStep,
        mandatory: stepInfo.mandatory,
        completedAt: stepProgress?.completedAt || null,
        completionMethod: stepProgress?.completionMethod || null
      };
      
      // Validation summary
      if (isCompleted && stepProgress) {
        analytics.validationSummary[step] = stepProgress.validationCriteria;
        analytics.requiredFieldsSummary[step] = stepProgress.requiredFieldsStatus;
        
        if (stepProgress.completedAt) {
          analytics.completionTimeline.push({
            step,
            stepName: stepInfo.name,
            completedAt: stepProgress.completedAt,
            phase: stepInfo.phase
          });
        }
      }
    }
    
    // Identify bottlenecks (steps that took too long or had issues)
    const completionTimes = analytics.completionTimeline.map(step => 
      new Date(step.completedAt).getTime()
    ).sort((a, b) => a - b);
    
    for (let i = 1; i < completionTimes.length; i++) {
      const timeDiff = completionTimes[i] - completionTimes[i-1];
      const avgTime = 300000; // 5 minutes in milliseconds
      
      if (timeDiff > avgTime * 2) {
        const step = analytics.completionTimeline[i];
        analytics.bottlenecks.push({
          step: step.step,
          stepName: step.stepName,
          timeSpent: Math.round(timeDiff / 1000 / 60), // minutes
          severity: timeDiff > avgTime * 3 ? 'high' : 'medium'
        });
      }
    }
    
    // Generate recommendations
    const completedCount = analytics.completedSteps.length;
    const mandatoryCompleted = analytics.completedSteps.filter(step => 
      this.journeySteps[step].mandatory
    ).length;
    
    if (completedCount < 3) {
      analytics.recommendations.push({
        type: 'engagement',
        priority: 'high',
        message: 'Customer is in early stages. Focus on building rapport and understanding needs.',
        suggestedAction: 'Ask open-ended questions about vehicle preferences and budget'
      });
    }
    
    if (mandatoryCompleted < 5 && analytics.currentStep > 5) {
      analytics.recommendations.push({
        type: 'compliance',
        priority: 'medium',
        message: 'Several mandatory steps are incomplete. Ensure proper qualification.',
        suggestedAction: 'Review and complete mandatory steps before proceeding'
      });
    }
    
    return analytics;
  }

  // Get journey analytics
  getJourneyAnalytics(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const status = this.getJourneyStatus(sessionId);
    
    // Calculate step completion times
    const stepTimings = {};
    let totalTime = 0;
    
    for (const [step, progress] of Object.entries(journeyState.stepProgress)) {
      if (progress.completedAt) {
        const startTime = new Date(journeyState.journeyStartTime);
        const endTime = new Date(progress.completedAt);
        const duration = (endTime - startTime) / 1000 / 60; // minutes
        stepTimings[step] = duration;
        totalTime += duration;
      }
    }
    
    // Calculate efficiency metrics
    const avgTimePerStep = journeyState.completedSteps.size > 0 ? 
      totalTime / journeyState.completedSteps.size : 0;
    
    const efficiencyScore = this.calculateEfficiencyScore(journeyState);
    
    return {
      sessionId,
      totalJourneyTime: Math.round(totalTime),
      averageTimePerStep: Math.round(avgTimePerStep * 100) / 100,
      stepTimings,
      efficiencyScore,
        phaseProgress: {
          inquiry: this.getPhaseProgress(1, 3, journeyState),
          vehicleSelection: this.getPhaseProgress(4, 4, journeyState),
          purchaseJourney: this.getPhaseProgress(5, 11, journeyState)
        },
      agentPerformance: this.getAgentPerformance(journeyState),
      bottlenecks: this.identifyBottlenecks(stepTimings),
      recommendations: this.generateRecommendations(journeyState, status)
    };
  }

  // Calculate efficiency score
  calculateEfficiencyScore(journeyState) {
    const totalSteps = 11;
    const completedSteps = journeyState.completedSteps.size;
    const skippedSteps = journeyState.skippedSteps.size;
    
    // Base score from completion
    let score = (completedSteps / totalSteps) * 100;
    
    // Bonus for efficient completion (fewer skipped steps)
    const skipPenalty = (skippedSteps / totalSteps) * 20;
    score -= skipPenalty;
    
    // Bonus for mandatory steps completion
    const mandatoryBonus = (journeyState.mandatoryStepsCompleted / journeyState.totalMandatorySteps) * 10;
    score += mandatoryBonus;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Get phase progress
  getPhaseProgress(startStep, endStep, journeyState) {
    const phaseSteps = [];
    for (let i = startStep; i <= endStep; i++) {
      phaseSteps.push(i);
    }
    
    const completedInPhase = phaseSteps.filter(step => 
      journeyState.completedSteps.has(step)
    ).length;
    
    return {
      totalSteps: phaseSteps.length,
      completedSteps: completedInPhase,
      progressPercentage: Math.round((completedInPhase / phaseSteps.length) * 100)
    };
  }

  // Get agent performance
  getAgentPerformance(journeyState) {
    const agentStats = {};
    
    for (const step of journeyState.completedSteps) {
      const stepInfo = this.journeySteps[step];
      const agent = stepInfo.agent;
      
      if (!agentStats[agent]) {
        agentStats[agent] = {
          stepsHandled: 0,
          stepsCompleted: 0,
          averageCompletionTime: 0
        };
      }
      
      agentStats[agent].stepsHandled++;
      agentStats[agent].stepsCompleted++;
    }
    
    return agentStats;
  }

  // Identify bottlenecks
  identifyBottlenecks(stepTimings) {
    const bottlenecks = [];
    const avgTime = Object.values(stepTimings).reduce((a, b) => a + b, 0) / Object.values(stepTimings).length;
    
    for (const [step, time] of Object.entries(stepTimings)) {
      if (time > avgTime * 1.5) { // 50% above average
        bottlenecks.push({
          step: parseInt(step),
          stepName: this.journeySteps[parseInt(step)].name,
          timeSpent: Math.round(time),
          averageTime: Math.round(avgTime),
          severity: time > avgTime * 2 ? 'high' : 'medium'
        });
      }
    }
    
    return bottlenecks.sort((a, b) => b.timeSpent - a.timeSpent);
  }

  // Generate recommendations
  generateRecommendations(journeyState, status) {
    const recommendations = [];
    
    // Check for stuck steps
    if (status.progressPercentage < 25 && status.completedCount < 4) {
      recommendations.push({
        type: 'engagement',
        priority: 'high',
        message: 'Customer may need more guidance. Consider providing clearer explanations or examples.',
        suggestedAction: 'Provide step-by-step guidance with examples'
      });
    }
    
    // Check for mandatory step completion
    if (status.mandatoryProgress < 50) {
      recommendations.push({
        type: 'compliance',
        priority: 'medium',
        message: 'Focus on completing mandatory steps to ensure proper lead qualification.',
        suggestedAction: 'Prioritize mandatory steps over optional ones'
      });
    }
    
    // Check for phase transition
    if (status.currentPhase === 'inquiry' && status.currentStep > 3) {
      recommendations.push({
        type: 'transition',
        priority: 'medium',
        message: 'Ready to transition to purchase journey phase.',
        suggestedAction: 'Begin purchase process steps'
      });
    }
    
    return recommendations;
  }

  // Clear journey state for a session
  clearJourneyState(sessionId) {
    this.sessionJourneys.delete(sessionId);
    console.log(`🗑️ Journey state cleared for session ${sessionId}`);
  }

  // Get all active journeys
  getAllActiveJourneys() {
    const activeJourneys = [];
    
    for (const [sessionId, journeyState] of this.sessionJourneys) {
      if (journeyState.currentStep < 11) {
        activeJourneys.push({
          sessionId,
          currentStep: journeyState.currentStep,
          currentStepName: this.journeySteps[journeyState.currentStep].name,
          phase: journeyState.phase,
          progress: Math.round((journeyState.completedSteps.size / 11) * 100),
          lastUpdated: journeyState.lastUpdated
        });
      }
    }
    
    return activeJourneys;
  }

  // Export journey data for analysis
  exportJourneyData(sessionId) {
    const journeyState = this.getJourneyState(sessionId);
    const status = this.getJourneyStatus(sessionId);
    const analytics = this.getJourneyAnalytics(sessionId);
    
    return {
      journeyState,
      status,
      analytics,
      exportTimestamp: new Date().toISOString()
    };
  }
}

// Export the class
export { ClientJourneyTracker };
