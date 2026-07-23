import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function testInventory() {
  console.log('🧪 Testing Inventory Fetch...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test 1: Check database connection
    console.log('1️⃣ Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    console.log('   Current time:', connectionTest.rows[0].current_time);
    
    // Test 2: Check dealers table
    console.log('\n2️⃣ Testing dealers table...');
    const dealersTest = await pool.query('SELECT COUNT(*) as dealer_count FROM dealers');
    console.log('✅ Dealers table accessible');
    console.log('   Total dealers:', dealersTest.rows[0].dealer_count);
    
    // Test 3: Check vehicles table
    console.log('\n3️⃣ Testing vehicles table...');
    const vehiclesTest = await pool.query('SELECT COUNT(*) as vehicle_count FROM vehicles');
    console.log('✅ Vehicles table accessible');
    console.log('   Total vehicles:', vehiclesTest.rows[0].vehicle_count);
    
    // Test 4: Check available vehicles for a specific dealer
    console.log('\n4️⃣ Testing dealer-specific vehicle fetch...');
    const dealerVehiclesTest = await pool.query(`
      SELECT v.id, v.make, v.model, v.year, v.price, v.status, d.business_name
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      WHERE v.status = 'available'
      LIMIT 5
    `);
    
    if (dealerVehiclesTest.rows.length > 0) {
      console.log('✅ Dealer vehicles fetch successful');
      console.log('   Sample vehicles:');
      dealerVehiclesTest.rows.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price} (${vehicle.business_name})`);
      });
    } else {
      console.log('⚠️ No available vehicles found');
    }
    
    // Test 5: Test the exact query used in Crew AI
    console.log('\n5️⃣ Testing Crew AI vehicle details query...');
    if (dealerVehiclesTest.rows.length > 0) {
      const testVehicleId = dealerVehiclesTest.rows[0].id;
      const vehicleDetailsTest = await pool.query(`
        SELECT v.*, d.business_name, d.contact_name, d.phone
        FROM vehicles v
        JOIN dealers d ON v.dealer_id = d.id
        WHERE v.id = $1
      `, [testVehicleId]);
      
      if (vehicleDetailsTest.rows.length > 0) {
        const vehicle = vehicleDetailsTest.rows[0];
        console.log('✅ Crew AI vehicle details query successful');
        console.log('   Vehicle:', vehicle.year, vehicle.make, vehicle.model);
        console.log('   Dealer:', vehicle.business_name);
        console.log('   Price:', vehicle.price);
        console.log('   Status:', vehicle.status);
      } else {
        console.log('❌ Crew AI vehicle details query failed - no results');
      }
    }
    
    // Test 6: Test alternative vehicles query
    console.log('\n6️⃣ Testing alternative vehicles query...');
    if (dealerVehiclesTest.rows.length > 0) {
      const testDealerId = dealerVehiclesTest.rows[0].dealer_id;
      const testVehicleId = dealerVehiclesTest.rows[0].id;
      
      const alternativeVehiclesTest = await pool.query(`
        SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.mileage, v.status, v.features,
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
        WHERE v.dealer_id = $1 
        AND v.id != $2 
        AND v.status = 'available'
        ORDER BY v.created_at DESC
        LIMIT $3
      `, [testDealerId, testVehicleId, 3]);
      
      console.log('✅ Alternative vehicles query successful');
      console.log('   Alternative vehicles found:', alternativeVehiclesTest.rows.length);
      
      if (alternativeVehiclesTest.rows.length > 0) {
        alternativeVehiclesTest.rows.forEach((vehicle, index) => {
          console.log(`   ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price}`);
        });
      }
    }
    
    console.log('\n🎉 Inventory fetch test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testInventory().catch(console.error); 