import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function debugFieldMappingsIssue() {
  const client = await pool.connect();
  try {
    console.log('=== COMPREHENSIVE FIELD MAPPINGS DEBUG ===');
    
    // 1. Check all import configs
    const configsResult = await client.query(`
      SELECT id, dealer_id, config_name, created_at 
      FROM import_configs 
      ORDER BY created_at DESC
    `);
    
    console.log('\n=== ALL IMPORT CONFIGS ===');
    configsResult.rows.forEach(config => {
      console.log(`Config ID: ${config.id}, Dealer ID: ${config.dealer_id}, Name: ${config.config_name}`);
    });
    
    if (configsResult.rows.length === 0) {
      console.log('❌ No import configs found!');
      return;
    }
    
    // 2. Check field mappings for each config
    for (const config of configsResult.rows) {
      console.log(`\n=== FIELD MAPPINGS FOR CONFIG ${config.id} (${config.config_name}) ===`);
      
      const mappingsResult = await client.query(`
        SELECT source_field, target_field, field_type, field_order, is_required
        FROM import_field_mappings 
        WHERE import_config_id = $1 
        ORDER BY field_order
      `, [config.id]);
      
      console.log(`Field mappings count: ${mappingsResult.rows.length}`);
      
      if (mappingsResult.rows.length > 0) {
        mappingsResult.rows.forEach(mapping => {
          console.log(`  ${mapping.source_field} -> ${mapping.target_field} (${mapping.field_type})`);
        });
      } else {
        console.log('❌ No field mappings found for this config');
      }
    }
    
    // 3. Test the specific query that executeImportFromPreview uses
    const dealerId = configsResult.rows[0].dealer_id;
    console.log(`\n=== TESTING QUERY FOR DEALER ${dealerId} ===`);
    
    const testQueryResult = await client.query(`
      SELECT source_field, target_field, field_type, field_order, is_required, default_value, transformation_rule
      FROM import_field_mappings 
      WHERE import_config_id IN (
        SELECT id FROM import_configs WHERE dealer_id = $1
      )
      ORDER BY field_order
    `, [dealerId]);
    
    console.log(`Test query returned ${testQueryResult.rows.length} field mappings`);
    
    if (testQueryResult.rows.length > 0) {
      console.log('Field mappings found:');
      testQueryResult.rows.forEach(mapping => {
        console.log(`  ${mapping.source_field} -> ${mapping.target_field} (${mapping.field_type})`);
      });
    } else {
      console.log('❌ No field mappings found with test query');
      
      // Check if there are any field mappings at all
      const allMappingsResult = await client.query(`
        SELECT COUNT(*) as total_mappings FROM import_field_mappings
      `);
      
      console.log(`Total field mappings in database: ${allMappingsResult.rows[0].total_mappings}`);
      
      if (allMappingsResult.rows[0].total_mappings > 0) {
        console.log('\n=== ALL FIELD MAPPINGS IN DATABASE ===');
        const allMappings = await client.query(`
          SELECT import_config_id, source_field, target_field, field_type
          FROM import_field_mappings 
          ORDER BY import_config_id, field_order
        `);
        
        allMappings.rows.forEach(mapping => {
          console.log(`Config ${mapping.import_config_id}: ${mapping.source_field} -> ${mapping.target_field} (${mapping.field_type})`);
        });
      }
    }
    
    // 4. Check if the dealer has any configs
    const dealerConfigsResult = await client.query(`
      SELECT id, config_name FROM import_configs WHERE dealer_id = $1
    `, [dealerId]);
    
    console.log(`\n=== DEALER ${dealerId} CONFIGS ===`);
    dealerConfigsResult.rows.forEach(config => {
      console.log(`  Config ID: ${config.id}, Name: ${config.config_name}`);
    });
    
  } catch (error) {
    console.error('Error debugging field mappings:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugFieldMappingsIssue(); 