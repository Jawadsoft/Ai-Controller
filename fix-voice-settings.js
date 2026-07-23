import { pool } from './src/database/connection.js';

async function fixVoiceSettings() {
  try {
    console.log('🔧 Fixing voice settings in database...\n');
    
    // First, let's see what we have
    console.log('📊 Current voice_openai_voice settings:');
    const currentQuery = `
      SELECT setting_type, setting_value, dealer_id, id
      FROM daive_api_settings
      WHERE setting_type = 'voice_openai_voice'
      ORDER BY dealer_id NULLS LAST, id
    `;
    
    const currentResult = await pool.query(currentQuery);
    currentResult.rows.forEach(row => {
      console.log(`- ${row.setting_value} (Dealer ID: ${row.dealer_id || 'NULL (Global)'}, ID: ${row.id})`);
    });
    
    console.log('\n🧹 Cleaning up duplicate voice settings...');
    
    // Delete all existing voice_openai_voice settings
    const deleteQuery = `
      DELETE FROM daive_api_settings
      WHERE setting_type = 'voice_openai_voice'
    `;
    
    const deleteResult = await pool.query(deleteQuery);
    console.log(`✅ Deleted ${deleteResult.rowCount} existing voice_openai_voice settings`);
    
    // Insert the correct setting (global)
    const insertQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES (NULL, 'voice_openai_voice', 'spruce')
      RETURNING *
    `;
    
    const insertResult = await pool.query(insertQuery);
    console.log('✅ Inserted new voice_openai_voice setting: spruce (Global)');
    
    // Also set for the specific dealer
    const dealerInsertQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ('0aa94346-ed1d-420e-8823-bcd97bf6456f', 'voice_openai_voice', 'spruce')
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = 'spruce', updated_at = NOW()
      RETURNING *
    `;
    
    const dealerInsertResult = await pool.query(dealerInsertQuery);
    console.log('✅ Set voice_openai_voice for dealer: spruce');
    
    // Verify the fix
    console.log('\n📊 Updated voice_openai_voice settings:');
    const verifyQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type = 'voice_openai_voice'
      ORDER BY dealer_id NULLS LAST
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    verifyResult.rows.forEach(row => {
      console.log(`- ${row.setting_value} (Dealer ID: ${row.dealer_id || 'NULL (Global)'})`);
    });
    
    // Also ensure other voice settings are correct
    console.log('\n🔧 Ensuring other voice settings are correct...');
    
    const settingsToUpdate = [
      { type: 'voice_enabled', value: 'true' },
      { type: 'voice_provider', value: 'openai' },
      { type: 'voice_tts_provider', value: 'openai' },
      { type: 'voice_speech_provider', value: 'whisper' },
      { type: 'voice_language', value: 'en-US' },
      { type: 'voice_speed', value: '1.0' },
      { type: 'voice_pitch', value: '1.0' }
    ];
    
    for (const setting of settingsToUpdate) {
      // Update global setting
      const globalQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
        VALUES (NULL, $1, $2)
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET setting_value = $2, updated_at = NOW()
        RETURNING *
      `;
      
      await pool.query(globalQuery, [setting.type, setting.value]);
      console.log(`✅ Updated global ${setting.type}: ${setting.value}`);
    }
    
    console.log('\n✅ Voice settings have been fixed!');
    console.log('🎤 OpenAI Voice: spruce');
    console.log('🎤 Voice Provider: openai');
    console.log('🎤 TTS Provider: openai');
    console.log('🎤 Voice Enabled: true');
    
    console.log('\n💡 Next steps:');
    console.log('1. Restart your application server');
    console.log('2. Test the voice functionality');
    console.log('3. The voice should now use "spruce" instead of "alloy"');
    
  } catch (error) {
    console.error('❌ Error fixing voice settings:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixVoiceSettings().catch(console.error); 