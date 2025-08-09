const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function fixVoiceSettingsConsistency() {
  try {
    console.log('🔧 Fixing voice settings consistency...');
    
    // Connect to database
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Check current settings
    console.log('\n📊 Current voice-related settings:');
    const checkQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type LIKE '%provider%' OR setting_type LIKE 'voice_%'
      ORDER BY setting_type, dealer_id
    `;
    
    const checkResult = await client.query(checkQuery);
    checkResult.rows.forEach(row => {
      console.log(`  ${row.setting_type}: ${row.setting_value} (dealer: ${row.dealer_id})`);
    });

    // Get the default dealer ID
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';

    // Remove old field names and ensure new field names have correct values
    console.log('\n🧹 Cleaning up old field names...');
    
    // Remove old speech_provider entries
    await client.query(`
      DELETE FROM daive_api_settings 
      WHERE setting_type = 'speech_provider' AND dealer_id = $1
    `, [dealerId]);
    console.log('✅ Removed old speech_provider entries');

    // Remove old tts_provider entries  
    await client.query(`
      DELETE FROM daive_api_settings 
      WHERE setting_type = 'tts_provider' AND dealer_id = $1
    `, [dealerId]);
    console.log('✅ Removed old tts_provider entries');

    // Ensure voice_speech_provider is set to 'deepgram'
    await client.query(`
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, 'voice_speech_provider', 'deepgram')
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = 'deepgram', updated_at = NOW()
    `, [dealerId]);
    console.log('✅ Set voice_speech_provider to deepgram');

    // Ensure voice_tts_provider is set to 'elevenlabs'
    await client.query(`
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, 'voice_tts_provider', 'elevenlabs')
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = 'elevenlabs', updated_at = NOW()
    `, [dealerId]);
    console.log('✅ Set voice_tts_provider to elevenlabs');

    // Verify the fix
    console.log('\n📊 Updated voice-related settings:');
    const verifyResult = await client.query(checkQuery);
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.setting_type}: ${row.setting_value} (dealer: ${row.dealer_id})`);
    });

    console.log('\n✅ Voice settings consistency fix completed!');
    console.log('\n🎯 Summary:');
    console.log('  • Removed old speech_provider and tts_provider entries');
    console.log('  • Ensured voice_speech_provider is set to "deepgram"');
    console.log('  • Ensured voice_tts_provider is set to "elevenlabs"');
    console.log('  • Voice settings are now consistent');

    client.release();
    await pool.end();

  } catch (error) {
    console.error('❌ Error fixing voice settings consistency:', error);
    process.exit(1);
  }
}

fixVoiceSettingsConsistency(); 