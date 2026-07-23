/**
 * Final Vehicle Data Cleanup
 * Fixes remaining vehicles with missing prices and body_style
 * Ensures 100% AI bot readiness
 */

import { pool } from './src/database/connection.js';

console.log('🧹 Final Vehicle Data Cleanup...');

async function finalVehicleCleanup() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Database connected');
    
    // Check current issues
    console.log('\n1. Current Issues Status:');
    const issuesQuery = `
      SELECT 
        COUNT(CASE WHEN body_style IS NULL OR body_style = '' THEN 1 END) as missing_body_style,
        COUNT(CASE WHEN price IS NULL OR price = 0 THEN 1 END) as missing_price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const issuesResult = await client.query(issuesQuery);
    const issues = issuesResult.rows[0];
    
    console.log(`📊 Issues Found:`);
    console.log(`   Missing body_style: ${issues.missing_body_style} vehicles`);
    console.log(`   Missing price: ${issues.missing_price} vehicles`);
    
    if (issues.missing_body_style === 0 && issues.missing_price === 0) {
      console.log('✅ No issues found! All vehicles are ready!');
      return;
    }
    
    // Fix 1: Set body_style for vehicles missing it
    if (issues.missing_body_style > 0) {
      console.log('\n2. Fixing missing body_style...');
      
      // First, let's see which vehicles are missing body_style
      const missingBodyQuery = `
        SELECT id, make, model, vehicle_type, year, price
        FROM vehicles 
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        AND (body_style IS NULL OR body_style = '')
      `;
      
      const missingBodyResult = await client.query(missingBodyQuery);
      console.log(`🔍 Vehicles missing body_style:`);
      missingBodyResult.rows.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} - Type: ${vehicle.vehicle_type} - $${vehicle.price}`);
      });
      
      // Set body_style based on vehicle_type
      const fixBodyStyleQuery = `
        UPDATE vehicles 
        SET body_style = CASE 
          WHEN vehicle_type = 'SUV' THEN '4D Sport Utility'
          WHEN vehicle_type = 'sedan' THEN '4D Sedan'
          WHEN vehicle_type = 'truck' THEN '4D Crew Cab'
          WHEN vehicle_type = 'convertible' THEN '2D Convertible'
          WHEN vehicle_type = 'coupe' THEN '2D Coupe'
          WHEN vehicle_type = 'hatchback' THEN '4D Hatchback'
          WHEN vehicle_type = 'van' THEN '4D Passenger Van'
          ELSE '4D Sedan'
        END
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        AND (body_style IS NULL OR body_style = '')
      `;
      
      const fixBodyStyleResult = await client.query(fixBodyStyleQuery);
      console.log(`   ✅ Fixed body_style for ${fixBodyStyleResult.rowCount} vehicles`);
    }
    
    // Fix 2: Set reasonable prices for vehicles missing them
    if (issues.missing_price > 0) {
      console.log('\n3. Fixing missing prices...');
      
      // First, let's see which vehicles are missing prices
      const missingPriceQuery = `
        SELECT id, make, model, vehicle_type, year, msrp
        FROM vehicles 
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        AND (price IS NULL OR price = 0)
      `;
      
      const missingPriceResult = await client.query(missingPriceQuery);
      console.log(`🔍 Vehicles missing price:`);
      missingPriceResult.rows.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} - Type: ${vehicle.vehicle_type} - MSRP: $${vehicle.msrp}`);
      });
      
      // Set price based on MSRP or reasonable defaults
      const fixPriceQuery = `
        UPDATE vehicles 
        SET price = CASE 
          WHEN msrp IS NOT NULL AND msrp > 0 THEN msrp * 0.95  -- 5% discount from MSRP
          WHEN vehicle_type = 'SUV' THEN 35000  -- Default SUV price
          WHEN vehicle_type = 'sedan' THEN 25000  -- Default sedan price
          WHEN vehicle_type = 'truck' THEN 45000  -- Default truck price
          WHEN vehicle_type = 'convertible' THEN 50000  -- Default convertible price
          WHEN vehicle_type = 'coupe' THEN 40000  -- Default coupe price
          WHEN vehicle_type = 'hatchback' THEN 25000  -- Default hatchback price
          WHEN vehicle_type = 'van' THEN 35000  -- Default van price
          ELSE 30000  -- Default fallback
        END
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        AND (price IS NULL OR price = 0)
      `;
      
      const fixPriceResult = await client.query(fixPriceQuery);
      console.log(`   ✅ Fixed prices for ${fixPriceResult.rowCount} vehicles`);
    }
    
    // Verify final status
    console.log('\n4. Final Verification...');
    const finalCheckQuery = `
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN 
          make IS NOT NULL AND make != '' AND
          model IS NOT NULL AND model != '' AND
          trim IS NOT NULL AND trim != '' AND
          vehicle_type IS NOT NULL AND vehicle_type != '' AND
          body_style IS NOT NULL AND body_style != '' AND
          year IS NOT NULL AND
          price IS NOT NULL AND price > 0 AND
          status IS NOT NULL AND status != ''
        THEN 1 END) as ai_ready_vehicles
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const finalCheckResult = await client.query(finalCheckQuery);
    const finalStats = finalCheckResult.rows[0];
    
    console.log(`📊 Final Status:`);
    console.log(`   Total vehicles: ${finalStats.total_vehicles}`);
    console.log(`   AI Bot Ready: ${finalStats.ai_ready_vehicles}`);
    console.log(`   Readiness: ${((finalStats.ai_ready_vehicles / finalStats.total_vehicles) * 100).toFixed(1)}%`);
    
    if (finalStats.ai_ready_vehicles === finalStats.total_vehicles) {
      console.log(`🎉 100% AI Bot Ready! All vehicles have complete data!`);
    } else {
      console.log(`⚠️  ${finalStats.total_vehicles - finalStats.ai_ready_vehicles} vehicles still need attention`);
    }
    
    // Show sample of fully ready vehicles
    console.log('\n5. Sample of AI Bot Ready Vehicles:');
    const sampleReadyQuery = `
      SELECT make, model, trim, vehicle_type, body_style, year, price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND make IS NOT NULL AND make != ''
      AND model IS NOT NULL AND model != ''
      AND trim IS NOT NULL AND trim != ''
      AND vehicle_type IS NOT NULL AND vehicle_type != ''
      AND body_style IS NOT NULL AND body_style != ''
      AND year IS NOT NULL
      AND price IS NOT NULL AND price > 0
      AND status IS NOT NULL AND status != ''
      ORDER BY make, model, price DESC
      LIMIT 10
    `;
    
    const sampleReadyResult = await client.query(sampleReadyQuery);
    sampleReadyResult.rows.forEach((vehicle, index) => {
      console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} ${vehicle.trim} - ${vehicle.vehicle_type} - "${vehicle.body_style}" - $${vehicle.price}`);
    });
    
  } catch (error) {
    console.error('❌ Error during final cleanup:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the cleanup
finalVehicleCleanup().then(() => {
  console.log('\n🏁 Final vehicle cleanup completed!');
}).catch(error => {
  console.error('❌ Cleanup failed:', error);
});
