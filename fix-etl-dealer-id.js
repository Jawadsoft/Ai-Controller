// Fix the dealer ID in existing ETL configuration
import { query } from './src/database/connection.js';

async function fixETLDealerId() {
  try {
    console.log('🔧 Fixing ETL dealer ID...');
    
    // Get the current ETL config
    const currentConfig = await query('SELECT * FROM etl_export_configs');
    console.log('Current ETL configs:', currentConfig.rows);
    
    // The correct user ID for dealer1@example.com
    const correctUserId = '2e00a324-5931-4377-aef1-9ee9362e11a6';
    
    // Update the dealer_id to use the user ID instead of dealer record ID
    await query('UPDATE etl_export_configs SET dealer_id = $1 WHERE dealer_id = $2', [
      correctUserId,
      '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    ]);
    
    console.log('✅ Updated ETL config dealer_id to user ID');
    
    // Verify the change
    const updatedConfig = await query('SELECT * FROM etl_export_configs');
    console.log('Updated ETL configs:', updatedConfig.rows);
    
  } catch (error) {
    console.error('❌ Error fixing ETL dealer ID:', error);
  }
}

fixETLDealerId(); 