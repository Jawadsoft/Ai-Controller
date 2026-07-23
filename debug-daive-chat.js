import daiveService from './src/lib/daive.js';
import { pool } from './src/database/connection.js';

async function debugDAIVEChat() {
  try {
    console.log('🔍 Debugging D.A.I.V.E. chat endpoint...\n');
    
    // Test 1: Check database connection
    console.log('1. Testing database connection...');
    const dbTest = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected:', dbTest.rows[0]);
    
    // Test 2: Check if vehicles exist
    console.log('\n2. Checking vehicles in database...');
    const vehicles = await pool.query('SELECT id, make, model, year FROM vehicles LIMIT 3');
    console.log(`✅ Found ${vehicles.rows.length} vehicles:`, vehicles.rows);
    
    if (vehicles.rows.length === 0) {
      console.log('❌ No vehicles found in database');
      return;
    }
    
    const testVehicleId = vehicles.rows[0].id;
    console.log('Using test vehicle ID:', testVehicleId);
    
    // Test 3: Test vehicle context retrieval
    console.log('\n3. Testing vehicle context retrieval...');
    const vehicleContext = await daiveService.getVehicleContext(testVehicleId);
    console.log('✅ Vehicle context:', vehicleContext ? 'Retrieved' : 'Failed');
    
    // Test 4: Test dealer prompts retrieval
    console.log('\n4. Testing dealer prompts retrieval...');
    const dealerPrompts = await daiveService.getDealerPrompts(vehicleContext?.dealer_id);
    console.log('✅ Dealer prompts:', Object.keys(dealerPrompts).length, 'prompts found');
    
    // Test 5: Test conversation processing
    console.log('\n5. Testing conversation processing...');
    const sessionId = daiveService.generateSessionId();
    const testMessage = 'Hello, I\'m interested in this vehicle';
    
    console.log('Session ID:', sessionId);
    console.log('Test message:', testMessage);
    
    const result = await daiveService.processConversation(
      sessionId,
      testVehicleId,
      testMessage,
      { name: 'Test Customer', email: 'test@example.com' }
    );
    
    console.log('✅ Conversation processed successfully');
    console.log('Response:', result.response?.substring(0, 100) + '...');
    console.log('Lead score:', result.leadScore);
    console.log('Conversation ID:', result.conversationId);
    
    // Test 6: Test conversation history
    console.log('\n6. Testing conversation history...');
    const history = await daiveService.getConversationHistory(sessionId);
    console.log('✅ Conversation history:', history ? 'Retrieved' : 'Not found');
    
    console.log('\n🎉 All D.A.I.V.E. chat tests passed!');
    console.log('\nThe issue might be in the HTTP request handling or server configuration.');
    
  } catch (error) {
    console.error('❌ Error during D.A.I.V.E. chat debug:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

debugDAIVEChat(); 