#!/usr/bin/env node

/**
 * Debug Script for DAIVE Service
 * This script helps identify why CrewAI is not working properly
 */

import DAIVEService from './src/lib/daivecrewai.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function debugDAIVEService() {
  console.log('🔍 Starting DAIVE Service Debug...\n');
  
  // Check environment variables
  console.log('🔑 Environment Variables Check:');
  console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('  - OPENAI_MODEL:', process.env.OPENAI_MODEL || 'gpt-4o-mini (default)');
  console.log('  - NODE_ENV:', process.env.NODE_ENV || 'Not set');
  console.log('');
  
  // Create DAIVE service instance
  console.log('🚀 Creating DAIVE Service instance...');
  const daiveService = new DAIVEService();
  
  // Check initial status
  console.log('📊 Initial Service Status:');
  console.log(JSON.stringify(daiveService.getServiceStatus(), null, 2));
  console.log('');
  
  // Try to initialize the service
  console.log('🤖 Attempting to initialize DAIVE Service...');
  try {
    await daiveService.initialize();
    console.log('✅ Service initialization completed');
  } catch (error) {
    console.error('❌ Service initialization failed:', error.message);
  }
  
  console.log('');
  
  // Check status after initialization
  console.log('📊 Service Status After Initialization:');
  console.log(JSON.stringify(daiveService.getServiceStatus(), null, 2));
  console.log('');
  
  // Test CrewAI initialization specifically
  console.log('🤖 Testing CrewAI initialization...');
  try {
    await daiveService.initializeCrewAI('test-dealer');
    console.log('✅ CrewAI initialization completed');
  } catch (error) {
    console.error('❌ CrewAI initialization failed:', error.message);
  }
  
  console.log('');
  
  // Final status check
  console.log('📊 Final Service Status:');
  console.log(JSON.stringify(daiveService.getServiceStatus(), null, 2));
  console.log('');
  
  // Test a simple conversation
  console.log('💬 Testing simple conversation...');
  try {
    const result = await daiveService.processConversation(
      'test-session',
      null,
      'Hello, can you help me find a car?',
      { dealerId: 'test-dealer' }
    );
    
    console.log('✅ Conversation test completed');
    console.log('📋 Response:', result.response);
    console.log('🤖 Crew Used:', result.crewUsed);
    console.log('🎯 Intent:', result.intent);
    
  } catch (error) {
    console.error('❌ Conversation test failed:', error.message);
  }
  
  console.log('\n🔍 Debug completed. Check the output above for issues.');
}

// Run the debug function
debugDAIVEService().catch(console.error);
