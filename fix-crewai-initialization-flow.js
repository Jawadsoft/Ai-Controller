import { pool } from './src/database/connection.js';

async function fixCrewAIInitializationFlow() {
  try {
    console.log('🔧 FIXING CREWAI INITIALIZATION FLOW...\n');
    
    // Step 1: Check current CrewAI settings
    console.log('📋 Step 1: Current CrewAI Settings...');
    console.log('====================================');
    
    const crewAISettings = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND setting_type LIKE 'crew_ai_%'
      ORDER BY setting_type
    `);
    
    console.log(`📊 Found ${crewAISettings.rows.length} CrewAI settings:`);
    crewAISettings.rows.forEach(row => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${row.setting_type}: ${row.setting_value} (${status})`);
    });
    
    // Step 2: Check if agents table exists and has agents
    console.log('\n📋 Step 2: Checking Agent Table...');
    console.log('==================================');
    
    try {
      const agentsResult = await pool.query(`
        SELECT agent_type, agent_name, agent_priority, is_active
        FROM crew_ai_agents 
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        ORDER BY agent_priority
      `);
      
      if (agentsResult.rows.length === 0) {
        console.log('❌ No agents found in agents table!');
        console.log('   This means the agents were never created during initialization.');
        console.log('   The fix script needs to be run first.');
        return;
      }
      
      console.log(`✅ Found ${agentsResult.rows.length} agents in table:`);
      agentsResult.rows.forEach(row => {
        const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`   ${row.agent_priority}. ${row.agent_type}: ${row.agent_name} (${status})`);
      });
      
    } catch (error) {
      console.log('❌ Agents table not found or error accessing it:', error.message);
      console.log('   This confirms the initialization flow is broken.');
      return;
    }
    
    // Step 3: Check CrewAI initialization status
    console.log('\n📋 Step 3: CrewAI Initialization Status...');
    console.log('==========================================');
    
    const criticalSettings = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND setting_type IN (
        'crew_ai_enabled', 
        'crew_ai_fallback_to_traditional', 
        'crew_ai_force_agent_usage',
        'crew_ai_auto_routing'
      )
      ORDER BY setting_type
    `);
    
    console.log('📊 Critical CrewAI Settings:');
    let allSettingsCorrect = true;
    
    const expectedSettings = {
      'crew_ai_enabled': 'true',
      'crew_ai_fallback_to_traditional': 'false',
      'crew_ai_force_agent_usage': 'true',
      'crew_ai_auto_routing': 'true'
    };
    
    criticalSettings.rows.forEach(row => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      const expectedValue = expectedSettings[row.setting_type];
      const isCorrect = expectedValue && row.setting_value === expectedValue;
      
      console.log(`   ${row.setting_type}: ${row.setting_value} (${status})`);
      
      if (!expectedValue) {
        console.log(`      ⚠️  Unknown setting type`);
      } else if (!isCorrect) {
        console.log(`      ❌ Expected: ${expectedValue}`);
        allSettingsCorrect = false;
      } else {
        console.log(`      ✅ Correct value`);
      }
    });
    
    // Step 4: Analysis of the initialization problem
    console.log('\n📋 Step 4: Initialization Problem Analysis...');
    console.log('============================================');
    
    console.log('🔍 ROOT CAUSE IDENTIFIED:');
    console.log('=========================');
    console.log('❌ The DAIVE Service initialize() method is NOT calling initializeCrewAI()');
    console.log('❌ This means agents are never created during service startup');
    console.log('❌ The service falls back to basic CrewAI without specialized agents');
    console.log('❌ Result: crewUsed: false, intent: ERROR, fallback responses');
    
    console.log('\n🔍 CURRENT INITIALIZATION FLOW:');
    console.log('==============================');
    console.log('1. ✅ Settings Manager initialized');
    console.log('2. ✅ Embeddings initialized');
    console.log('3. ❌ CrewAI initialization SKIPPED (commented out)');
    console.log('4. ❌ Agents never created');
    console.log('5. ❌ Service marked as initialized without CrewAI');
    console.log('6. ❌ Fallback responses used');
    
    // Step 5: Create the fix
    console.log('\n📋 Step 5: Creating Initialization Fix...');
    console.log('==========================================');
    
    console.log('🔧 FIX REQUIRED: Modify src/lib/daivecrewai.js');
    console.log('=============================================');
    
    const fixCode = `
// LOCATION: src/lib/daivecrewai.js, around line 6050
// PROBLEM: The initialize() method is not calling initializeCrewAI()

