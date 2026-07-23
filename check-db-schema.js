// Check Database Schema
// Shows the actual column names and types in the vehicles table

import { pool } from './src/database/connection.js';

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema for vehicles table...\n');
  
  try {
    // Check table structure
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Vehicles Table Schema:');
    console.log('==========================');
    schemaResult.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultValue = row.column_default ? ` (default: ${row.column_default})` : '';
      console.log(`   • ${row.column_name}: ${row.data_type} ${nullable}${defaultValue}`);
    });
    
    console.log(`\n📈 Total columns: ${schemaResult.rows.length}`);
    
    // Check sample data
    console.log('\n🔍 Sample Data Structure:');
    console.log('==========================');
    const sampleResult = await pool.query('SELECT * FROM vehicles LIMIT 1');
    
    if (sampleResult.rows.length > 0) {
      const sample = sampleResult.rows[0];
      console.log('Sample vehicle record:');
      Object.entries(sample).forEach(([key, value]) => {
        const truncatedValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`   • ${key}: ${truncatedValue}`);
      });
    }
    
    // Check specific fields we need
    console.log('\n🎯 Checking Required Fields:');
    console.log('============================');
    const requiredFields = ['body_style', 'price', 'features', 'color', 'exterior_color', 'odometer', 'mileage'];
    
    for (const field of requiredFields) {
      try {
        const fieldCheck = await pool.query(`SELECT ${field} FROM vehicles LIMIT 1`);
        console.log(`   ✅ ${field}: EXISTS`);
      } catch (error) {
        console.log(`   ❌ ${field}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkDatabaseSchema().then(() => {
  console.log('\n🎉 Database schema check completed!');
}).catch(error => {
  console.error('\n💥 Schema check failed:', error);
}); 