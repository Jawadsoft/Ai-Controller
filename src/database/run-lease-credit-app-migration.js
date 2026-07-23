 /**
 * Run Lease Credit Application Migration
 * Adds lease-specific fields and calculation functions
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
    console.log('🚀 Starting lease credit application migration...\n');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'add-lease-fields-to-credit-apps.sql'),
      'utf8'
    );
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Added fields:');
    console.log('  💳 Deal type: finance or lease');
    console.log('  🚗 Vehicle: MSRP, down payment, trade-in, rebates');
    console.log('  📊 Lease terms: residual %, money factor, mileage');
    console.log('  💰 Calculated: depreciation, finance charge, monthly payment');
    console.log('  🔧 Auto-calculation trigger added\n');
    
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

