import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function clearImportConfigs() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to clear all import configurations...');
    
    // First, let's see what configurations exist
    const configsResult = await client.query(`
      SELECT id, config_name, dealer_id FROM import_configs
    `);
    
    if (configsResult.rows.length === 0) {
      console.log('✅ No import configurations found in database');
      return;
    }
    
    console.log(`Found ${configsResult.rows.length} import configurations:`);
    configsResult.rows.forEach(config => {
      console.log(`- ID: ${config.id}, Name: ${config.config_name}, Dealer: ${config.dealer_id}`);
    });
    
    console.log('\n🗑️  Proceeding with deletion...');
    
    // Delete in the correct order to respect foreign key constraints
    await client.query('BEGIN');
    
    try {
      // Delete field mappings first (they reference import_configs)
      const fieldMappingsResult = await client.query('DELETE FROM import_field_mappings');
      console.log(`✅ Deleted ${fieldMappingsResult.rowCount} field mappings`);
      
      // Delete connection settings
      const connectionResult = await client.query('DELETE FROM import_connection_settings');
      console.log(`✅ Deleted ${connectionResult.rowCount} connection settings`);
      
      // Delete file settings
      const fileSettingsResult = await client.query('DELETE FROM import_file_settings');
      console.log(`✅ Deleted ${fileSettingsResult.rowCount} file settings`);
      
      // Delete processing settings
      const processingResult = await client.query('DELETE FROM import_processing_settings');
      console.log(`✅ Deleted ${processingResult.rowCount} processing settings`);
      
      // Delete schedule settings
      const scheduleResult = await client.query('DELETE FROM import_schedule_settings');
      console.log(`✅ Deleted ${scheduleResult.rowCount} schedule settings`);
      
      // Finally, delete the main import configurations
      const configsResult = await client.query('DELETE FROM import_configs');
      console.log(`✅ Deleted ${configsResult.rowCount} import configurations`);
      
      await client.query('COMMIT');
      console.log('\n🎉 Successfully cleared all import configurations!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error during deletion:', error);
      throw error;
    }
    
    // Verify deletion
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM import_configs');
    console.log(`\n📊 Verification: ${verifyResult.rows[0].count} configurations remaining`);
    
    if (verifyResult.rows[0].count > 0) {
      console.log('⚠️  Some configurations still exist. Trying force deletion...');
      
      // Try to delete any remaining records
      const remainingConfigs = await client.query('SELECT * FROM import_configs');
      console.log('Remaining configurations:', remainingConfigs.rows);
      
      // Force delete any remaining records
      await client.query('DELETE FROM import_configs');
      console.log('✅ Force deletion completed');
    }
    
  } catch (error) {
    console.error('❌ Error clearing import configurations:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
clearImportConfigs()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }); 