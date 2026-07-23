import { pool } from './src/database/connection.js';

async function fixVoiceSettingsTable() {
  try {
    console.log('🔧 Fixing voice_settings table to use Liam voice...\n');
    
    // First, let's see what's currently in the voice_settings table
    const currentQuery = 'SELECT * FROM voice_settings;';
    const currentResult = await pool.query(currentQuery);
    
    if (currentResult.rows.length === 0) {
      console.log('❌ No records found in voice_settings table');
      return;
    }
    
    console.log('📋 Current voice_settings:');
    console.log('==========================');
    currentResult.rows.forEach((row, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  Dealer ID: ${row.dealer_id || 'Global'}`);
      console.log(`  TTS Provider: ${row.tts_provider || 'Not set'}`);
      console.log(`  ElevenLabs Voice: ${row.elevenlabs_voice || 'Not set'}`);
      console.log(`  OpenAI Voice: ${row.openai_voice || 'Not set'}`);
      console.log(`  Voice Provider: ${row.voice_provider || 'Not set'}`);
      console.log(`  Enabled: ${row.enabled || 'Not set'}`);
    });
    
    // Update the voice_settings table to use Liam voice and ElevenLabs TTS
    console.log('\n🔧 Updating voice_settings to use Liam voice...');
    
    const updateQuery = `
      UPDATE voice_settings 
      SET 
        tts_provider = 'elevenlabs',
        voice_provider = 'elevenlabs',
        elevenlabs_voice = 'liam',
        openai_voice = 'alloy',
        enabled = true,
        voice_quality = 'hd',
        voice_emotion = 'friendly',
        updated_at = NOW()
      WHERE id = $1
    `;
    
    // Update each record
    for (const row of currentResult.rows) {
      await pool.query(updateQuery, [row.id]);
      console.log(`✅ Updated record ${row.id} (Dealer: ${row.dealer_id || 'Global'})`);
    }
    
    // Verify the changes
    console.log('\n🧪 Verifying changes...');
    const verifyQuery = 'SELECT * FROM voice_settings;';
    const verifyResult = await pool.query(verifyQuery);
    
    console.log('\n📋 Updated voice_settings:');
    console.log('==========================');
    verifyResult.rows.forEach((row, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`  Dealer ID: ${row.dealer_id || 'Global'}`);
      console.log(`  TTS Provider: ${row.tts_provider} ✅`);
      console.log(`  ElevenLabs Voice: ${row.elevenlabs_voice} ✅`);
      console.log(`  OpenAI Voice: ${row.openai_voice} ✅`);
      console.log(`  Voice Provider: ${row.voice_provider} ✅`);
      console.log(`  Enabled: ${row.enabled} ✅`);
    });
    
    console.log('\n🎉 voice_settings table updated successfully!');
    console.log('🎤 Now both voice systems should use Liam voice consistently.');
    
  } catch (error) {
    console.error('❌ Error fixing voice_settings table:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixVoiceSettingsTable();
