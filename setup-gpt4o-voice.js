import { pool } from './src/database/connection.js';

async function setupGPT4oVoice() {
  try {
    console.log('🚀 Setting up GPT-4o Real-time Voice...\n');
    
    // GPT-4o voice configuration settings
    const gpt4oSettings = [
      { type: 'voice_provider', value: 'openai' },
      { type: 'voice_tts_provider', value: 'openai' },
      { type: 'voice_speech_provider', value: 'whisper' },
      { type: 'voice_enabled', value: 'true' },
      { type: 'voice_openai_voice', value: 'nova' },
      { type: 'voice_language', value: 'en-US' },
      { type: 'voice_speed', value: '1.0' },
      { type: 'voice_pitch', value: '1.0' },
      // GPT-4o specific settings
      { type: 'openai_model', value: 'gpt-4o' },
      { type: 'voice_realtime_enabled', value: 'true' },
      { type: 'voice_streaming_enabled', value: 'true' },
      { type: 'voice_response_format', value: 'text' }
    ];
    
    console.log('📝 Configuring GPT-4o voice settings...');
    
    for (const setting of gpt4oSettings) {
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
    
    console.log('\n✅ GPT-4o Real-time Voice Configuration Complete!');
    console.log('🎤 Model: GPT-4o');
    console.log('🎤 Voice Provider: OpenAI');
    console.log('🎤 Speech Recognition: Whisper');
    console.log('🎤 Real-time: Enabled');
    console.log('🎤 Streaming: Enabled');
    
    console.log('\n💡 GPT-4o Voice Features:');
    console.log('- Real-time voice conversation');
    console.log('- Low latency responses');
    console.log('- Natural voice interaction');
    console.log('- Context-aware conversations');
    console.log('- Multi-modal understanding');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Make sure you have a valid OpenAI API key');
    console.log('2. Restart your application server');
    console.log('3. Test real-time voice conversation');
    console.log('4. The system will now use GPT-4o for voice interactions');
    
  } catch (error) {
    console.error('❌ Error setting up GPT-4o voice:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupGPT4oVoice().catch(console.error); 