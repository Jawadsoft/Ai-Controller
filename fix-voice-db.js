const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function fixVoiceDB() {
  try {
    console.log('🔧 Fixing voice settings database...');
    
    const client = await pool.connect();
    console.log('✅ Connected to database');

    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';

    // Remove old entries
    await client.query("DELETE FROM daive_api_settings WHERE setting_type = 'speech_provider' AND dealer_id = $1", [dealerId]);
    await client.query("DELETE FROM daive_api_settings WHERE setting_type = 'tts_provider' AND dealer_id = $1", [dealerId]);
    console.log('✅ Removed old entries');

    // Set correct values
    await client.query(`
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, 'voice_speech_provider', 'deepgram')
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = 'deepgram'
    `, [dealerId]);

    await client.query(`
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, 'voice_tts_provider', 'elevenlabs')
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = 'elevenlabs'
    `, [dealerId]);

    console.log('✅ Set correct values');

    // Verify
    const result = await client.query(`
      SELECT setting_type, setting_value 
      FROM daive_api_settings 
      WHERE dealer_id = $1 AND setting_type LIKE '%provider%'
    `, [dealerId]);

    console.log('\n📊 Current provider settings:');
    result.rows.forEach(row => {
      console.log(`  ${row.setting_type}: ${row.setting_value}`);
    });

    client.release();
    await pool.end();
    console.log('\n✅ Database fix completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixVoiceDB(); 