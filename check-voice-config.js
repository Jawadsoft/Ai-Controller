import { pool } from './src/database/connection.js';

async function checkVoiceConfiguration() {
  try {
    console.log('🔍 Checking voice configuration...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Check all voice-related settings
    const query = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND (
        setting_type LIKE '%voice%' OR 
        setting_type LIKE '%speech%' OR 
        setting_type LIKE '%deepgram%' OR 
        setting_type LIKE '%openai%' OR 
        setting_type LIKE '%elevenlabs%'
      )
      ORDER BY setting_type
    `;
    
    const result = await pool.query(query, [dealerId]);
    
    console.log(`📊 Found ${result.rows.length} voice-related settings:`);
    console.log('='.repeat(60));
    
    result.rows.forEach(row => {
      console.log(`📝 ${row.setting_type}:`);
      console.log(`   Value: ${row.setting_value}`);
      console.log(`   Active: ${row.is_active}`);
      console.log('');
    });
    
    // Check specific voice configuration
    console.log('🎤 Voice Configuration Analysis:');
    console.log('='.repeat(40));
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_type] = row.setting_value;
    });
    
    // Check speech provider
    if (settings.speech_provider) {
      console.log(`✅ Speech Provider: ${settings.speech_provider}`);
    } else {
      console.log('❌ Speech Provider: Not set');
    }
    
    // Check voice provider
    if (settings.voice_provider) {
      console.log(`✅ Voice Provider: ${settings.voice_provider}`);
    } else {
      console.log('❌ Voice Provider: Not set');
    }
    
    // Check voice enabled
    if (settings.voice_enabled) {
      console.log(`✅ Voice Enabled: ${settings.voice_enabled}`);
    } else {
      console.log('❌ Voice Enabled: Not set');
    }
    
    // Check API keys
    if (settings.deepgram_key) {
      console.log(`✅ Deepgram Key: ${settings.deepgram_key.substring(0, 20)}...`);
    } else {
      console.log('❌ Deepgram Key: Not set');
    }
    
    if (settings.openai_key) {
      console.log(`✅ OpenAI Key: ${settings.openai_key.substring(0, 20)}...`);
    } else {
      console.log('❌ OpenAI Key: Not set');
    }
    
    if (settings.elevenlabs_key) {
      console.log(`✅ ElevenLabs Key: ${settings.elevenlabs_key.substring(0, 20)}...`);
    } else {
      console.log('❌ ElevenLabs Key: Not set');
    }
    
    // Check voice settings
    if (settings.voice_language) {
      console.log(`✅ Voice Language: ${settings.voice_language}`);
    } else {
      console.log('❌ Voice Language: Not set');
    }
    
    if (settings.voice_speed) {
      console.log(`✅ Voice Speed: ${settings.voice_speed}`);
    } else {
      console.log('❌ Voice Speed: Not set');
    }
    
    if (settings.voice_pitch) {
      console.log(`✅ Voice Pitch: ${settings.voice_pitch}`);
    } else {
      console.log('❌ Voice Pitch: Not set');
    }
    
    // Configuration validation
    console.log('\n🔍 Configuration Validation:');
    console.log('='.repeat(40));
    
    let isValid = true;
    
    if (settings.speech_provider === 'deepgram') {
      if (!settings.deepgram_key) {
        console.log('❌ ERROR: Deepgram selected but no API key');
        isValid = false;
      } else {
        console.log('✅ Deepgram configuration is valid');
      }
    } else if (settings.speech_provider === 'whisper') {
      if (!settings.openai_key) {
        console.log('❌ ERROR: Whisper selected but no OpenAI key');
        isValid = false;
      } else {
        console.log('✅ Whisper configuration is valid');
      }
    } else {
      console.log('❌ ERROR: No speech provider configured');
      isValid = false;
    }
    
    if (!settings.elevenlabs_key) {
      console.log('❌ ERROR: No ElevenLabs key for TTS');
      isValid = false;
    } else {
      console.log('✅ ElevenLabs TTS configuration is valid');
    }
    
    if (settings.voice_enabled !== 'true') {
      console.log('❌ ERROR: Voice is not enabled');
      isValid = false;
    } else {
      console.log('✅ Voice is enabled');
    }
    
    console.log(`\n🎯 Overall Configuration: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    if (!isValid) {
      console.log('\n💡 To fix voice recognition:');
      console.log('   1. Ensure speech_provider is set to "deepgram" or "whisper"');
      console.log('   2. Ensure corresponding API key is set');
      console.log('   3. Ensure voice_enabled is set to "true"');
      console.log('   4. Ensure elevenlabs_key is set for TTS');
    }
    
  } catch (error) {
    console.error('❌ Error checking voice configuration:', error);
  } finally {
    await pool.end();
  }
}

checkVoiceConfiguration(); 