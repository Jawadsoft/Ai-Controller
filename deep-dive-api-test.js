import { pool } from './src/database/connection.js';

async function deepDiveAPITest() {
  try {
    console.log('🔍 DEEP DIVE API KEY INVESTIGATION...\n');
    
    // Test 1: Check if there are multiple API key entries that might be conflicting
    console.log('📋 Test 1: Multiple API Key Conflict Check...');
    console.log('=============================================');
    
    const allKeysResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, is_active, updated_at, created_at
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key'
      ORDER BY dealer_id NULLS FIRST, updated_at DESC
    `);
    
    if (allKeysResult.rows.length === 0) {
      console.log('❌ No OpenAI API keys found in database!');
      return;
    }
    
    console.log(`📊 Found ${allKeysResult.rows.length} OpenAI API key entries:`);
    allKeysResult.rows.forEach((row, index) => {
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
    
    // Test 2: Check if there are any inactive but still referenced keys
    console.log('📋 Test 2: Inactive Key Reference Check...');
    console.log('==========================================');
    
    const inactiveKeys = allKeysResult.rows.filter(row => !row.is_active);
    if (inactiveKeys.length > 0) {
      console.log('⚠️  Found inactive API keys that might still be referenced:');
      inactiveKeys.forEach(row => {
        const dealerId = row.dealer_id || 'Global';
        console.log(`   - ${dealerId}: ${row.setting_value.substring(0, 25)}... (Inactive since: ${row.updated_at})`);
      });
    } else {
      console.log('✅ No inactive API keys found');
    }
    
    // Test 3: Check if there are any other tables storing API keys
    console.log('\n📋 Test 3: Other API Key Storage Check...');
    console.log('==========================================');
    
    const otherTablesResult = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%openai%' OR column_name LIKE '%api_key%' OR column_name LIKE '%key%')
      AND table_name != 'daive_api_settings'
      ORDER BY table_name, column_name
    `);
    
    if (otherTablesResult.rows.length > 0) {
      console.log('📊 Found other tables with potential API key columns:');
      otherTablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}.${row.column_name} (${row.data_type})`);
      });
      
      // Check if any of these tables actually contain API keys
      for (const tableRow of otherTablesResult.rows) {
        try {
          const checkResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM ${tableRow.table_name}
            WHERE ${tableRow.column_name} LIKE '%sk-%'
          `);
          
          if (checkResult.rows[0].count > 0) {
            console.log(`   ⚠️  Table ${tableRow.table_name} contains ${checkResult.rows[0].count} potential API keys!`);
          }
        } catch (error) {
          // Column might not be accessible or table might not exist
        }
      }
    } else {
      console.log('✅ No other tables with potential API key columns found');
    }
    
    // Test 4: Check for any hardcoded values in the database
    console.log('\n📋 Test 4: Hardcoded Value Search...');
    console.log('=====================================');
    
    // Search for the old API key pattern in any text field
    const hardcodedSearch = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND data_type IN ('text', 'character varying', 'character')
      AND table_name != 'daive_api_settings'
      ORDER BY table_name, column_name
    `);
    
    console.log('🔍 Searching for hardcoded old API key in other tables...');
    let foundOldKey = false;
    
    for (const colRow of hardcodedSearch.rows) {
      try {
        const searchResult = await pool.query(`
          SELECT COUNT(*) as count
          FROM ${colRow.table_name}
          WHERE ${colRow.column_name}::text LIKE '%SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA%'
        `);
        
        if (searchResult.rows[0].count > 0) {
          console.log(`   ❌ FOUND OLD API KEY in ${colRow.table_name}.${colRow.column_name}!`);
          foundOldKey = true;
        }
      } catch (error) {
        // Column might not be accessible
      }
    }
    
    if (!foundOldKey) {
      console.log('✅ No hardcoded old API keys found in other tables');
    }
    
    // Test 5: Check if there are any database triggers or functions that might be overriding
    console.log('\n📋 Test 5: Database Functions and Triggers Check...');
    console.log('==================================================');
    
    const functionsResult = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name LIKE '%api%' OR routine_name LIKE '%key%' OR routine_name LIKE '%setting%'
      ORDER BY routine_name
    `);
    
    if (functionsResult.rows.length > 0) {
      console.log('📊 Found database functions that might affect API keys:');
      functionsResult.rows.forEach(row => {
        console.log(`   - ${row.routine_name} (${row.routine_type})`);
      });
    } else {
      console.log('✅ No database functions found that might affect API keys');
    }
    
    // Test 6: Check for any session or cache tables
    console.log('\n📋 Test 6: Session and Cache Tables Check...');
    console.log('============================================');
    
    const sessionTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%session%' OR table_name LIKE '%cache%' OR table_name LIKE '%temp%')
      ORDER BY table_name
    `);
    
    if (sessionTablesResult.rows.length > 0) {
      console.log('📊 Found potential session/cache tables:');
      sessionTablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('✅ No session/cache tables found');
    }
    
    // Test 7: Final analysis
    console.log('\n🎯 FINAL ANALYSIS:');
    console.log('==================');
    
    const hasOldKeyInDB = allKeysResult.rows.some(row => 
      row.setting_value.includes('SI5jhPH1xpWW9d7BOSNG88e3ueokQvNJQmd0UHPpyebZPNAGtkdvyDYprIEpOwPamULAmGW7klT3BlbkFJSPYtJ8fpS1yRHAXeKHX9VYtgSbU4UDwro0GyQdZGIdG6S2Ba_KZ3Pddx_vipma24SBbgTVW7kA')
    );
    
    if (hasOldKeyInDB) {
      console.log('❌ ROOT CAUSE: Database still contains the old deactivated API key');
      console.log('   SOLUTION: You need to completely remove the old key entry');
    } else {
      console.log('✅ Database is clean - no old API keys found');
      console.log('⚠️  The issue must be in the application code or runtime cache');
      console.log('   SOLUTION: Force restart the entire application stack');
    }
    
    console.log('\n🚨 ULTIMATE SOLUTION:');
    console.log('=====================');
    console.log('1. STOP your application server (Ctrl+C)');
    console.log('2. STOP your database server (if running locally)');
    console.log('3. WAIT 30 seconds for all processes to terminate');
    console.log('4. START your database server');
    console.log('5. START your application server');
    console.log('6. Clear your browser cache completely');
    console.log('7. Test the AI bot again');
    
  } catch (error) {
    console.error('❌ Error during deep dive investigation:', error.message);
  } finally {
    await pool.end();
  }
}

deepDiveAPITest();
