import pg from 'pg';
const { Pool } = pg;

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL for local connections
});

async function checkTables() {
  let client;
  
  try {
    client = await pool.connect();
    
    // Get all tables from local database
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const localTables = result.rows.map(row => row.table_name);
    
    // Your provided list
    const providedList = [
      'chat_conversations',
      'conversation_messages',
      'crew_ai_agent_memory',
      'crew_ai_performance',
      'crew_ai_settings',
      'crew_ai_task_log',
      'daive_analytics',
      'daive_api_settings',
      'daive_conversations',
      'daive_prompts',
      'daive_voice_sessions',
      'dealers',
      'etl_company_settings',
      'etl_connection_settings',
      'etl_dealer_authorizations',
      'etl_export_configs',
      'etl_export_filters',
      'etl_export_history',
      'etl_field_mappings',
      'etl_file_format_settings',
      'etl_file_naming_settings',
      'etl_schedule_settings',
      'import_configs',
      'import_connection_settings',
      'import_errors',
      'import_field_mappings',
      'import_file_settings',
      'import_history',
      'import_processing_settings',
      'import_schedule_settings',
      'leads',
      'subscription_plans',
      'user_roles',
      'users',
      'vehicles',
      'voice_settings'
    ];
    
    console.log('🔍 Checking local database tables...\n');
    
    console.log('📋 Tables in your provided list:');
    providedList.forEach(table => console.log(`  - ${table}`));
    
    console.log('\n🗄️ Tables found in local database:');
    localTables.forEach(table => console.log(`  - ${table}`));
    
    console.log('\n📊 Analysis:');
    console.log(`  Total tables in list: ${providedList.length}`);
    console.log(`  Total tables in local DB: ${localTables.length}`);
    
    // Find missing tables (in list but not in local DB)
    const missingInLocal = providedList.filter(table => !localTables.includes(table));
    
    // Find extra tables (in local DB but not in list)
    const extraInLocal = localTables.filter(table => !providedList.includes(table));
    
    if (missingInLocal.length > 0) {
      console.log('\n❌ Tables in your list but MISSING from local database:');
      missingInLocal.forEach(table => console.log(`  - ${table}`));
    } else {
      console.log('\n✅ All tables from your list are present in local database!');
    }
    
    if (extraInLocal.length > 0) {
      console.log('\n➕ Extra tables in local database (not in your list):');
      extraInLocal.forEach(table => console.log(`  - ${table}`));
    } else {
      console.log('\n✅ No extra tables found in local database!');
    }
    
    // Summary
    console.log('\n📈 Summary:');
    if (missingInLocal.length === 0 && extraInLocal.length === 0) {
      console.log('🎉 Perfect match! Your list and local database are in sync.');
    } else {
      console.log(`📝 ${missingInLocal.length} tables need to be created`);
      console.log(`🔧 ${extraInLocal.length} extra tables found`);
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Make sure your local PostgreSQL server is running');
    console.log('   - Check your DATABASE_URL environment variable');
    console.log('   - Verify database connection settings');
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the check
checkTables().catch(console.error);
