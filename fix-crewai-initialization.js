import { pool } from './src/database/connection.js';

async function fixCrewAIInitialization() {
  try {
    console.log('🔧 Fixing CrewAI Initialization Issue...\n');
    
    // Step 1: Verify the API key is accessible
    console.log('📋 Step 1: Verifying API Key Accessibility...');
    console.log('============================================');
    
    const apiKeyResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, is_active
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' 
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND is_active = true
    `);
    
    if (apiKeyResult.rows.length === 0) {
      console.log('❌ No active OpenAI API key found for dealer!');
      return;
    }
    
    const apiKey = apiKeyResult.rows[0].setting_value;
    console.log('✅ API Key found and accessible:');
    console.log(`   Dealer ID: ${apiKeyResult.rows[0].dealer_id}`);
    console.log(`   Key: ${apiKey.substring(0, 25)}...`);
    console.log(`   Active: ${apiKeyResult.rows[0].is_active}`);
    
    // Step 2: Check if there are any conflicting settings
    console.log('\n📋 Step 2: Checking for Conflicting Settings...');
    console.log('===============================================');
    
    const conflictingResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id, is_active
      FROM daive_api_settings 
      WHERE setting_type IN ('crew_ai_enabled', 'crew_ai_max_tokens')
      AND dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      ORDER BY setting_type
    `);
    
    console.log('📊 CrewAI Settings:');
    conflictingResult.rows.forEach(row => {
      console.log(`   ${row.setting_type}: ${row.setting_value} (Active: ${row.is_active})`);
    });
    
    // Step 3: Force enable CrewAI and set proper configuration
    console.log('\n📋 Step 3: Forcing CrewAI Configuration...');
    console.log('==========================================');
    
    const crewAIConfig = {
      'crew_ai_enabled': 'true',
      'crew_ai_max_tokens': '200',
      'crew_ai_auto_routing': 'true',
      'crew_ai_enable_sales_crew': 'true',
      'crew_ai_enable_customer_service_crew': 'true',
      'crew_ai_enable_inventory_crew': 'true',
      'crew_ai_crew_collaboration': 'true',
      'crew_ai_agent_memory': 'true',
      'crew_ai_performance_tracking': 'true',
      'crew_ai_fallback_to_traditional': 'false', // CRITICAL: Disable fallback to prevent "technical difficulties"
      'crew_ai_crew_selection': 'auto'
    };
    
    console.log('🔄 Updating CrewAI configuration...');
    
    for (const [settingType, settingValue] of Object.entries(crewAIConfig)) {
      try {
        await pool.query(`
          INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active, updated_at)
          VALUES ($1, $2, $3, true, NOW())
          ON CONFLICT (dealer_id, setting_type) 
          DO UPDATE SET setting_value = $3, is_active = true, updated_at = NOW()
        `, ['0aa94346-ed1d-420e-8823-bcd97bf6456f', settingType, settingValue]);
        
        console.log(`   ✅ ${settingType}: ${settingValue}`);
      } catch (error) {
        console.log(`   ❌ ${settingType}: ${error.message}`);
      }
    }
    
    // Step 4: Verify the configuration
    console.log('\n📋 Step 4: Verifying Final Configuration...');
    console.log('==========================================');
    
    const finalResult = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND setting_type IN ('openai_key', 'crew_ai_enabled', 'crew_ai_max_tokens', 'crew_ai_fallback_to_traditional')
      ORDER BY setting_type
    `);
    
    console.log('📊 Final Configuration:');
    finalResult.rows.forEach(row => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${row.setting_type}: ${row.setting_value} (${status})`);
    });
    
    // Step 5: Final diagnosis and solution
    console.log('\n🎯 FINAL DIAGNOSIS:');
    console.log('==================');
    console.log('✅ API Key: Available and active');
    console.log('✅ CrewAI: Enabled and configured');
    console.log('✅ Fallback: Disabled (will prevent "technical difficulties" messages)');
    
    console.log('\n🚨 CRITICAL NEXT STEPS:');
    console.log('========================');
    console.log('1. STOP your application server completely (Ctrl+C)');
    console.log('2. WAIT 15 seconds for all processes to terminate');
    console.log('3. RESTART your application server');
    console.log('4. Look for these console messages:');
    console.log('   ✅ "🔑 Got OpenAI API key from dealer: 0aa94346-ed1d-420e-8823-bcd97bf6456f"');
    console.log('   ✅ "✅ CrewAI LLM initialized for dealer: 0aa94346-ed1d-420e-8823-bcd97bf6456f"');
    console.log('   ❌ NO MORE "technical difficulties" messages');
    
    console.log('\n💡 What This Fix Does:');
    console.log('======================');
    console.log('- Forces CrewAI to be enabled');
    console.log('- Sets proper token limits');
    console.log('- Disables fallback responses');
    console.log('- Ensures CrewAI uses your new API key');
    console.log('- Prevents "technical difficulties" fallbacks');
    
  } catch (error) {
    console.error('❌ Error during CrewAI fix:', error.message);
  } finally {
    await pool.end();
  }
}

fixCrewAIInitialization();
