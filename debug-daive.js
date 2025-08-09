import daiveService from './src/lib/daive.js';
import { pool } from './src/database/connection.js';

async function debugDAIVE() {
  try {
    console.log('🔍 Debugging D.A.I.V.E. service...\n');
    
    // Test 1: Check if we can connect to the database
    console.log('1. Testing database connection...');
    const dbTest = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection: OK');
    console.log(`   Current time: ${dbTest.rows[0].current_time}\n`);
    
    // Test 2: Check if vehicles exist
    console.log('2. Checking for vehicles...');
    const vehicles = await pool.query('SELECT id, make, model, year FROM vehicles LIMIT 3');
    if (vehicles.rows.length === 0) {
      console.log('❌ No vehicles found in database');
      return;
    }
    console.log(`✅ Found ${vehicles.rows.length} vehicles:`);
    vehicles.rows.forEach(v => console.log(`   - ${v.year} ${v.make} ${v.model} (ID: ${v.id})`));
    console.log('');
    
    // Test 3: Check if D.A.I.V.E. tables exist
    console.log('3. Checking D.A.I.V.E. tables...');
    const tables = ['daive_conversations', 'daive_prompts', 'daive_analytics'];
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✅ ${table}: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`❌ ${table}: ${error.message}`);
      }
    }
    console.log('');
    
    // Test 4: Test vehicle context retrieval
    console.log('4. Testing vehicle context retrieval...');
    const testVehicleId = vehicles.rows[0].id;
    const vehicleContext = await daiveService.getVehicleContext(testVehicleId);
    if (vehicleContext) {
      console.log('✅ Vehicle context retrieved:');
      console.log(`   Make: ${vehicleContext.make}`);
      console.log(`   Model: ${vehicleContext.model}`);
      console.log(`   Year: ${vehicleContext.year}`);
      console.log(`   Dealer: ${vehicleContext.business_name}`);
    } else {
      console.log('❌ Failed to get vehicle context');
      return;
    }
    console.log('');
    
    // Test 5: Test dealer prompts retrieval
    console.log('5. Testing dealer prompts retrieval...');
    const dealerPrompts = await daiveService.getDealerPrompts(vehicleContext.dealer_id);
    console.log(`✅ Dealer prompts: ${Object.keys(dealerPrompts).length} prompts found`);
    Object.entries(dealerPrompts).forEach(([type, text]) => {
      console.log(`   - ${type}: ${text.substring(0, 50)}...`);
    });
    console.log('');
    
    // Test 6: Test conversation creation
    console.log('6. Testing conversation creation...');
    const sessionId = daiveService.generateSessionId();
    const customerInfo = { name: 'Test Customer', email: 'test@example.com' };
    
    try {
      const conversation = await daiveService.getOrCreateConversation(testVehicleId, sessionId, customerInfo);
      console.log('✅ Conversation created:');
      console.log(`   ID: ${conversation.id}`);
      console.log(`   Session: ${conversation.session_id}`);
      console.log(`   Customer: ${conversation.customer_name}`);
    } catch (error) {
      console.log('❌ Failed to create conversation:');
      console.log(`   Error: ${error.message}`);
      return;
    }
    console.log('');
    
    // Test 7: Test OpenAI connection (if API key is set)
    console.log('7. Testing OpenAI connection...');
    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await daiveService.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Say "Hello, D.A.I.V.E. is working!"' }],
          max_tokens: 50
        });
        console.log('✅ OpenAI connection: OK');
        console.log(`   Response: ${completion.choices[0].message.content}`);
      } catch (error) {
        console.log('❌ OpenAI connection failed:');
        console.log(`   Error: ${error.message}`);
      }
    } else {
      console.log('⚠️  OpenAI API key not set');
    }
    console.log('');
    
    // Test 8: Test full conversation processing
    console.log('8. Testing full conversation processing...');
    try {
      const result = await daiveService.processConversation(sessionId, testVehicleId, 'Hello, I am interested in this vehicle', customerInfo);
      console.log('✅ Conversation processed successfully:');
      console.log(`   Response: ${result.response.substring(0, 100)}...`);
      console.log(`   Lead Score: ${result.leadScore}%`);
      console.log(`   Should Handoff: ${result.shouldHandoff}`);
    } catch (error) {
      console.log('❌ Conversation processing failed:');
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugDAIVE(); 