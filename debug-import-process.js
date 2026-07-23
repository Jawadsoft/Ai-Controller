import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

// Simulate the exact process from executeImportFromPreview
async function debugImportProcess() {
  const client = await pool.connect();
  try {
    console.log('=== DEBUGGING IMPORT PROCESS ===');
    
    // Simulate the config that would be passed to executeImportFromPreview
    const testConfig = {
      dealer_id: '0aa94346-ed1d-420e-8823-bcd97bf6456f', // This should match the database
      processing: {
        duplicate_handling: 'skip',
        batch_size: 1000,
        max_errors: 100,
        validate_data: true,
        archive_processed_files: true,
        archive_directory: '/archive'
      },
      fileSettings: {
        file_type: 'csv',
        delimiter: ',',
        has_header: true,
        encoding: 'utf8',
        date_format: 'YYYY-MM-DD'
      },
      schedule: {
        frequency: 'manual',
        time_hour: 0,
        time_minute: 0
      }
    };
    
    console.log('Test config dealer_id:', testConfig.dealer_id);
    
    // Test the exact query from executeImportFromPreview
    console.log('\n=== TESTING FIELD MAPPINGS QUERY ===');
    const mappingsResult = await client.query(`
      SELECT source_field, target_field, field_type, field_order, is_required, default_value, transformation_rule
      FROM import_field_mappings 
      WHERE import_config_id IN (
        SELECT id FROM import_configs WHERE dealer_id = $1
      )
      ORDER BY field_order
    `, [testConfig.dealer_id]);
    
    console.log(`Query returned ${mappingsResult.rows.length} field mappings`);
    
    if (mappingsResult.rows.length > 0) {
      console.log('Field mappings found:');
      mappingsResult.rows.forEach(mapping => {
        console.log(`  ${mapping.source_field} -> ${mapping.target_field} (${mapping.field_type})`);
      });
      
      // Test with a sample record
      const sampleRecord = {
        "DealerId": "MP7042_ClayCooleyHyundaiofRockwall",
        "VIN": "2GNAXKEX6J6282582",
        "Year": "2018",
        "Make": "Chevrolet",
        "Model": "Equinox",
        "Series": "LT",
        "Odometer": "62060",
        "Price": "16888"
      };
      
      console.log('\n=== TESTING TRANSFORMATION ===');
      console.log('Sample record:', sampleRecord);
      
      // Simulate the transformation process
      const transformed = {};
      
      for (const mapping of mappingsResult.rows) {
        const sourceField = mapping.source_field;
        const targetField = mapping.target_field;
        const fieldType = mapping.field_type;
        
        const sourceValue = sampleRecord[sourceField];
        
        console.log(`Mapping: ${sourceField} -> ${targetField}, Value: "${sourceValue}"`);
        
        if (sourceValue !== undefined) {
          const cleanedValue = sourceValue.toString().trim();
          
          let transformedValue = cleanedValue;
          
          // Convert to number if needed
          if (fieldType === 'number' || fieldType === 'integer' || fieldType === 'decimal') {
            const numValue = parseFloat(cleanedValue);
            if (!isNaN(numValue)) {
              transformedValue = fieldType === 'integer' ? parseInt(numValue) : numValue;
            } else {
              transformedValue = null;
            }
          }
          
          transformed[targetField] = transformedValue;
          console.log(`  Transformed: ${transformedValue} (${typeof transformedValue})`);
        } else {
          console.log(`  No value found for ${sourceField}`);
        }
      }
      
      console.log('\n=== FINAL TRANSFORMED RECORD ===');
      console.log(JSON.stringify(transformed, null, 2));
      
      // Check required fields
      const requiredFields = ['dealer_id', 'vin', 'make', 'model', 'year'];
      console.log('\n=== REQUIRED FIELD CHECK ===');
      requiredFields.forEach(field => {
        const value = transformed[field];
        if (value !== undefined && value !== null && value !== '') {
          console.log(`✅ ${field}: ${value}`);
        } else {
          console.log(`❌ ${field}: MISSING or EMPTY`);
        }
      });
      
    } else {
      console.log('❌ No field mappings found!');
    }
    
  } catch (error) {
    console.error('Error debugging import process:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugImportProcess(); 