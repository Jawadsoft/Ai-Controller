import { pool } from './src/database/connection.js';

async function checkDeepgramInDatabase() {
  try {
    console.log('🔍 Checking Deepgram key in database...\n');
    
    // Check all API settings for the default dealer
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    const query = `
      SELECT setting_type, setting_value, is_active, created_at, updated_at
      FROM daive_api_settings
      WHERE dealer_id = $1
      ORDER BY setting_type
    `;
    
    const result = await pool.query(query, [dealerId]);
    
    console.log(`📊 Found ${result.rows.length} settings for dealer ${dealerId}:`);
    console.log('='.repeat(60));
    
    result.rows.forEach(row => {
      console.log(`📝 ${row.setting_type}:`);
      console.log(`   Value: ${row.setting_value ? row.setting_value.substring(0, 20) + '...' : 'null'}`);
      console.log(`   Active: ${row.is_active}`);
      console.log(`   Created: ${row.created_at}`);
      console.log(`   Updated: ${row.updated_at}`);
      console.log('');
    });
    
    // Check specifically for deepgram_key
    const deepgramQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = 'deepgram_key'
    `;
    
    const deepgramResult = await pool.query(deepgramQuery, [dealerId]);
    
    if (deepgramResult.rows.length > 0) {
      console.log('✅ Deepgram key found in database');
      console.log(`   Value: ${deepgramResult.rows[0].setting_value.substring(0, 20)}...`);
      console.log(`   Active: ${deepgramResult.rows[0].is_active}`);
    } else {
      console.log('❌ Deepgram key NOT found in database');
      console.log('💡 You may need to save the Deepgram key first');
    }
    
    // Check if speech_provider is set to deepgram
    const speechProviderQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = 'speech_provider'
    `;
    
    const speechProviderResult = await pool.query(speechProviderQuery, [dealerId]);
    
    if (speechProviderResult.rows.length > 0) {
      console.log(`\n🎤 Speech provider: ${speechProviderResult.rows[0].setting_value}`);
    } else {
      console.log('\n❌ Speech provider not set');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
}

checkDeepgramInDatabase(); 