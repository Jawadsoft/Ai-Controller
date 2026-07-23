# Client Journey Tracking System

## Overview

The Client Journey Tracking System is a comprehensive solution for monitoring and managing the 16-step client journey during conversations in the DAIVE system. It maintains the distinction between mandatory and optional steps while providing real-time tracking, analytics, and recommendations.

## 🎯 16-Step Client Journey Structure

### Phase 1: Lead Qualification & Vehicle Selection (Steps 1-8)

| Step | Name | Description | Mandatory | Agent |
|------|------|-------------|-----------|-------|
| 1 | Greet & Qualify Lead | Initial greeting and lead qualification | ✅ Yes | Sales Consultant |
| 2 | Identify Car Type | Determine vehicle type preference | ✅ Yes | Sales Consultant |
| 3 | Define Budget | Establish budget range and constraints | ✅ Yes | Sales Consultant |
| 4 | Select Features / Needs | Identify key features and requirements | ✅ Yes | Sales Consultant |
| 5 | Check Preferred Brand | Determine brand preferences | ❌ No | Sales Consultant |
| 6 | Vehicle Recommendations | Present vehicle recommendations | ✅ Yes | Sales Consultant |
| 7 | Test Drive & Selection | Schedule test drive or confirm selection | ❌ No | Sales Consultant |
| 8 | Purchase Decision | Confirm purchase intent and commitment | ✅ Yes | Sales Consultant |

### Phase 2: Purchase Journey (Steps 9-16)

| Step | Name | Description | Mandatory | Agent |
|------|------|-------------|-----------|-------|
| 9 | Sale Confirmation | Confirm vehicle selection and review details | ✅ Yes | Sales Consultant |
| 10 | Contract Review | Review and explain sales contract terms | ✅ Yes | Sales Consultant |
| 11 | Trade-In Discussion | Assess and discuss trade-in vehicle | ❌ No | Sales Consultant |
| 12 | Finance Finalization | Finalize financing terms and paperwork | ✅ Yes | Finance Specialist |
| 13 | Vehicle Preparation | Prepare vehicle for delivery | ✅ Yes | Inventory Crew |
| 14 | Delivery & Handover | Complete delivery and handover process | ✅ Yes | Sales Consultant |
| 15 | Customer Support | Ensure customer satisfaction | ✅ Yes | Customer Service |
| 16 | Follow-Up | Schedule follow-up and provide support | ✅ Yes | Customer Service |

## 🚀 Key Features

### 1. **Mandatory vs. Optional Step Management**
- **Mandatory Steps**: Must be completed before proceeding (Steps 1-4, 6, 8-10, 12-16)
- **Optional Steps**: Can be skipped if not applicable (Steps 5, 7, 11)
- Automatic validation of step completion criteria

### 2. **Real-Time Progress Tracking**
- Current step identification
- Progress percentage calculation
- Mandatory step completion tracking
- Phase transition monitoring

### 3. **Intelligent Step Navigation**
- Forward progression based on completion
- Backward navigation to previous steps
- Skip non-mandatory steps
- Automatic phase transitions

### 4. **Comprehensive Analytics**
- Step completion timing
- Efficiency scoring
- Bottleneck identification
- Agent performance tracking
- Phase progress analysis

### 5. **Smart Recommendations**
- Engagement suggestions
- Compliance reminders
- Phase transition guidance
- Performance optimization tips

## 📁 File Structure

```
src/lib/
├── clientJourneyTracker.js      # Main journey tracking class
├── journeyIntegration.js        # Integration helper for DAIVEService
└── daivecrewai.js              # Existing DAIVE service (to be integrated)

test-journey-tracking.js         # Test and demonstration file
CLIENT_JOURNEY_TRACKING_README.md # This documentation
```

## 🔧 Installation & Setup

### 1. **Import the ClientJourneyTracker**

```javascript
import { ClientJourneyTracker } from './src/lib/clientJourneyTracker.js';
```

### 2. **Initialize the Tracker**

```javascript
const journeyTracker = new ClientJourneyTracker();
```

### 3. **Start Tracking a Session**

```javascript
const sessionId = 'unique_session_id';
const journeyState = journeyTracker.getJourneyState(sessionId);
```

## 💻 Usage Examples

### Basic Journey Tracking

```javascript
// Initialize journey for a session
const sessionId = 'customer_123';
journeyTracker.getJourneyState(sessionId);

// Update journey during conversation
const updatedJourney = journeyTracker.updateJourneyState(
  sessionId,
  "I want an SUV with a budget of $30,000",
  "car_type_preference",
  { body_style: "SUV", budgetAmount: 30000 }
);

// Get current status
const status = journeyTracker.getJourneyStatus(sessionId);
console.log(`Current step: ${status.currentStep}/${status.totalSteps}`);
console.log(`Progress: ${status.progressPercentage}%`);
```

### Step Navigation

```javascript
// Check if current step is mandatory
const isMandatory = journeyTracker.journeySteps[status.currentStep].mandatory;

// Skip a non-mandatory step
if (!isMandatory) {
  journeyTracker.skipStep(sessionId, status.currentStep);
}

// Go back to a previous step
journeyTracker.goBackToStep(sessionId, 3);

// Get next steps information
const nextSteps = journeyTracker.getNextSteps(sessionId);
```

### Analytics & Reporting

