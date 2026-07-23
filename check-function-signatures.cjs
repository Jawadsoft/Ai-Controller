const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function checkFunctionSignatures() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking function signatures...');
    
    // Get function OIDs and signatures
    const functions = await client.query(`
      SELECT 
        oid,
        proname,
        pronargs,
        proargtypes,
        proargnames,
        proargmodes
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv';
    `);
    
    console.log(`\n📊 Found ${functions.rows.length} functions:`);
    
    for (let i = 0; i < functions.rows.length; i++) {
      const func = functions.rows[i];
      console.log(`\n${i + 1}. Function OID: ${func.oid}`);
      console.log(`   Name: ${func.proname}`);
      console.log(`   Arguments: ${func.pronargs}`);
      console.log(`   Argument types: ${func.proargtypes}`);
      console.log(`   Argument names: ${func.proargnames}`);
      console.log(`   Argument modes: ${func.proargmodes}`);
      
      // Try to drop this specific function by OID
      try {
        await client.query(`DROP FUNCTION IF EXISTS import_vehicle_from_csv(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, INTEGER, TEXT);`);
        console.log(`   ✅ Dropped function ${i + 1}`);
      } catch (error) {
        console.log(`   ❌ Could not drop function ${i + 1}: ${error.message}`);
      }
    }
    
    // Check remaining functions
    const remainingFunctions = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv';
    `);
    
    console.log(`\n📊 Remaining functions: ${remainingFunctions.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking function signatures:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkFunctionSignatures().catch(console.error);
