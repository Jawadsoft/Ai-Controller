import pg from 'pg';
const { Pool } = pg;

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL for local connections
});

async function fixCrewAITables() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('🔌 Connected to database');
    
    // Create crew_ai_settings table
    console.log('\n📋 Creating crew_ai_settings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS crew_ai_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
        enabled BOOLEAN DEFAULT false,
        auto_routing BOOLEAN DEFAULT true,
        enable_sales_crew BOOLEAN DEFAULT true,
        enable_customer_service_crew BOOLEAN DEFAULT true,
        enable_inventory_crew BOOLEAN DEFAULT false,
        crew_collaboration BOOLEAN DEFAULT true,
        agent_memory BOOLEAN DEFAULT true,
        performance_tracking BOOLEAN DEFAULT true,
        fallback_to_traditional BOOLEAN DEFAULT true,
        crew_selection TEXT DEFAULT 'auto',
        max_tokens INTEGER DEFAULT 300,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(dealer_id)
      );
    `);
    console.log('✅ crew_ai_settings table created/verified');
    
    // Create crew_ai_performance table
    console.log('\n📊 Creating crew_ai_performance table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS crew_ai_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
        agent_role TEXT NOT NULL,
        task_type TEXT NOT NULL,
        success_rate DECIMAL(5,2) DEFAULT 0,
        average_response_time DECIMAL(8,2) DEFAULT 0,
        total_tasks INTEGER DEFAULT 0,
        successful_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0,
        last_performance_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ crew_ai_performance table created/verified');
    
    // Create crew_ai_agent_memory table
    console.log('\n🧠 Creating crew_ai_agent_memory table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS crew_ai_agent_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
        agent_role TEXT NOT NULL,
        memory_key TEXT NOT NULL,
        memory_value TEXT,
        memory_type TEXT DEFAULT 'conversation',
        importance_score INTEGER DEFAULT 1,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(dealer_id, agent_role, memory_key)
      );
    `);
    console.log('✅ crew_ai_agent_memory table created/verified');
    
    // Create crew_ai_task_log table
    console.log('\n📝 Creating crew_ai_task_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS crew_ai_task_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
        agent_role TEXT NOT NULL,
        task_type TEXT NOT NULL,
        task_description TEXT,
        input_data JSONB,
        output_data JSONB,
        execution_time DECIMAL(8,2),
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ crew_ai_task_log table created/verified');
    
    // Create indexes for better performance
    console.log('\n🔍 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_dealer_id ON crew_ai_settings(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_enabled ON crew_ai_settings(enabled);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_dealer_id ON crew_ai_performance(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_agent_role ON crew_ai_performance(agent_role);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_dealer_id ON crew_ai_agent_memory(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_agent_role ON crew_ai_agent_memory(agent_role);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_dealer_id ON crew_ai_task_log(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_agent_role ON crew_ai_task_log(agent_role);
    `);
    console.log('✅ Indexes created/verified');
    
    // Insert default global crew AI settings
    console.log('\n⚙️ Inserting default Crew AI settings...');
    await client.query(`
      INSERT INTO crew_ai_settings (
        dealer_id, enabled, auto_routing, enable_sales_crew, 
        enable_customer_service_crew, enable_inventory_crew, 
        crew_collaboration, agent_memory, performance_tracking, 
        fallback_to_traditional, crew_selection, max_tokens
      ) VALUES (
        NULL, true, true, true, true, false, true, true, true, true, 'auto', 300
      ) ON CONFLICT (dealer_id) DO NOTHING;
    `);
    console.log('✅ Default Crew AI settings inserted');
    
    // Add comments to tables
    console.log('\n💬 Adding table comments...');
    await client.query(`
      COMMENT ON TABLE crew_ai_settings IS 'Configuration settings for Crew AI functionality per dealer';
      COMMENT ON TABLE crew_ai_performance IS 'Performance metrics for Crew AI agents';
      COMMENT ON TABLE crew_ai_agent_memory IS 'Memory storage for Crew AI agents to maintain context';
      COMMENT ON TABLE crew_ai_task_log IS 'Log of tasks executed by Crew AI agents';
    `);
    console.log('✅ Table comments added');
    
    console.log('\n🎉 All Crew AI tables have been created successfully!');
    console.log('\n📋 Tables created:');
    console.log('  - crew_ai_settings');
    console.log('  - crew_ai_performance');
    console.log('  - crew_ai_agent_memory');
    console.log('  - crew_ai_task_log');
    
    // Verify the tables exist
    console.log('\n🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'crew_ai_%'
      ORDER BY table_name;
    `);
    
    console.log('✅ Found Crew AI tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('❌ Error fixing Crew AI tables:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Make sure your PostgreSQL server is running');
    console.log('   - Check your DATABASE_URL environment variable');
    console.log('   - Verify you have permissions to create tables');
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the fix
fixCrewAITables().catch(console.error);
