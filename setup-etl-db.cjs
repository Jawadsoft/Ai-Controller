const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function setupETLDatabase() {
  try {
    console.log('🔧 Setting up ETL database schema...');
    
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Read and execute the ETL schema
    const schemaPath = path.join(__dirname, 'src/database/etl-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Executing ETL schema...');
    await client.query(schemaSQL);
    
    console.log('✅ ETL database schema created successfully!');
    console.log('\n📊 Created tables:');
    console.log('  • etl_export_configs');
    console.log('  • etl_connection_settings');
    console.log('  • etl_schedule_settings');
    console.log('  • etl_file_format_settings');
    console.log('  • etl_file_naming_settings');
    console.log('  • etl_field_mappings');
    console.log('  • etl_export_filters');
    console.log('  • etl_export_history');
    console.log('  • etl_company_settings');
    console.log('  • etl_dealer_authorizations');
    
    console.log('\n🎯 ETL system is ready for configuration!');
    console.log('\n📋 Next steps:');
    console.log('  1. Access the ETL Configuration page in your application');
    console.log('  2. Create your first export configuration');
    console.log('  3. Configure FTP/SFTP connection settings');
    console.log('  4. Set up field mappings and file format');
    console.log('  5. Test the connection and execute exports');

    client.release();
    await pool.end();

  } catch (error) {
    console.error('❌ Error setting up ETL database:', error);
    process.exit(1);
  }
}

setupETLDatabase(); 