import { pool } from './src/database/connection.js';

async function forceCacheRefresh() {
  try {
    console.log('🔄 Force refreshing settings cache...\n');
    
    // First, let's check the current API key
    console.log('📋 Current OpenAI Key in Database:');
    console.log('==================================');
    
    const keyResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, updated_at
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' 
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `);
    
    if (keyResult.rows.length > 0) {
      const row = keyResult.rows[0];
      console.log(`Dealer ID: ${row.dealer_id}`);
      console.log(`Key: ${row.setting_value.substring(0, 25)}...`);
      console.log(`Last Updated: ${row.updated_at}`);
      
      // Check if it's the old deactivated key
      if (row.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA')) {
        console.log('\n⚠️  WARNING: This is still the OLD DEACTIVATED key!');
        console.log('   You need to update the API key in the database first.');
        return;
      } else {
        console.log('\n✅ This is a NEW API key');
      }
    }
    
    console.log('\n🧹 Cache Management Options:');
    console.log('============================');
    console.log('1. Restart your application server (Recommended)');
    console.log('2. Wait for 5-minute cache to expire');
    console.log('3. Modify cache expiry time temporarily');
    
    console.log('\n💡 To restart your server:');
    console.log('   - Stop the current process (Ctrl+C)');
    console.log('   - Run: npm run dev (or your start command)');
    
    console.log('\n🔍 To verify the fix:');
    console.log('   - Check the console logs for "⚙️ Loading fresh settings"');
    console.log('   - Instead of "⚙️ Using cached settings"');
    
  } catch (error) {
    console.error('❌ Error during cache refresh:', error.message);
  } finally {
    await pool.end();
  }
}

forceCacheRefresh();
