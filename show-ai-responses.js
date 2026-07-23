#!/usr/bin/env node

/**
 * Display AI Responses from Customer Journey Test
 * Shows the full AI-generated responses for each step
 */

import { OptimizedCrewAgentAI } from './src/lib/daivecrewai.js';
import settingsManager from './src/lib/settingsManager.js';

console.log('🤖 AI Response Showcase - Optimized CrewAgentAI System');
console.log('=====================================================');

// Customer conversation flow (same as test)
const CUSTOMER_JOURNEY = [
  {
    step: 1,
    message: 'Can you help me find the right car?',
    expectedIntent: 'general_inquiry',
    expectedAgent: 'sales_consultant',
    description: 'Initial greeting and request for help'
  },
  {
    step: 2,
    message: 'I want an SUV.',
    expectedIntent: 'car_type_preference',
    expectedAgent: 'product_specialist',
    description: 'Vehicle type preference'
  },
  {
    step: 3,
    message: 'My budget is $30,000.',
    expectedIntent: 'budget_inquiry',
    expectedAgent: 'finance_manager',
    description: 'Budget specification'
  },
  {
    step: 4,
    message: 'Is the Toyota RAV4 Hybrid in stock?',
    expectedIntent: 'check_availability',
    expectedAgent: 'inventory_specialist',
    description: 'Specific vehicle availability check'
  },
  {
    step: 5,
    message: 'How do I finalize the deal?',
    expectedIntent: 'purchase_commitment',
    expectedAgent: 'sales_consultant',
    description: 'Ready to purchase - deal finalization'
  }
];

async function showAIResponses() {
  try {
    // Initialize settings manager
    console.log('\n🔧 Initializing Settings Manager...');
    await settingsManager.initialize();
    console.log('✅ Settings Manager initialized');
    
    // Get API keys
    console.log('\n🔑 Getting API keys...');
    const apiKeys = await settingsManager.getAPIKeys('global');
    
    if (!apiKeys.openai) {
      console.log('❌ OpenAI API key not found');
      return;
    }
    
    console.log('✅ OpenAI API key available');
    
    // Create system instance
    console.log('\n🤖 Creating OptimizedCrewAgentAI instance...');
    const crewAI = new OptimizedCrewAgentAI(apiKeys.openai, 'test-dealer');
    console.log('✅ Instance created successfully');
    
    // Process each step and show responses
    console.log('\n🚗 Processing Customer Journey for AI Responses...');
    console.log('==================================================');
    
    const sessionId = 'response-showcase-' + Date.now();
    let conversationContext = {};
    
    for (const step of CUSTOMER_JOURNEY) {
      console.log(`\n📝 Step ${step.step}: ${step.description}`);
      console.log(`💬 Customer: "${step.message}"`);
      console.log(`🎯 Expected Intent: ${step.expectedIntent}`);
      console.log(`🤖 Expected Agent: ${step.expectedAgent}`);
      console.log('─'.repeat(80));
      
      try {
        // Process the message through the optimized system
        const result = await crewAI.processWithCrewAgentAI(
          step.message,
          sessionId,
          conversationContext
        );
        
        if (result.success) {
          console.log(`✅ AI Response Generated Successfully!`);
          console.log(`🤖 Agent Used: ${result.agent} (${result.agentType})`);
          console.log(`🎯 Intent Detected: ${result.intent} (${result.confidence}% confidence)`);
          console.log(`📊 Response Quality Score: ${result.validation?.overall_score || 'N/A'}/10`);
          
          // Show the full AI response
          console.log('\n💬 FULL AI RESPONSE:');
          console.log('='.repeat(80));
          console.log(result.response);
          console.log('='.repeat(80));
          
          // Show validation details
          if (result.validation) {
            console.log('\n✅ Response Validation Details:');
            console.log(`   Overall Score: ${result.validation.overall_score}/10`);
            console.log(`   Relevance: ${result.validation.criteria?.relevance || 'N/A'}/10`);
            console.log(`   Accuracy: ${result.validation.criteria?.accuracy || 'N/A'}/10`);
            console.log(`   Helpfulness: ${result.validation.criteria?.helpfulness || 'N/A'}/10`);
            console.log(`   Tone: ${result.validation.criteria?.tone || 'N/A'}/10`);
            console.log(`   Completeness: ${result.validation.criteria?.completeness || 'N/A'}/10`);
            
            if (result.validation.validation_reason) {
              console.log(`   Validation Reason: ${result.validation.validation_reason}`);
            }
          }
          
          // Show performance metrics
          if (result.performance) {
            console.log('\n📊 Performance Breakdown:');
            console.log(`   Intent Detection: ${result.performance.intentDetection?.toFixed(2) || 'N/A'}ms`);
            console.log(`   Agent Routing: ${result.performance.agentRouting?.toFixed(2) || 'N/A'}ms`);
            console.log(`   Response Generation: ${result.performance.responseGeneration?.toFixed(2) || 'N/A'}ms`);
            console.log(`   Validation: ${result.performance.validation?.toFixed(2) || 'N/A'}ms`);
          }
          
          // Update conversation context for next step
          conversationContext = result.context || {};
          
          // Show context progression
          if (result.context) {
            console.log(`\n💾 Context Updated: ${result.context.messages?.length || 0} messages, Stage: ${result.context.conversationStage || 'unknown'}`);
          }
          
        } else {
          console.log(`❌ AI Response Generation Failed: ${result.error || 'Unknown error'}`);
        }
        
      } catch (error) {
        console.log(`❌ Step ${step.step} Error: ${error.message}`);
      }
      
      // Add a small delay between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Show final conversation context
    console.log('\n💾 Final Conversation Context Summary');
    console.log('=====================================');
    const finalContext = crewAI.conversationContexts.get(sessionId);
    if (finalContext) {
      console.log(`✅ Context maintained for session: ${finalContext.messages?.length || 0} messages`);
      console.log(`   Conversation stage: ${finalContext.conversationStage || 'unknown'}`);
      console.log(`   Current intent: ${finalContext.currentIntent || 'unknown'}`);
      console.log(`   Agent history: ${finalContext.agentHistory?.length || 0} interactions`);
      
      if (finalContext.preferences) {
        console.log(`   Customer preferences:`, finalContext.preferences);
      }
    }
    
    console.log('\n🎉 AI Response Showcase Completed!');
    console.log('The system generated intelligent, contextual responses for each step of the customer journey.');
    
  } catch (error) {
    console.error('\n❌ AI Response showcase failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the AI response showcase
showAIResponses();
