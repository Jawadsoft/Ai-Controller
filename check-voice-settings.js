import { pool } from './src/database/connection.js';

async function checkVoiceSettings() {
  try {
    console.log('🔍 Checking current voice settings in database...\n');
    
    // Check voice settings table
    const voiceSettingsQuery = `
      SELECT * FROM daive_voice_settings 
      ORDER BY dealer_id NULLS FIRST, created_at DESC
    `;
    
    const voiceSettingsResult = await pool.query(voiceSettingsQuery);
    
    if (voiceSettingsResult.rows.length === 0) {
      console.log('❌ No voice settings found in database');
      console.log('Creating default voice settings...\n');
      
      // Create default voice settings
      const insertQuery = `
        INSERT INTO daive_voice_settings (
          dealer_id, enabled, language, voice_speed, voice_pitch, 
          voice_provider, speech_provider, tts_provider, 
          openai_voice, elevenlabs_voice, auto_voice_response,
          voice_quality, voice_emotion, recording_quality
        ) VALUES (
          NULL, true, 'en-US', 1.0, 1.0, 
          'openai', 'whisper', 'openai', 
          'alloy', 'jessica', true,
          'hd', 'friendly', 'high'
        )
      `;
      
      await pool.query(insertQuery);
      console.log('✅ Default voice settings created');
    } else {
      console.log('📊 Current voice settings:');
      voiceSettingsResult.rows.forEach((setting, index) => {
        console.log(`\n--- Setting ${index + 1} ---`);
        console.log(`Dealer ID: ${setting.dealer_id || 'Global'}`);
        console.log(`Enabled: ${setting.enabled}`);
        console.log(`Language: ${setting.language}`);
        console.log(`Voice Provider: ${setting.voice_provider}`);
        console.log(`TTS Provider: ${setting.tts_provider}`);
        console.log(`OpenAI Voice: ${setting.openai_voice}`);
        console.log(`ElevenLabs Voice: ${setting.elevenlabs_voice}`);
        console.log(`Auto Voice Response: ${setting.auto_voice_response}`);
        console.log(`Voice Quality: ${setting.voice_quality}`);
        console.log(`Voice Emotion: ${setting.voice_emotion}`);
        console.log(`Recording Quality: ${setting.recording_quality}`);
      });
    }
    
    // Check API keys
    console.log('\n🔑 Checking API keys...\n');
    
    const apiKeysQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      ORDER BY dealer_id NULLS FIRST, setting_type
    `;
    
    const apiKeysResult = await pool.query(apiKeysQuery);
    
    if (apiKeysResult.rows.length === 0) {
      console.log('❌ No API keys found');
    } else {
      console.log('📋 Available API keys:');
      apiKeysResult.rows.forEach(key => {
        const maskedValue = key.setting_value ? 
          key.setting_value.substring(0, 8) + '...' + key.setting_value.substring(key.setting_value.length - 4) : 
          'Not set';
        console.log(`${key.setting_type}: ${maskedValue} (Dealer: ${key.dealer_id || 'Global'})`);
      });
    }

    // Check if voice settings table exists
    console.log('\n🏗️ Checking database structure...\n');
    
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'daive_voice_settings'
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    
    if (tableCheckResult.rows.length === 0) {
      console.log('❌ daive_voice_settings table does not exist');
      console.log('Creating table...\n');
      
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS daive_voice_settings (
          id SERIAL PRIMARY KEY,
          dealer_id UUID,
          enabled BOOLEAN DEFAULT true,
          language VARCHAR(10) DEFAULT 'en-US',
          voice_speed DECIMAL(3,2) DEFAULT 1.0,
          voice_pitch DECIMAL(3,2) DEFAULT 1.0,
          voice_provider VARCHAR(50) DEFAULT 'openai',
          speech_provider VARCHAR(50) DEFAULT 'whisper',
          tts_provider VARCHAR(50) DEFAULT 'openai',
          openai_voice VARCHAR(50) DEFAULT 'alloy',
          elevenlabs_voice VARCHAR(50) DEFAULT 'jessica',
          auto_voice_response BOOLEAN DEFAULT true,
          voice_quality VARCHAR(20) DEFAULT 'hd',
          voice_emotion VARCHAR(20) DEFAULT 'friendly',
          recording_quality VARCHAR(20) DEFAULT 'high',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await pool.query(createTableQuery);
      console.log('✅ daive_voice_settings table created');
      
      // Insert default settings
      const insertDefaultQuery = `
        INSERT INTO daive_voice_settings (
          dealer_id, enabled, language, voice_speed, voice_pitch, 
          voice_provider, speech_provider, tts_provider, 
          openai_voice, elevenlabs_voice, auto_voice_response,
          voice_quality, voice_emotion, recording_quality
        ) VALUES (
          NULL, true, 'en-US', 1.0, 1.0, 
          'openai', 'whisper', 'openai', 
          'alloy', 'jessica', true,
          'hd', 'friendly', 'high'
        )
      `;
      
      await pool.query(insertDefaultQuery);
      console.log('✅ Default voice settings inserted');
    } else {
      console.log('✅ daive_voice_settings table exists');
    }

    console.log('\n🎯 Voice Configuration Summary:');
    console.log('1. Voice is ENABLED by default');
    console.log('2. TTS Provider: OpenAI (tts-1-hd model)');
    console.log('3. Voice: Alloy (clear, professional)');
    console.log('4. Auto Voice Response: ENABLED');
    console.log('5. Quality: HD');
    console.log('6. Language: English (US)');
    
    console.log('\n💡 To fix voice issues:');
    console.log('1. Ensure OpenAI API key is set and valid');
    console.log('2. Check that voice settings are saved in DAIVE Settings');
    console.log('3. Verify "Enable Voice Responses" is ON');
    console.log('4. Test voice using the "Test Voice" button');
    
  } catch (error) {
    console.error('❌ Error checking voice settings:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkVoiceSettings(); 