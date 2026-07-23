/**
 * Enhanced Conversation Context Service
 * Integrates with Daivesteps structure for complete conversation flow management
 */

import DaivestepsStructure from './daivestepsStructure.js';

export class EnhancedConversationContext {
  constructor() {
    this.daivestepsStructure = new DaivestepsStructure();
  }

  /**
   * Create a complete conversation context with all Daivesteps
   */
  createCompleteContext(sessionId, userId, dealerId) {
    const baseContext = {
      // Session metadata
      session_id: sessionId,
      user_id: userId,
      dealer_id: dealerId,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      
      // Current step tracking
      Currentstep: 'Inquiry',
      
      // Conversation tracking
      conversationSummary: null,
      messages: [],
      agentHistory: [],
      lastPromptedIntent: null,
      
      // ALL DATA in daivesteps structure (Steps 1-11)
      Daivesteps: this.daivestepsStructure.initializeCompleteStructure()
    };

    console.log('✅ Complete conversation context created with all Daivesteps');
    return baseContext;
  }

  /**
   * Update conversation context with user message and intent
   */
  updateContext(conversationContext, userMessage, intent, response) {
    // Update basic context
    conversationContext.last_updated = new Date().toISOString();
    conversationContext.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    conversationContext.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    // Update step progress using Daivesteps structure
    this.daivestepsStructure.updateStepProgress(conversationContext, userMessage, intent);

    // Update current step based on progress
    this.updateCurrentStep(conversationContext);

    // Update step completion status
    this.updateStepCompletionStatus(conversationContext);

    console.log(`🔄 Context updated for intent: ${intent}`);
    return conversationContext;
  }

  /**
   * Update current step based on conversation progress
   */
  updateCurrentStep(conversationContext) {
    const steps = [
      'Step 1 - Inquiry',
      'Step 2 - Lead Capture', 
      'Step 3 - Vehicle',
      'Step 4 - Test Drive',
      'Step 5 - Trade Evaluation',
      'Step 6 - Qualification',
      'Step 7 - Purchase Commitment',
      'Step 8 - Vehicle Prep',
      'Step 9 - Finance Manager',
      'Step 10 - Delivery',
      'Step 11 - CSI & Follow-ups'
    ];

    // Find the highest completed step
    let currentStep = 'Inquiry';
    for (const step of steps) {
      const stepData = conversationContext.Daivesteps[step];
      if (stepData && stepData.status === 'Completed') {
        currentStep = step.replace('Step ', '').replace(' - ', ' ');
      } else if (stepData && stepData.status === 'In Progress') {
        currentStep = step.replace('Step ', '').replace(' - ', ' ');
        break;
      }
    }

    conversationContext.Currentstep = currentStep;
    console.log(`📋 Current step updated to: ${currentStep}`);
  }

  /**
   * Update step completion status
   */
  updateStepCompletionStatus(conversationContext) {
    // Use the helper method from daivestepsStructure
    const stepCompletion = this.daivestepsStructure.getStepCompletion(conversationContext);
    
    // Update conversationContext.stepCompleted for backward compatibility
    if (!conversationContext.stepCompleted) {
      conversationContext.stepCompleted = {};
    }
    Object.assign(conversationContext.stepCompleted, stepCompletion);
  }

  /**
   * Get conversation progress summary
   */
  getProgressSummary(conversationContext) {
    const progress = this.daivestepsStructure.getConversationProgress(conversationContext);
    const incompleteSteps = this.daivestepsStructure.getIncompleteSteps(conversationContext);
    
    return {
      ...progress,
      incompleteSteps,
      currentStep: conversationContext.Currentstep,
      lastUpdated: conversationContext.last_updated
    };
  }

  // ========================================
  // HELPER METHODS FOR CLEAN DATA ACCESS
  // ========================================

  /**
   * Get preferences (replaces conversationContext.preferences)
   */
  getPreferences(conversationContext) {
    return this.daivestepsStructure.getPreferences(conversationContext);
  }

  /**
   * Update preferences (replaces conversationContext.preferences updates)
   */
  updatePreferences(conversationContext, preferences) {
    this.daivestepsStructure.updatePreferences(conversationContext, preferences);
  }

  /**
   * Get step completion status (replaces conversationContext.stepCompleted)
   */
  getStepCompletion(conversationContext) {
    return this.daivestepsStructure.getStepCompletion(conversationContext);
  }

