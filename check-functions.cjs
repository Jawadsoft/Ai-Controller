const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function checkFunctions() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking database functions...');
    
    // List all functions
    const functions = await client.query(`
      SELECT 
        routine_name,
        routine_type,
        data_type,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%import%' OR routine_name LIKE '%vehicle%'
      ORDER BY routine_name;
    `);
    
    console.log('\n📊 Found functions:');
    functions.rows.forEach(func => {
      console.log(`\n• ${func.routine_name} (${func.routine_type})`);
      console.log(`  Returns: ${func.data_type}`);
      if (func.routine_definition) {
        console.log(`  Definition: ${func.routine_definition.substring(0, 200)}...`);
      }
    });
    
    // Check specific function parameters
    if (functions.rows.length > 0) {
      console.log('\n🔍 Checking function parameters...');
      
      for (const func of functions.rows) {
        const params = await client.query(`
          SELECT parameter_name, data_type, parameter_default, ordinal_position
          FROM information_schema.parameters 
          WHERE specific_name = $1
          ORDER BY ordinal_position;
        `, [func.routine_name]);
        
        if (params.rows.length > 0) {
          console.log(`\n📋 ${func.routine_name} parameters (${params.rows.length}):`);
          params.rows.forEach(param => {
            console.log(`  ${param.ordinal_position}. ${param.parameter_name}: ${param.data_type} ${param.parameter_default ? `(default: ${param.parameter_default})` : ''}`);
          });
        } else {
          console.log(`\n📋 ${func.routine_name}: No parameters`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking functions:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkFunctions().catch(console.error);
