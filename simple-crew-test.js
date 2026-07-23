import { pool } from './src/database/connection.js';

async function testCrewResponseTimes() {
  console.log('🚀 Simple Crew Response Time Test\n');
  
  try {
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Test 1: Database Connection
    console.log('1️⃣ Testing Database Connection...');
    const dbStart = Date.now();
    const connectionTest = await pool.query('SELECT NOW() as current_time');
    const dbTime = Date.now() - dbStart;
    console.log(`✅ Database connected in ${dbTime}ms`);
    
    // Test 2: Basic Vehicle Count
    console.log('\n2️⃣ Testing Vehicle Count Query...');
    const countStart = Date.now();
    const vehicleCount = await pool.query('SELECT COUNT(*) as count FROM vehicles WHERE dealer_id = $1 AND status = $2', [dealerId, 'available']);
    const countTime = Date.now() - countStart;
    console.log(`✅ Vehicle count: ${countTime}ms (${vehicleCount.rows[0].count} vehicles found)`);
    
    // Test 3: Vehicle Details Query
    console.log('\n3️⃣ Testing Vehicle Details Query...');
    const detailsStart = Date.now();
    const vehicleDetails = await pool.query(`
      SELECT v.*, d.business_name, d.contact_name, d.phone
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      WHERE v.dealer_id = $1 AND v.status = 'available'
      LIMIT 1
    `, [dealerId]);
    const detailsTime = Date.now() - detailsStart;
    
    if (vehicleDetails.rows.length > 0) {
      const vehicle = vehicleDetails.rows[0];
      console.log(`✅ Vehicle details: ${detailsTime}ms`);
      console.log(`   Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      console.log(`   Dealer: ${vehicle.business_name}`);
      console.log(`   Price: $${vehicle.price}`);
    } else {
      console.log('⚠️ No vehicles found for testing');
    }
    
    // Test 4: Alternative Vehicles Query
    console.log('\n4️⃣ Testing Alternative Vehicles Query...');
    const altStart = Date.now();
    const altVehicles = await pool.query(`
      SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features
      FROM vehicles v
      WHERE v.dealer_id = $1 
      AND v.status = 'available'
      ORDER BY v.created_at DESC
      LIMIT 5
    `, [dealerId]);
    const altTime = Date.now() - altStart;
    console.log(`✅ Alternative vehicles: ${altTime}ms (${altVehicles.rows.length} vehicles found)`);
    
    // Test 5: Dealer Prompts Query
    console.log('\n5️⃣ Testing Dealer Prompts Query...');
    const promptsStart = Date.now();
    const dealerPrompts = await pool.query(`
      SELECT prompt_type, prompt_text
      FROM daive_prompts
      WHERE (dealer_id = $1 OR dealer_id IS NULL) AND is_active = true
      ORDER BY dealer_id DESC NULLS LAST
    `, [dealerId]);
    const promptsTime = Date.now() - promptsStart;
    console.log(`✅ Dealer prompts: ${promptsTime}ms (${dealerPrompts.rows.length} prompts found)`);
    
    // Test 6: Complex Inventory Query (similar to Crew AI)
    console.log('\n6️⃣ Testing Complex Inventory Query...');
    const complexStart = Date.now();
    const complexQuery = await pool.query(`
      SELECT 
        v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features,
        d.business_name, d.contact_name, d.phone,
        COALESCE(
          CASE 
            WHEN v.photo_url_list IS NOT NULL AND array_length(v.photo_url_list, 1) > 0 
            THEN v.photo_url_list[1]
            WHEN v.images IS NOT NULL AND array_length(v.images, 1) > 0 
            THEN v.images[1]
            ELSE NULL
          END,
          'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=300&h=200&fit=crop&crop=center'
        ) as image_url
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      WHERE v.dealer_id = $1 
      AND v.status = 'available'
      AND v.price BETWEEN 20000 AND 40000
      ORDER BY v.created_at DESC
      LIMIT 10
    `, [dealerId]);
    const complexTime = Date.now() - complexStart;
    console.log(`✅ Complex inventory query: ${complexTime}ms (${complexQuery.rows.length} vehicles found)`);
    
    // Test 7: Conversation History Query
    console.log('\n7️⃣ Testing Conversation History Query...');
    const convStart = Date.now();
    const conversations = await pool.query(`
      SELECT id, session_id, vehicle_id, lead_qualification_score, created_at
      FROM daive_conversations
      WHERE dealer_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [dealerId]);
    const convTime = Date.now() - convStart;
    console.log(`✅ Conversation history: ${convTime}ms (${conversations.rows.length} conversations found)`);
    
    // Performance Summary
    console.log('\n📊 Performance Summary:');
    console.log('========================');
    console.log(`Database connection: ${dbTime}ms`);
    console.log(`Vehicle count: ${countTime}ms`);
    console.log(`Vehicle details: ${detailsTime}ms`);
    console.log(`Alternative vehicles: ${altTime}ms`);
    console.log(`Dealer prompts: ${promptsTime}ms`);
    console.log(`Complex inventory: ${complexTime}ms`);
    console.log(`Conversation history: ${convTime}ms`);
    
    const totalTime = dbTime + countTime + detailsTime + altTime + promptsTime + complexTime + convTime;
    console.log(`\n🎯 Total query time: ${totalTime}ms`);
    console.log(`📈 Average response time: ${(totalTime / 7).toFixed(1)}ms`);
    
    // Response Quality Check
    console.log('\n🔍 Response Quality Check:');
    console.log('==========================');
    console.log(`Total vehicles available: ${vehicleCount.rows[0].count}`);
    console.log(`Dealer prompts available: ${dealerPrompts.rows.length}`);
    console.log(`Recent conversations: ${conversations.rows.length}`);
    
    if (vehicleDetails.rows.length > 0) {
      const vehicle = vehicleDetails.rows[0];
      console.log(`Sample vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price}`);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🏁 Test completed');
  }
}

// Run the test
testCrewResponseTimes().catch(console.error);
