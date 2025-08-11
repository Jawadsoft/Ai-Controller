import { pool } from './src/database/connection.js';

console.log('🔑 Checking for available API keys...');

const checkApiKeys = async () => {
  try {
    const result = await pool.query(`
      SELECT dealer_id, setting_type, setting_value 
      FROM daive_api_settings 
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key') 
      AND setting_value IS NOT NULL
    `);
    
    console.log('📊 API Keys found:');
    if (result.rows.length === 0) {
      console.log('❌ No API keys found in the database');
    } else {
      result.rows.forEach(row => {
        const dealer = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        const keyPreview = row.setting_value.substring(0, 8) + '...';
        console.log(`   - ${row.setting_type}: ${keyPreview} (${dealer})`);
      });
    }
    
    // Check if we have any keys at all
    const allKeysResult = await pool.query(`
      SELECT setting_type, COUNT(*) as count
      FROM daive_api_settings 
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      GROUP BY setting_type
    `);
    
    console.log('\n📈 API Key Summary:');
    allKeysResult.rows.forEach(row => {
      console.log(`   - ${row.setting_type}: ${row.count} entries`);
    });
    
  } catch (error) {
    console.error('❌ Error checking API keys:', error);
  } finally {
    await pool.end();
  }
};

checkApiKeys(); 