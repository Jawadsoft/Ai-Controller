// Check current API settings
import { pool } from './src/database/connection.js';

async function checkAPISettings() {
  try {
    console.log('🔍 Checking DAIVE API Settings...\n');
    
    const result = await pool.query('SELECT * FROM daive_api_settings ORDER BY dealer_id NULLS FIRST, setting_type');
    
    if (result.rows.length === 0) {
      console.log('❌ No API settings found in database');
      console.log('💡 You need to add API keys to enable CrewAI functionality');
    } else {
      console.log('📋 Current API Settings:');
      result.rows.forEach(row => {
        const dealer = row.dealer_id || 'GLOBAL';
        const value = row.setting_value ? `${row.setting_value.substring(0, 20)}...` : 'NULL';
        console.log(`  - ${row.setting_type}: ${value} (Dealer: ${dealer})`);
      });
    }
    
    console.log('\n🔑 To fix CrewAI fallback responses, you need to:');
    console.log('  1. Get an OpenAI API key from https://platform.openai.com/');
    console.log('  2. Add it to the daive_api_settings table');
    console.log('  3. Or set OPENAI_API_KEY environment variable');
    
  } catch (error) {
    console.error('❌ Error checking API settings:', error.message);
  } finally {
    await pool.end();
  }
}

checkAPISettings();
