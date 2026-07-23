import { pool } from './src/database/connection.js';

async function addOpenAIKeyGlobal() {
  try {
    console.log('🔑 Adding OpenAI API Key (Global)...\n');
    
    // Check if OpenAI key already exists globally
    const checkQuery = `
      SELECT setting_value
      FROM daive_api_settings
      WHERE setting_type = 'openai_key' AND dealer_id IS NULL
      LIMIT 1
    `;
    
    const existing = await pool.query(checkQuery);
    
    if (existing.rows.length > 0 && existing.rows[0].setting_value) {
      console.log('✅ OpenAI API key already exists (Global)');
      console.log(`Key: ${existing.rows[0].setting_value.substring(0, 10)}...`);
      return;
    }
    
    console.log('❌ No OpenAI API key found (Global)');
    console.log('\n🔧 To fix this:');
    console.log('1. Get your OpenAI API key from: https://platform.openai.com/api-keys');
    console.log('2. Go to DAIVE Settings → API Keys');
    console.log('3. Add your OpenAI API key');
    console.log('4. Test the connection');
    console.log('\n💡 The OpenAI API key is needed for:');
    console.log('- Whisper speech-to-text transcription');
    console.log('- GPT-4o AI processing');
    console.log('- OpenAI TTS (if using OpenAI voices)');
    console.log('\n🌍 This will be a GLOBAL setting (works for all dealers)');
    
    // If you want to add it programmatically, uncomment and modify:
    /*
    const openaiKey = 'your-openai-api-key-here';
    const insertQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES (NULL, 'openai_key', $1)
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = $1, updated_at = NOW()
      RETURNING *
    `;
    
    await pool.query(insertQuery, [openaiKey]);
    console.log('✅ OpenAI API key added successfully (Global)');
    */
    
    // Show current global API keys status
    console.log('\n📊 Current Global API Keys:');
    console.log('============================');
    
    const allKeysQuery = `
      SELECT setting_type, setting_value
      FROM daive_api_settings
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      AND dealer_id IS NULL
      ORDER BY setting_type
    `;
    
    const allKeys = await pool.query(allKeysQuery);
    
    allKeys.rows.forEach(row => {
      const hasKey = row.setting_value && row.setting_value.length > 0;
      const status = hasKey ? '✅ Configured' : '❌ Empty';
      const keyPreview = hasKey ? `${row.setting_value.substring(0, 10)}...` : 'Not set';
      
      console.log(`${row.setting_type}: ${status}`);
      console.log(`  Key: ${keyPreview}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding OpenAI key:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
addOpenAIKeyGlobal().catch(console.error); 