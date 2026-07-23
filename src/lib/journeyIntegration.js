// Journey Integration for DAIVE
// Shows how to integrate ClientJourneyTracker with existing DAIVEService

import { ClientJourneyTracker } from './clientJourneyTracker.js';

// Integration helper functions
export class JourneyIntegration {
  constructor(daiveService) {
    this.daiveService = daiveService;
    this.journeyTracker = new ClientJourneyTracker();
  }

  // Initialize journey tracking for a session
  initializeJourney(sessionId) {
    const journeyState = this.journeyTracker.getJourneyState(sessionId);
    console.log(`🚀 Journey initialized for session ${sessionId} at step ${journeyState.currentStep}`);
    return journeyState;
  }

  // Update journey state during conversation
  updateJourney(sessionId, userMessage, detectedIntent, preferences = {}) {
    try {
      const journeyState = this.journeyTracker.updateJourneyState(
        sessionId, 
        userMessage, 
        detectedIntent, 
        preferences
      );
      
      console.log(`🔄 Journey updated for session ${sessionId} at step ${journeyState.currentStep}`);
      return journeyState;
    } catch (error) {
      console.error('❌ Journey update error:', error);
      return null;
    }
  }

  // Get current journey status
  getJourneyStatus(sessionId) {
    return this.journeyTracker.getJourneyStatus(sessionId);
  }

  // Get journey analytics
  getJourneyAnalytics(sessionId) {
    return this.journeyTracker.getJourneyAnalytics(sessionId);
  }

  // Check if step is mandatory
  isStepMandatory(stepNumber) {
    const stepInfo = this.journeyTracker.journeySteps[stepNumber];
    return stepInfo ? stepInfo.mandatory : false;
  }

  // Get next steps information
  getNextSteps(sessionId) {
    return this.journeyTracker.getNextSteps(sessionId);
  }

  // Skip a step (if not mandatory)
  skipStep(sessionId, stepNumber) {
    return this.journeyTracker.skipStep(sessionId, stepNumber);
  }

  // Go back to a previous step
  goBackToStep(sessionId, stepNumber) {
    return this.journeyTracker.goBackToStep(sessionId, stepNumber);
  }

  // Get all active journeys
  getAllActiveJourneys() {
    return this.journeyTracker.getAllActiveJourneys();
  }

  // Clear journey state
  clearJourney(sessionId) {
    this.journeyTracker.clearJourneyState(sessionId);
  }

  // Export journey data
  exportJourneyData(sessionId) {
    return this.journeyTracker.exportJourneyData(sessionId);
  }
}

// Usage example:
/*
// In your DAIVEService or main application:
import { JourneyIntegration } from './journeyIntegration.js';

// Initialize
const journeyIntegration = new JourneyIntegration(daiveService);

// Start tracking for a session
journeyIntegration.initializeJourney(sessionId);

// Update during conversation
journeyIntegration.updateJourney(sessionId, userMessage, detectedIntent, preferences);

// Get current status
const status = journeyIntegration.getJourneyStatus(sessionId);
console.log(`Current step: ${status.currentStep}/${status.totalSteps} (${status.progressPercentage}%)`);

// Check if current step is mandatory
const isMandatory = journeyIntegration.isStepMandatory(status.currentStep);
if (isMandatory) {
  console.log('This step must be completed before proceeding');
}

// Get next steps
const nextSteps = journeyIntegration.getNextSteps(sessionId);
console.log('Next steps:', nextSteps.map(step => `${step.step}: ${step.name}`));
*/