```javascript
// Get comprehensive analytics
const analytics = journeyTracker.getJourneyAnalytics(sessionId);
console.log(`Efficiency Score: ${analytics.efficiencyScore}/100`);
console.log(`Total Time: ${analytics.totalJourneyTime} minutes`);
console.log(`Bottlenecks: ${analytics.bottlenecks.length}`);

// Export journey data
const exportedData = journeyTracker.exportJourneyData(sessionId);
```

## 🔄 Integration with DAIVEService

### 1. **Add to DAIVEService Constructor**

```javascript
class DAIVEService {
  constructor(maxTokens = 200) {
    // ... existing properties ...
    this.clientJourneyTracker = null;
  }
}
```

### 2. **Initialize Journey Tracker**

```javascript
async initializeClientJourneyTracker() {
  try {
    const { ClientJourneyTracker } = await import('./clientJourneyTracker.js');
    this.clientJourneyTracker = new ClientJourneyTracker();
    console.log('✅ Client Journey Tracker initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Client Journey Tracker:', error);
    return false;
  }
}
```

### 3. **Integrate with Conversation Processing**

```javascript
async processConversationWithOptimizedCrew(sessionId, vehicleId, userMessage, customerInfo = {}) {
  // ... existing conversation processing ...
  
  // Update client journey tracking
  if (this.clientJourneyTracker) {
    try {
      const journeyState = this.clientJourneyTracker.updateJourneyState(
        sessionId, 
        userMessage, 
        result?.intent || 'general_inquiry', 
        conversationContext.preferences
      );
      
      // Get current journey status for response enhancement
      const journeyStatus = this.clientJourneyTracker.getJourneyStatus(sessionId);
      conversationContext.journeyStatus = journeyStatus;
      
      console.log(`📊 Journey Progress: Step ${journeyStatus.currentStep}/${journeyStatus.totalSteps} (${journeyStatus.progressPercentage}%)`);
    } catch (journeyError) {
      console.warn('⚠️ Journey tracking error:', journeyError);
    }
  }
  
  // ... continue with response generation ...
}
```

## 📊 Journey Status Response Format

```javascript
{
  sessionId: "customer_123",
  currentStep: 3,
  currentStepName: "Define Budget",
  currentStepDescription: "Establish budget range and constraints",
  currentStepQuestion: "What's your budget range?",
  currentStepIntent: "budget",
  currentStepAgent: "sales_consultant",
  currentPhase: "lead_qualification",
  completedSteps: [1, 2],
  skippedSteps: [],
  totalSteps: 16,
  completedCount: 2,
  skippedCount: 0,
  progressPercentage: 12,
  mandatoryProgress: 25,
  mandatoryStepsCompleted: 2,
  totalMandatorySteps: 8,
  nextSteps: [
    {
      step: 4,
      name: "Select Features / Needs",
      description: "Identify key features and requirements",
      required: true,
      mandatory: true,
      agent: "sales_consultant",
      phase: "lead_qualification"
    }
  ],
  journeyStartTime: "2025-01-20T10:00:00.000Z",
  lastUpdated: "2025-01-20T10:15:00.000Z",
  estimatedTimeRemaining: {
    remainingSteps: 14,
    estimatedMinutes: 49,
    estimatedTimeString: "49 minutes"
  },
  preferences: {
    vehicle_condition: "new",
    body_style: "SUV"
  }
}
```

## 🧪 Testing

Run the test file to see the journey tracking in action:

```bash
node test-journey-tracking.js
```

This will demonstrate:
- Journey initialization
- Step progression through conversation flow
- Progress tracking and analytics
- Step navigation (forward, backward, skip)
- Comprehensive reporting

## 🔍 Monitoring & Debugging

### Console Logs

The system provides detailed console logging:

- 🚀 Journey initialization
- 🔄 Step updates and progression
- ✅ Step completion
- ⏭️ Step skipping
- ⬅️ Step navigation
- 📊 Progress updates
- 🚨 Bottlenecks and issues
- 💡 Recommendations

### Common Issues & Solutions

1. **Step not progressing**: Check if completion criteria are met
2. **Mandatory step skipped**: Verify step configuration
3. **Phase not transitioning**: Ensure all required steps are completed
4. **Analytics not updating**: Check if journey state is being maintained

## 📈 Performance Considerations

- **Memory Usage**: Journey states are stored in memory (Map)
- **Scalability**: Each session maintains its own journey state
- **Cleanup**: Use `clearJourneyState()` to free memory for completed sessions
- **Persistence**: Consider database storage for long-term analytics

## 🔮 Future Enhancements

- **Database Integration**: Persistent storage of journey data
- **Real-time Dashboard**: Live monitoring of all active journeys
- **AI-powered Recommendations**: ML-based step optimization
- **Multi-language Support**: Internationalization of step content
- **Custom Journey Templates**: Configurable step definitions
- **Integration APIs**: Webhook support for external systems

## 📞 Support

For questions or issues with the Client Journey Tracking System:

1. Check the console logs for detailed error information
2. Verify step configuration and validation rules
3. Test with the provided test file
4. Review the integration examples

---

**Note**: This system maintains the existing 16-step structure while adding intelligent tracking, validation, and analytics capabilities. All mandatory steps must be completed, but optional steps can be skipped based on business logic and customer preferences.
