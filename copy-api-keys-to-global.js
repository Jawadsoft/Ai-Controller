import { pool } from './src/database/connection.js';

console.log('🔑 Copying API keys to global settings...');

const copyApiKeysToGlobal = async () => {
  try {
    // Get the dealer ID that has the API keys
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Get all API keys from this dealer
    const keysResult = await pool.query(`
      SELECT setting_type, setting_value 
      FROM daive_api_settings 
      WHERE dealer_id = $1 AND setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
    `, [dealerId]);
    
    console.log(`📊 Found ${keysResult.rows.length} API keys for dealer ${dealerId}`);
    
    // Copy each key to global settings
    for (const key of keysResult.rows) {
      // Check if global key already exists
      const checkResult = await pool.query(`
        SELECT id FROM daive_api_settings 
        WHERE dealer_id IS NULL AND setting_type = $1
      `, [key.setting_type]);
      
      if (checkResult.rows.length === 0) {
        // Insert global key
        await pool.query(`
          INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, created_at)
          VALUES (NULL, $1, $2, NOW())
        `, [key.setting_type, key.setting_value]);
        console.log(`✅ Created global ${key.setting_type}`);
      } else {
        // Update global key
        await pool.query(`
          UPDATE daive_api_settings 
          SET setting_value = $2, updated_at = NOW()
          WHERE dealer_id IS NULL AND setting_type = $1
        `, [key.setting_type, key.setting_value]);
        console.log(`✅ Updated global ${key.setting_type}`);
      }
    }
    
    console.log('\n🎉 API keys copied to global settings successfully!');
    console.log('💡 Voice responses should now work for all users.');
    
  } catch (error) {
    console.error('❌ Error copying API keys:', error);
  } finally {
    await pool.end();
  }
};

copyApiKeysToGlobal(); 