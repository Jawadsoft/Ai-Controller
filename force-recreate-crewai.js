#!/usr/bin/env node

/**
 * Force Recreate CrewAI
 * This script forces the recreation of the CrewAI instance with the new API key
 */

import DAIVEService from './src/lib/daivecrewai.js';

async function forceRecreateCrewAI() {
  console.log('🔄 Force Recreating CrewAI...\n');
  
  try {
    const daiveService = new DAIVEService();
    console.log('✅ Service instance created');
    
    // Initialize the service
    console.log('🤖 Initializing service...');
    await daiveService.initialize();
    console.log('✅ Service initialized');
    
    // Check current status
    const status = daiveService.getServiceStatus();
    console.log('📊 Current Status:', status);
    
    // Force recreate CrewAI with new API key
    console.log('\n🔄 Force recreating CrewAI...');
    
    // Clear the current CrewAI instance
    daiveService.crewAI = null;
    console.log('✅ Cleared current CrewAI instance');
    
    // Reinitialize CrewAI
    await daiveService.initializeCrewAI('global');
    console.log('✅ CrewAI reinitialized');
    
    // Check status after recreation
    const newStatus = daiveService.getServiceStatus();
    console.log('📊 Status after recreation:', newStatus);
    
    // Test the new CrewAI instance
    if (daiveService.crewAI) {
      console.log('\n🧪 Testing new CrewAI instance...');
      
      try {
        // Make a simple test call
        const response = await daiveService.crewAI.invoke([
          { role: 'user', content: 'Hello, this is a test message.' }
        ]);
        
        console.log('✅ CrewAI test successful!');
        console.log('📝 Response preview:', response.content.substring(0, 100) + '...');
        
        // Now test a full conversation
        console.log('\n💬 Testing full conversation...');
        const result = await daiveService.processConversation(
          'test-session-3',
          null,
          'Hello, can you help me find a car?',
          { dealerId: '0aa94346-ed1d-420e-8823-bcd97bf6456f' }
        );
        
        console.log('✅ Conversation result:', {
          success: !!result.response,
          crewUsed: result.crewUsed,
          intent: result.intent,
          responseLength: result.response?.length || 0,
          responsePreview: result.response?.substring(0, 100) + '...'
        });
        
      } catch (crewError) {
        console.error('❌ CrewAI test failed:', crewError.message);
        if (crewError.message.includes('401')) {
          console.error('🔑 Still getting 401 error - API key issue persists');
        }
      }
    } else {
      console.log('❌ CrewAI not available after recreation');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

forceRecreateCrewAI().catch(console.error);
