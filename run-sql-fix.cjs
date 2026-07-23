const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function runSQLFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running SQL fix for import function...');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('fix-import-function.sql', 'utf8');
    
    // Execute the SQL
    await client.query(sqlContent);
    
    console.log('✅ SQL fix executed successfully!');
    
    // Verify the function was created correctly
    const verification = await client.query(`
      SELECT 
        proname,
        pronargs,
        proargnames
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv';
    `);
    
    if (verification.rows.length > 0) {
      const func = verification.rows[0];
      console.log(`\n📋 Function verification:`);
      console.log(`  Name: ${func.proname}`);
      console.log(`  Arguments: ${func.pronargs}`);
      console.log(`  Argument names: ${func.proargnames}`);
      
      if (func.pronargs === 28) {
        console.log('🎯 Perfect! Function has 28 parameters as expected!');
        
        // Test the function
        console.log('\n🧪 Testing function...');
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
          
          console.log('✅ Function test successful!');
          console.log('Result:', testResult.rows[0]);
          
          // Clean up test data
          await client.query(`DELETE FROM vehicles WHERE vin = 'TEST123';`);
          console.log('🧹 Test data cleaned up');
          
          console.log('\n🎉 SUCCESS! Your import function is now working correctly!');
          console.log('📊 You can now use the CSV import functionality in your application.');
          
        } catch (error) {
          console.error('❌ Function test failed:', error.message);
        }
      } else {
        console.log(`❌ Function has ${func.pronargs} parameters, expected 28`);
      }
    } else {
      console.log('❌ Function not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error running SQL fix:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runSQLFix().catch(console.error);
