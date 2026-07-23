import { pool } from './src/database/connection.js';

async function updateMileageToDecimal() {
  try {
    console.log('🔄 Updating mileage column to support decimal values...\n');
    
    // Check current column type
    const checkQuery = `
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' AND column_name = 'mileage'
    `;
    
    const checkResult = await pool.query(checkQuery);
    console.log('Current mileage column type:', checkResult.rows[0]);
    
    // Update the column type to DECIMAL(10,1)
    const alterQuery = `
      ALTER TABLE vehicles 
      ALTER COLUMN mileage TYPE DECIMAL(10,1) USING mileage::DECIMAL(10,1)
    `;
    
    await pool.query(alterQuery);
    console.log('✅ Successfully updated mileage column to DECIMAL(10,1)');
    
    // Verify the change
    const verifyResult = await pool.query(checkQuery);
    console.log('Updated mileage column type:', verifyResult.rows[0]);
    
    // Test with a sample vehicle
    const testQuery = `
      SELECT id, make, model, mileage, price 
      FROM vehicles 
      LIMIT 3
    `;
    
    const testResult = await pool.query(testQuery);
    console.log('\n📊 Sample vehicles with updated data types:');
    testResult.rows.forEach((vehicle, index) => {
      console.log(`${index + 1}. ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      console.log(`   Mileage: ${vehicle.mileage} (type: ${typeof vehicle.mileage})`);
      console.log(`   Price: ${vehicle.price} (type: ${typeof vehicle.price})`);
      console.log('');
    });
    
    console.log('🎉 Migration completed successfully!');
    console.log('   - Mileage now supports decimal values (e.g., 15000.5)');
    console.log('   - Price already supported decimal values');
    console.log('   - Form inputs now have step="0.1" for mileage and step="0.01" for price');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

updateMileageToDecimal(); 