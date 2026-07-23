const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function checkVehicleTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking vehicles table structure...');
    
    // Check if vehicles table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicles'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Vehicles table does not exist!');
      return;
    }
    
    console.log('✅ Vehicles table exists');
    
    // Get table structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 Vehicles table columns:');
    columns.rows.forEach(col => {
      console.log(`  • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Check if import function exists
    const functionExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.routines 
        WHERE routine_name = 'import_vehicle_from_csv'
      );
    `);
    
    if (functionExists.rows[0].exists) {
      console.log('\n✅ import_vehicle_from_csv function exists');
      
      // Get function parameters
      const functionParams = await client.query(`
        SELECT parameter_name, data_type, parameter_default
        FROM information_schema.parameters 
        WHERE specific_name = 'import_vehicle_from_csv'
        ORDER BY ordinal_position;
      `);
      
      console.log(`\n📋 Function parameters (${functionParams.rows.length}):`);
      functionParams.rows.forEach(param => {
        console.log(`  • ${param.parameter_name}: ${param.data_type} ${param.parameter_default ? `(default: ${param.parameter_default})` : ''}`);
      });
    } else {
      console.log('\n❌ import_vehicle_from_csv function does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error checking vehicle table:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkVehicleTable().catch(console.error);
