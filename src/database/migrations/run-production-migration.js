/**
 * Production Database Migration Script
 * Run this to sync all recent database changes to production
 * 
 * Usage:
 *   node src/database/migrations/run-production-migration.js
 * 
 * Make sure your .env file has the correct DATABASE_URL for production
 * Or set the DATABASE_URL environment variable when running:
 *   DATABASE_URL="your-production-db-url" node src/database/migrations/run-production-migration.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Starting production database migration...');
    console.log(`📡 Connecting to database: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1] : 'Not set'}`);
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, 'production-sync-migration.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('⏳ Executing migration...\n');
    
    // Execute the migration
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      
      console.log('\n✅ Migration completed successfully!');
      console.log('\nThe following changes were applied:');
      console.log('  ✓ Added file_match_keyword column');
      console.log('  ✓ Added selected_files, available_files, last_file_scan columns');
      console.log('  ✓ Created system_logs table');
      console.log('  ✓ Added import_config_id column to vehicles');
      console.log('  ✓ Updated import_vehicle_from_csv function');
      console.log('\n🎉 Your production database is now synced!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
