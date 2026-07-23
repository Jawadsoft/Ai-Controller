const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function testImportFunction() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing import_vehicle_from_csv function...');
    
    // First, let's see what functions exist
    const functions = await client.query(`
      SELECT 
        routine_name,
        routine_type,
        data_type,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
      AND routine_name = 'import_vehicle_from_csv';
    `);
    
    console.log('\n📊 Found functions:');
    functions.rows.forEach(func => {
      console.log(`\n• ${func.routine_name} (${func.routine_type})`);
      console.log(`  Returns: ${func.data_type}`);
      if (func.routine_definition) {
        console.log(`  Definition preview: ${func.routine_definition.substring(0, 300)}...`);
      }
    });
    
    // Try to call the function with a simple test
    console.log('\n🧪 Testing function call...');
    
    try {
      const testResult = await client.query(`
        SELECT import_vehicle_from_csv(
          '00000000-0000-0000-0000-000000000000'::UUID,
          'TEST123',
          'Test Make',
          'Test Model',
          'Test Series',
          'TEST123',
          'used',
          'Sedan',
          'Car',
          false,
          'Red',
          'Black',
          '2.0L',
          '2.0',
          'Test features',
          50000,
          25000,
          24000,
          'Automatic',
          30000,
          5000,
          1000,
          1000,
          6000,
          1000,
          '{http://example.com/image1.jpg,http://example.com/image2.jpg}',
          2020,
          'TEST_DEALER'
        ) as vehicle_id;
      `);
      
      console.log('✅ Function call successful!');
      console.log('Result:', testResult.rows[0]);
      
    } catch (error) {
      console.error('❌ Function call failed:', error.message);
      console.error('Error details:', {
        code: error.code,
        detail: error.detail,
        hint: error.hint
      });
    }
    
    // Check if any test data was inserted
    const testVehicle = await client.query(`
      SELECT * FROM vehicles WHERE vin = 'TEST123';
    `);
    
    if (testVehicle.rows.length > 0) {
      console.log('\n✅ Test vehicle was inserted:');
      console.log('ID:', testVehicle.rows[0].id);
      console.log('VIN:', testVehicle.rows[0].vin);
      console.log('Make:', testVehicle.rows[0].make);
      console.log('Model:', testVehicle.rows[0].model);
      
      // Clean up test data
      await client.query(`DELETE FROM vehicles WHERE vin = 'TEST123';`);
      console.log('🧹 Test data cleaned up');
    } else {
      console.log('\n❌ No test vehicle was inserted');
    }
    
  } catch (error) {
    console.error('❌ Error testing import function:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testImportFunction().catch(console.error);