  /**
   * Get vehicle arrays (replaces conversationContext.sharedVehicles, etc.)
   */
  getVehicleArrays(conversationContext) {
    return this.daivestepsStructure.getVehicleArrays(conversationContext);
  }

  /**
   * Update vehicle arrays (replaces conversationContext.sharedVehicles updates)
   */
  updateVehicleArrays(conversationContext, arrayType, vehicles) {
    this.daivestepsStructure.updateVehicleArrays(conversationContext, arrayType, vehicles);
  }

  /**
   * Get budget info (from Step 2)
   */
  getBudgetInfo(conversationContext) {
    const step2 = conversationContext.Daivesteps?.[2]?.slots?.budget || {};
    return {
      target_price: step2.target_price,
      max_price: step2.max_price,
      monthly_payment: step2.monthly_payment,
      down_payment: step2.down_payment,
      has_budget: step2.has_budget || false
    };
  }

  /**
   * Update budget info (in Step 2)
   */
  updateBudgetInfo(conversationContext, budgetInfo) {
    if (!conversationContext.Daivesteps[2]) {
      conversationContext.Daivesteps[2] = { slots: {} };
    }
    if (!conversationContext.Daivesteps[2].slots.budget) {
      conversationContext.Daivesteps[2].slots.budget = {};
    }
    Object.assign(conversationContext.Daivesteps[2].slots.budget, budgetInfo);
  }

  /**
   * Get vehicle selection info (from Step 3)
   */
  getVehicleSelection(conversationContext) {
    const step3 = conversationContext.Daivesteps?.[3]?.slots?.VehicleSelection || {};
    return {
      type: step3.type,
      make: step3.make,
      model: step3.model,
      hasType: step3.hasType || false,
      hasMake: step3.hasMake || false,
      selectedVehicle: step3.selectedVehicle,
      lastSelection: step3.lastSelection
    };
  }

  /**
   * Update vehicle selection (in Step 3)
   */
  updateVehicleSelection(conversationContext, vehicleData) {
    if (!conversationContext.Daivesteps[3]) {
      conversationContext.Daivesteps[3] = { slots: {} };
    }
    if (!conversationContext.Daivesteps[3].slots.VehicleSelection) {
      conversationContext.Daivesteps[3].slots.VehicleSelection = {};
    }
    Object.assign(conversationContext.Daivesteps[3].slots.VehicleSelection, vehicleData);
  }

  /**
   * Get customer profile (from Step 1)
   */
  getCustomerProfile(conversationContext) {
    const step1 = conversationContext.Daivesteps?.[1]?.slots?.customer_profile || {};
    return {
      buyer_profile: step1.buyer_profile,
      goal: step1.goal,
      customer_location: step1.customer_location,
      communication_style: step1.communication_style || 'standard',
      remarks: step1.remarks,
      status: step1.status
    };
  }

  /**
   * Update customer profile (in Step 1)
   */
  updateCustomerProfile(conversationContext, profileData) {
    if (!conversationContext.Daivesteps[1]) {
      conversationContext.Daivesteps[1] = { slots: {} };
    }
    if (!conversationContext.Daivesteps[1].slots.customer_profile) {
      conversationContext.Daivesteps[1].slots.customer_profile = {};
    }
    Object.assign(conversationContext.Daivesteps[1].slots.customer_profile, profileData);
  }

  /**
   * Get test drive info (from Step 4)
   */
  getTestDriveInfo(conversationContext) {
    const step4 = conversationContext.Daivesteps?.[4]?.test_drive || {};
    return {
      currentStep: step4.currentStep || 'none',
      hasConfirmedInterest: step4.hasConfirmedInterest || false,
      hasProvidedDay: step4.hasProvidedDay || false,
      hasProvidedTime: step4.hasProvidedTime || false,
      isScheduled: step4.isScheduled || false,
      scheduled_day: step4.scheduled_day,
      scheduled_time: step4.scheduled_time,
      location: step4.location,
      confirmation_status: step4.confirmation_status || 'pending'
    };
  }

  /**
   * Update test drive info (in Step 4)
   */
  updateTestDriveInfo(conversationContext, testDriveData) {
    if (!conversationContext.Daivesteps[4]) {
      conversationContext.Daivesteps[4] = { test_drive: {} };
    }
    if (!conversationContext.Daivesteps[4].test_drive) {
      conversationContext.Daivesteps[4].test_drive = {};
    }
    Object.assign(conversationContext.Daivesteps[4].test_drive, testDriveData);
  }

