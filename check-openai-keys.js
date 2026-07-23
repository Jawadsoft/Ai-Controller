import { pool } from './src/database/connection.js';

async function checkOpenAIKeys() {
  try {
    console.log('🔍 Checking all OpenAI keys in database...\n');
    
    const result = await pool.query(`
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' 
      ORDER BY dealer_id NULLS FIRST
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No OpenAI keys found in database');
      return;
    }
    
    console.log('📋 All OpenAI Keys in Database:');
    console.log('================================');
    
    result.rows.forEach((row, index) => {
      const dealerId = row.dealer_id || 'Global';
      const keyValue = row.setting_value;
      const maskedKey = keyValue.substring(0, 25) + '...';
      
      console.log(`${index + 1}. Dealer: ${dealerId}`);
      console.log(`   Key: ${maskedKey}`);
      console.log('');
    });
    
    // Check if we have any global keys
    const globalKeys = result.rows.filter(row => !row.dealer_id);
    const dealerKeys = result.rows.filter(row => row.dealer_id);
    
    console.log('📊 Summary:');
    console.log(`   Global keys: ${globalKeys.length}`);
    console.log(`   Dealer-specific keys: ${dealerKeys.length}`);
    
  } catch (error) {
    console.error('❌ Error checking OpenAI keys:', error.message);
  } finally {
    await pool.end();
  }
}

checkOpenAIKeys();