// CURRENT CODE (BROKEN):
console.log('🤖 Step 2: Initializing CrewAI LLM with dynamic dealer detection...');
// Don't initialize with a hardcoded dealer ID - let it be initialized per conversation
// await this.initializeCrewAI('0aa94346-ed1d-420e-8823-bcd97bf6456f');

// FIXED CODE:
console.log('🤖 Step 2: Initializing CrewAI LLM with dynamic dealer detection...');
// Initialize CrewAI with a default dealer to ensure agents are created
await this.initializeCrewAI('0aa94346-ed1d-420e-8823-bcd97bf6456f');

// ALSO FIX: The initialization check should verify agents, not just crewAI
if (this.crewAI && this.agents && Object.keys(this.agents).length > 0) {
  this.initialized = true;
  console.log('✅ Unified DAIVE Service initialized successfully with agents');
  
  // Log service status
  const crewAIStatus = this.crewAI ? '✅' : '❌';
  const agentsStatus = this.agents && Object.keys(this.agents).length > 0 ? '✅' : '❌';
  console.log(\`📊 Service Status: Settings=✅, CrewAI=\${crewAIStatus}, Agents=\${agentsStatus}, Dealer=Dynamic (per conversation)\`);
} else {
  console.warn('⚠️ Service initialized but CrewAI or agents not available - will use fallback responses');
  this.initialized = false;
}
`;
    
    console.log(fixCode);
    
    // Step 6: Alternative database-based fix
    console.log('\n📋 Step 6: Alternative Database Fix...');
    console.log('=======================================');
    
    console.log('🔧 DATABASE FIX: Force enable CrewAI and disable fallbacks');
    console.log('================================================================');
    
    const forceEnableSettings = {
      'crew_ai_enabled': 'true',
      'crew_ai_fallback_to_traditional': 'false',
      'crew_ai_force_agent_usage': 'true',
      'crew_ai_auto_routing': 'true',
      'crew_ai_crew_collaboration': 'true',
      'crew_ai_agent_memory': 'true',
      'crew_ai_performance_tracking': 'true'
    };
    
    console.log('🔄 Force-enabling CrewAI settings...');
    
    for (const [settingType, settingValue] of Object.entries(forceEnableSettings)) {
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
    
    // Step 7: Final verification and recommendations
    console.log('\n📋 Step 7: Final Verification...');
    console.log('================================');
    
    const finalResult = await pool.query(`
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND setting_type IN ('crew_ai_enabled', 'crew_ai_fallback_to_traditional', 'crew_ai_force_agent_usage')
      ORDER BY setting_type
    `);
    
    console.log('📊 Final CrewAI Configuration:');
    finalResult.rows.forEach(row => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`   ${row.setting_type}: ${row.setting_value} (${status})`);
    });
    
    // Step 8: Summary and next steps
    console.log('\n🎯 INITIALIZATION FLOW FIX SUMMARY:');
    console.log('===================================');
    console.log('✅ Database settings: Force-enabled CrewAI');
    console.log('❌ Code initialization: Still broken (needs manual fix)');
    console.log('❌ Agent creation: Will fail until code is fixed');
    
    console.log('\n🚨 CRITICAL NEXT STEPS:');
    console.log('========================');
    console.log('1. MANUAL CODE FIX REQUIRED:');
    console.log('   - Edit src/lib/daivecrewai.js');
    console.log('   - Uncomment the initializeCrewAI() call in initialize() method');
    console.log('   - Fix the initialization check to verify agents');
    console.log('');
    console.log('2. RESTART your application server');
    console.log('3. Look for these console messages:');
    console.log('   ✅ "🔧 Starting dealership agents initialization..."');
    console.log('   ✅ "👨‍💼 Creating Sales Consultant agent..."');
    console.log('   ✅ "✅ Dealership sales crew initialized with 4 specialized agents"');
    console.log('4. Test the AI bot - should now show:');
    console.log('   ✅ crewUsed: true (not false)');
    console.log('   ✅ intent: Proper intent (not ERROR)');
    console.log('   ✅ No "technical difficulties" messages');
    
    console.log('\n💡 Why This Happened:');
    console.log('=====================');
    console.log('- The initialize() method was commented out to prevent hardcoded dealer ID');
    console.log('- But this also prevented agent creation during service startup');
    console.log('- Agents are only created when initializeCrewAI() is called');
    console.log('- Without agents, the service falls back to basic responses');
    console.log('- Result: crewUsed: false and fallback responses');
    
  } catch (error) {
    console.error('❌ Error during CrewAI initialization flow fix:', error.message);
  } finally {
    await pool.end();
  }
}

fixCrewAIInitializationFlow();
