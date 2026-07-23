#!/usr/bin/env node

/**
 * Clear Cache and Test
 * This script clears the settings cache and tests the service again
 */

import DAIVEService from './src/lib/daivecrewai.js';

async function clearCacheAndTest() {
  console.log('🧹 Clearing Cache and Testing...\n');
  
  try {
    // Create a fresh service instance
    const daiveService = new DAIVEService();
    console.log('✅ Fresh service instance created');
    
    // Clear any cached settings by forcing a fresh initialization
    console.log('🔄 Forcing fresh initialization...');
    await daiveService.initialize();
    console.log('✅ Service initialized');
    
    // Check service status
    const status = daiveService.getServiceStatus();
    console.log('📊 Service Status:', status);
    
    // Test a conversation with a valid dealer ID
    console.log('\n💬 Testing conversation with valid dealer ID...');
    
    // Use the actual dealer ID from your database
    const validDealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    const result = await daiveService.processConversation(
      'test-session-2',
      null,
      'Hello, can you help me find a car?',
      { dealerId: validDealerId }
    );
    
    console.log('✅ Conversation result:', {
      success: !!result.response,
      crewUsed: result.crewUsed,
      intent: result.intent,
      responseLength: result.response?.length || 0,
      responsePreview: result.response?.substring(0, 100) + '...'
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

clearCacheAndTest().catch(console.error);
