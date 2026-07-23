import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testVehicleUpdate() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing vehicle update functionality...');
    
    const dealerId = 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';
    
    // Check existing vehicles without color
    console.log('\n📋 Checking vehicles with NULL exterior_color...');
    const vehiclesWithoutColor = await client.query(`
      SELECT 
        id, vin, make, model, year, 
        color, exterior_color, interior_color,
        created_at, updated_at
      FROM vehicles 
      WHERE dealer_id = $1 
      AND (color IS NULL OR exterior_color IS NULL)
      ORDER BY created_at DESC
      LIMIT 5
    `, [dealerId]);
    
    if (vehiclesWithoutColor.rows.length > 0) {
      console.log(`Found ${vehiclesWithoutColor.rows.length} vehicles without color:`);
      vehiclesWithoutColor.rows.forEach((vehicle, index) => {
        console.log(`  ${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
        console.log(`     VIN: ${vehicle.vin}`);
        console.log(`     Color: ${vehicle.color || 'NULL'}`);
        console.log(`     Exterior Color: ${vehicle.exterior_color || 'NULL'}`);
        console.log(`     Interior Color: ${vehicle.interior_color || 'NULL'}`);
        console.log(`     Created: ${vehicle.created_at}`);
        console.log(`     Updated: ${vehicle.updated_at}`);
        console.log('');
      });
      
      // Test updating one vehicle with color
      const testVehicle = vehiclesWithoutColor.rows[0];
      console.log(`🎨 Testing update for vehicle: ${testVehicle.vin}`);
      
      // Simulate the import_vehicle_from_csv function call
      const updateResult = await client.query(`
        SELECT import_vehicle_from_csv(
          $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::boolean,
          $11::text, $12::text, $13::text, $14::text, $15::text, $16::integer, $17::numeric, $18::numeric, $19::text, $20::numeric,
          $21::numeric, $22::numeric, $23::numeric, $24::numeric, $25::numeric, $26::text, $27::integer, $28::text
        ) as vehicle_id
      `, [
        dealerId,                    // p_dealer_id
        testVehicle.vin,             // p_vin
        testVehicle.make,            // p_make
        testVehicle.model,           // p_model
        testVehicle.series || null,  // p_series
        testVehicle.stock_number || null, // p_stock_number
        testVehicle.new_used || 'used', // p_new_used
        testVehicle.body_style || null, // p_body_style
        testVehicle.vehicle_type || null, // p_vehicle_type
        testVehicle.certified || false, // p_certified
        'Red',                       // p_color (NEW COLOR!)
        'Black',                     // p_interior_color (NEW COLOR!)
        testVehicle.engine_type || null, // p_engine_type
        testVehicle.displacement || null, // p_displacement
        testVehicle.features || null, // p_features
        testVehicle.odometer || null, // p_odometer
        testVehicle.price || null,    // p_price
        testVehicle.other_price || null, // p_other_price
        testVehicle.transmission || null, // p_transmission
        testVehicle.msrp || null,     // p_msrp
        testVehicle.dealer_discount || null, // p_dealer_discount
        testVehicle.consumer_rebate || null, // p_consumer_rebate
        testVehicle.dealer_accessories || null, // p_dealer_accessories
        testVehicle.total_customer_savings || null, // p_total_customer_savings
        testVehicle.total_dealer_rebate || null, // p_total_dealer_rebate
        testVehicle.photo_url_list || null, // p_photo_url_list
        testVehicle.year,            // p_year
        testVehicle.reference_dealer_id || null // p_reference_dealer_id
      ]);
      
      console.log(`✅ Update result: ${updateResult.rows[0].vehicle_id}`);
      
      // Check if the vehicle was updated
      const updatedVehicle = await client.query(`
        SELECT 
          id, vin, make, model, year, 
          color, exterior_color, interior_color,
          updated_at
        FROM vehicles 
        WHERE id = $1
      `, [updateResult.rows[0].vehicle_id]);
      
      if (updatedVehicle.rows.length > 0) {
        const vehicle = updatedVehicle.rows[0];
        console.log('\n🎉 Vehicle updated successfully!');
        console.log(`  VIN: ${vehicle.vin}`);
        console.log(`  Color: ${vehicle.color || 'NULL'}`);
        console.log(`  Exterior Color: ${vehicle.exterior_color || 'NULL'}`);
        console.log(`  Interior Color: ${vehicle.interior_color || 'NULL'}`);
        console.log(`  Updated: ${vehicle.updated_at}`);
        
        if (vehicle.color === 'Red' && vehicle.interior_color === 'Black') {
          console.log('✅ Color fields were successfully updated!');
        } else {
          console.log('❌ Color fields were not updated as expected');
        }
      }
      
    } else {
      console.log('✅ All vehicles already have color information');
    }
    
    // Check all vehicles to see color distribution
    console.log('\n📊 Color field distribution:');
    const colorStats = await client.query(`
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(color) as vehicles_with_color,
        COUNT(exterior_color) as vehicles_with_exterior_color,
        COUNT(interior_color) as vehicles_with_interior_color
      FROM vehicles 
      WHERE dealer_id = $1
    `, [dealerId]);
    
    if (colorStats.rows.length > 0) {
      const stats = colorStats.rows[0];
      console.log(`  Total vehicles: ${stats.total_vehicles}`);
      console.log(`  With color: ${stats.vehicles_with_color}`);
      console.log(`  With exterior_color: ${stats.vehicles_with_exterior_color}`);
      console.log(`  With interior_color: ${stats.vehicles_with_interior_color}`);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testVehicleUpdate().catch(console.error);
