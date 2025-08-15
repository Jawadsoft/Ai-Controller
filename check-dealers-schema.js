// Check dealers table schema
import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDealersSchema() {
  try {
    console.log('🔍 Checking dealers table schema...\n');
    
    // Check table structure
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'dealers' 
      ORDER BY ordinal_position
    `;
    
    const schemaResult = await pool.query(schemaQuery);
    console.log('📋 Dealers table columns:');
    schemaResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check actual data for the specific dealer
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    const dataQuery = `
      SELECT * FROM dealers WHERE id = $1
    `;
    
    const dataResult = await pool.query(dataQuery, [dealerId]);
    if (dataResult.rows.length > 0) {
      console.log(`\n📊 Actual dealer data for ${dealerId}:`);
      const dealer = dataResult.rows[0];
      Object.keys(dealer).forEach(key => {
        console.log(`  - ${key}: ${dealer[key]}`);
      });
    } else {
      console.log(`\n❌ No dealer found with ID: ${dealerId}`);
    }
    
    console.log('\n✅ Dealers schema check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkDealersSchema(); 