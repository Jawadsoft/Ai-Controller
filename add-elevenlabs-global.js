import { pool } from './src/database/connection.js';

async function addElevenLabsGlobal() {
  try {
    console.log('🔑 Adding ElevenLabs API key to global settings...\n');
    
    // First, get the existing ElevenLabs key from dealer settings
    const getKeyQuery = `
      SELECT setting_value 
      FROM daive_api_settings 
      WHERE setting_type = 'elevenlabs_key' AND is_active = true
      LIMIT 1
    `;
    
    const keyResult = await pool.query(getKeyQuery);
    if (keyResult.rows.length === 0) {
      console.log('❌ No ElevenLabs API key found in dealer settings');
      return;
    }
    
    const elevenLabsKey = keyResult.rows[0].setting_value;
    console.log('✅ Found ElevenLabs API key in dealer settings');
    
    // Check if global ElevenLabs key already exists
    const checkGlobalQuery = `
      SELECT setting_value, is_active
      FROM daive_api_settings 
      WHERE setting_type = 'elevenlabs_key' AND dealer_id IS NULL
    `;
    
    const globalResult = await pool.query(checkGlobalQuery);
    
    if (globalResult.rows.length > 0) {
      // Update existing global key
      const updateQuery = `
        UPDATE daive_api_settings 
        SET setting_value = $1, is_active = true, updated_at = NOW()
        WHERE setting_type = 'elevenlabs_key' AND dealer_id IS NULL
      `;
      
      await pool.query(updateQuery, [elevenLabsKey]);
      console.log('✅ Updated existing global ElevenLabs API key');
    } else {
      // Insert new global key
      const insertQuery = `
        INSERT INTO daive_api_settings 
        (dealer_id, setting_type, setting_value, is_active, created_at, updated_at)
        VALUES (NULL, 'elevenlabs_key', $1, true, NOW(), NOW())
      `;
      
      await pool.query(insertQuery, [elevenLabsKey]);
      console.log('✅ Added new global ElevenLabs API key');
    }
    
    // Verify the global key is now set
    const verifyQuery = `
      SELECT setting_value, is_active
      FROM daive_api_settings 
      WHERE setting_type = 'elevenlabs_key' AND dealer_id IS NULL
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    if (verifyResult.rows.length > 0) {
      console.log('✅ Global ElevenLabs API key verified:');
      console.log(`   Key: ${verifyResult.rows[0].setting_value ? '🔑 Set' : '❌ Empty'}`);
      console.log(`   Active: ${verifyResult.rows[0].is_active ? '✅ Yes' : '❌ No'}`);
    }
    
    console.log('\n🎉 ElevenLabs API key added to global settings!');
    console.log('🎤 Now Liam voice should work even without a dealer ID');
    
  } catch (error) {
    console.error('❌ Error adding ElevenLabs global key:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
addElevenLabsGlobal();
