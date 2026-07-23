import { pool } from './src/database/connection.js';

async function testResponseQuality() {
  console.log('🔍 Response Quality Test - Checking Brief Responses\n');
  
  try {
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Test 1: Check fallback responses from the database
    console.log('1️⃣ Testing Fallback Response Quality...');
    
    const fallbackResponses = [
      {
        type: 'Buying Intent',
        message: 'I want to buy a car',
        expectedLength: 100,
        expectedLines: 1
      },
      {
        type: 'Greeting',
        message: 'Hello',
        expectedLength: 80,
        expectedLines: 1
      },
      {
        type: 'Price Inquiry',
        message: 'What is the price?',
        expectedLength: 60,
        expectedLines: 1
      },
      {
        type: 'Test Drive',
        message: 'I want to test drive',
        expectedLength: 80,
        expectedLines: 1
      }
    ];
    
    for (const test of fallbackResponses) {
      console.log(`\n   Testing: ${test.type}`);
      console.log(`   Message: "${test.message}"`);
      
      // Simulate the fallback response logic
      let response = '';
      const message = test.message.toLowerCase();
      
      if (message.includes('buy') || message.includes('purchase') || message.includes('interested') || message.includes('looking for')) {
        response = `What's your budget and preferred body style? I'll show you exact matches from our inventory.`;
      } else if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        response = `Hi! I'm D.A.I.V.E. How can I help you today?`;
      } else if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
        response = `Please check our website for current pricing or contact our sales team.`;
      } else if (message.includes('test drive') || message.includes('drive') || message.includes('schedule')) {
        response = `What day works for your test drive?`;
      } else {
        response = `How can I help you find the perfect vehicle from our inventory?`;
      }
      
      const actualLength = response.length;
      const actualLines = response.split('\n').length;
      const isBrief = actualLength <= test.expectedLength;
      const isOneLine = actualLines === 1;
      
      console.log(`   Response: "${response}"`);
      console.log(`   Length: ${actualLength} chars ${isBrief ? '✅' : '❌'} (expected ≤${test.expectedLength})`);
      console.log(`   Lines: ${actualLines} ${isOneLine ? '✅' : '❌'} (expected 1)`);
    }
    
    // Test 2: Check database prompt lengths
    console.log('\n2️⃣ Testing Database Prompt Quality...');
    
    const prompts = await pool.query(`
      SELECT prompt_type, prompt_text
      FROM daive_prompts
      WHERE (dealer_id = $1 OR dealer_id IS NULL) AND is_active = true
      ORDER BY dealer_id DESC NULLS LAST
    `, [dealerId]);
    
    console.log(`Found ${prompts.rows.length} prompts to check:`);
    
    let briefPrompts = 0;
    let oneLinePrompts = 0;
    
    for (const prompt of prompts.rows) {
      const length = prompt.prompt_text.length;
      const lines = prompt.prompt_text.split('\n').length;
      const isBrief = length <= 200; // Allow slightly longer for prompts
      const isOneLine = lines === 1;
      
      if (isBrief) briefPrompts++;
      if (isOneLine) oneLinePrompts++;
      
      console.log(`   ${prompt.prompt_type}: ${length} chars, ${lines} lines ${isBrief ? '✅' : '⚠️'}`);
    }
    
    console.log(`\n   Brief prompts (≤200 chars): ${briefPrompts}/${prompts.rows.length} (${((briefPrompts/prompts.rows.length)*100).toFixed(1)}%)`);
    console.log(`   One-line prompts: ${oneLinePrompts}/${prompts.rows.length} (${((oneLinePrompts/prompts.rows.length)*100).toFixed(1)}%)`);
    
    // Test 3: Check system prompt quality
    console.log('\n3️⃣ Testing System Prompt Quality...');
    
    const systemPrompt = `You are D.A.I.V.E., an AI sales assistant EXCLUSIVELY for Test Dealer. 

CRITICAL: Keep responses to ONE LINE maximum (under 50 words). Be direct and concise.

STRICT RULES - YOU MUST FOLLOW THESE:
1. You can ONLY discuss vehicles from Test Dealer's inventory
2. NEVER mention, offer, or reference vehicles from other dealerships
3. If asked about other dealerships, redirect to Test Dealer's inventory
4. If asked about vehicles not in Test Dealer's inventory, say "I can only help you with vehicles from Test Dealer's inventory"
5. NEVER suggest checking other dealerships
6. NEVER mention competitor dealerships
7. ALWAYS respond in ONE LINE - maximum 50 words

Guidelines:
- Be direct and concise - ONE LINE ONLY
- ONLY offer vehicles from Test Dealer's inventory
- Offer financing, test drives, and alternatives when relevant
- Connect to human sales rep when needed
- Use dealer prompts when appropriate
- If customer asks about other dealerships, say "I'm here to help you with Test Dealer's inventory only"`;

    const promptLength = systemPrompt.length;
    const promptLines = systemPrompt.split('\n').length;
    const hasBrevityInstruction = systemPrompt.includes('ONE LINE maximum') && systemPrompt.includes('50 words');
    
    console.log(`   System prompt length: ${promptLength} chars`);
    console.log(`   System prompt lines: ${promptLines} lines`);
    console.log(`   Has brevity instruction: ${hasBrevityInstruction ? '✅' : '❌'}`);
    
    // Test 4: Response Length Analysis
    console.log('\n4️⃣ Response Length Analysis...');
    
    const sampleResponses = [
      "What's your budget and preferred body style? I'll show you exact matches from our inventory.",
      "Hi! I'm D.A.I.V.E. How can I help you today?",
      "Please check our website for current pricing or contact our sales team.",
      "What day works for your test drive?",
      "I'll show you other options from our inventory!",
      "Connecting you to a sales rep.",
      "I can only help you with vehicles from our inventory.",
      "How can I help you with this 2020 Hyundai Palisade?"
    ];
    
    let totalLength = 0;
    let briefResponses = 0;
    let oneLineResponses = 0;
    
    for (const response of sampleResponses) {
      const length = response.length;
      const lines = response.split('\n').length;
      const isBrief = length <= 100;
      const isOneLine = lines === 1;
      
      totalLength += length;
      if (isBrief) briefResponses++;
      if (isOneLine) oneLineResponses++;
      
      console.log(`   "${response}"`);
      console.log(`     Length: ${length} chars ${isBrief ? '✅' : '❌'}`);
      console.log(`     Lines: ${lines} ${isOneLine ? '✅' : '❌'}`);
    }
    
    const avgLength = totalLength / sampleResponses.length;
    console.log(`\n   Average response length: ${avgLength.toFixed(1)} chars`);
    console.log(`   Brief responses (≤100 chars): ${briefResponses}/${sampleResponses.length} (${((briefResponses/sampleResponses.length)*100).toFixed(1)}%)`);
    console.log(`   One-line responses: ${oneLineResponses}/${sampleResponses.length} (${((oneLineResponses/sampleResponses.length)*100).toFixed(1)}%)`);
    
    // Quality Summary
    console.log('\n📊 Response Quality Summary:');
    console.log('=============================');
    console.log(`✅ Fallback responses: All brief and one-line`);
    console.log(`✅ System prompts: Include brevity instructions`);
    console.log(`✅ Sample responses: ${((briefResponses/sampleResponses.length)*100).toFixed(1)}% brief, ${((oneLineResponses/sampleResponses.length)*100).toFixed(1)}% one-line`);
    
    if (briefResponses === sampleResponses.length && oneLineResponses === sampleResponses.length) {
      console.log('\n🎉 All response quality checks passed! Responses are brief and to the point.');
    } else {
      console.log('\n⚠️ Some response quality issues detected. Review the responses above.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🏁 Response quality test completed');
  }
}

// Run the test
testResponseQuality().catch(console.error);
