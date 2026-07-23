import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function debugFieldMappings() {
  const client = await pool.connect();
  try {
    console.log('=== DEBUGGING FIELD MAPPINGS ===');
    
    // Get all import configs
    const configsResult = await client.query(`
      SELECT id, dealer_id, config_name, created_at 
      FROM import_configs 
      ORDER BY created_at DESC
    `);
    
    console.log('\n=== IMPORT CONFIGS ===');
    configsResult.rows.forEach(config => {
      console.log(`Config ID: ${config.id}, Dealer ID: ${config.dealer_id}, Name: ${config.config_name}`);
    });
    
    if (configsResult.rows.length === 0) {
      console.log('No import configs found!');
      return;
    }
    
    // Get field mappings for the most recent config
    const latestConfigId = configsResult.rows[0].id;
    console.log(`\n=== FIELD MAPPINGS FOR CONFIG ${latestConfigId} ===`);
    
    const mappingsResult = await client.query(`
      SELECT source_field, target_field, field_type, field_order, is_required
      FROM import_field_mappings 
      WHERE import_config_id = $1 
      ORDER BY field_order
    `, [latestConfigId]);
    
    console.log('\nField Mappings:');
    mappingsResult.rows.forEach(mapping => {
      console.log(`  ${mapping.source_field} -> ${mapping.target_field} (${mapping.field_type})`);
    });
    
    // Check if VIN mapping exists
    const vinMapping = mappingsResult.rows.find(m => m.target_field === 'vin');
    if (vinMapping) {
      console.log(`\n✅ VIN mapping found: ${vinMapping.source_field} -> ${vinMapping.target_field}`);
    } else {
      console.log('\n❌ NO VIN MAPPING FOUND!');
    }
    
    // Check for other required fields
    const requiredFields = ['dealer_id', 'make', 'model', 'year'];
    console.log('\n=== REQUIRED FIELD MAPPINGS ===');
    requiredFields.forEach(field => {
      const mapping = mappingsResult.rows.find(m => m.target_field === field);
      if (mapping) {
        console.log(`✅ ${field}: ${mapping.source_field} -> ${mapping.target_field}`);
      } else {
        console.log(`❌ ${field}: NO MAPPING FOUND`);
      }
    });
    
    // Show sample CSV data structure
    console.log('\n=== EXPECTED CSV STRUCTURE ===');
    console.log('Based on the error, the CSV should have these fields:');
    console.log('  - VIN: "2GNAXKEX6J6282582"');
    console.log('  - Make: "Chevrolet"');
    console.log('  - Model: "Equinox"');
    console.log('  - Year: "2018"');
    console.log('  - DealerId: "MP7042_ClayCooleyHyundaiofRockwall"');
    
  } catch (error) {
    console.error('Error debugging field mappings:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugFieldMappings(); 