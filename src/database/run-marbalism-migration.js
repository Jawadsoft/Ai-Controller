/**
 * Marbalism AI Migration Runner
 * Adds marbalism_ai_enabled, marbalism_ai_activated_at, and
 * marbalism_ai_deactivated_by columns to the dealers table.
 *
 * Usage: node src/database/run-marbalism-migration.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.DATABASE_CONNECTION_STRING ||
    'postgresql://postgres:dealeriq@localhost:5432/vehicle_management',
});

async function runMarbalismMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Marbalism AI Migration...\n');

    // Read and execute the SQL migration file
    const migrationPath = join(__dirname, 'migrations', 'add-marbalism-ai.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing migration SQL...');
    await client.query(migrationSQL);

    console.log('\n✅ Marbalism AI Migration completed successfully!\n');

    // ── Verify columns were added ──────────────────────────────────────────
    console.log('🔍 Verifying columns on dealers table...');

    const columnsCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'dealers'
        AND column_name  IN (
          'marbalism_ai_enabled',
          'marbalism_ai_activated_at',
          'marbalism_ai_deactivated_by'
        )
      ORDER BY column_name
    `);

    if (columnsCheck.rows.length === 0) {
      console.warn('⚠️  No Marbalism columns found — they may already exist or the migration did not run.');
    } else {
      console.log('\n📊 Columns added / verified:');
      columnsCheck.rows.forEach((row) => {
        console.log(`   ✓ ${row.column_name}  (${row.data_type}, default: ${row.column_default ?? 'none'})`);
      });
    }

    // ── Verify index was created ───────────────────────────────────────────
    const indexCheck = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'dealers'
        AND indexname  = 'idx_dealers_marbalism_ai_enabled'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('\n🗂️  Index verified:');
      console.log('   ✓ idx_dealers_marbalism_ai_enabled');
    }

    // ── Quick stats ────────────────────────────────────────────────────────
    const statsCheck = await client.query(`
      SELECT
        COUNT(*)::int                                         AS total_dealers,
        COUNT(*) FILTER (WHERE marbalism_ai_enabled = true)::int AS active_marbalism
      FROM dealers
    `);

    const { total_dealers, active_marbalism } = statsCheck.rows[0];
    console.log('\n📈 Dealer stats after migration:');
    console.log(`   Total dealers       : ${total_dealers}`);
    console.log(`   Marbalism AI active : ${active_marbalism}`);

    console.log('\n🎉 Marbalism AI is ready!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart your server: npm run dev');
    console.log('   2. Log in as a dealer → go to /profile → click "Activate Marbalism AI"');
    console.log('   3. Or log in as super admin → /admin → toggle the Marbalism switch per dealer');
    console.log('   4. Once activated, "Marbalism AI" appears in the top navigation\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMarbalismMigration().catch(console.error);
