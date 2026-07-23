import daiveService from './src/lib/daive.js';
import { pool } from './src/database/connection.js';

async function debugDAIVEResponse() {
  try {
    console.log('🔍 Debugging D.A.I.V.E. response...\n');
    
    const sessionId = 'debug_test_' + Date.now();
    const vehicleId = 'fe21b82a-5e3b-46e4-a51d-0f6806a46cc5';
    const userMessage = 'I want an ideal car for my family';
    
    console.log('Session ID:', sessionId);
    console.log('Vehicle ID:', vehicleId);
    console.log('User Message:', userMessage);
    console.log('');
    
    // Test 1: Check OpenAI API directly
    console.log('1. Testing OpenAI API directly...');
    try {
      const completion = await daiveService.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { 
            role: 'system', 
            content: 'You are D.A.I.V.E., an AI car sales assistant. A customer says: "I want an ideal car for my family". Respond naturally and helpfully.' 
          },
          { 
            role: 'user', 
            content: 'I want an ideal car for my family' 
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });
      
      console.log('✅ OpenAI API working:');
      console.log('Response:', completion.choices[0].message.content);
    } catch (error) {
      console.log('❌ OpenAI API error:', error.message);
    }
    
    console.log('');
    
    // Test 2: Test full conversation processing
    console.log('2. Testing full conversation processing...');
    try {
      const result = await daiveService.processConversation(
        sessionId,
        vehicleId,
        userMessage,
        { name: 'Test Customer', email: 'test@example.com' }
      );
      
      console.log('✅ Conversation processed:');
      console.log('Response:', result.response);
      console.log('Lead Score:', result.leadScore);
      console.log('Conversation ID:', result.conversationId);
      
      // Test 3: Test follow-up message
      console.log('\n3. Testing follow-up message...');
      const followUpResult = await daiveService.processConversation(
        sessionId,
        vehicleId,
        'What about safety features for children?',
        { name: 'Test Customer', email: 'test@example.com' }
      );
      
      console.log('✅ Follow-up processed:');
      console.log('Response:', followUpResult.response);
      console.log('Lead Score:', followUpResult.leadScore);
      
    } catch (error) {
      console.log('❌ Conversation processing error:', error.message);
      console.log('Stack:', error.stack);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugDAIVEResponse(); 