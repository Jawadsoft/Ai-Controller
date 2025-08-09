import { pool } from './src/database/connection.js';

async function setTTSProvider() {
  try {
    console.log('🔧 Setting TTS provider in database...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Check current TTS provider setting
    const checkQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = 'tts_provider'
    `;
    
    const checkResult = await pool.query(checkQuery, [dealerId]);
    
    if (checkResult.rows.length > 0) {
      console.log('📝 Current TTS provider value:', checkResult.rows[0].setting_value);
      
      // Update the TTS provider to deepgram
      const updateQuery = `
        UPDATE daive_api_settings
        SET setting_value = 'deepgram', updated_at = CURRENT_TIMESTAMP
        WHERE dealer_id = $1 AND setting_type = 'tts_provider'
        RETURNING *
      `;
      
      const updateResult = await pool.query(updateQuery, [dealerId]);
      
      if (updateResult.rows.length > 0) {
        console.log('✅ TTS provider updated successfully');
        console.log(`   New value: ${updateResult.rows[0].setting_value}`);
      }
    } else {
      console.log('❌ TTS provider setting not found, creating it...');
      
      const insertQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active)
        VALUES ($1, 'tts_provider', 'deepgram', true)
        RETURNING *
      `;
      
      const insertResult = await pool.query(insertQuery, [dealerId]);
      
      if (insertResult.rows.length > 0) {
        console.log('✅ TTS provider created successfully');
        console.log(`   Value: ${insertResult.rows[0].setting_value}`);
      }
    }
    
    // Verify the fix
    const verifyQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = 'tts_provider'
    `;
    
    const verifyResult = await pool.query(verifyQuery, [dealerId]);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Verification successful:');
      console.log(`   Setting: ${verifyResult.rows[0].setting_type}`);
      console.log(`   Value: ${verifyResult.rows[0].setting_value}`);
      console.log(`   Active: ${verifyResult.rows[0].is_active}`);
    }
    
    // Show all voice-related settings after the change
    console.log('\n📊 All voice-related settings after change:');
    const allSettingsQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND (
        setting_type LIKE '%voice%' OR 
        setting_type LIKE '%speech%' OR 
        setting_type LIKE '%deepgram%' OR 
        setting_type LIKE '%openai%' OR 
        setting_type LIKE '%elevenlabs%' OR
        setting_type LIKE '%tts%'
      )
      ORDER BY setting_type
    `;
    
    const allSettingsResult = await pool.query(allSettingsQuery, [dealerId]);
    
    allSettingsResult.rows.forEach(row => {
      console.log(`   ${row.setting_type}: ${row.setting_value} (${row.is_active ? 'active' : 'inactive'})`);
    });
    
    console.log('\n🎯 TTS configuration should now be set to Deepgram!');
    
  } catch (error) {
    console.error('❌ Error setting TTS provider:', error);
  } finally {
    await pool.end();
  }
}

setTTSProvider(); 