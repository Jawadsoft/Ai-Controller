import { pool } from './src/database/connection.js';

async function checkVoiceSettings() {
  try {
    console.log('🔍 Checking current voice settings in database...\n');
    
    // Check current voice settings
    const query = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type LIKE 'voice_%'
      ORDER BY setting_type
    `;
    
    const result = await pool.query(query);
    
    console.log('📊 Current Voice Settings:');
    console.log('========================');
    
    if (result.rows.length === 0) {
      console.log('❌ No voice settings found in database');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.setting_type}: ${row.setting_value} (Dealer ID: ${row.dealer_id || 'NULL (Global)'})`);
      });
    }
    
    // Check API keys
    console.log('\n🔑 API Keys:');
    console.log('============');
    
    const apiQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      ORDER BY setting_type
    `;
    
    const apiResult = await pool.query(apiQuery);
    
    if (apiResult.rows.length === 0) {
      console.log('❌ No API keys found in database');
    } else {
      apiResult.rows.forEach(row => {
        const maskedValue = row.setting_value ? 
          row.setting_value.substring(0, 10) + '...' + row.setting_value.substring(row.setting_value.length - 4) : 
          'NOT SET';
        console.log(`${row.setting_type}: ${maskedValue} (Dealer ID: ${row.dealer_id || 'NULL (Global)'})`);
      });
    }
    
    console.log('\n💡 To enable OpenAI TTS:');
    console.log('1. Go to DAIVE Settings → API Keys');
    console.log('2. Enter your OpenAI API key');
    console.log('3. Go to Voice Settings');
    console.log('4. Select "OpenAI TTS (tts-1-hd)" from Voice Provider');
    console.log('5. Choose a voice (Alloy, Echo, Fable, Onyx, Nova, Shimmer)');
    console.log('6. Click Save Voice Settings');
    
  } catch (error) {
    console.error('❌ Error checking voice settings:', error);
  } finally {
    await pool.end();
  }
}

checkVoiceSettings(); 