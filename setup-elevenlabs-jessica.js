import { pool } from './src/database/connection.js';

async function setupElevenLabsJessica() {
  try {
    console.log('🎤 Setting up ElevenLabs with Jessica voice...\n');
    
    // ElevenLabs Jessica voice configuration
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
    
    console.log('📝 Configuring ElevenLabs Jessica voice settings...');
    
    for (const setting of elevenLabsSettings) {
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
    
    // Also update for specific dealer
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    for (const setting of elevenLabsSettings) {
      const dealerQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET setting_value = $3, updated_at = NOW()
        RETURNING *
      `;
      
      await pool.query(dealerQuery, [dealerId, setting.type, setting.value]);
      console.log(`✅ Updated dealer ${setting.type}: ${setting.value}`);
    }
    
    console.log('\n✅ ElevenLabs Jessica Voice Configuration Complete!');
    console.log('🎤 Voice Provider: ElevenLabs');
    console.log('🎤 Voice: Jessica');
    console.log('🎤 Speech Recognition: Whisper');
    console.log('🎤 Real-time: Enabled');
    console.log('🎤 Streaming: Enabled');
    
    console.log('\n💡 ElevenLabs Jessica Voice Features:');
    console.log('- Natural, human-like voice');
    console.log('- Professional and friendly tone');
    console.log('- High-quality speech synthesis');
    console.log('- Context-aware conversations');
    console.log('- Optimized for customer service');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Make sure you have a valid ElevenLabs API key');
    console.log('2. Add your ElevenLabs API key in DAIVE Settings');
    console.log('3. Restart your application server');
    console.log('4. Test voice conversation with Jessica voice');
    console.log('5. The system will now use ElevenLabs Jessica for TTS');
    
  } catch (error) {
    console.error('❌ Error setting up ElevenLabs Jessica voice:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupElevenLabsJessica().catch(console.error); 