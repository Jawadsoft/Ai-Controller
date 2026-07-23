/**
 * Check Database Settings Script
 * Examines what dealers and API keys are available for testing
 */

import settingsManager from './src/lib/settingsManager.js';
import { pool } from './src/database/connection.js';

console.log('🔍 Checking Database Settings...');

async function checkDatabaseSettings() {
  try {
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    console.log('\n2. Checking available dealers...');
    const dealersQuery = `
      SELECT DISTINCT dealer_id, COUNT(*) as setting_count
      FROM daive_api_settings 
      WHERE dealer_id IS NOT NULL 
      GROUP BY dealer_id
      ORDER BY setting_count DESC
    `;
    
    const dealersResult = await client.query(dealersQuery);
    console.log('📊 Dealers found:', dealersResult.rows.length);
    
    if (dealersResult.rows.length > 0) {
      dealersResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. Dealer ID: ${row.dealer_id} (${row.setting_count} settings)`);
      });
    } else {
      console.log('   ⚠️ No dealer-specific settings found');
    }
    
    console.log('\n3. Checking global settings...');
    const globalQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id IS NULL 
      AND setting_type LIKE '%key%'
      ORDER BY setting_type
    `;
    
    const globalResult = await client.query(globalQuery);
    console.log('🌍 Global API keys found:', globalResult.rows.length);
    
    if (globalResult.rows.length > 0) {
      globalResult.rows.forEach(row => {
        const hasValue = row.setting_value && row.setting_value !== '';
        const status = hasValue ? '✅' : '❌';
        console.log(`   ${status} ${row.setting_type}: ${hasValue ? 'SET' : 'NOT SET'}`);
      });
    }
    
    console.log('\n4. Testing SettingsManager...');
    const sm = new settingsManager();
    
    console.log('   🔍 Testing global settings...');
    const globalSettings = await sm.getAllSettings();
    console.log('   ✅ Global settings loaded');
    
    console.log('   🔑 Testing API keys retrieval...');
    const apiKeys = await sm.getAPIKeys();
    console.log('   📋 API Keys found:');
    Object.entries(apiKeys).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`      ${status} ${key}: ${value ? 'SET' : 'NOT SET'}`);
    });
    
    console.log('\n5. Testing CrewAI settings...');
    const crewSettings = await sm.getCrewAISettings();
    console.log('   🤖 CrewAI Settings:');
    Object.entries(crewSettings).forEach(([key, value]) => {
      console.log(`      ${key}: ${value}`);
    });
    
    console.log('\n6. Looking for any available dealer with API keys...');
    const availableKeys = await sm.getAvailableAPIKeys();
    console.log('   🔍 Available API keys across all dealers:');
    Object.entries(availableKeys).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`      ${status} ${key}: ${value ? 'SET' : 'NOT SET'}`);
    });
    
    // Check if we have any working API keys
    const hasAnyKeys = Object.values(availableKeys).some(key => key);
    
    if (hasAnyKeys) {
      console.log('\n🎉 Found working API keys!');
      console.log('   You can now run the customer journey test with real functionality.');
      
      // Find the first dealer with API keys
      const dealerWithKeysQuery = `
        SELECT DISTINCT dealer_id
        FROM daive_api_settings 
        WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key', 'azure_speech_key')
        AND setting_value IS NOT NULL 
        AND setting_value != ''
        AND dealer_id IS NOT NULL
        LIMIT 1
      `;
      
      const dealerResult = await client.query(dealerWithKeysQuery);
      if (dealerResult.rows.length > 0) {
        const dealerId = dealerResult.rows[0].dealer_id;
        console.log(`   💡 Use dealer ID: ${dealerId} for testing`);
      }
    } else {
      console.log('\n⚠️ No API keys found in database');
      console.log('   You need to add API keys to test the CrewAI functionality.');
      console.log('   Add keys to the daive_api_settings table.');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error checking database settings:', error);
  }
}

// Run the check
checkDatabaseSettings().then(() => {
  console.log('\n🏁 Database settings check completed!');
}).catch(error => {
  console.error('❌ Check failed:', error);
});
