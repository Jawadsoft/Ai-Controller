/**
 * Check Real Inventory Data
 * Shows what's actually in your vehicle database
 */

import { pool } from './src/database/connection.js';

console.log('🔍 Checking Real Inventory Data...');

async function checkRealInventory() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    
    // Check SUV inventory under $35,000
    console.log('\n1. SUVs under $35,000:');
    const suvQuery = `
      SELECT make, model, trim, year, price, status, stock_number
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND (vehicle_type = 'SUV' OR body_style = 'SUV')
      AND price < 35000
      AND status = 'available'
      ORDER BY price ASC
      LIMIT 10
    `;
    
    const suvResult = await client.query(suvQuery);
    console.log(`📊 Found ${suvResult.rows.length} SUVs under $35,000:`);
    
    if (suvResult.rows.length > 0) {
      suvResult.rows.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''} (${vehicle.year})`);
        console.log(`      Price: $${vehicle.price}, Stock: ${vehicle.stock_number || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ No SUVs under $35,000 found');
    }
    
    // Check Toyota RAV4 specifically
    console.log('\n2. Toyota RAV4 availability:');
    const rav4Query = `
      SELECT make, model, trim, year, price, status, stock_number
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND make ILIKE '%toyota%'
      AND model ILIKE '%rav4%'
      ORDER BY year DESC
    `;
    
    const rav4Result = await client.query(rav4Query);
    console.log(`📊 Found ${rav4Result.rows.length} Toyota RAV4 models:`);
    
    if (rav4Result.rows.length > 0) {
      rav4Result.rows.forEach((vehicle, index) => {
        console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''} (${vehicle.year})`);
        console.log(`      Price: $${vehicle.price}, Status: ${vehicle.status}, Stock: ${vehicle.stock_number || 'N/A'}`);
      });
    } else {
      console.log('   ❌ No Toyota RAV4 models found');
    }
    
    // Check vehicle types distribution
    console.log('\n3. Vehicle types distribution:');
    const typeQuery = `
      SELECT 
        COALESCE(vehicle_type, body_style, 'Unknown') as type,
        COUNT(*) as count,
        AVG(price) as avg_price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND status = 'available'
      GROUP BY COALESCE(vehicle_type, body_style, 'Unknown')
      ORDER BY count DESC
    `;
    
    const typeResult = await client.query(typeQuery);
    console.log('📊 Vehicle types in inventory:');
    typeResult.rows.forEach(row => {
      console.log(`   ${row.type}: ${row.count} vehicles, avg price: $${Math.round(row.avg_price || 0)}`);
    });
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error checking inventory:', error);
  }
}

// Run the check
checkRealInventory().then(() => {
  console.log('\n🏁 Inventory check completed!');
}).catch(error => {
  console.error('❌ Check failed:', error);
});
