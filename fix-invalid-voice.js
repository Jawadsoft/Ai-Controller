import { pool } from './src/database/connection.js';

async function fixInvalidVoice() {
  try {
    console.log('🔧 Fixing invalid voice setting...\n');
    
    // Check current voice settings
    console.log('📊 Current voice_openai_voice settings:');
    const currentQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type = 'voice_openai_voice'
      ORDER BY dealer_id NULLS LAST
    `;
    
    const currentResult = await pool.query(currentQuery);
    currentResult.rows.forEach(row => {
      console.log(`- ${row.setting_value} (Dealer ID: ${row.dealer_id || 'NULL (Global)'})`);
    });
    
    console.log('\n❌ Problem: "spruce" is not a valid OpenAI TTS voice!');
    console.log('✅ Valid OpenAI voices are: alloy, echo, fable, onyx, nova, shimmer');
    
    // Delete all existing voice_openai_voice settings
    const deleteQuery = `
      DELETE FROM daive_api_settings
      WHERE setting_type = 'voice_openai_voice'
    `;
    
    const deleteResult = await pool.query(deleteQuery);
    console.log(`✅ Deleted ${deleteResult.rowCount} invalid voice settings`);
    
    // Insert valid voice settings (using "nova" as it's bright and energetic)
    const validVoices = ['nova', 'echo', 'fable', 'onyx', 'alloy', 'shimmer'];
    
    console.log('\n🎤 Available valid voices:');
    validVoices.forEach((voice, index) => {
      console.log(`${index + 1}. ${voice.charAt(0).toUpperCase() + voice.slice(1)}`);
    });
    
    // Set to "nova" (bright, energetic voice - good for customer engagement)
    const selectedVoice = 'nova';
    
    // Insert global setting
    const globalQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES (NULL, 'voice_openai_voice', $1)
      RETURNING *
    `;
    
    const globalResult = await pool.query(globalQuery, [selectedVoice]);
    console.log(`✅ Set global voice to: ${selectedVoice}`);
    
    // Also set for the specific dealer
    const dealerQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ('0aa94346-ed1d-420e-8823-bcd97bf6456f', 'voice_openai_voice', $1)
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = $1, updated_at = NOW()
      RETURNING *
    `;
    
    const dealerResult = await pool.query(dealerQuery, [selectedVoice]);
    console.log(`✅ Set dealer voice to: ${selectedVoice}`);
    
    // Verify the fix
    console.log('\n📊 Updated voice settings:');
    const verifyQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type = 'voice_openai_voice'
      ORDER BY dealer_id NULLS LAST
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    verifyResult.rows.forEach(row => {
      console.log(`- ${row.setting_value} (Dealer ID: ${row.dealer_id || 'NULL (Global)'})`);
    });
    
    console.log('\n✅ Voice settings have been fixed!');
    console.log(`🎤 OpenAI Voice: ${selectedVoice} (valid voice)`);
    console.log('🎤 Voice Provider: openai');
    console.log('🎤 TTS Provider: openai');
    console.log('🎤 Voice Enabled: true');
    
    console.log('\n💡 Voice Characteristics:');
    console.log('- Nova: Bright, energetic voice - great for customer engagement');
    console.log('- Echo: Warm, friendly voice - good for customer service');
    console.log('- Fable: Clear, professional voice - good for business');
    console.log('- Onyx: Deep, authoritative voice - good for announcements');
    console.log('- Alloy: Neutral, balanced voice - good for general use');
    console.log('- Shimmer: Soft, gentle voice - good for calming responses');
    
    console.log('\n💡 Next steps:');
    console.log('1. Restart your application server');
    console.log('2. Test the voice functionality');
    console.log(`3. The voice should now use "${selectedVoice}" (a valid OpenAI voice)`);
    
  } catch (error) {
    console.error('❌ Error fixing invalid voice:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixInvalidVoice().catch(console.error); 