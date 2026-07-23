/**
 * Check Vehicle Table Schema
 * Examines the actual structure of the vehicles table
 */

import { pool } from './src/database/connection.js';

console.log('🔍 Checking Vehicle Table Schema...');

async function checkVehicleSchema() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    
    // Check if vehicles table exists
    console.log('\n1. Checking if vehicles table exists...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'vehicles'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Vehicles table does not exist');
      
      // Check what tables exist
      const allTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('📋 Available tables:');
      allTables.rows.forEach(row => console.log(`   - ${row.table_name}`));
      
      client.release();
      return;
    }
    
    console.log('✅ Vehicles table exists');
    
    // Get table structure
    console.log('\n2. Getting vehicles table structure...');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Vehicle table columns:');
    columns.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      console.log(`   ${row.column_name}: ${row.data_type} ${nullable}${defaultVal}`);
    });
    
    // Check sample data
    console.log('\n3. Checking sample data...');
    const sampleData = await client.query('SELECT * FROM vehicles LIMIT 3');
    
    if (sampleData.rows.length === 0) {
      console.log('⚠️ No data in vehicles table');
    } else {
      console.log('📊 Sample data structure:');
      console.log(JSON.stringify(sampleData.rows[0], null, 2));
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

// Run the check
checkVehicleSchema().then(() => {
  console.log('\n🏁 Schema check completed!');
}).catch(error => {
  console.error('❌ Check failed:', error);
});
