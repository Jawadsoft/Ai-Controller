/**
 * Verify Vehicle Mapping and AI Bot Fields
 * Ensures all vehicles have proper trim and type data for AI communication
 */

import { pool } from './src/database/connection.js';

console.log('🔍 Verifying Vehicle Mapping for AI Bot...');

async function verifyVehicleMapping() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Database connected');
    
    // Check the complete mapping status
    console.log('\n1. Complete Vehicle Mapping Status:');
    const mappingQuery = `
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN trim IS NOT NULL AND trim != '' THEN 1 END) as has_trim,
        COUNT(CASE WHEN vehicle_type IS NOT NULL AND vehicle_type != '' THEN 1 END) as has_type,
        COUNT(CASE WHEN body_style IS NOT NULL AND body_style != '' THEN 1 END) as has_body_style,
        COUNT(CASE WHEN (trim IS NOT NULL AND trim != '') AND (vehicle_type IS NOT NULL AND vehicle_type != '') THEN 1 END) as complete_data
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const mappingResult = await client.query(mappingQuery);
    const mappingStats = mappingResult.rows[0];
    
    console.log(`📊 Mapping Statistics:`);
    console.log(`   Total vehicles: ${mappingStats.total_vehicles}`);
    console.log(`   Has trim: ${mappingStats.has_trim}`);
    console.log(`   Has type: ${mappingStats.has_type}`);
    console.log(`   Has body_style: ${mappingStats.has_body_style}`);
    console.log(`   Complete data: ${mappingStats.complete_data}`);
    
    // Check vehicle type distribution
    console.log('\n2. Vehicle Type Distribution:');
    const typeQuery = `
      SELECT vehicle_type, COUNT(*) as count
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND vehicle_type IS NOT NULL AND vehicle_type != ''
      GROUP BY vehicle_type
      ORDER BY count DESC
    `;
    
    const typeResult = await client.query(typeQuery);
    typeResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.vehicle_type}: ${row.count} vehicles`);
    });
    
    // Check body_style to vehicle_type mapping
    console.log('\n3. Body Style to Vehicle Type Mapping:');
    const mappingCheckQuery = `
      SELECT body_style, vehicle_type, COUNT(*) as count
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND body_style IS NOT NULL AND body_style != ''
      AND vehicle_type IS NOT NULL AND vehicle_type != ''
      GROUP BY body_style, vehicle_type
      ORDER BY body_style, vehicle_type
    `;
    
    const mappingCheckResult = await client.query(mappingCheckQuery);
    mappingCheckResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. "${row.body_style}" → ${row.vehicle_type} (${row.count} vehicles)`);
    });
    
    // Check sample vehicles with complete data
    console.log('\n4. Sample Vehicles with Complete Data:');
    const sampleQuery = `
      SELECT make, model, trim, vehicle_type, body_style, year, price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND trim IS NOT NULL AND trim != ''
      AND vehicle_type IS NOT NULL AND vehicle_type != ''
      AND body_style IS NOT NULL AND body_style != ''
      ORDER BY make, model, price DESC
      LIMIT 15
    `;
    
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach((vehicle, index) => {
      console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} ${vehicle.trim} - ${vehicle.vehicle_type} - "${vehicle.body_style}" - $${vehicle.price}`);
    });
    
    // Check for any remaining issues
    console.log('\n5. Checking for Remaining Issues:');
    const issuesQuery = `
      SELECT 
        COUNT(CASE WHEN trim IS NULL OR trim = '' THEN 1 END) as missing_trim,
        COUNT(CASE WHEN vehicle_type IS NULL OR vehicle_type = '' THEN 1 END) as missing_type,
        COUNT(CASE WHEN body_style IS NULL OR body_style = '' THEN 1 END) as missing_body_style,
        COUNT(CASE WHEN price IS NULL OR price = 0 THEN 1 END) as missing_price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const issuesResult = await client.query(issuesQuery);
    const issues = issuesResult.rows[0];
    
    if (issues.missing_trim > 0 || issues.missing_type > 0 || issues.missing_body_style > 0) {
      console.log(`⚠️  Issues found:`);
      if (issues.missing_trim > 0) console.log(`   Missing trim: ${issues.missing_trim} vehicles`);
      if (issues.missing_type > 0) console.log(`   Missing type: ${issues.missing_type} vehicles`);
      if (issues.missing_body_style > 0) console.log(`   Missing body_style: ${issues.missing_body_style} vehicles`);
      if (issues.missing_price > 0) console.log(`   Missing price: ${issues.missing_price} vehicles`);
    } else {
      console.log(`✅ No data issues found!`);
    }
    
    // AI Bot Field Requirements Check
    console.log('\n6. AI Bot Field Requirements Check:');
    const aiFieldsQuery = `
      SELECT 
        COUNT(CASE WHEN 
          make IS NOT NULL AND make != '' AND
          model IS NOT NULL AND model != '' AND
          trim IS NOT NULL AND trim != '' AND
          vehicle_type IS NOT NULL AND vehicle_type != '' AND
          year IS NOT NULL AND
          price IS NOT NULL AND price > 0 AND
          status IS NOT NULL AND status != ''
        THEN 1 END) as ai_ready_vehicles
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const aiFieldsResult = await client.query(aiFieldsQuery);
    const aiReady = aiFieldsResult.rows[0].ai_ready_vehicles;
    
    console.log(`🚗 AI Bot Ready Vehicles: ${aiReady} out of ${mappingStats.total_vehicles}`);
    
    if (aiReady === mappingStats.total_vehicles) {
      console.log(`✅ 100% of vehicles are AI bot ready!`);
    } else {
      console.log(`⚠️  ${mappingStats.total_vehicles - aiReady} vehicles need attention for AI bot functionality`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying vehicle mapping:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the verification
verifyVehicleMapping().then(() => {
  console.log('\n🏁 Vehicle mapping verification completed!');
}).catch(error => {
  console.error('❌ Verification failed:', error);
});
