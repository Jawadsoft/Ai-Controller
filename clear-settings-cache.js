import { pool } from './src/database/connection.js';

async function clearSettingsCache() {
  try {
    console.log('🧹 Clearing settings cache and forcing refresh...\n');
    
    // First, let's check if there's a way to clear the cache
    console.log('📋 Current API Keys (before cache clear):');
    console.log('==========================================');
    
    const result = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, updated_at
      FROM daive_api_settings 
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      ORDER BY dealer_id NULLS FIRST, setting_type
    `);
    
    result.rows.forEach(row => {
      const dealerId = row.dealer_id || 'Global';
      const keyType = row.setting_type;
      const keyValue = row.setting_value;
      const maskedKey = keyValue.substring(0, 25) + '...';
      
      console.log(`${keyType}:`);
      console.log(`  Dealer: ${dealerId}`);
      console.log(`  Key: ${maskedKey}`);
      console.log(`  Updated: ${row.updated_at}`);
      console.log('');
    });
    
    // Now let's try to force a cache refresh by updating the timestamp
    console.log('🔄 Forcing cache refresh by updating timestamp...');
    
    const updateResult = await pool.query(`
      UPDATE daive_api_settings 
      SET updated_at = NOW()
      WHERE setting_type = 'openai_key' 
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      RETURNING setting_type, updated_at
    `);
    
    if (updateResult.rows.length > 0) {
      console.log('✅ Cache refresh timestamp updated successfully');
      console.log(`   Updated: ${updateResult.rows[0].updated_at}`);
    } else {
      console.log('⚠️  No rows were updated');
    }
    
    console.log('\n💡 To completely clear the cache, you need to:');
    console.log('   1. Restart your application server');
    console.log('   2. Or wait for the 5-minute cache to expire');
    console.log('   3. Or modify the cache expiry time in settingsManager.js');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  } finally {
    await pool.end();
  }
}

clearSettingsCache();