  /**
   * Get all conversation data in a clean format
   */
  getConversationData(conversationContext) {
    return {
      // Session info
      session_id: conversationContext.session_id,
      user_id: conversationContext.user_id,
      dealer_id: conversationContext.dealer_id,
      current_step: conversationContext.Currentstep,
      last_updated: conversationContext.last_updated,
      
      // All data from daivesteps
      customer_profile: this.getCustomerProfile(conversationContext),
      budget_info: this.getBudgetInfo(conversationContext),
      vehicle_selection: this.getVehicleSelection(conversationContext),
      vehicle_arrays: this.getVehicleArrays(conversationContext),
      test_drive_info: this.getTestDriveInfo(conversationContext),
      preferences: this.getPreferences(conversationContext),
      step_completion: this.getStepCompletion(conversationContext),
      
      // Conversation tracking
      messages: conversationContext.messages || [],
      agent_history: conversationContext.agentHistory || [],
      conversation_summary: conversationContext.conversationSummary
    };
  }

  /**
   * Get next recommended actions
   */
  getNextActions(conversationContext) {
    const incompleteSteps = this.daivestepsStructure.getIncompleteSteps(conversationContext);
    const nextActions = [];

    for (const step of incompleteSteps) {
      if (step.status === 'In Progress') {
        nextActions.push({
          priority: 'high',
          step: step.stepName,
          action: step.nextAction,
          status: step.status
        });
      } else if (step.status === 'Pending') {
        nextActions.push({
          priority: 'medium',
          step: step.stepName,
          action: step.nextAction,
          status: step.status
        });
      }
    }

    return nextActions.sort((a, b) => {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Check if conversation is ready for next step
   */
  isReadyForNextStep(conversationContext, targetStep) {
    const step = conversationContext.Daivesteps[targetStep];
    if (!step) return false;

    // Check if current step is completed
    const currentStepName = `Step ${conversationContext.Currentstep.split(' ')[0]} - ${conversationContext.Currentstep.split(' ').slice(1).join(' ')}`;
    const currentStepComplete = this.daivestepsStructure.isStepComplete(conversationContext, currentStepName);
    
    return currentStepComplete || step.status === 'In Progress';
  }

  /**
   * Get step-specific data for agent responses
   */
  getStepData(conversationContext, stepName) {
    const step = conversationContext.Daivesteps[stepName];
    if (!step) return null;

    const stepStatus = this.daivestepsStructure.getStepStatus(conversationContext, stepName);
    
    return {
      stepName,
      status: stepStatus.status,
      nextAction: stepStatus.nextAction,
      data: step,
      isComplete: this.daivestepsStructure.isStepComplete(conversationContext, stepName),
      stageCompleted: stepStatus.stageCompleted
    };
  }

  /**
   * Generate conversation summary
   */
  generateConversationSummary(conversationContext) {
    const progress = this.getProgressSummary(conversationContext);
    const nextActions = this.getNextActions(conversationContext);
    
    let summary = `Conversation Progress: ${progress.progressPercentage}% complete\n`;
    summary += `Current Step: ${progress.currentStep}\n`;
    summary += `Completed Steps: ${progress.completedSteps}/${progress.totalSteps}\n`;
    
    if (nextActions.length > 0) {
      summary += `\nNext Actions:\n`;
      nextActions.slice(0, 3).forEach((action, index) => {
        summary += `${index + 1}. ${action.action} (${action.step})\n`;
      });
    }
    
    return summary;
  }

  /**
   * Reset conversation context
   */
  resetContext(conversationContext) {
    // Reset all steps to pending
    Object.keys(conversationContext.Daivesteps).forEach(stepName => {
      const step = conversationContext.Daivesteps[stepName];
      step.status = 'Pending';
      if (step.stageCompleted) {
        Object.keys(step.stageCompleted).forEach(key => {
          if (key !== 'status') {
            step.stageCompleted[key] = false;
          }
        });
      }
    });

    // Reset step completion status
    Object.keys(conversationContext.stepCompleted).forEach(key => {
      conversationContext.stepCompleted[key] = false;
    });

    conversationContext.Currentstep = 'Inquiry';
    conversationContext.last_updated = new Date().toISOString();
    
    console.log('🔄 Conversation context reset');
    return conversationContext;
  }
}

export default EnhancedConversationContext;
