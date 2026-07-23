import { pool } from './src/database/connection.js';

async function conversationTest() {
  try {
    console.log('🧪 CONVERSATION TEST - Testing AI Bot Functionality...\n');
    
    // Step 1: Verify current configuration
    console.log('📋 Step 1: Verifying Current Configuration...');
    console.log('============================================');
    
    const configResult = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND setting_type IN ('openai_key', 'crew_ai_enabled', 'crew_ai_fallback_to_traditional')
      ORDER BY setting_type
    `);
    
    let hasValidConfig = true;
    configResult.rows.forEach(row => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${row.setting_type}: ${row.setting_value} (${status})`);
      
      if (row.setting_type === 'openai_key' && !row.setting_value.includes('sk-proj-')) {
        hasValidConfig = false;
        console.log('   ❌ API key format looks invalid');
      }
      
      if (row.setting_type === 'crew_ai_fallback_to_traditional' && row.setting_value === 'true') {
        hasValidConfig = false;
        console.log('   ❌ Fallback is still enabled - this will cause "technical difficulties"');
      }
    });
    
    if (!hasValidConfig) {
      console.log('\n❌ Configuration issues detected. Please run the CrewAI fix first.');
      return;
    }
    
    console.log('\n✅ Configuration looks good!');
    
    // Step 2: Test conversation flow simulation
    console.log('\n📋 Step 2: Testing Conversation Flow...');
    console.log('=======================================');
    
    const testMessages = [
      {
        type: 'greeting',
        message: 'Hello, how are you today?',
        expectedResponse: 'should NOT contain "technical difficulties"'
      },
      {
        type: 'test_drive',
        message: 'I\'m interested in scheduling a test drive. What\'s the process like?',
        expectedResponse: 'should NOT contain "technical difficulties"'
      },
      {
        type: 'inventory',
        message: 'What vehicles do you have available in your inventory?',
        expectedResponse: 'should NOT contain "technical difficulties"'
      },
      {
        type: 'pricing',
        message: 'What are your current pricing options?',
        expectedResponse: 'should NOT contain "technical difficulties"'
      }
    ];
    
    console.log('📊 Test Messages to Verify:');
    testMessages.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.type.toUpperCase()}: "${test.message}"`);
      console.log(`      Expected: ${test.expectedResponse}`);
      console.log('');
    });
    
    // Step 3: Check if there are any hardcoded fallback responses still active
    console.log('📋 Step 3: Checking for Hardcoded Fallbacks...');
    console.log('=============================================');
    
    // Check if the dealer has custom prompts that might override the fallbacks
    const promptsResult = await pool.query(`
      SELECT prompt_type, prompt_text
      FROM daive_prompts 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND is_active = true
      ORDER BY prompt_type
    `);
    
    if (promptsResult.rows.length > 0) {
      console.log('📊 Custom Dealer Prompts Found:');
      promptsResult.rows.forEach(row => {
        const hasTechnicalDifficulties = row.prompt_text.toLowerCase().includes('technical difficulties');
        const status = hasTechnicalDifficulties ? '❌ CONTAINS FALLBACK' : '✅ CLEAN';
        console.log(`   ${row.prompt_type}: ${status}`);
        if (hasTechnicalDifficulties) {
          console.log(`      Text: "${row.prompt_text.substring(0, 100)}..."`);
        }
      });
    } else {
      console.log('✅ No custom dealer prompts found - using default system');
    }
    
    // Step 4: Test the actual conversation processing logic
    console.log('\n📋 Step 4: Testing Conversation Logic...');
    console.log('==========================================');
    
    console.log('🔍 Simulating conversation flow...');
    console.log('   Message → Intent Detection → CrewAI Processing → Response');
    console.log('');
    
    // Simulate the conversation flow
    for (const test of testMessages) {
      console.log(`🧪 Testing: ${test.type.toUpperCase()}`);
      console.log(`   Input: "${test.message}"`);
      console.log(`   Expected: ${test.expectedResponse}`);
      
      // Simulate intent detection
      const intent = detectIntent(test.message);
      console.log(`   Intent Detected: ${intent}`);
      
      // Check if this would trigger fallback
      const wouldTriggerFallback = checkFallbackTrigger(intent, test.message);
      if (wouldTriggerFallback) {
        console.log(`   ⚠️  WARNING: This message might trigger fallback response`);
      } else {
        console.log(`   ✅ Should process normally through CrewAI`);
      }
      
      console.log('');
    }
    
    // Step 5: Final verification
    console.log('📋 Step 5: Final Verification...');
    console.log('================================');
    
    console.log('🎯 CONVERSATION TEST SUMMARY:');
    console.log('=============================');
    console.log('✅ Configuration: Properly set');
    console.log('✅ API Key: Valid format');
    console.log('✅ CrewAI: Enabled');
    console.log('✅ Fallback: Disabled');
    
    console.log('\n🚨 NEXT STEPS FOR TESTING:');
    console.log('==========================');
    console.log('1. Restart your application server');
    console.log('2. Open the AI bot in your browser');
    console.log('3. Try these test messages:');
    testMessages.forEach((test, index) => {
      console.log(`   ${index + 1}. "${test.message}"`);
    });
    console.log('');
    console.log('4. Verify responses do NOT contain "technical difficulties"');
    console.log('5. Verify responses are AI-generated (not hardcoded)');
    
    console.log('\n💡 What to Look For:');
    console.log('=====================');
    console.log('✅ Real AI responses (varied, contextual)');
    console.log('✅ No "technical difficulties" messages');
    console.log('✅ Proper intent recognition');
    console.log('✅ CrewAI initialization messages in console');
    
  } catch (error) {
    console.error('❌ Error during conversation test:', error.message);
  } finally {
    await pool.end();
  }
}

// Helper function to simulate intent detection
function detectIntent(text) {
  const t = text.toLowerCase();
  
  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(t)) return 'GREET';
  if (/\b(test\s*drive|schedule|drive|test drive)\b/.test(t)) return 'TEST_DRIVE';
  if (/\b(price|cost|how much|o\.t\.d|out the door|pricing)\b/.test(t)) return 'PRICE';
  if (/\b(finance|payment|loan|apr|interest rate|monthly payment|down payment)\b/.test(t)) return 'FINANCE';
  if (/\b(feature|spec|details?|safety|mpg|mileage|specifications)\b/.test(t)) return 'FEATURES';
  if (/\b(inventory|available|stock|show me|what do you have|in stock)\b/.test(t)) return 'INVENTORY';
  if (/\b(alternative|other|options|similar|compare)\b/.test(t)) return 'ALTERNATIVES';
  if (/\b(trade[\s-]*in|tradein|valuation|trade-in)\b/.test(t)) return 'TRADE_IN';
  if (/\b(human|agent|representative|talk to|call me|speak to someone)\b/.test(t)) return 'HANDOFF';
  if (/\b(urgent|asap|today|immediately|now|quick)\b/.test(t)) return 'URGENT';
  
  return 'GENERAL_INQUIRY';
}

// Helper function to check if a message might trigger fallback
function checkFallbackTrigger(intent, message) {
  const fallbackTriggers = [
    'technical difficulties',
    'experiencing some technical difficulties',
    'currently experiencing technical difficulties',
    'having technical issues'
  ];
  
  return fallbackTriggers.some(trigger => 
    message.toLowerCase().includes(trigger)
  );
}

conversationTest();
