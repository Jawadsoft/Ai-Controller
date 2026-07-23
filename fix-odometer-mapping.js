import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function fixOdometerMapping() {
  const client = await pool.connect();
  try {
    console.log('=== FIXING ODOMETER FIELD MAPPING ===');
    
    // Get the latest import config
    const configsResult = await client.query(`
      SELECT id, dealer_id, config_name 
      FROM import_configs 
      ORDER BY created_at DESC LIMIT 1
    `);
    
    if (configsResult.rows.length === 0) {
      console.log('No import configs found!');
      return;
    }
    
    const config = configsResult.rows[0];
    console.log(`Using config: ${config.config_name} (ID: ${config.id})`);
    
    // Check current odometer mapping
    const currentMapping = await client.query(`
      SELECT source_field, target_field, field_type 
      FROM import_field_mappings 
      WHERE import_config_id = $1 AND source_field = 'Odometer'
    `, [config.id]);
    
    if (currentMapping.rows.length > 0) {
      console.log('Current Odometer mapping:', currentMapping.rows[0]);
      
      // Update the mapping to map to 'odometer' instead of 'mileage'
      await client.query(`
        UPDATE import_field_mappings 
        SET target_field = 'odometer', updated_at = NOW()
        WHERE import_config_id = $1 AND source_field = 'Odometer'
      `, [config.id]);
      
      console.log('✅ Updated Odometer mapping to target "odometer"');
    } else {
      console.log('❌ No Odometer mapping found');
    }
    
    // Verify the fix
    const updatedMapping = await client.query(`
      SELECT source_field, target_field, field_type 
      FROM import_field_mappings 
      WHERE import_config_id = $1 AND source_field = 'Odometer'
    `, [config.id]);
    
    if (updatedMapping.rows.length > 0) {
      console.log('Updated Odometer mapping:', updatedMapping.rows[0]);
    }
    
    // Show all field mappings for verification
    const allMappings = await client.query(`
      SELECT source_field, target_field, field_type 
      FROM import_field_mappings 
      WHERE import_config_id = $1 
      ORDER BY field_order
    `, [config.id]);
    
    console.log('\n=== ALL FIELD MAPPINGS ===');
    allMappings.rows.forEach(mapping => {
      console.log(`  ${mapping.source_field} -> ${mapping.target_field} (${mapping.field_type})`);
    });
    
  } catch (error) {
    console.error('Error fixing odometer mapping:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixOdometerMapping(); 