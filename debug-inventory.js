// Debug inventory issue - check what vehicles are actually in the database
import { pool } from './src/database/connection.js';

async function debugInventory() {
  try {
    console.log('🔍 Debugging Inventory Issue...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Check what vehicles are actually in the database
    console.log('📊 All Available Vehicles:');
    const allVehicles = await pool.query(`
      SELECT make, model, year, price, color, status
      FROM vehicles 
      WHERE dealer_id = $1 AND status = 'available'
      ORDER BY make, model
    `, [dealerId]);
    
    if (allVehicles.rows.length === 0) {
      console.log('❌ No vehicles found in database');
    } else {
      console.log(`Found ${allVehicles.rows.length} vehicles:`);
      allVehicles.rows.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model} - $${v.price} - ${v.color}`);
      });
    }
    
    // Check specifically for Toyota vehicles
    console.log('\n🚗 Toyota Vehicles Only:');
    const toyotaVehicles = await pool.query(`
      SELECT make, model, year, price, color, status
      FROM vehicles 
      WHERE dealer_id = $1 AND status = 'available' AND LOWER(make) = 'toyota'
      ORDER BY model, year
    `, [dealerId]);
    
    if (toyotaVehicles.rows.length === 0) {
      console.log('❌ No Toyota vehicles found in database');
    } else {
      console.log(`Found ${toyotaVehicles.rows.length} Toyota vehicles:`);
      toyotaVehicles.rows.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model} - $${v.price} - ${v.color}`);
      });
    }
    
    // Check for vehicles in the $25k-$30k range
    console.log('\n💰 Vehicles in $25k-$30k Range:');
    const budgetVehicles = await pool.query(`
      SELECT make, model, year, price, color, status
      FROM vehicles 
      WHERE dealer_id = $1 AND status = 'available' AND price BETWEEN 25000 AND 30000
      ORDER BY price
    `, [dealerId]);
    
    if (budgetVehicles.rows.length === 0) {
      console.log('❌ No vehicles found in $25k-$30k range');
    } else {
      console.log(`Found ${budgetVehicles.rows.length} vehicles in budget range:`);
      budgetVehicles.rows.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model} - $${v.price} - ${v.color}`);
      });
    }
    
    // Check for Toyota vehicles in budget range
    console.log('\n🚗💰 Toyota Vehicles in $25k-$30k Range:');
    const toyotaBudgetVehicles = await pool.query(`
      SELECT make, model, year, price, color, status
      FROM vehicles 
      WHERE dealer_id = $1 AND status = 'available' AND LOWER(make) = 'toyota' AND price BETWEEN 25000 AND 30000
      ORDER BY price
    `, [dealerId]);
    
    if (toyotaBudgetVehicles.rows.length === 0) {
      console.log('❌ No Toyota vehicles found in $25k-$30k range');
    } else {
      console.log(`Found ${toyotaBudgetVehicles.rows.length} Toyota vehicles in budget range:`);
      toyotaBudgetVehicles.rows.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model} - $${v.price} - ${v.color}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging inventory:', error.message);
  } finally {
    await pool.end();
  }
}

debugInventory();
