/**
 * Check Body Styles in Vehicle Database
 * This script examines the actual body_style values to create proper mapping
 */

import { pool } from './src/database/connection.js';

console.log('🔍 Checking Body Styles in Vehicle Database...');

async function checkBodyStyles() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Database connected');
    
    // Check all unique body_style values
    console.log('\n1. Unique body_style values:');
    const bodyStyleQuery = `
      SELECT DISTINCT body_style, COUNT(*) as count
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND body_style IS NOT NULL AND body_style != ''
      GROUP BY body_style
      ORDER BY count DESC
    `;
    
    const bodyStyleResult = await client.query(bodyStyleQuery);
    console.log('📊 Body style distribution:');
    bodyStyleResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. "${row.body_style}" - ${row.count} vehicles`);
    });
    
    // Check sample vehicles with their body_style
    console.log('\n2. Sample vehicles with body_style:');
    const sampleQuery = `
      SELECT make, model, body_style, vehicle_type, year, price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND body_style IS NOT NULL AND body_style != ''
      ORDER BY make, model
      LIMIT 20
    `;
    
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((vehicle, index) => {
      console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} - Body: "${vehicle.body_style}" - Type: ${vehicle.vehicle_type || 'NULL'} - $${vehicle.price}`);
    });
    
    // Check current vehicle_type values
    console.log('\n3. Current vehicle_type values:');
    const typeQuery = `
      SELECT DISTINCT vehicle_type, COUNT(*) as count
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND vehicle_type IS NOT NULL AND vehicle_type != ''
      GROUP BY vehicle_type
      ORDER BY count DESC
    `;
    
    const typeResult = await client.query(typeQuery);
    console.log('📊 Vehicle type distribution:');
    typeResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. "${row.vehicle_type}" - ${row.count} vehicles`);
    });
    
  } catch (error) {
    console.error('❌ Error checking body styles:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the check
checkBodyStyles().then(() => {
  console.log('\n🏁 Body style check completed!');
}).catch(error => {
  console.error('❌ Check failed:', error);
});
