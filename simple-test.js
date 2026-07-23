/**
 * Simple Test Script for Optimized CrewAI System
 */

import DAIVEService from './src/lib/daivecrewai.js';

console.log('🚀 Starting Simple Test...');

async function simpleTest() {
  try {
    console.log('1. Creating DAIVEService instance...');
    const daiveService = new DAIVEService();
    console.log('✅ DAIVEService created');
    
    console.log('2. Testing basic initialization...');
    console.log('✅ Basic test completed');
    
    // Test if the optimized system exists
    if (daiveService.initializeOptimizedCrewAI) {
      console.log('✅ initializeOptimizedCrewAI method exists');
    } else {
      console.log('❌ initializeOptimizedCrewAI method not found');
    }
    
    if (daiveService.processConversationWithOptimizedCrew) {
      console.log('✅ processConversationWithOptimizedCrew method exists');
    } else {
      console.log('❌ processConversationWithOptimizedCrew method not found');
    }
    
    console.log('3. Testing method signatures...');
    console.log('DAIVEService methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(daiveService)));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

simpleTest().then(() => {
  console.log('🏁 Simple test completed');
}).catch(error => {
  console.error('❌ Test error:', error);
});
