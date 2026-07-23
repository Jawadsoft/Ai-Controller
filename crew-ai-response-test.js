import { pool } from './src/database/connection.js';

async function testCrewAIResponseTimes() {
  console.log('🚀 Crew AI Response Time Test\n');
  
  try {
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Test 1: Database Connection
    console.log('1️⃣ Testing Database Connection...');
    const dbStart = Date.now();
    const connectionTest = await pool.query('SELECT NOW() as current_time');
    const dbTime = Date.now() - dbStart;
    console.log(`✅ Database connected in ${dbTime}ms`);
    
    // Test 2: Crew AI Related Tables Check
    console.log('\n2️⃣ Testing Crew AI Database Tables...');
    
    // Check daive_conversations table
    const convStart = Date.now();
    const conversations = await pool.query('SELECT COUNT(*) as count FROM daive_conversations WHERE dealer_id = $1', [dealerId]);
    const convTime = Date.now() - convStart;
    console.log(`✅ Conversations table: ${convTime}ms (${conversations.rows[0].count} records)`);
    
    // Check daive_prompts table
    const promptsStart = Date.now();
    const prompts = await pool.query('SELECT COUNT(*) as count FROM daive_prompts WHERE dealer_id = $1 OR dealer_id IS NULL', [dealerId]);
    const promptsTime = Date.now() - promptsStart;
    console.log(`✅ Prompts table: ${promptsTime}ms (${prompts.rows[0].count} records)`);
    
    // Check vehicles table
    const vehiclesStart = Date.now();
    const vehicles = await pool.query('SELECT COUNT(*) as count FROM vehicles WHERE dealer_id = $1 AND status = $2', [dealerId, 'available']);
    const vehiclesTime = Date.now() - vehiclesStart;
    console.log(`✅ Vehicles table: ${vehiclesTime}ms (${vehicles.rows[0].count} vehicles)`);
    
    // Test 3: Crew AI Specific Queries
    console.log('\n3️⃣ Testing Crew AI Specific Queries...');
    
    // Test vehicle context query (used by Crew AI)
    const contextStart = Date.now();
    const vehicleContext = await pool.query(`
      SELECT v.*, d.business_name, d.contact_name, d.phone, d.address, d.city, d.state
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      WHERE v.dealer_id = $1 AND v.status = 'available'
      LIMIT 1
    `, [dealerId]);
    const contextTime = Date.now() - contextStart;
    
    if (vehicleContext.rows.length > 0) {
      const vehicle = vehicleContext.rows[0];
      console.log(`✅ Vehicle context: ${contextTime}ms`);
      console.log(`   Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      console.log(`   Dealer: ${vehicle.business_name}`);
      console.log(`   Price: $${vehicle.price}`);
    }
    
    // Test alternative vehicles query (used by Crew AI)
    const altStart = Date.now();
    const altVehicles = await pool.query(`
      SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features
      FROM vehicles v
      WHERE v.dealer_id = $1 
      AND v.id != $2 
      AND v.status = 'available'
      ORDER BY v.created_at DESC
      LIMIT 5
    `, [dealerId, vehicleContext.rows[0]?.id || '00000000-0000-0000-0000-000000000000']);
    const altTime = Date.now() - altStart;
    console.log(`✅ Alternative vehicles: ${altTime}ms (${altVehicles.rows.length} vehicles found)`);
    
    // Test 4: Crew AI Response Generation Simulation
    console.log('\n4️⃣ Testing Crew AI Response Generation Simulation...');
    
    // Simulate the exact queries that Crew AI would make
    const crewStart = Date.now();
    
    // Query 1: Get vehicle details
    const vehicleDetails = await pool.query(`
      SELECT v.*, d.business_name, d.contact_name, d.phone
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      WHERE v.id = $1
    `, [vehicleContext.rows[0]?.id || '00000000-0000-0000-0000-000000000000']);
    
    // Query 2: Get dealer prompts
    const dealerPrompts = await pool.query(`
      SELECT prompt_type, prompt_text
      FROM daive_prompts
      WHERE (dealer_id = $1 OR dealer_id IS NULL) AND is_active = true
      ORDER BY dealer_id DESC NULLS LAST
    `, [dealerId]);
    
    // Query 3: Get conversation history
    const convHistory = await pool.query(`
      SELECT messages, lead_qualification_score
      FROM daive_conversations
      WHERE dealer_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [dealerId]);
    
    const crewTime = Date.now() - crewStart;
    console.log(`✅ Crew AI simulation: ${crewTime}ms`);
    console.log(`   Vehicle details: ${vehicleDetails.rows.length > 0 ? 'Found' : 'Not found'}`);
    console.log(`   Dealer prompts: ${dealerPrompts.rows.length} prompts`);
    console.log(`   Conversation history: ${convHistory.rows.length > 0 ? 'Found' : 'Not found'}`);
    
    // Test 5: Performance Benchmarking
    console.log('\n5️⃣ Performance Benchmarking...');
    
    // Test multiple concurrent queries (simulating real usage)
    const benchmarkStart = Date.now();
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(pool.query('SELECT COUNT(*) as count FROM vehicles WHERE dealer_id = $1 AND status = $2', [dealerId, 'available']));
    }
    
    const results = await Promise.all(promises);
    const benchmarkTime = Date.now() - benchmarkStart;
    console.log(`✅ Concurrent queries benchmark: ${benchmarkTime}ms (5 queries)`);
    console.log(`   Average per query: ${(benchmarkTime / 5).toFixed(1)}ms`);
    
    // Test 6: Response Time Analysis
    console.log('\n6️⃣ Response Time Analysis...');
    
    // Calculate percentiles
    const times = [dbTime, convTime, promptsTime, vehiclesTime, contextTime, altTime, crewTime, benchmarkTime];
    times.sort((a, b) => a - b);
    
    const p50 = times[Math.floor(times.length * 0.5)];
    const p90 = times[Math.floor(times.length * 0.9)];
    const p95 = times[Math.floor(times.length * 0.95)];
    
    console.log(`   P50 (median): ${p50}ms`);
    console.log(`   P90: ${p90}ms`);
    console.log(`   P95: ${p95}ms`);
    console.log(`   Fastest: ${times[0]}ms`);
    console.log(`   Slowest: ${times[times.length - 1]}ms`);
    
    // Performance Summary
    console.log('\n📊 Performance Summary:');
    console.log('========================');
    console.log(`Database connection: ${dbTime}ms`);
    console.log(`Conversations table: ${convTime}ms`);
    console.log(`Prompts table: ${promptsTime}ms`);
    console.log(`Vehicles table: ${vehiclesTime}ms`);
    console.log(`Vehicle context: ${contextTime}ms`);
    console.log(`Alternative vehicles: ${altTime}ms`);
    console.log(`Crew AI simulation: ${crewTime}ms`);
    console.log(`Concurrent benchmark: ${benchmarkTime}ms`);
    
    const totalTime = dbTime + convTime + promptsTime + vehiclesTime + contextTime + altTime + crewTime + benchmarkTime;
    console.log(`\n🎯 Total test time: ${totalTime}ms`);
    console.log(`📈 Average response time: ${(totalTime / times.length).toFixed(1)}ms`);
    
    // Response Quality Check
    console.log('\n🔍 Response Quality Check:');
    console.log('==========================');
    console.log(`Total vehicles available: ${vehicles.rows[0].count}`);
    console.log(`Dealer prompts available: ${prompts.rows[0].count}`);
    console.log(`Recent conversations: ${conversations.rows[0].count}`);
    
    if (vehicleContext.rows.length > 0) {
      const vehicle = vehicleContext.rows[0];
      console.log(`Sample vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price}`);
    }
    
    // Performance Recommendations
    console.log('\n💡 Performance Recommendations:');
    console.log('================================');
    if (dbTime > 100) {
      console.log('⚠️ Database connection time is high - consider connection pooling optimization');
    }
    if (crewTime > 200) {
      console.log('⚠️ Crew AI query time is high - consider query optimization or caching');
    }
    if (benchmarkTime > 100) {
      console.log('⚠️ Concurrent query performance could be improved');
    }
    
    if (dbTime <= 100 && crewTime <= 200 && benchmarkTime <= 100) {
      console.log('✅ All performance metrics are within acceptable ranges');
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
testCrewAIResponseTimes().catch(console.error);
