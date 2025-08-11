import { pool } from './src/database/connection.js';

async function setupVoiceSettings() {
  try {
    console.log('🎤 Setting up voice settings for DAIVE...\n');

    // First, check if the table exists
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'daive_voice_settings'
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    
    if (tableCheckResult.rows.length === 0) {
      console.log('📋 Creating daive_voice_settings table...');
      
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
      console.log('✅ Table created successfully');
    } else {
      console.log('✅ Table already exists');
    }

    // Clear existing settings and insert new ones
    console.log('🗑️ Clearing existing voice settings...');
    await pool.query('DELETE FROM daive_voice_settings');
    
    // Insert default voice settings
    console.log('💾 Inserting default voice settings...');
    
    const insertQuery = `
      INSERT INTO daive_voice_settings (
        dealer_id, enabled, language, voice_speed, voice_pitch, 
        voice_provider, speech_provider, tts_provider, 
        openai_voice, elevenlabs_voice, auto_voice_response,
        voice_quality, voice_emotion, recording_quality
      ) VALUES 
      (NULL, true, 'en-US', 1.0, 1.0, 'openai', 'whisper', 'openai', 'alloy', 'jessica', true, 'hd', 'friendly', 'high'),
      (NULL, true, 'en-US', 1.0, 1.0, 'elevenlabs', 'whisper', 'elevenlabs', 'alloy', 'jessica', true, 'hd', 'friendly', 'high')
    `;
    
    await pool.query(insertQuery);
    console.log('✅ Default voice settings inserted');

    // Verify the settings
    console.log('\n🔍 Verifying voice settings...');
    
    const verifyQuery = `
      SELECT * FROM daive_voice_settings 
      ORDER BY id
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    
    console.log('\n📊 Current voice settings:');
    verifyResult.rows.forEach((setting, index) => {
      console.log(`\n--- Setting ${index + 1} ---`);
      console.log(`ID: ${setting.id}`);
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

    console.log('\n🎯 Voice Configuration Complete!');
    console.log('✅ Voice is ENABLED by default');
    console.log('✅ TTS Provider: OpenAI (tts-1-hd model)');
    console.log('✅ Voice: Alloy (clear, professional)');
    console.log('✅ Auto Voice Response: ENABLED');
    console.log('✅ Quality: HD');
    console.log('✅ Language: English (US)');
    
    console.log('\n💡 Next steps:');
    console.log('1. Go to DAIVE Settings → Voice Settings');
    console.log('2. Verify "Enable Voice Responses" is ON');
    console.log('3. Ensure "Auto Voice Response" is ON');
    console.log('4. Go to API Keys tab and set your OpenAI API key');
    console.log('5. Test voice using the "Test Voice" button');
    console.log('6. Save all settings');

  } catch (error) {
    console.error('❌ Error setting up voice settings:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupVoiceSettings(); 