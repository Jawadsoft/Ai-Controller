/**
 * System Logs Table Migration Runner
 * Creates the system_logs table for activity logging
 */

import { pool } from './src/database/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  let client;
  
  try {
    console.log('🚀 Starting system_logs table migration...\n');
    
    // Get a client from the pool
    client = await pool.connect();
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', 'create-system-logs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ system_logs table created successfully!\n');
    
    // Verify the table exists
    const checkQuery = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'system_logs'
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(checkQuery);
    
    console.log('📊 Table structure:');
    console.log('─────────────────────────────────────────');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name.padEnd(20)} ${row.data_type}`);
    });
    console.log('─────────────────────────────────────────\n');
    
    // Check indexes
    const indexQuery = `
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'system_logs';
    `;
    
    const indexResult = await client.query(indexQuery);
    console.log('📑 Indexes created:');
    console.log('─────────────────────────────────────────');
    indexResult.rows.forEach(row => {
      console.log(`   ✓ ${row.indexname}`);
    });
    console.log('─────────────────────────────────────────\n');
    
    console.log('🎉 Migration completed successfully!\n');
    console.log('The system_logs table is now ready for:');
    console.log('  • Website scraping activity logs');
    console.log('  • Import/export activity logs');
    console.log('  • System error tracking');
    console.log('  • User activity monitoring\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the migration
runMigration();
