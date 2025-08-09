import { pool } from './src/database/connection.js';

async function fixOpenAITTSettings() {
  try {
    console.log('🔧 Fixing OpenAI TTS settings in database...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Settings to update
    const settingsToUpdate = [
      { type: 'voice_provider', value: 'openai' },
      { type: 'voice_tts_provider', value: 'openai' },
      { type: 'voice_openai_voice', value: 'alloy' },
      { type: 'voice_enabled', value: 'true' },
      { type: 'voice_speed', value: '1.0' },
      { type: 'voice_pitch', value: '1.0' },
      { type: 'voice_language', value: 'en-US' }
    ];
    
    console.log('📝 Updating voice settings for dealer:', dealerId);
    
    for (const setting of settingsToUpdate) {
      const query = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET setting_value = $3, updated_at = NOW()
        RETURNING *
      `;
      
      const result = await pool.query(query, [dealerId, setting.type, setting.value]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Updated ${setting.type}: ${setting.value}`);
      } else {
        console.log(`❌ Failed to update ${setting.type}`);
      }
    }
    
    // Also update global settings
    console.log('\n📝 Updating global voice settings...');
    
    for (const setting of settingsToUpdate) {
      const query = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
        VALUES (NULL, $1, $2)
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET setting_value = $2, updated_at = NOW()
        RETURNING *
      `;
      
      const result = await pool.query(query, [setting.type, setting.value]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Updated global ${setting.type}: ${setting.value}`);
      } else {
        console.log(`❌ Failed to update global ${setting.type}`);
      }
    }
    
    console.log('\n✅ OpenAI TTS settings have been updated!');
    console.log('🎤 Voice Provider: openai');
    console.log('🎤 TTS Provider: openai');
    console.log('🎤 OpenAI Voice: alloy');
    console.log('🎤 Voice Enabled: true');
    
    console.log('\n💡 Next steps:');
    console.log('1. Restart your application server');
    console.log('2. Go to DAIVE Settings → API Keys');
    console.log('3. Make sure your OpenAI API key is set');
    console.log('4. Test the voice functionality');
    
  } catch (error) {
    console.error('❌ Error fixing OpenAI TTS settings:', error);
  } finally {
    await pool.end();
  }
}

fixOpenAITTSettings(); 