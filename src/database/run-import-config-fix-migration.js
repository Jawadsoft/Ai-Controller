/**
 * Fix import_field_mappings invalid field_type values
 * and add 'test' to import_schedule_settings frequency constraint.
 *
 * Usage:
 *   node src/database/run-import-config-fix-migration.js
 *
 * Production (Render):
 *   Set DATABASE_URL in env, then run the same command.
 */

import pkg from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.DATABASE_CONNECTION_STRING ||
    'postgresql://postgres:dealeriq@localhost:5432/vehicle_management',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting import config fix migration...\n');

    const sqlPath = join(__dirname, 'fix-import-field-types-and-schedule.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    await client.query(sql);

    console.log('✅ Migration SQL executed successfully.\n');

    const badTypes = await client.query(`
      SELECT field_type, COUNT(*)::int AS count
      FROM import_field_mappings
      GROUP BY field_type
      ORDER BY field_type
    `);

    console.log('📊 field_type distribution:');
    for (const row of badTypes.rows) {
      console.log(`   - ${row.field_type}: ${row.count}`);
    }

    const config5 = await client.query(`
      SELECT id, source_field, target_field, field_type
      FROM import_field_mappings
      WHERE import_config_id = 5
      ORDER BY field_order
    `);

    console.log(`\n📋 Config #5 mappings: ${config5.rows.length} row(s)`);
    config5.rows.forEach((r) => {
      console.log(`   ${r.source_field} -> ${r.target_field} (${r.field_type})`);
    });

    console.log('\n🎉 Import config fix migration completed.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
