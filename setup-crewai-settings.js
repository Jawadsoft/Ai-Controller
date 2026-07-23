import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupCrewAISettings() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('🔌 Connected to database');
    
    // Check if daive_api_settings table exists
    console.log('\n🔍 Checking if daive_api_settings table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daive_api_settings'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ daive_api_settings table is missing - creating it now...');
      
      // Create daive_api_settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS daive_api_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
          setting_type VARCHAR(100) NOT NULL,
          setting_value TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(dealer_id, setting_type)
        );
      `);
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_daive_api_settings_dealer_id ON daive_api_settings(dealer_id);
        CREATE INDEX IF NOT EXISTS idx_daive_api_settings_type ON daive_api_settings(setting_type);
        CREATE INDEX IF NOT EXISTS idx_daive_api_settings_active ON daive_api_settings(is_active);
      `);
      
      console.log('✅ daive_api_settings table created with indexes');
    } else {
      console.log('✅ daive_api_settings table exists');
    }
    
    // Initialize Crew AI settings in daive_api_settings table
    console.log('\n⚙️ Initializing Crew AI settings in daive_api_settings table...');
    
    const crewAISettings = [
      { setting_type: 'crew_ai_enabled', setting_value: 'false' },
      { setting_type: 'crew_ai_max_tokens', setting_value: '300' },
      { setting_type: 'crew_ai_auto_routing', setting_value: 'true' },
      { setting_type: 'crew_ai_enable_sales_crew', setting_value: 'true' },
      { setting_type: 'crew_ai_enable_customer_service_crew', setting_value: 'true' },
      { setting_type: 'crew_ai_enable_inventory_crew', setting_value: 'false' },
      { setting_type: 'crew_ai_crew_collaboration', setting_value: 'true' },
      { setting_type: 'crew_ai_agent_memory', setting_value: 'true' },
      { setting_type: 'crew_ai_performance_tracking', setting_value: 'true' },
      { setting_type: 'crew_ai_fallback_to_traditional', setting_value: 'true' },
      { setting_type: 'crew_ai_crew_selection', setting_value: 'auto' }
    ];
    
    // Insert global Crew AI settings (dealer_id = NULL)
    for (const setting of crewAISettings) {
      await client.query(`
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active)
        VALUES (NULL, $1, $2, true)
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET 
          setting_value = $2,
          is_active = true,
          updated_at = NOW()
      `, [setting.setting_type, setting.setting_value]);
    }
    
    console.log('✅ Global Crew AI settings initialized');
    
    // Check if there are any existing dealers to initialize settings for
    console.log('\n🔍 Checking for existing dealers...');
    const dealersResult = await client.query(`
      SELECT id, name FROM dealers LIMIT 5
    `);
    
    if (dealersResult.rows.length > 0) {
      console.log(`📋 Found ${dealersResult.rows.length} dealers, initializing Crew AI settings...`);
      
      for (const dealer of dealersResult.rows) {
        console.log(`  - Initializing settings for dealer: ${dealer.name} (${dealer.id})`);
        
        for (const setting of crewAISettings) {
          await client.query(`
            INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (dealer_id, setting_type) 
            DO UPDATE SET 
              setting_value = $3,
              is_active = true,
              updated_at = NOW()
          `, [dealer.id, setting.setting_type, setting.setting_value]);
        }
      }
      
      console.log('✅ Dealer-specific Crew AI settings initialized');
    } else {
      console.log('⚠️ No dealers found, skipping dealer-specific settings');
    }
    
    // Verify the settings were created
    console.log('\n🔍 Verifying Crew AI settings...');
    const settingsCheck = await client.query(`
      SELECT setting_type, setting_value, dealer_id, is_active
      FROM daive_api_settings 
      WHERE setting_type LIKE 'crew_ai%'
      ORDER BY dealer_id NULLS FIRST, setting_type
    `);
    
    console.log('✅ Crew AI settings in database:');
    settingsCheck.rows.forEach(row => {
      const dealer = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
      console.log(`  - ${dealer}: ${row.setting_type} = ${row.setting_value} (${row.is_active ? 'active' : 'inactive'})`);
    });
    
    console.log('\n🎉 Crew AI settings setup completed successfully!');
    console.log('\n📋 What was accomplished:');
    console.log('  - Verified/created daive_api_settings table');
    console.log('  - Initialized global Crew AI settings');
    console.log('  - Initialized dealer-specific Crew AI settings');
    console.log('  - All settings are now accessible via settingsManager');
    
  } catch (error) {
    console.error('❌ Error setting up Crew AI settings:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the setup
if (import.meta.url === `file://${process.argv[1]}`) {
  setupCrewAISettings()
    .then(() => {
      console.log('\n✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
}

export default setupCrewAISettings;
