/**
 * Dealer Finance Settings Migration Runner
 * Creates the dealer_finance_settings table for storing default
 * tax rates, fees, and add-ons used by DAIVE to quote OTD prices.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running dealer_finance_settings migration...');
    const sql = readFileSync(
      join(__dirname, 'dealer-finance-settings-migration.sql'),
      'utf8'
    );
    await client.query(sql);
    console.log('✅ dealer_finance_settings table created / verified');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => process.exit(1));
