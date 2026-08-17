import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING
});

async function checkImportErrors() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking recent import errors...\n');
    
    // Get the most recent import
    const recentImport = await client.query(`
      SELECT 
        id,
        import_config_id,
        import_status,
        file_name,
        records_processed,
        records_inserted,
        records_updated,
        records_skipped,
        records_failed,
        started_at,
        completed_at
      FROM import_history
      ORDER BY started_at DESC
      LIMIT 1
    `);
    
    if (recentImport.rows.length === 0) {
      console.log('❌ No import history found');
      return;
    }
    
    const importRecord = recentImport.rows[0];
    console.log('📊 Most Recent Import:');
    console.log('   ID:', importRecord.id);
    console.log('   File:', importRecord.file_name);
    console.log('   Status:', importRecord.import_status);
    console.log('   Processed:', importRecord.records_processed);
    console.log('   Inserted:', importRecord.records_inserted);
    console.log('   Updated:', importRecord.records_updated);
    console.log('   Skipped:', importRecord.records_skipped);
    console.log('   Failed:', importRecord.records_failed);
    console.log('   Started:', importRecord.started_at);
    console.log('   Completed:', importRecord.completed_at);
    console.log('');
    
    if (importRecord.records_failed === 0) {
      console.log('✅ No failed records - import was 100% successful!');
      return;
    }
    
    // Get error details
    console.log(`⚠️ Analyzing ${importRecord.records_failed} failed records...\n`);
    
    const errors = await client.query(`
      SELECT 
        row_number,
        error_message,
        raw_data
      FROM import_errors
      WHERE import_history_id = $1
      ORDER BY row_number
      LIMIT 50
    `, [importRecord.id]);
    
    if (errors.rows.length === 0) {
      console.log('❌ No error details found in import_errors table');
      return;
    }
    
    // Group errors by message
    const errorGroups = {};
    errors.rows.forEach(error => {
      const msg = error.error_message;
      if (!errorGroups[msg]) {
        errorGroups[msg] = {
          count: 0,
          examples: []
        };
      }
      errorGroups[msg].count++;
      if (errorGroups[msg].examples.length < 3) {
        errorGroups[msg].examples.push({
          row: error.row_number,
          data: error.raw_data
        });
      }
    });
    
    console.log('📋 Error Summary by Type:\n');
    Object.entries(errorGroups).forEach(([message, data]) => {
      console.log(`❌ ${message}`);
      console.log(`   Count: ${data.count} records`);
      console.log(`   Example rows: ${data.examples.map(e => e.row).join(', ')}`);
      
      if (data.examples.length > 0) {
        console.log(`   Example data:`);
        try {
          const exampleData = JSON.parse(data.examples[0].data);
          const keys = Object.keys(exampleData);
          const sample = {};
          keys.slice(0, 5).forEach(key => {
            sample[key] = exampleData[key];
          });
          console.log('   ', JSON.stringify(sample, null, 2).replace(/\n/g, '\n    '));
        } catch (e) {
          console.log('    ', data.examples[0].data.substring(0, 100) + '...');
        }
      }
      console.log('');
    });
    
    // Check for common patterns
    console.log('🔍 Common Failure Patterns:\n');
    
    const allErrors = errors.rows.map(e => e.error_message);
    
    if (allErrors.some(e => e.includes('vin') && e.includes('missing'))) {
      console.log('⚠️ Missing VIN: Some records are missing VIN (required field)');
      console.log('   Solution: Ensure your CSV has a VIN column and it\'s mapped correctly');
      console.log('');
    }
    
    if (allErrors.some(e => e.includes('make') && e.includes('missing'))) {
      console.log('⚠️ Missing Make: Some records are missing Make (required field)');
      console.log('   Solution: Ensure your CSV has a Make column and it\'s mapped correctly');
      console.log('');
    }
    
    if (allErrors.some(e => e.includes('model') && e.includes('missing'))) {
      console.log('⚠️ Missing Model: Some records are missing Model (required field)');
      console.log('   Solution: Ensure your CSV has a Model column and it\'s mapped correctly');
      console.log('');
    }
    
    if (allErrors.some(e => e.includes('year') && e.includes('missing'))) {
      console.log('⚠️ Missing Year: Some records are missing Year (required field)');
      console.log('   Solution: Ensure your CSV has a Year column and it\'s mapped correctly');
      console.log('');
    }
    
    if (allErrors.some(e => e.includes('duplicate'))) {
      console.log('⚠️ Duplicate Records: Some records are duplicates');
      console.log('   Solution: Check your duplicate_handling setting in import config');
      console.log('');
    }
    
    if (allErrors.some(e => e.includes('foreign key') || e.includes('constraint'))) {
      console.log('⚠️ Database Constraints: Some records violate database constraints');
      console.log('   Solution: Check data integrity (dealer_id, references, etc.)');
      console.log('');
    }
    
    console.log('💡 Recommendations:\n');
    console.log('1. Review the error messages above');
    console.log('2. Check your field mappings in the import configuration');
    console.log('3. Verify the source CSV file has all required columns');
    console.log('4. Ensure data quality (no empty required fields)');
    console.log('5. Test with a small subset of the failed records');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkImportErrors();
