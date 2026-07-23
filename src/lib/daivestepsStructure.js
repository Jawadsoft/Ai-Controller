/**
 * Complete Daivesteps Structure for Steps 4-11
 * Includes proper default values, conversation flow logic, and step completion tracking
 */

export class DaivestepsStructure {
  constructor() {
    this.structure = this.initializeCompleteStructure();
  }

  /**
   * Initialize the complete Daivesteps structure with all steps 4-11
   */
  initializeCompleteStructure() {
    return {
      1: { // Step 1 - Inquiry
        description: 'Initial customer inquiry and greeting',
        status: 'Pending',
        slots: {
          customer_profile: {
            buyer_profile: null,
            goal: null,
            customer_location: null,
            communication_style: 'standard',
            remarks: null,
            status: 'Pending'
          }
        },
        stageCompleted: {
          greeting_completed: false,
          interest_identified: false,
          status: 'Pending'
        },
        defaultValues: {
          buyer_profile: null,
          goal: null,
          communication_style: 'standard'
        }
      },
      
      2: { // Step 2 - Lead Capture
        description: 'Budget, preferences, and lead qualification',
        status: 'Pending',
        slots: {
          budget: {
            target_price: null,
            max_price: null,
            monthly_payment: null,
            down_payment: null,
            has_budget: false
          },
          vehicle_condition: {
            condition_preference: null,
            reason: null
          },
          preferences: {
            testDriveStep: 'none',
            requirements: {},
            budgetAmount: null,
            budgetRange: null,
            vehicleType: null
          }
        },
        stageCompleted: {
          budget_captured: false,
          preferences_identified: false,
          status: 'Pending'
        },
        defaultValues: {
          target_price: null,
          has_budget: false,
          testDriveStep: 'none'
        }
      },
      
      3: { // Step 3 - Vehicle Selection
        description: 'Vehicle search, selection, and inventory management',
        status: 'Pending',
        slots: {
          VehicleSelection: {
            type: null,
            make: null,
            model: null,
            hasType: false,
            hasMake: false
          },
          customerPreferences: {
            testDriveStep: 'none',
            requirements: {},
            budgetAmount: null,
            budgetRange: null,
            vehicleType: null,
            selectedVehicle: null,
            lastVehicleSelection: null,
            vehicle_selected: false
          },
          sharedVehicles: [],
          rejectedVehicles: [],
          selectedVehicles: [],
          inventoryData: [],
          recentVehicleOptions: []
        },
        stageCompleted: {
          vehicles_shared: false,
          selection_made: false,
          status: 'Pending'
        },
        defaultValues: {
          type: null,
          make: null,
          model: null,
          hasType: false,
          hasMake: false
        }
      },
      
      4: { // Step 4 - Test Drive
        description: 'Scheduling status, completion status, Feedback',
        status: 'Pending', // Pending, In Progress, Completed, Skipped
        test_drive: {
          currentStep: 'none', // none, interest_expressed, day_selected, time_selected, scheduled, completed
          hasConfirmedInterest: false,
          hasProvidedDay: false,
          hasProvidedTime: false,
          isScheduled: false,
          step: 'none',
          timestamp: null,
          isImmediate: false,
          scheduled_day: null,
          scheduled_time: null,
          location: null,
          preferred_contact_method: null,
          confirmation_status: 'pending', // pending, confirmed, rescheduled, cancelled
          notes: null,
          stageCompleted: {
            interest_confirmed: false,
            appointment_day_selected: false,
            appointment_time_selected: false,
            location_confirmed: false,
            confirmation_sent: false,
            status: 'Pending'
          }
        },
        // Default values for incomplete steps
        defaultValues: {
          currentStep: 'none',
          hasConfirmedInterest: false,
          hasProvidedDay: false,
          hasProvidedTime: false,
          isScheduled: false
        }
      },
      
      5: { // Step 5 - Trade Evaluation
        description: 'Trade-in vehicle assessment and valuation',
        status: 'Pending',
        trade_in: {
          hasTradeIn: false,
          vehicleDetails: {
            year: null,
            make: null,
            model: null,
            mileage: null,
            condition: null, // excellent, good, fair, poor
            vin: null,
            color: null,
            features: []
          },
          valuationEstimate: {
            low: null,
            high: null,
            average: null,
            kbb_value: null,
            dealer_offer: null
          },
          customer_expectation: null,
          remarks: null,
          status: 'Pending'
        },
        stageCompleted: {
          vehicle_assessed: false,
          valuation_provided: false,
          customer_agreed: false,
          status: 'Pending'
        },
        defaultValues: {
          hasTradeIn: false,
          vehicleDetails: {
            year: null,
            make: null,
            model: null,
            mileage: null,
            condition: null
          }
        }
      },
      
      6: { // Step 6 - Qualification
        description: 'Financial qualification and credit assessment',
        status: 'Pending',
        finance_qualification: {
          needs_financing: null, // true, false, unsure
          finance_type: null, // loan, lease, cash, unsure
          term_months: null,
          approved: false,
          credit_score_range: null, // excellent, good, fair, poor, unknown
          preferred_payment_type: null, // monthly, bi-weekly, weekly
          interest_rate_estimate: null,
          payment_terms: null,
          down_payment_amount: null,
          monthly_payment_range: {
            min: null,
            max: null,
            preferred: null
          },
          remarks: null,
          status: 'Pending'
        },
        stageCompleted: {
          needs_assessed: false,
          credit_checked: false,
          terms_provided: false,
          customer_approved: false,
          status: 'Pending'
        },
        defaultValues: {
          needs_financing: null,
          finance_type: null,
          approved: false,
          credit_score_range: null
        }
      },
      
      7: { // Step 7 - Purchase Commitment
        description: 'Customer commitment to purchase and deal finalization',
        status: 'Pending',
        purchase_commitment: {
          isCommitted: false,
          commitment_level: null, // interested, serious, ready_to_buy, committed
          expected_commitment_date: null,
          deal_structure: {
            vehicle_price: null,
            trade_value: null,
            down_payment: null,
            monthly_payment: null,
            term_months: null,
            interest_rate: null,
            total_financed: null
          },
          conditions: [], // any conditions for commitment
          remarks: null,
          status: 'Pending'
        },
        stageCompleted: {
          interest_confirmed: false,
          deal_presented: false,
          conditions_met: false,
          commitment_received: false,
          status: 'Pending'
        },
        defaultValues: {
          isCommitted: false,
          commitment_level: null,
          deal_structure: {
            vehicle_price: null,
            trade_value: null,
            down_payment: null
          }
        }
      },
      
      8: { // Step 8 - Vehicle Prep
        description: 'Vehicle preparation for delivery',
        status: 'Pending',
        vehicle_preparation: {
          prep_status: 'not_started', // not_started, in_progress, completed
          cleaning_done: false,
          inspection_done: false,
          service_completed: false,
          accessories_installed: false,
          ready_for_delivery: false,
          prep_tasks: [
            { task: 'Exterior cleaning', completed: false, notes: null },
            { task: 'Interior cleaning', completed: false, notes: null },
            { task: 'Mechanical inspection', completed: false, notes: null },
            { task: 'Accessory installation', completed: false, notes: null },
            { task: 'Final inspection', completed: false, notes: null }
          ],
          estimated_completion: null,
          remarks: null,
          status: 'Pending'
        },
        stageCompleted: {
          cleaning_completed: false,
          inspection_completed: false,
          accessories_installed: false,
          ready_for_delivery: false,
          status: 'Pending'
        },
        defaultValues: {
          prep_status: 'not_started',
          cleaning_done: false,
          inspection_done: false,
          ready_for_delivery: false
        }
      },
      
      9: { // Step 9 - Finance Manager
        description: 'Final financial paperwork and documentation',
        status: 'Pending',
        finance_manager_stage: {
          documents_signed: false,
          final_review_done: false,
          paperwork_completed: false,
          insurance_verified: false,
          registration_processed: false,
          documents: {
            purchase_agreement: { signed: false, date: null },
            financing_contract: { signed: false, date: null },
            insurance_forms: { completed: false, date: null },
            registration_forms: { completed: false, date: null },
            warranty_documents: { provided: false, date: null }
          },
          remarks: null,
          status: 'Pending'
        },
        stageCompleted: {
          documents_reviewed: false,
          contracts_signed: false,
          insurance_verified: false,
          registration_completed: false,
          status: 'Pending'
        },
        defaultValues: {
          documents_signed: false,
          final_review_done: false,
          paperwork_completed: false
        }
      },
      
      10: { // Step 10 - Delivery
        description: 'Vehicle delivery and handover process',
        status: 'Pending',
        delivery: {
          delivery_scheduled: false,
          delivery_date: null,
          delivery_time: null,
          delivery_method: null, // pickup, delivery, home_delivery
          handover_completed: false,
          delivery_tasks: [
            { task: 'Vehicle inspection with customer', completed: false, notes: null },
            { task: 'Key handover', completed: false, notes: null },
            { task: 'Documentation review', completed: false, notes: null },
            { task: 'Feature demonstration', completed: false, notes: null },
            { task: 'Service appointment scheduling', completed: false, notes: null }
          ],
          customer_satisfaction: null,
          remarks: null,
          status: 'Pending'
        },
        stageCompleted: {
          delivery_scheduled: false,
          vehicle_handed_over: false,
          documentation_completed: false,
          customer_trained: false,
          status: 'Pending'
        },
        defaultValues: {
          delivery_scheduled: false,
          delivery_date: null,
          handover_completed: false
        }
      },
      
      11: { // Step 11 - CSI & Follow-ups
        description: 'Customer satisfaction survey and follow-up',
        status: 'Pending',
        csi_follow_up: {
          csi_completed: false,
          follow_up_scheduled: false,
          follow_up_date: null,
          customer_satisfaction_score: null, // 1-10 scale
          survey_responses: {
            overall_satisfaction: null,
            sales_process: null,
            vehicle_quality: null,
            delivery_experience: null,
            would_recommend: null,
            comments: null
          },
          follow_up_actions: [],
          next_contact_date: null,
          notes: null,
          status: 'Pending'
        },
        stageCompleted: {
          csi_survey_sent: false,
          survey_completed: false,
          follow_up_scheduled: false,
          issues_resolved: false,
          status: 'Pending'
        },
        defaultValues: {
          csi_completed: false,
          follow_up_scheduled: false,
          customer_satisfaction_score: null
        }
      }
    };
  }

