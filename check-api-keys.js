import { pool } from './src/database/connection.js';

async function checkAPIKeys() {
  try {
    console.log('🔑 Checking API Keys Configuration...\n');
    
    // Check for API keys in database
    const query = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      ORDER BY setting_type, dealer_id
    `;
    
    const result = await pool.query(query);
    
    console.log('📊 API Keys Found:');
    console.log('==================');
    
    if (result.rows.length === 0) {
      console.log('❌ No API keys found in database');
    } else {
      result.rows.forEach(row => {
        const keyType = row.setting_type;
        const hasKey = row.setting_value && row.setting_value.length > 0;
        const scope = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        const status = hasKey ? '✅ Configured' : '❌ Empty';
        const keyPreview = hasKey ? `${row.setting_value.substring(0, 10)}...` : 'Not set';
        
        console.log(`${keyType}: ${status} (${scope})`);
        console.log(`  Key: ${keyPreview}`);
      });
    }
    
    // Check environment variables
    console.log('\n🌍 Environment Variables:');
    console.log('========================');
    console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Not set'}`);
    
    console.log('\n💡 To fix voice issues:');
    console.log('1. Add OpenAI API key for Whisper transcription');
    console.log('2. Add ElevenLabs API key for Jessica voice');
    console.log('3. Go to DAIVE Settings → API Keys');
    console.log('4. Test the connections');
    
  } catch (error) {
    console.error('❌ Error checking API keys:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAPIKeys().catch(console.error); 