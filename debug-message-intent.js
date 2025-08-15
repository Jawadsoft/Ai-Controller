// Debug message intent detection
import DAIVEService from './src/lib/daivecrewai.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugMessageIntent() {
  try {
    console.log('🔍 Debugging Message Intent Detection...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Initialize DAIVE Service
    console.log('🚀 Initializing DAIVE Service...');
    const daiveService = new DAIVEService(150);
    await daiveService.initialize(dealerId);
    
    // Test messages that should NOT be inventory queries
    const testMessages = [
      "Hello! I want to know about financing options.",
      "Can you tell me about test drives?",
      "What makes this dealership special?",
      "I'm interested in family vehicles",
      "Tell me about your service department",
      "What are your business hours?",
      "Do you offer warranties?",
      "I want to know about your financing options",
      "Can you help me with insurance?",
      "What's your return policy?",
      "I need help choosing a vehicle",
      "What's the best time to visit?",
      "Do you have any special offers?",
      "I want to know about your team",
      "What makes you different from other dealers?"
    ];
    
    console.log('🧪 Testing message intent detection...\n');
    
    testMessages.forEach((message, index) => {
      console.log(`📝 Test ${index + 1}: "${message}"`);
      
      const intent = daiveService.detectIntent(message);
      const isInventory = daiveService.isInventoryQuery(message);
      
      console.log(`   - Intent: ${intent}`);
      console.log(`   - Is Inventory Query: ${isInventory ? '❌ YES (WRONG!)' : '✅ NO (CORRECT)'}`);
      
      if (isInventory) {
        console.log(`   - ⚠️  This message will bypass CrewAI and use inventory responses!`);
      } else {
        console.log(`   - ✅ This message will use CrewAI with your database prompts`);
      }
      
      console.log('');
    });
    
    // Test the actual conversation flow for a few messages
    console.log('🚀 Testing actual conversation flow...\n');
    
    const testConversationMessages = [
      "Hello! I want to know about financing options.",
      "Can you tell me about test drives?",
      "What makes this dealership special?"
    ];
    
    for (let i = 0; i < testConversationMessages.length; i++) {
      const message = testConversationMessages[i];
      console.log(`\n🧪 Testing conversation ${i + 1}: "${message}"`);
      
      const sessionId = 'debug-session-' + Date.now();
      const customerInfo = {
        dealerId: dealerId,
        name: 'Test Customer',
        email: 'test@example.com'
      };
      
      try {
        const result = await daiveService.processConversation(
          sessionId, 
          null, 
          message, 
          customerInfo
        );
        
        console.log(`   - Success: ${result.success}`);
        console.log(`   - Crew Used: ${result.crewUsed}`);
        console.log(`   - Crew Type: ${result.crewType}`);
        console.log(`   - Response: ${result.response?.substring(0, 100)}...`);
        
        if (result.crewType === 'Inventory-Aware AI') {
          console.log(`   - ⚠️  Bypassed CrewAI - using inventory responses!`);
        } else if (result.crewType === 'CrewAI') {
          console.log(`   - ✅ Using CrewAI with your database prompts!`);
        }
        
      } catch (error) {
        console.error(`   - ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n✅ Message intent debugging completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugMessageIntent();