  /**
   * Update step progress based on conversation context and user message
   */
  updateStepProgress(conversationContext, userMessage, intent) {
    const message = userMessage.toLowerCase();
    const currentStep = conversationContext.Currentstep;
    
    console.log(`🔄 Updating step progress for intent: ${intent}`);
    
    // Step 4 - Test Drive Logic
    if (intent === 'test_drive_request' || message.includes('test drive') || message.includes('schedule')) {
      this.updateTestDriveStep(conversationContext, message);
    }
    
    // Step 5 - Trade Evaluation Logic
    if (intent === 'trade_inquiry' || message.includes('trade') || message.includes('trade-in') || message.includes('my car')) {
      this.updateTradeEvaluationStep(conversationContext, message);
    }
    
    // Step 6 - Qualification Logic
    if (intent === 'financing_inquiry' || message.includes('finance') || message.includes('payment') || message.includes('loan') || message.includes('credit')) {
      this.updateQualificationStep(conversationContext, message);
    }
    
    // Step 7 - Purchase Commitment Logic
    if (intent === 'purchase_commitment' || message.includes('buy') || message.includes('purchase') || message.includes('commit') || message.includes('deal')) {
      this.updatePurchaseCommitmentStep(conversationContext, message);
    }
    
    // Step 8 - Vehicle Prep Logic
    if (intent === 'vehicle_prep' || message.includes('prepare') || message.includes('ready') || message.includes('delivery prep')) {
      this.updateVehiclePrepStep(conversationContext, message);
    }
    
    // Step 9 - Finance Manager Logic
    if (intent === 'finance_manager' || message.includes('paperwork') || message.includes('documents') || message.includes('contract')) {
      this.updateFinanceManagerStep(conversationContext, message);
    }
    
    // Step 10 - Delivery Logic
    if (intent === 'delivery' || message.includes('deliver') || message.includes('pickup') || message.includes('handover')) {
      this.updateDeliveryStep(conversationContext, message);
    }
    
    // Step 11 - CSI & Follow-ups Logic
    if (intent === 'csi_followup' || message.includes('satisfaction') || message.includes('survey') || message.includes('follow up')) {
      this.updateCSIFollowupStep(conversationContext, message);
    }
  }

