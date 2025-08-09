import { pool } from './src/database/connection.js';

async function checkDealerApiSettings() {
  try {
    console.log('Checking API settings for dealer1@example.com...\n');
    
    // Get dealer ID
    const dealerResult = await pool.query(
      'SELECT id FROM dealers WHERE email = $1',
      ['dealer1@example.com']
    );
    
    if (dealerResult.rows.length === 0) {
      console.log('❌ Dealer not found: dealer1@example.com');
      return;
    }
    
    const dealerId = dealerResult.rows[0].id;
    console.log(`✅ Dealer found with ID: ${dealerId}`);
    
    // Get API settings
    const settingsResult = await pool.query(
      'SELECT setting_type, setting_value, is_active FROM daive_api_settings WHERE dealer_id = $1',
      [dealerId]
    );
    
    console.log('\n📋 API Settings:');
    if (settingsResult.rows.length === 0) {
      console.log('❌ No API settings found');
    } else {
      settingsResult.rows.forEach(row => {
        const maskedValue = row.setting_value ? 
          row.setting_value.substring(0, 8) + '...' + row.setting_value.substring(row.setting_value.length - 4) :
          'Not set';
        console.log(`✅ ${row.setting_type}: ${maskedValue} (Active: ${row.is_active})`);
      });
    }
    
    // Check if voice can be activated
    const hasElevenLabs = settingsResult.rows.some(row => 
      row.setting_type === 'elevenlabs_key' && row.setting_value && row.is_active
    );
    
    console.log('\n🎵 Voice Activation Status:');
    if (hasElevenLabs) {
      console.log('✅ ElevenLabs API key is configured - Voice can be activated!');
      console.log('\n📝 Next Steps:');
      console.log('1. Go to DAIVE Settings → Voice Settings tab');
      console.log('2. Enable "Voice Responses" toggle');
      console.log('3. Select "ElevenLabs" as Voice Provider');
      console.log('4. Choose your preferred language and settings');
      console.log('5. Test voice functionality in a vehicle conversation');
    } else {
      console.log('❌ ElevenLabs API key not found or inactive');
      console.log('Please configure the ElevenLabs API key in DAIVE Settings → API Keys tab');
    }
    
  } catch (error) {
    console.error('❌ Error checking API settings:', error);
  } finally {
    await pool.end();
  }
}

checkDealerApiSettings(); 