 import { pool } from './src/database/connection.js';

async function aggressiveCacheClear() {
  try {
    console.log('🧹 AGGRESSIVE CACHE CLEARING...\n');
    
    // 1. Check current API key status
    console.log('📋 Step 1: Checking current API key...');
    const keyResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, updated_at, is_active
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' 
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `);
    
    if (keyResult.rows.length > 0) {
      const row = keyResult.rows[0];
      console.log(`✅ API Key found:`);
      console.log(`   Dealer ID: ${row.dealer_id}`);
      console.log(`   Key: ${row.setting_value.substring(0, 25)}...`);
      console.log(`   Active: ${row.is_active}`);
      console.log(`   Updated: ${row.updated_at}`);
      
      // Check if it's the old deactivated key
      if (row.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA')) {
        console.log('\n❌ CRITICAL: This is still the OLD DEACTIVATED key!');
        console.log('   The database update did not work properly.');
        return;
      }
    } else {
      console.log('❌ No API key found for this dealer!');
      return;
    }
    
    // 2. Force database refresh by updating multiple fields
    console.log('\n📋 Step 2: Forcing database refresh...');
    
    const updateResult = await pool.query(`
      UPDATE daive_api_settings 
      SET 
        updated_at = NOW(),
        created_at = NOW(),
        is_active = true
      WHERE setting_type = 'openai_key' 
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      RETURNING setting_type, updated_at, is_active
    `);
    
    if (updateResult.rows.length > 0) {
      console.log('✅ Database refresh completed');
      console.log(`   Updated: ${updateResult.rows[0].updated_at}`);
      console.log(`   Active: ${updateResult.rows[0].is_active}`);
    }
    
    // 3. Check if there are any global API keys that might be interfering
    console.log('\n📋 Step 3: Checking for global API keys...');
    const globalResult = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' 
      AND dealer_id IS NULL
    `);
    
    if (globalResult.rows.length > 0) {
      console.log('⚠️  Found global API keys that might override dealer settings:');
      globalResult.rows.forEach(row => {
        console.log(`   ${row.setting_type}: ${row.setting_value.substring(0, 25)}... (Active: ${row.is_active})`);
      });
      
      // Deactivate global keys to ensure dealer-specific key is used
      console.log('\n🔄 Deactivating global API keys to prioritize dealer settings...');
      await pool.query(`
        UPDATE daive_api_settings 
        SET is_active = false
        WHERE setting_type = 'openai_key' 
        AND dealer_id IS NULL
      `);
      console.log('✅ Global API keys deactivated');
    } else {
      console.log('✅ No global API keys found');
    }
    
    // 4. Verify final state
    console.log('\n📋 Step 4: Final verification...');
    const finalResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, is_active, updated_at
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key'
      ORDER BY dealer_id NULLS FIRST
    `);
    
    console.log('📊 Final API Key Status:');
    finalResult.rows.forEach(row => {
      const dealerId = row.dealer_id || 'Global';
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${dealerId}: ${status} - ${row.setting_value.substring(0, 25)}...`);
    });
    
    console.log('\n🚨 IMMEDIATE ACTION REQUIRED:');
    console.log('================================');
    console.log('1. STOP your application server (Ctrl+C)');
    console.log('2. WAIT 10 seconds');
    console.log('3. RESTART your application server');
    console.log('4. Test the AI bot again');
    
    console.log('\n💡 If the issue persists after restart:');
    console.log('   - Check server console for "⚙️ Loading fresh settings" messages');
    console.log('   - Look for any error messages in the console');
    console.log('   - Verify the API key is being loaded correctly');
    
  } catch (error) {
    console.error('❌ Error during aggressive cache clear:', error.message);
  } finally {
    await pool.end();
  }
}

aggressiveCacheClear();