  /**
   * Update Test Drive Step (Step 4)
   */
  updateTestDriveStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[4];
    if (!step) return;

    // Check for interest confirmation
    if (message.includes('test drive') || message.includes('schedule') || message.includes('appointment')) {
      if (!step.test_drive.hasConfirmedInterest) {
        step.test_drive.hasConfirmedInterest = true;
        step.test_drive.currentStep = 'interest_expressed';
        step.test_drive.stageCompleted.interest_confirmed = true;
        step.status = 'In Progress';
        console.log('🚗 Test drive interest confirmed');
      }
    }

    // Check for day selection
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'tomorrow', 'today'];
    for (const day of days) {
      if (message.includes(day)) {
        step.test_drive.hasProvidedDay = true;
        step.test_drive.scheduled_day = day;
        step.test_drive.currentStep = 'day_selected';
        step.test_drive.stageCompleted.appointment_day_selected = true;
        console.log(`📅 Test drive day selected: ${day}`);
        break;
      }
    }

    // Check for time selection
    const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm|morning|afternoon|evening)/i;
    const timeMatch = message.match(timePattern);
    if (timeMatch) {
      step.test_drive.hasProvidedTime = true;
      step.test_drive.scheduled_time = timeMatch[0];
      step.test_drive.currentStep = 'time_selected';
      step.test_drive.stageCompleted.appointment_time_selected = true;
      console.log(`⏰ Test drive time selected: ${timeMatch[0]}`);
    }

    // Check for scheduling completion
    if (step.test_drive.hasConfirmedInterest && step.test_drive.hasProvidedDay && step.test_drive.hasProvidedTime) {
      step.test_drive.isScheduled = true;
      step.test_drive.currentStep = 'scheduled';
      step.test_drive.stageCompleted.confirmation_sent = true;
      step.status = 'Completed';
      console.log('✅ Test drive fully scheduled');
    }
  }

  /**
   * Update Trade Evaluation Step (Step 5)
   */
  updateTradeEvaluationStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[5];
    if (!step) return;

    if (!step.trade_in.hasTradeIn) {
      step.trade_in.hasTradeIn = true;
      step.status = 'In Progress';
      console.log('🔄 Trade-in interest detected');
    }

    // Extract vehicle details
    const makes = ['toyota', 'honda', 'hyundai', 'ford', 'chevrolet', 'kia', 'nissan', 'mazda', 'subaru'];
    for (const make of makes) {
      if (message.includes(make)) {
        step.trade_in.vehicleDetails.make = make.charAt(0).toUpperCase() + make.slice(1);
        step.trade_in.stageCompleted.vehicle_assessed = true;
        console.log(`🚗 Trade-in make: ${make}`);
        break;
      }
    }

    // Extract year
    const yearMatch = message.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      step.trade_in.vehicleDetails.year = parseInt(yearMatch[0]);
      console.log(`📅 Trade-in year: ${yearMatch[0]}`);
    }

    // Extract mileage
    const mileageMatch = message.match(/\b(\d{1,3}(?:,\d{3})*)\s*(?:miles?|k|k miles?)\b/i);
    if (mileageMatch) {
      step.trade_in.vehicleDetails.mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
      console.log(`🛣️ Trade-in mileage: ${mileageMatch[1]}`);
    }

    // Extract condition
    const conditions = ['excellent', 'good', 'fair', 'poor'];
    for (const condition of conditions) {
      if (message.includes(condition)) {
        step.trade_in.vehicleDetails.condition = condition;
        console.log(`🔍 Trade-in condition: ${condition}`);
        break;
      }
    }
  }

  /**
   * Update Qualification Step (Step 6)
   */
  updateQualificationStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[6];
    if (!step) return;

    if (step.finance_qualification.needs_financing === null) {
      step.finance_qualification.needs_financing = true;
      step.status = 'In Progress';
      console.log('💰 Financing needs detected');
    }

    // Extract financing type
    if (message.includes('lease')) {
      step.finance_qualification.finance_type = 'lease';
    } else if (message.includes('loan') || message.includes('finance')) {
      step.finance_qualification.finance_type = 'loan';
    } else if (message.includes('cash') || message.includes('pay cash')) {
      step.finance_qualification.finance_type = 'cash';
    }

    // Extract term
    const termMatch = message.match(/\b(\d{1,2})\s*(?:month|months|year|years)\b/i);
    if (termMatch) {
      const term = parseInt(termMatch[1]);
      step.finance_qualification.term_months = term > 12 ? term : term * 12;
      console.log(`📅 Financing term: ${termMatch[1]}`);
    }

    // Extract down payment
    const downPaymentMatch = message.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:down|down payment)/i);
    if (downPaymentMatch) {
      step.finance_qualification.down_payment_amount = parseInt(downPaymentMatch[1].replace(/,/g, ''));
      console.log(`💵 Down payment: $${downPaymentMatch[1]}`);
    }
  }

  /**
   * Update Purchase Commitment Step (Step 7)
   */
  updatePurchaseCommitmentStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[7];
    if (!step) return;

    if (message.includes('buy') || message.includes('purchase') || message.includes('commit') || message.includes('deal')) {
      step.purchase_commitment.isCommitted = true;
      step.purchase_commitment.commitment_level = 'committed';
      step.status = 'Completed';
      console.log('✅ Purchase commitment received');
    }
  }

  /**
   * Update Vehicle Prep Step (Step 8)
   */
  updateVehiclePrepStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[8];
    if (!step) return;

    if (message.includes('prepare') || message.includes('ready') || message.includes('delivery prep')) {
      step.vehicle_preparation.prep_status = 'in_progress';
      step.status = 'In Progress';
      console.log('🔧 Vehicle preparation started');
    }
  }

  /**
   * Update Finance Manager Step (Step 9)
   */
  updateFinanceManagerStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[9];
    if (!step) return;

    if (message.includes('paperwork') || message.includes('documents') || message.includes('contract')) {
      step.finance_manager_stage.documents_signed = true;
      step.finance_manager_stage.paperwork_completed = true;
      step.status = 'Completed';
      console.log('📋 Finance paperwork completed');
    }
  }

  /**
   * Update Delivery Step (Step 10)
   */
  updateDeliveryStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[10];
    if (!step) return;

    if (message.includes('deliver') || message.includes('pickup') || message.includes('handover')) {
      step.delivery.delivery_scheduled = true;
      step.delivery.handover_completed = true;
      step.status = 'Completed';
      console.log('🚚 Delivery completed');
    }
  }

  /**
   * Update CSI Follow-up Step (Step 11)
   */
  updateCSIFollowupStep(conversationContext, message) {
    const step = conversationContext.Daivesteps[11];
    if (!step) return;

    if (message.includes('satisfaction') || message.includes('survey') || message.includes('follow up')) {
      step.csi_follow_up.csi_completed = true;
      step.csi_follow_up.follow_up_scheduled = true;
      step.status = 'Completed';
      console.log('📊 CSI follow-up completed');
    }
  }

  /**
   * Get current step status and next actions
   */
  getStepStatus(conversationContext, stepName) {
    const step = conversationContext.Daivesteps[stepName];
    if (!step) return { status: 'Not Started', nextAction: 'Initialize step' };
    
    const status = step.status;
    const stageCompleted = step.stageCompleted || {};
    
    // Determine next action based on current status
    let nextAction = '';
    switch (stepName) {
      case 4: // Step 4 - Test Drive
        if (!stageCompleted.interest_confirmed) nextAction = 'Confirm test drive interest';
        else if (!stageCompleted.appointment_day_selected) nextAction = 'Select appointment day';
        else if (!stageCompleted.appointment_time_selected) nextAction = 'Select appointment time';
        else if (!stageCompleted.location_confirmed) nextAction = 'Confirm location';
        break;
        
      case 5: // Step 5 - Trade Evaluation
        if (!stageCompleted.vehicle_assessed) nextAction = 'Assess trade-in vehicle';
        else if (!stageCompleted.valuation_provided) nextAction = 'Provide valuation estimate';
        else if (!stageCompleted.customer_agreed) nextAction = 'Get customer agreement on trade value';
        break;
        
      case 6: // Step 6 - Qualification
        if (!stageCompleted.needs_assessed) nextAction = 'Assess financing needs';
        else if (!stageCompleted.credit_checked) nextAction = 'Check credit score';
        else if (!stageCompleted.terms_provided) nextAction = 'Provide financing terms';
        break;
        
      case 7: // Step 7 - Purchase Commitment
        if (!stageCompleted.interest_confirmed) nextAction = 'Confirm purchase interest';
        else if (!stageCompleted.deal_presented) nextAction = 'Present final deal';
        else if (!stageCompleted.commitment_received) nextAction = 'Get purchase commitment';
        break;
        
      case 8: // Step 8 - Vehicle Prep
        if (!stageCompleted.cleaning_completed) nextAction = 'Complete vehicle cleaning';
        else if (!stageCompleted.inspection_completed) nextAction = 'Complete vehicle inspection';
        else if (!stageCompleted.accessories_installed) nextAction = 'Install accessories';
        break;
        
      case 9: // Step 9 - Finance Manager
        if (!stageCompleted.documents_reviewed) nextAction = 'Review all documents';
        else if (!stageCompleted.contracts_signed) nextAction = 'Sign contracts';
        else if (!stageCompleted.insurance_verified) nextAction = 'Verify insurance';
        break;
        
      case 10: // Step 10 - Delivery
        if (!stageCompleted.delivery_scheduled) nextAction = 'Schedule delivery';
        else if (!stageCompleted.vehicle_handed_over) nextAction = 'Hand over vehicle';
        else if (!stageCompleted.customer_trained) nextAction = 'Train customer on vehicle features';
        break;
        
      case 11: // Step 11 - CSI & Follow-ups
        if (!stageCompleted.csi_survey_sent) nextAction = 'Send CSI survey';
        else if (!stageCompleted.survey_completed) nextAction = 'Complete customer survey';
        else if (!stageCompleted.follow_up_scheduled) nextAction = 'Schedule follow-up';
        break;
    }
    
    return { status, nextAction, stageCompleted };
  }

  /**
   * Check if step is complete
   */
  isStepComplete(conversationContext, stepName) {
    const step = conversationContext.Daivesteps[stepName];
    if (!step) return false;
    
    const stageCompleted = step.stageCompleted || {};
    const requiredFields = Object.keys(stageCompleted).filter(key => key !== 'status');
    
    return requiredFields.every(field => stageCompleted[field] === true);
  }

  /**
   * Get all incomplete steps
   */
  getIncompleteSteps(conversationContext) {
    const incompleteSteps = [];
    const stepNames = Object.keys(this.structure);
    
    for (const stepName of stepNames) {
      if (!this.isStepComplete(conversationContext, stepName)) {
        const stepStatus = this.getStepStatus(conversationContext, stepName);
        incompleteSteps.push({
          stepName,
          status: stepStatus.status,
          nextAction: stepStatus.nextAction
        });
      }
    }
    
    return incompleteSteps;
  }

  /**
   * Get step name from numeric key
   */
  getStepName(stepNumber) {
    const stepNames = {
      1: 'Step 1 - Inquiry',
      2: 'Step 2 - Lead Capture', 
      3: 'Step 3 - Vehicle Selection',
      4: 'Step 4 - Test Drive',
      5: 'Step 5 - Trade Evaluation',
      6: 'Step 6 - Qualification',
      7: 'Step 7 - Purchase Commitment',
      8: 'Step 8 - Vehicle Prep',
      9: 'Step 9 - Finance Manager',
      10: 'Step 10 - Delivery',
      11: 'Step 11 - CSI & Follow-ups'
    };
    return stepNames[stepNumber] || `Step ${stepNumber}`;
  }

  /**
   * Get step number from name
   */
  getStepNumber(stepName) {
    const stepNumbers = {
      'Step 1 - Inquiry': 1,
      'Step 2 - Lead Capture': 2,
      'Step 3 - Vehicle Selection': 3,
      'Step 4 - Test Drive': 4,
      'Step 5 - Trade Evaluation': 5,
      'Step 6 - Qualification': 6,
      'Step 7 - Purchase Commitment': 7,
      'Step 8 - Vehicle Prep': 8,
      'Step 9 - Finance Manager': 9,
      'Step 10 - Delivery': 10,
      'Step 11 - CSI & Follow-ups': 11
    };
    return stepNumbers[stepName] || null;
  }

  /**
   * Get preferences from daivesteps (replaces conversationContext.preferences)
   */
  getPreferences(conversationContext) {
    const step2 = conversationContext.Daivesteps?.[2]?.slots?.preferences || {};
    const step3 = conversationContext.Daivesteps?.[3]?.slots?.customerPreferences || {};
    return { ...step2, ...step3 };
  }

  /**
   * Update preferences in daivesteps
   */
  updatePreferences(conversationContext, preferences) {
    if (!conversationContext.Daivesteps[2]) {
      conversationContext.Daivesteps[2] = { slots: {} };
    }
    if (!conversationContext.Daivesteps[2].slots.preferences) {
      conversationContext.Daivesteps[2].slots.preferences = {};
    }
    Object.assign(conversationContext.Daivesteps[2].slots.preferences, preferences);
  }

  /**
   * Get step completion status (replaces conversationContext.stepCompleted)
   */
  getStepCompletion(conversationContext) {
    const completion = {};
    Object.keys(conversationContext.Daivesteps).forEach(stepNumber => {
      const step = conversationContext.Daivesteps[stepNumber];
      const stepKey = this.getStepKey(parseInt(stepNumber));
      completion[stepKey] = step.status === 'Completed';
    });
    return completion;
  }

  /**
   * Get vehicle arrays (replaces conversationContext.sharedVehicles, etc.)
   */
  getVehicleArrays(conversationContext) {
    const step3 = conversationContext.Daivesteps?.[3]?.slots || {};
    return {
      sharedVehicles: step3.sharedVehicles || [],
      rejectedVehicles: step3.rejectedVehicles || [],
      selectedVehicles: step3.selectedVehicles || [],
      inventoryData: step3.inventoryData || [],
      recentVehicleOptions: step3.recentVehicleOptions || []
    };
  }

  /**
   * Update vehicle arrays
   */
  updateVehicleArrays(conversationContext, arrayType, vehicles) {
    if (!conversationContext.Daivesteps[3]) {
      conversationContext.Daivesteps[3] = { slots: {} };
    }
    conversationContext.Daivesteps[3].slots[arrayType] = vehicles;
  }

  /**
   * Map step numbers to keys
   */
  getStepKey(stepNumber) {
    const mapping = {
      1: 'inquiry',
      2: 'lead_capture',
      3: 'vehicle_selection',
      4: 'test_drive',
      5: 'trade_evaluation',
      6: 'qualification',
      7: 'purchase_commitment',
      8: 'vehicle_preparation',
      9: 'finance_manager',
      10: 'delivery',
      11: 'csi_followup'
    };
    return mapping[stepNumber] || `step_${stepNumber}`;
  }

  /**
   * Get conversation progress summary
   */
  getConversationProgress(conversationContext) {
    const stepNames = Object.keys(this.structure);
    const totalSteps = stepNames.length;
    const completedSteps = stepNames.filter(stepName => this.isStepComplete(conversationContext, stepName)).length;
    const inProgressSteps = stepNames.filter(stepName => {
      const step = conversationContext.Daivesteps[stepName];
      return step && step.status === 'In Progress';
    }).length;
    
    return {
      totalSteps,
      completedSteps,
      inProgressSteps,
      pendingSteps: totalSteps - completedSteps - inProgressSteps,
      progressPercentage: Math.round((completedSteps / totalSteps) * 100)
    };
  }
}

export default DaivestepsStructure;
