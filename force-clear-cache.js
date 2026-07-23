import { pool } from './src/database/connection.js';

async function forceClearCache() {
  try {
    console.log('🧹 FORCE CLEARING SETTINGS MANAGER CACHE...\n');
    
    // Update the timestamp to force cache refresh
    console.log('🔄 Updating timestamps to force cache refresh...');
    
    await pool.query(`
      UPDATE daive_api_settings 
      SET updated_at = NOW() + INTERVAL '1 minute'
      WHERE setting_type = 'openai_key'
    `);
    
    console.log('✅ Timestamps updated successfully');
    
    // Also check if there are any other corrupted keys anywhere
    console.log('\n🔍 Checking for any remaining corrupted keys...');
    
    const corruptedKeys = await pool.query(`
      SELECT dealer_id, setting_type, setting_value 
      FROM daive_api_settings 
      WHERE setting_value LIKE '%lfgAi4mE%' OR setting_value LIKE '%4m8A%'
    `);
    
    if (corruptedKeys.rows.length > 0) {
      console.log('❌ Found corrupted keys that need to be fixed:');
      corruptedKeys.rows.forEach(row => {
        const dealer = row.dealer_id || 'GLOBAL';
        console.log(`   ${dealer}: ${row.setting_type} = ${row.setting_value}`);
      });
      
      console.log('\n🔄 Fixing corrupted keys...');
      for (const row of corruptedKeys.rows) {
        const correctKey = 'YOUR_OPENAI_API_KEY_HERE';
        
        await pool.query(`
          UPDATE daive_api_settings 
          SET setting_value = $1, updated_at = NOW()
          WHERE dealer_id = $2 AND setting_type = $3
        `, [correctKey, row.dealer_id, row.setting_type]);
        
        console.log(`   ✅ Fixed ${row.setting_type} for dealer ${row.dealer_id || 'GLOBAL'}`);
      }
    } else {
      console.log('✅ No corrupted keys found');
    }
    
    // Verify the current state
    console.log('\n🔍 Current API key status:');
    const currentKeys = await pool.query(`
      SELECT dealer_id, setting_type, setting_value 
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key'
      ORDER BY dealer_id NULLS FIRST
    `);
    
    currentKeys.rows.forEach(row => {
      const key = row.setting_value;
      const dealer = row.dealer_id || 'GLOBAL';
      console.log(`   ${dealer}: ${key.substring(0, 20)}...${key.substring(key.length - 20)}`);
    });
    
    console.log('\n🚀 Cache clearing completed!');
    console.log('📝 Next steps:');
    console.log('   1. Restart your application server (to clear in-memory cache)');
    console.log('   2. Test the conversation again');
    console.log('   3. The system should now use the correct API key');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  } finally {
    await pool.end();
  }
}

forceClearCache();
