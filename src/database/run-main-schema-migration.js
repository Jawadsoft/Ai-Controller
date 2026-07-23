import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dealeriq',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMainSchemaMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Main Schema Migration...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'main-schema-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration file loaded successfully');
    console.log(`📊 File size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);
    
    // Split the migration into logical sections for better error handling
    const sections = migrationSQL.split('-- =====================================================');
    
    console.log(`🔧 Found ${sections.length - 1} migration sections\n`);
    
    // Execute the migration
    console.log('⚡ Executing migration...\n');
    
    const result = await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log(`📈 Result: ${result.command || 'Migration executed'}\n`);
    
    // Verify key tables were created
    console.log('🔍 Verifying key tables...\n');
    
    const tablesToCheck = [
      'users', 'dealers', 'vehicles', 'leads', 'user_roles', 'subscription_plans',
      'daive_conversations', 'daive_prompts', 'daive_user_interests',
      'daive_voice_sessions', 'daive_analytics', 'daive_api_settings',
      'chat_conversations', 'conversation_messages', 'user_interests',
      'etl_export_configs', 'etl_connection_settings', 'etl_company_settings',
      'etl_dealer_authorizations', 'etl_export_filters', 'etl_field_mappings',
      'etl_file_format_settings', 'etl_file_naming_settings', 'etl_schedule_settings',
      'etl_export_history', 'import_configs', 'import_connection_settings',
      'import_file_settings', 'import_field_mappings', 'import_processing_settings',
      'import_schedule_settings', 'import_history', 'import_errors',
      'voice_settings', 'dealer_prompts', 'test_drives', 'inventory_alerts',
      'dealer_settings', 'audit_log',        'crew_ai_agents', 'crew_ai_conversation_routing',
       'crew_ai_workflows', 'crew_ai_performance', 'crew_ai_agent_memory',
       'crew_ai_task_log'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        if (tableCheck.rows[0].exists) {
          console.log(`✅ Table '${tableName}' exists`);
        } else {
          console.log(`❌ Table '${tableName}' missing`);
        }
      } catch (error) {
        console.log(`⚠️ Could not check table '${tableName}': ${error.message}`);
      }
    }
    
    // Check indexes
    console.log('\n🔍 Checking key indexes...\n');
    
    const indexCheck = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `);
    
    console.log(`📊 Found ${indexCheck.rows.length} indexes:`);
    indexCheck.rows.forEach(row => {
      console.log(`   - ${row.indexname} (${row.tablename})`);
    });
    
    // Check triggers
    console.log('\n🔍 Checking triggers...\n');
    
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `);
    
    console.log(`📊 Found ${triggerCheck.rows.length} triggers:`);
    triggerCheck.rows.forEach(row => {
      console.log(`   - ${row.trigger_name} (${row.event_object_table})`);
    });
    
    // Check views
    console.log('\n🔍 Checking views...\n');
    
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log(`📊 Found ${viewCheck.rows.length} views:`);
    viewCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n🎉 Main Schema Migration completed successfully!');
    console.log('\n📚 Next Steps:');
    console.log('   1. Verify all tables were created correctly');
    console.log('   2. Check that indexes are in place');
    console.log('   3. Verify triggers are working');
    console.log('   4. Test the application functionality');
    console.log('   5. Run any additional data migrations if needed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n🔍 Error details:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    console.error('   Hint:', error.hint);
    
    // Try to get more context about where the error occurred
    if (error.position) {
      console.error('\n📍 Error position in SQL:', error.position);
      
      // Try to show the context around the error
      const migrationPath = path.join(__dirname, 'main-schema-migration.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      const lines = migrationSQL.split('\n');
      const errorLine = Math.floor(error.position / 80) + 1; // Rough estimate
      
      console.error('\n📄 Context around error (approximate):');
      for (let i = Math.max(0, errorLine - 3); i < Math.min(lines.length, errorLine + 3); i++) {
        const marker = i === errorLine ? '>>> ' : '    ';
        console.error(`${marker}${i + 1}: ${lines[i]}`);
      }
    }
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMainSchemaMigration().catch(console.error);
