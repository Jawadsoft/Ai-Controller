import { pool } from './src/database/connection.js';

async function cleanupVoiceSettings() {
  try {
    console.log('🧹 Cleaning up conflicting voice settings...\n');
    
    // Remove old ElevenLabs settings that conflict with OpenAI
    const settingsToRemove = [
      { type: 'voice_provider', value: 'elevenlabs' },
      { type: 'voice_tts_provider', value: 'elevenlabs' }
    ];
    
    console.log('🗑️ Removing old ElevenLabs settings...');
    
    for (const setting of settingsToRemove) {
      // Remove global settings
      const globalQuery = `
        DELETE FROM daive_api_settings
        WHERE dealer_id IS NULL AND setting_type = $1 AND setting_value = $2
      `;
      
      const globalResult = await pool.query(globalQuery, [setting.type, setting.value]);
      console.log(`✅ Removed global ${setting.type}: ${setting.value} (${globalResult.rowCount} rows)`);
      
      // Remove dealer-specific settings
      const dealerQuery = `
        DELETE FROM daive_api_settings
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f' AND setting_type = $1 AND setting_value = $2
      `;
      
      const dealerResult = await pool.query(dealerQuery, [setting.type, setting.value]);
      console.log(`✅ Removed dealer ${setting.type}: ${setting.value} (${dealerResult.rowCount} rows)`);
    }
    
    // Remove duplicate settings
    console.log('\n🗑️ Removing duplicate settings...');
    
    const duplicateQuery = `
      DELETE FROM daive_api_settings a
      WHERE a.id NOT IN (
        SELECT MIN(id)
        FROM daive_api_settings
        WHERE dealer_id = a.dealer_id AND setting_type = a.setting_type
        GROUP BY dealer_id, setting_type
      )
    `;
    
    const duplicateResult = await pool.query(duplicateQuery);
    console.log(`✅ Removed ${duplicateResult.rowCount} duplicate settings`);
    
    console.log('\n✅ Voice settings cleanup completed!');
    console.log('🎤 Now only OpenAI TTS settings should remain');
    
  } catch (error) {
    console.error('❌ Error cleaning up voice settings:', error);
  } finally {
    await pool.end();
  }
}

cleanupVoiceSettings(); 