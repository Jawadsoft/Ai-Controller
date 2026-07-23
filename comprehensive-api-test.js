import { pool } from './src/database/connection.js';

async function comprehensiveAPITest() {
  try {
    console.log('🔍 COMPREHENSIVE API KEY DIAGNOSIS...\n');
    
    // Test 1: Check environment variables
    console.log('📋 Test 1: Environment Variables Check...');
    console.log('==========================================');
    const envVars = {
      'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
      'NODE_ENV': process.env.NODE_ENV,
      'DEALER_ID': process.env.DEALER_ID
    };
    
    Object.entries(envVars).forEach(([key, value]) => {
      if (value) {
        if (key === 'OPENAI_API_KEY') {
          const isOldKey = value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA');
          console.log(`   ${key}: ${isOldKey ? '❌ OLD DEACTIVATED KEY' : '✅ NEW KEY'} - ${value.substring(0, 25)}...`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      } else {
        console.log(`   ${key}: ❌ Not set`);
      }
    });
    
    // Test 2: Database API key status
    console.log('\n📋 Test 2: Database API Key Status...');
    console.log('=======================================');
    
    const dbResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, is_active, updated_at, created_at
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key'
      ORDER BY dealer_id NULLS FIRST
    `);
    
    if (dbResult.rows.length === 0) {
      console.log('❌ No OpenAI API keys found in database!');
    } else {
      dbResult.rows.forEach((row, index) => {
        const dealerId = row.dealer_id || 'Global';
        const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        const isOldKey = row.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA');
        const keyStatus = isOldKey ? '❌ OLD DEACTIVATED' : '✅ NEW VALID';
        
        console.log(`${index + 1}. ${dealerId}:`);
        console.log(`   Status: ${status}`);
        console.log(`   Key: ${keyStatus} - ${row.setting_value.substring(0, 25)}...`);
        console.log(`   Updated: ${row.updated_at}`);
        console.log(`   Created: ${row.created_at}`);
        console.log('');
      });
    }
    
    // Test 3: Settings Manager Logic Simulation
    console.log('📋 Test 3: Settings Manager Logic Simulation...');
    console.log('===============================================');
    
    // Simulate the exact query from settingsManager.js
    const settingsQuery = `
      WITH dealer_settings AS (
        SELECT setting_type, setting_value, is_active, 'dealer' as source
        FROM daive_api_settings 
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f' AND is_active = true
      ),
      global_settings AS (
        SELECT setting_type, setting_value, is_active, 'global' as source
        FROM daive_api_settings 
        WHERE dealer_id IS NULL AND is_active = true
      )
      SELECT setting_type, setting_value, is_active, source
      FROM dealer_settings
      UNION ALL
      SELECT setting_type, setting_value, is_active, source
      FROM global_settings
      WHERE setting_type NOT IN (SELECT setting_type FROM dealer_settings)
      ORDER BY setting_type
    `;
    
    const settingsResult = await pool.query(settingsQuery);
    
    console.log('📊 Settings Manager Query Results:');
    const openaiRow = settingsResult.rows.find(row => row.setting_type === 'openai_key');
    if (openaiRow) {
      const isOldKey = openaiRow.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA');
      console.log(`   openai_key: ${isOldKey ? '❌ OLD KEY' : '✅ NEW KEY'} (Source: ${openaiRow.source})`);
      console.log(`   Value: ${openaiRow.setting_value.substring(0, 30)}...`);
      console.log(`   Active: ${openaiRow.is_active}`);
    } else {
      console.log('   openai_key: ❌ NOT FOUND');
    }
    
    // Test 4: Check for any cached or session data
    console.log('\n📋 Test 4: Cache and Session Check...');
    console.log('=====================================');
    
    // Check if there are any other tables that might store API keys
    const otherTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%api%' OR table_name LIKE '%key%' OR table_name LIKE '%setting%'
      ORDER BY table_name
    `);
    
    console.log('📊 Potential API Key Tables:');
    otherTablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Test 5: Check for any hardcoded values in the database
    console.log('\n📋 Test 5: Hardcoded Value Check...');
    console.log('====================================');
    
    const hardcodedResult = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%key%' OR column_name LIKE '%api%')
      ORDER BY table_name, column_name
    `);
    
    console.log('📊 Potential API Key Columns:');
    hardcodedResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}.${row.column_name} (${row.data_type})`);
    });
    
    // Test 6: Verify the exact error scenario
    console.log('\n📋 Test 6: Error Scenario Analysis...');
    console.log('=====================================');
    
    console.log('🔍 Based on your error message:');
    console.log('   Error: "The OpenAI account associated with this API key has been deactivated"');
    console.log('   This means the system is still using the OLD API key somewhere');
    
    // Test 7: Check if there are multiple API key entries
    console.log('\n📋 Test 7: Multiple API Key Check...');
    console.log('====================================');
    
    const multipleKeysResult = await pool.query(`
      SELECT COUNT(*) as key_count, dealer_id
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key'
      GROUP BY dealer_id
      ORDER BY dealer_id NULLS FIRST
    `);
    
    console.log('📊 API Key Distribution:');
    multipleKeysResult.rows.forEach(row => {
      const dealerId = row.dealer_id || 'Global';
      console.log(`   ${dealerId}: ${row.key_count} key(s)`);
    });
    
    // Test 8: Final diagnosis
    console.log('\n🎯 FINAL DIAGNOSIS:');
    console.log('===================');
    
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA')) {
      console.log('❌ ROOT CAUSE: Environment variable OPENAI_API_KEY contains the old deactivated key');
      console.log('   SOLUTION: Remove or update the OPENAI_API_KEY environment variable');
    } else if (dbResult.rows.some(row => row.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA'))) {
      console.log('❌ ROOT CAUSE: Database still contains the old deactivated API key');
      console.log('   SOLUTION: Update the database with the new API key');
    } else {
      console.log('✅ Database and environment look clean');
      console.log('⚠️  The issue might be in application code or cached settings');
      console.log('   SOLUTION: Restart your application server completely');
    }
    
    console.log('\n🚨 IMMEDIATE ACTIONS:');
    console.log('=====================');
    console.log('1. Check if you have a .env file with OPENAI_API_KEY');
    console.log('2. Remove any environment variable overrides');
    console.log('3. Restart your application server (Ctrl+C, wait 10s, restart)');
    console.log('4. Clear any browser cache or local storage');
    
  } catch (error) {
    console.error('❌ Error during comprehensive test:', error.message);
  } finally {
    await pool.end();
  }
}

comprehensiveAPITest();
