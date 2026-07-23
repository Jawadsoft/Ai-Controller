import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixImportScheduleConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing import schedule constraint to allow "manual" frequency...');
    
    // Drop the existing constraint
    console.log('\n📋 Dropping existing frequency constraint...');
    try {
      await client.query('ALTER TABLE import_schedule_settings DROP CONSTRAINT IF EXISTS import_schedule_settings_frequency_check');
      console.log('✅ Dropped existing frequency constraint');
    } catch (error) {
      console.log('⚠️ Constraint drop warning:', error.message);
    }
    
    // Add new constraint that includes "manual"
    console.log('\n📋 Adding new frequency constraint with "manual" option...');
    await client.query(`
      ALTER TABLE import_schedule_settings 
      ADD CONSTRAINT import_schedule_settings_frequency_check 
      CHECK (frequency IN ('daily', 'weekly', 'monthly', 'hourly', 'manual'))
    `);
    console.log('✅ Added new frequency constraint with "manual" option');
    
    // Verify the constraint
    console.log('\n🔍 Verifying the constraint...');
    const constraintResult = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'import_schedule_settings_frequency_check'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✅ Constraint verified:');
      console.log(`  - Name: ${constraintResult.rows[0].constraint_name}`);
      console.log(`  - Check: ${constraintResult.rows[0].check_clause}`);
    }
    
    // Test inserting a manual frequency record
    console.log('\n🧪 Testing manual frequency insertion...');
    try {
      // First, get an existing import config ID
      const configResult = await client.query('SELECT id FROM import_configs LIMIT 1');
      
      if (configResult.rows.length > 0) {
        const configId = configResult.rows[0].id;
        
        // Try to insert a manual frequency record
        await client.query(`
          INSERT INTO import_schedule_settings (
            import_config_id, frequency, time_hour, time_minute, 
            day_of_week, day_of_month, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [configId, 'manual', 0, 0, null, null, false]);
        
        console.log('✅ Manual frequency insertion test successful');
        
        // Clean up test record
        await client.query('DELETE FROM import_schedule_settings WHERE frequency = $1', ['manual']);
        console.log('✅ Test record cleaned up');
      } else {
        console.log('⚠️ No import configs found to test with');
      }
    } catch (error) {
      console.log('❌ Manual frequency test failed:', error.message);
    }
    
    console.log('\n🎉 Import schedule constraint fix completed!');
    
  } catch (error) {
    console.error('💥 Constraint fix failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixImportScheduleConstraint().catch(console.error);
