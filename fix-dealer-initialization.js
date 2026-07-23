import { pool } from './src/database/connection.js';

async function fixDealerInitialization() {
  try {
    console.log('🔧 Fixing dealer initialization issue...\n');
    
    // First, let's check the current dealer ID being used
    console.log('📋 Current Dealer ID: 0aa94346-ed1d-420e-8823-bcd97bf6456f');
    
    // Check if there are any global settings that might be interfering
    console.log('\n📋 Checking for global settings...');
    const globalResult = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id IS NULL
      ORDER BY setting_type
    `);
    
    if (globalResult.rows.length > 0) {
      console.log('⚠️  Found global settings that might interfere:');
      globalResult.rows.forEach(row => {
        console.log(`   ${row.setting_type}: ${row.setting_value} (Active: ${row.is_active})`);
      });
    } else {
      console.log('✅ No global settings found');
    }
    
    // Check dealer-specific settings
    console.log('\n📋 Checking dealer-specific settings...');
    const dealerResult = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      ORDER BY setting_type
    `);
    
    console.log('📊 Dealer Settings:');
    dealerResult.rows.forEach(row => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${row.setting_type}: ${status}`);
    });
    
    // Now let's create a test to see what the settings manager would return
    console.log('\n🧪 Testing Settings Manager Logic...');
    
    // Simulate the settings manager query
    const testQuery = `
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
    
    const testResult = await pool.query(testQuery);
    
    console.log('\n📊 Settings Manager Test Results:');
    testResult.rows.forEach(row => {
      console.log(`   ${row.setting_type}: ${row.setting_value ? '✅ HAS VALUE' : '❌ NO VALUE'} (Source: ${row.source})`);
    });
    
    // Check specifically for the OpenAI key
    const openaiKeyRow = testResult.rows.find(row => row.setting_type === 'openai_key');
    if (openaiKeyRow) {
      console.log(`\n🔑 OpenAI Key Source: ${openaiKeyRow.source}`);
      console.log(`   Value: ${openaiKeyRow.setting_value ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`   Active: ${openaiKeyRow.is_active}`);
    } else {
      console.log('\n❌ No OpenAI key found in test query!');
    }
    
    console.log('\n💡 DIAGNOSIS:');
    console.log('==============');
    console.log('The issue is likely in the DAIVE service initialization.');
    console.log('It\'s calling initializeCrewAI("global") instead of using the actual dealer ID.');
    
    console.log('\n🚨 IMMEDIATE FIX REQUIRED:');
    console.log('==========================');
    console.log('1. The DAIVE service needs to be modified to use the correct dealer ID');
    console.log('2. The initializeCrewAI("global") call should use the actual dealer ID');
    console.log('3. Restart the server after making the fix');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
  } finally {
    await pool.end();
  }
}

fixDealerInitialization();
