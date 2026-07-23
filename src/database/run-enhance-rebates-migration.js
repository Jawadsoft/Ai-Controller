/**
 * Run Enhanced Rebates Migration
 * Adds model-specific configuration support
 */

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting rebates enhancement migration...\n');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'enhance-rebates-with-model-config.sql'),
      'utf8'
    );
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Added:');
    console.log('  📊 model_specific_amounts JSONB field');
    console.log('  🔧 Updated apply_rebate_to_vehicles function');
    console.log('  💡 Now supports per-model rebate amounts\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

