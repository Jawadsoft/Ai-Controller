import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function verifyImportConfigs() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying import configurations in database...\n');
    
    // Check main import configurations
    const configsResult = await client.query('SELECT COUNT(*) as count FROM import_configs');
    console.log(`📊 Import configurations: ${configsResult.rows[0].count}`);
    
    // Check related tables
    const fieldMappingsResult = await client.query('SELECT COUNT(*) as count FROM import_field_mappings');
    console.log(`📊 Field mappings: ${fieldMappingsResult.rows[0].count}`);
    
    const connectionResult = await client.query('SELECT COUNT(*) as count FROM import_connection_settings');
    console.log(`📊 Connection settings: ${connectionResult.rows[0].count}`);
    
    const fileSettingsResult = await client.query('SELECT COUNT(*) as count FROM import_file_settings');
    console.log(`📊 File settings: ${fileSettingsResult.rows[0].count}`);
    
    const processingResult = await client.query('SELECT COUNT(*) as count FROM import_processing_settings');
    console.log(`📊 Processing settings: ${processingResult.rows[0].count}`);
    
    const scheduleResult = await client.query('SELECT COUNT(*) as count FROM import_schedule_settings');
    console.log(`📊 Schedule settings: ${scheduleResult.rows[0].count}`);
    
    const total = configsResult.rows[0].count + fieldMappingsResult.rows[0].count + 
                  connectionResult.rows[0].count + fileSettingsResult.rows[0].count + 
                  processingResult.rows[0].count + scheduleResult.rows[0].count;
    
    console.log(`\n📊 Total import-related records: ${total}`);
    
    if (total === 0) {
      console.log('\n✅ SUCCESS: All import configurations have been successfully removed!');
    } else {
      console.log('\n⚠️  WARNING: Some import-related records still exist in the database.');
    }
    
  } catch (error) {
    console.error('❌ Error verifying import configurations:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the verification
verifyImportConfigs()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }); 