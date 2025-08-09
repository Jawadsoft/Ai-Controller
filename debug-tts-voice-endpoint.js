import { pool } from './src/database/connection.js';

async function debugTTSVoiceEndpoint() {
  try {
    console.log('🔍 Debugging TTS in Voice Endpoint...\n');
    
    // The voice endpoint also needs to be fixed for dealer-specific settings
    // Let's check what dealer ID the logs show
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f'; // From your logs
    
    console.log(`🏢 Testing with dealer ID: ${dealerId}`);
    
    // Test the voice endpoint TTS queries
    console.log('\n📋 Test 1: Voice Endpoint - Voice Enabled Check');
    
    // This is the query pattern used in the voice endpoint (around line 611)
    const voiceEnabledQuery = `
      SELECT setting_value
      FROM daive_api_settings
      WHERE dealer_id IS NULL AND setting_type = 'voice_enabled'
      LIMIT 1
    `;
    
    const voiceResult = await pool.query(voiceEnabledQuery);
    console.log(`   Old query finds: ${voiceResult.rows.length} results`);
    
    if (voiceResult.rows.length === 0) {
      console.log('   ❌ This is the problem! Voice endpoint still uses global queries');
      console.log('   💡 Voice endpoint needs same fix as chat endpoint');
    }
    
    // Test with dealer-specific query
    const newVoiceEnabledQuery = `
      WITH dealer_setting AS (
        SELECT setting_value FROM daive_api_settings 
        WHERE dealer_id = $1 AND setting_type = 'voice_enabled'
      ),
      global_setting AS (
        SELECT setting_value FROM daive_api_settings 
        WHERE dealer_id IS NULL AND setting_type = 'voice_enabled'
      )
      SELECT setting_value FROM dealer_setting
      UNION ALL
      SELECT setting_value FROM global_setting
      WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
      LIMIT 1
    `;
    
    const newVoiceResult = await pool.query(newVoiceEnabledQuery, [dealerId]);
    console.log(`   New query finds: ${newVoiceResult.rows.length} results`);
    
    if (newVoiceResult.rows.length > 0) {
      console.log(`   ✅ voice_enabled: ${newVoiceResult.rows[0].setting_value}`);
      
      if (newVoiceResult.rows[0].setting_value === 'true') {
        console.log('\n🎤 Test 2: Voice Endpoint - TTS Provider Check');
        
        const newTTSProviderQuery = `
          WITH dealer_setting AS (
            SELECT setting_value FROM daive_api_settings 
            WHERE dealer_id = $1 AND setting_type = 'voice_tts_provider'
          ),
          global_setting AS (
            SELECT setting_value FROM daive_api_settings 
            WHERE dealer_id IS NULL AND setting_type = 'voice_tts_provider'
          )
          SELECT setting_value FROM dealer_setting
          UNION ALL
          SELECT setting_value FROM global_setting
          WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
          LIMIT 1
        `;
        
        const ttsResult = await pool.query(newTTSProviderQuery, [dealerId]);
        
        if (ttsResult.rows.length > 0) {
          console.log(`   ✅ TTS Provider: ${ttsResult.rows[0].setting_value}`);
          
          console.log('\n🔑 Test 3: Voice Endpoint - API Key Check');
          const provider = ttsResult.rows[0].setting_value;
          let keyType = provider === 'elevenlabs' ? 'elevenlabs_key' : 
                       provider === 'openai' ? 'openai_key' : 'deepgram_key';
          
          const newKeyQuery = `
            WITH dealer_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id = $1 AND setting_type = $2
            ),
            global_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id IS NULL AND setting_type = $2
            )
            SELECT setting_value FROM dealer_setting
            UNION ALL
            SELECT setting_value FROM global_setting
            WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
            LIMIT 1
          `;
          
          const keyResult = await pool.query(newKeyQuery, [dealerId, keyType]);
          
          if (keyResult.rows.length > 0 && keyResult.rows[0].setting_value) {
            const maskedKey = keyResult.rows[0].setting_value.substring(0, 8) + '...' + 
                            keyResult.rows[0].setting_value.substring(keyResult.rows[0].setting_value.length - 4);
            console.log(`   ✅ ${keyType}: ${maskedKey}`);
            
            console.log('\n🎉 Voice Endpoint TTS Configuration is Available!');
            console.log('   Problem: Voice endpoint still uses old global queries');
            console.log('   Solution: Update voice endpoint queries like we did for chat endpoint');
          }
        }
      }
    }
    
    console.log('\n📝 Summary:');
    console.log('   ✅ Chat endpoint: Fixed to use dealer-specific settings');
    console.log('   ❌ Voice endpoint: Still uses global queries (dealer_id IS NULL)');
    console.log('   💡 Voice endpoint needs the same fixes as chat endpoint');
    
    console.log('\n🔧 Files that need updating:');
    console.log('   - src/routes/daive.js (voice endpoint around lines 611-800)');
    console.log('   - All TTS queries in voice endpoint need dealer-specific pattern');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await pool.end();
  }
}

debugTTSVoiceEndpoint();