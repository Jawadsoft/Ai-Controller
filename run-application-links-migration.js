/**
 * Application Links Schema Migration Runner
 * Creates the application_links table for shareable credit application links
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('\n🚀 Starting application links migration...\n');

  const client = await pool.connect();

  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, 'application-links-schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Application links migration completed successfully!\n');
    console.log('📋 Created:');
    console.log('   • application_links table');
    console.log('   • Indexes for optimal performance');
    console.log('   • cleanup_expired_application_links() function\n');
    console.log('🎯 Next steps:');
    console.log('   • Restart your server');
    console.log('   • Access Customer Management at /customers');
    console.log('   • Generate shareable application links\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

