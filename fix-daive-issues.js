import pg from 'pg';
const { Pool } = pg;

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL for local connections
});

async function fixDaiveIssues() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('🔌 Connected to database');
    
    // Check if crew_ai_settings table exists
    console.log('\n🔍 Checking if crew_ai_settings table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'crew_ai_settings'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ crew_ai_settings table is missing - creating it now...');
      
      // Create crew_ai_settings table
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
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_dealer_id ON crew_ai_settings(dealer_id);
        CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_enabled ON crew_ai_settings(enabled);
      `);
      
      // Insert default global settings
      await client.query(`
        INSERT INTO crew_ai_settings (
          dealer_id, enabled, auto_routing, enable_sales_crew, 
          enable_customer_service_crew, enable_inventory_crew, 
          crew_collaboration, agent_memory, performance_tracking, 
          fallback_to_traditional, crew_selection, max_tokens
        ) VALUES (
          NULL, true, true, true, true, false, true, true, true, true, 'auto', 300
        );
      `);
      
      console.log('✅ crew_ai_settings table created successfully');
    } else {
      console.log('✅ crew_ai_settings table already exists');
    }
    
    // Check if daive_prompts table exists and has correct structure
    console.log('\n🔍 Checking daive_prompts table...');
    const promptsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daive_prompts'
      );
    `);
    
    if (!promptsCheck.rows[0].exists) {
      console.log('❌ daive_prompts table is missing - creating it now...');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS daive_prompts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
          prompt_type TEXT NOT NULL,
          prompt_text TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(dealer_id, prompt_type)
        );
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_daive_prompts_dealer_id ON daive_prompts(dealer_id);
      `);
      
      console.log('✅ daive_prompts table created successfully');
    } else {
      console.log('✅ daive_prompts table already exists');
    }
    
    // Check if dealers table exists (required for foreign key references)
    console.log('\n🔍 Checking dealers table...');
    const dealersCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'dealers'
      );
    `);
    
    if (!dealersCheck.rows[0].exists) {
      console.log('❌ dealers table is missing - this is required for Crew AI and DAIVE to work');
      console.log('💡 Please run your main database setup first to create the dealers table');
      return;
    } else {
      console.log('✅ dealers table exists');
    }
    
    // Test Crew AI settings endpoint functionality
    console.log('\n🧪 Testing Crew AI settings functionality...');
    try {
      const settingsResult = await client.query(`
        SELECT * FROM crew_ai_settings 
        WHERE dealer_id IS NULL 
        LIMIT 1
      `);
      
      if (settingsResult.rows.length > 0) {
        console.log('✅ Crew AI settings query works - found default settings');
        console.log('   Settings:', settingsResult.rows[0]);
      } else {
        console.log('⚠️ No default Crew AI settings found');
      }
    } catch (error) {
      console.log('❌ Error testing Crew AI settings:', error.message);
    }
    
    // Test DAIVE prompts functionality
    console.log('\n🧪 Testing DAIVE prompts functionality...');
    try {
      const promptsResult = await client.query(`
        SELECT COUNT(*) as prompt_count FROM daive_prompts
      `);
      
      console.log(`✅ DAIVE prompts query works - found ${promptsResult.rows[0].prompt_count} prompts`);
    } catch (error) {
      console.log('❌ Error testing DAIVE prompts:', error.message);
    }
    
    // Check for any existing prompts
    console.log('\n🔍 Checking for existing DAIVE prompts...');
    const existingPrompts = await client.query(`
      SELECT prompt_type, COUNT(*) as count 
      FROM daive_prompts 
      GROUP BY prompt_type
    `);
    
    if (existingPrompts.rows.length > 0) {
      console.log('📋 Existing prompt types:');
      existingPrompts.rows.forEach(row => {
        console.log(`   - ${row.prompt_type}: ${row.count} prompts`);
      });
    } else {
      console.log('📝 No existing prompts found');
    }
    
    // Summary
    console.log('\n📊 Summary of fixes applied:');
    console.log('✅ Crew AI settings table verified/created');
    console.log('✅ DAIVE prompts table verified/created');
    console.log('✅ Required indexes created');
    console.log('✅ Default Crew AI settings inserted');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your application');
    console.log('   2. Try accessing Crew AI settings again');
    console.log('   3. Test saving quick prompts');
    console.log('   4. Check the browser console for any remaining errors');
    
  } catch (error) {
    console.error('❌ Error fixing DAIVE issues:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Make sure your PostgreSQL server is running');
    console.log('   - Check your DATABASE_URL environment variable');
    console.log('   - Verify you have permissions to create tables');
    console.log('   - Check if the dealers table exists');
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the fix
fixDaiveIssues().catch(console.error);
