import { pool } from './src/database/connection.js';

async function fixRoutingRules() {
  try {
    console.log('🔧 FIXING CREWAI ROUTING RULES...\n');
    
    // Check current routing rules
    const currentRules = await pool.query(`
      SELECT COUNT(*) as count
      FROM crew_ai_conversation_routing 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `);
    
    console.log(`📊 Current routing rules: ${currentRules.rows[0].count}`);
    
    if (currentRules.rows[0].count > 0) {
      console.log('✅ Routing rules already exist, showing current ones:');
      const rules = await pool.query(`
        SELECT intent_pattern, primary_agent, secondary_agents
        FROM crew_ai_conversation_routing 
        WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        ORDER BY intent_pattern
      `);
      
      rules.rows.forEach(rule => {
        console.log(`   ${rule.intent_pattern}: ${rule.primary_agent} + [${rule.secondary_agents.join(', ')}]`);
      });
      return;
    }
    
    // Insert routing rules
    console.log('🔄 Inserting routing rules...');
    
    const routingRules = [
      {
        intent_pattern: 'test_drive|financing|pricing|negotiation|purchase',
        primary_agent: 'sales',
        secondary_agents: ['inventory', 'finance'],
        routing_rules: ['Use sales agent as primary', 'Include inventory details', 'Offer financing options']
      },
      {
        intent_pattern: 'general_inquiry|scheduling|complaint|policy',
        primary_agent: 'customer_service',
        secondary_agents: ['sales'],
        routing_rules: ['Use customer service as primary', 'Escalate to sales if needed']
      },
      {
        intent_pattern: 'vehicle_specs|features|comparison|availability',
        primary_agent: 'inventory',
        secondary_agents: ['sales'],
        routing_rules: ['Use inventory agent as primary', 'Include sales context']
      },
      {
        intent_pattern: 'complex|multiple|escalation|handoff',
        primary_agent: 'manager',
        secondary_agents: ['sales', 'customer_service'],
        routing_rules: ['Use manager as coordinator', 'Involve relevant specialists']
      }
    ];
    
    for (const rule of routingRules) {
      try {
        await pool.query(`
          INSERT INTO crew_ai_conversation_routing (dealer_id, intent_pattern, primary_agent, secondary_agents, routing_rules)
          VALUES ($1, $2, $3, $4, $5)
        `, ['0aa94346-ed1d-420e-8823-bcd97bf6456f', rule.intent_pattern, rule.primary_agent, rule.secondary_agents, rule.routing_rules]);
        
        console.log(`   ✅ ${rule.intent_pattern} → ${rule.primary_agent}`);
      } catch (error) {
        console.log(`   ❌ ${rule.intent_pattern}: ${error.message}`);
      }
    }
    
    // Verify final status
    const finalCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM crew_ai_conversation_routing 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `);
    
    console.log(`\n📊 Final routing rules count: ${finalCount.rows[0].count}`);
    
    if (finalCount.rows[0].count >= 4) {
      console.log('✅ Routing rules successfully created!');
      console.log('🚀 Ready for testing!');
    } else {
      console.log('❌ Some routing rules failed to create');
    }
    
  } catch (error) {
    console.error('❌ Error fixing routing rules:', error.message);
  } finally {
    await pool.end();
  }
}

fixRoutingRules();
