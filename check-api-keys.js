import { pool } from './src/database/connection.js';

async function checkAPIKeys() {
  try {
    console.log('🔍 Checking current API keys in database...\n');
    
    const result = await pool.query(`
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE setting_type LIKE '%_key' 
      AND setting_value IS NOT NULL 
      ORDER BY dealer_id NULLS FIRST, setting_type
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No API keys found in database');
      return;
    }
    
    console.log('📋 Current API Keys in Database:');
    console.log('================================');
    
    result.rows.forEach((row, index) => {
      const keyType = row.setting_type;
      const keyValue = row.setting_value;
      const dealerId = row.dealer_id || 'Global';
      const maskedKey = keyValue.substring(0, 20) + '...';
      
      console.log(`${index + 1}. ${keyType}:`);
      console.log(`   Value: ${maskedKey}`);
      console.log(`   Dealer: ${dealerId}`);
      console.log('');
    });
    
    // Check if any keys are empty or invalid
    const invalidKeys = result.rows.filter(row => 
      !row.setting_value || row.setting_value.trim() === '' || row.setting_value === 'null'
    );
    
    if (invalidKeys.length > 0) {
      console.log('⚠️  Invalid/Empty Keys Found:');
      invalidKeys.forEach(row => {
        console.log(`   - ${row.setting_type}: "${row.setting_value}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking API keys:', error.message);
  } finally {
    await pool.end();
  }
}

checkAPIKeys(); 