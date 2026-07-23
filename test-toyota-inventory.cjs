import { pool } from '../src/database/connection.js';

async function testToyotaInventory() {
  console.log('🚗 Testing Toyota Inventory Query...\n');
  
  try {
    // Test 1: Check if we can connect to the database
    console.log('🔍 Test 1: Database Connection');
    const client = await pool.connect();
    console.log('✅ Database connection successful\n');
    
    // Test 2: Check total vehicles in database
    console.log('🔍 Test 2: Total Vehicle Count');
    const totalResult = await client.query('SELECT COUNT(*) as total FROM vehicles');
    console.log(`📊 Total vehicles in database: ${totalResult.rows[0].total}\n`);
    
    // Test 3: Check vehicles by dealer (using a sample dealer ID)
    console.log('🔍 Test 3: Vehicles by Dealer');
    const dealerResult = await client.query('SELECT id, business_name FROM dealers LIMIT 5');
    console.log('📋 Available dealers:');
    dealerResult.rows.forEach(dealer => {
      console.log(`   - ${dealer.id}: ${dealer.business_name}`);
    });
    console.log();
    
    // Test 4: Check Toyota vehicles specifically
    console.log('🔍 Test 4: Toyota Vehicles Query');
    const toyotaQuery = `
      SELECT id, make, model, year, trim, price, mileage, status, color, dealer_id
      FROM vehicles 
      WHERE LOWER(make) = LOWER('toyota') AND status = 'available'
      ORDER BY year DESC
      LIMIT 10
    `;
    
    const toyotaResult = await client.query(toyotaQuery);
    console.log(`🚗 Toyota vehicles found: ${toyotaResult.rows.length}`);
    
    if (toyotaResult.rows.length > 0) {
      console.log('📋 Toyota vehicles:');
      toyotaResult.rows.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`);
        console.log(`      💰 Price: $${vehicle.price?.toLocaleString() || 'N/A'}`);
        console.log(`      🚗 Mileage: ${vehicle.mileage?.toLocaleString() || 'N/A'} miles`);
        console.log(`      🎨 Color: ${vehicle.color || 'N/A'}`);
        console.log(`      🏢 Dealer ID: ${vehicle.dealer_id}`);
        console.log();
      });
    } else {
      console.log('❌ No Toyota vehicles found');
    }
    
    // Test 5: Check vehicles by a specific dealer ID
    if (dealerResult.rows.length > 0) {
      const testDealerId = dealerResult.rows[0].id;
      console.log(`🔍 Test 5: Vehicles for Dealer ${testDealerId}`);
      
      const dealerVehiclesQuery = `
        SELECT id, make, model, year, trim, price, mileage, status, color
        FROM vehicles 
        WHERE dealer_id = $1 AND status = 'available'
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      const dealerVehiclesResult = await client.query(dealerVehiclesQuery, [testDealerId]);
      console.log(`📊 Vehicles for dealer ${testDealerId}: ${dealerVehiclesResult.rows.length}`);
      
      if (dealerVehiclesResult.rows.length > 0) {
        console.log('📋 Sample vehicles:');
        dealerVehiclesResult.rows.slice(0, 3).forEach((vehicle, index) => {
          console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
        });
      }
      console.log();
    }
    
    // Test 6: Check database schema
    console.log('🔍 Test 6: Database Schema Check');
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'vehicles'
      ORDER BY ordinal_position
    `;
    
    const schemaResult = await client.query(schemaQuery);
    console.log('📋 Vehicles table schema:');
    schemaResult.rows.forEach(column => {
      console.log(`   - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    });
    console.log();
    
    client.release();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testToyotaInventory();
