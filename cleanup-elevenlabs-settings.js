import { pool } from './src/database/connection.js';

async function cleanupElevenLabsSettings() {
  try {
    console.log('🧹 Cleaning up ElevenLabs voice settings...\n');
    
    // Delete all existing voice settings to start fresh
    const deleteQueries = [
      'DELETE FROM daive_api_settings WHERE setting_type LIKE \'voice_%\'',
      'DELETE FROM daive_api_settings WHERE setting_type = \'openai_model\'',
      'DELETE FROM daive_api_settings WHERE setting_type = \'openai_key\''
    ];
    
    for (const query of deleteQueries) {
      await pool.query(query);
      console.log(`🗑️  Cleaned up: ${query.split('WHERE ')[1]}`);
    }
    
    // ElevenLabs Jessica voice configuration (clean)
    const elevenLabsSettings = [
      { type: 'voice_provider', value: 'elevenlabs' },
      { type: 'voice_tts_provider', value: 'elevenlabs' },
      { type: 'voice_speech_provider', value: 'whisper' },
      { type: 'voice_enabled', value: 'true' },
      { type: 'voice_elevenlabs_voice', value: 'jessica' },
      { type: 'voice_language', value: 'en-US' },
      { type: 'voice_speed', value: '1.0' },
      { type: 'voice_pitch', value: '1.0' },
      { type: 'voice_realtime_enabled', value: 'true' },
      { type: 'voice_streaming_enabled', value: 'true' },
      { type: 'voice_response_format', value: 'text' }
    ];
    
    console.log('\n📝 Setting up clean ElevenLabs Jessica voice settings...');
    
    // Insert global settings
    for (const setting of elevenLabsSettings) {
      const globalQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
        VALUES (NULL, $1, $2)
        RETURNING *
      `;
      
      await pool.query(globalQuery, [setting.type, setting.value]);
      console.log(`✅ Added global ${setting.type}: ${setting.value}`);
    }
    
    // Insert dealer-specific settings
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    for (const setting of elevenLabsSettings) {
      const dealerQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      await pool.query(dealerQuery, [dealerId, setting.type, setting.value]);
      console.log(`✅ Added dealer ${setting.type}: ${setting.value}`);
    }
    
    console.log('\n✅ ElevenLabs Jessica Voice Settings Cleanup Complete!');
    console.log('🎤 Voice Provider: ElevenLabs');
    console.log('🎤 Voice: Jessica');
    console.log('🎤 Speech Recognition: Whisper');
    console.log('🎤 Real-time: Enabled');
    console.log('🎤 Streaming: Enabled');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Add your ElevenLabs API key in DAIVE Settings');
    console.log('2. Restart your application server');
    console.log('3. Test voice conversation with Jessica voice');
    
  } catch (error) {
    console.error('❌ Error cleaning up ElevenLabs settings:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupElevenLabsSettings().catch(console.error); 