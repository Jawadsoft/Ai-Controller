import { query } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateCrewAIAgentAssignments() {
  try {
    console.log('🚀 Starting CrewAI Agent Assignment Migration...');
    
    // Read migration SQL
    const migrationPath = path.join(__dirname, 'crewai-agent-assignments-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('📋 Executing CrewAI agent assignment migration...');
    await query(migrationSQL);
    
    console.log('✅ CrewAI agent assignment migration completed successfully');
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    
    const assignmentsCount = await query('SELECT COUNT(*) as count FROM crew_ai_agent_assignments');
    const dealersCount = await query('SELECT COUNT(*) as count FROM dealers');
    
    console.log(`📊 Migration Summary:`);
    console.log(`   - Dealers: ${dealersCount.rows[0].count}`);
    console.log(`   - Agent Assignments: ${assignmentsCount.rows[0].count}`);
    
    // Test the new functions
    console.log('🧪 Testing new functions...');
    
    const testDealer = await query('SELECT id FROM dealers LIMIT 1');
    if (testDealer.rows.length > 0) {
      const dealerId = testDealer.rows[0].id;
      
      // Test get_available_agents_for_dealer function
      const availableAgents = await query('SELECT * FROM get_available_agents_for_dealer($1)', [dealerId]);
      console.log(`✅ get_available_agents_for_dealer function working: ${availableAgents.rows.length} results`);
      
      // Test get_agent_performance_summary function
      const performanceSummary = await query('SELECT * FROM get_agent_performance_summary($1)', [dealerId]);
      console.log(`✅ get_agent_performance_summary function working: ${performanceSummary.rows.length} results`);
    }
    
    console.log('🎉 CrewAI Agent Assignment migration completed successfully!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Update your main app.js to include the CrewAI agent routes:');
    console.log('   import crewaiAgentRoutes from "./src/routes/crewai-agents.js";');
    console.log('   app.use("/api/crewai-agents", crewaiAgentRoutes);');
    console.log('');
    console.log('2. Add the CrewAI Agent Management component to your frontend:');
    console.log('   import CrewAIAgentManagement from "./src/components/CrewAIAgentManagement";');
    console.log('   <Route path="/crewai-agents" element={<CrewAIAgentManagement />} />');
    console.log('');
    console.log('3. Test the system by assigning agents to staff members');
    console.log('4. Monitor performance through the analytics dashboard');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCrewAIAgentAssignments()
    .then(() => {
      console.log('✅ CrewAI Agent Assignment migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default migrateCrewAIAgentAssignments;
