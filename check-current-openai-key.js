import { pool } from './src/database/connection.js';

async function checkCurrentOpenAIKey() {
  try {
    console.log('🔍 Checking current OpenAI key value...\n');
    
    const result = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, updated_at
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' 
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No OpenAI key found for this dealer');
      return;
    }
    
    const row = result.rows[0];
    console.log('📋 Current OpenAI Key Details:');
    console.log('==============================');
    console.log(`Dealer ID: ${row.dealer_id}`);
    console.log(`Key: ${row.setting_value}`);
    console.log(`Last Updated: ${row.updated_at}`);
    console.log('');
    
    // Check if it's the old deactivated key
    if (row.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA')) {
      console.log('⚠️  WARNING: This is the OLD DEACTIVATED key!');
    } else {
      console.log('✅ This appears to be a NEW key');
    }
    
  } catch (error) {
    console.error('❌ Error checking OpenAI key:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentOpenAIKey();
