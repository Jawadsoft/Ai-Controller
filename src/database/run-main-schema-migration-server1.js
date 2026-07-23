/**
 * run-main-schema-migration-server.js
 *
 * Production-safe runner for main-schema-migration.sql.
 * Uses the shared connection.js pool so DATABASE_URL (Render, Railway, etc.)
 * is automatically honoured.  Falls back to individual DB_* env vars for local dev.
 *
 * Usage:
 *   node src/database/run-main-schema-migration-server.js
 */

import { pool } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── All 44 tables that the SQL file should create ───────────────────────────
const EXPECTED_TABLES = [
  // Core
  'users', 'dealers', 'vehicles', 'leads', 'user_roles', 'subscription_plans',
  // DAIVE AI
  'daive_conversations', 'daive_prompts', 'daive_user_interests',
  'daive_voice_sessions', 'daive_analytics', 'daive_api_settings',
  // Chat
  'chat_conversations', 'conversation_messages', 'user_interests',
  // ETL export
  'etl_export_configs', 'etl_connection_settings', 'etl_company_settings',
  'etl_dealer_authorizations', 'etl_export_filters', 'etl_field_mappings',
  'etl_file_format_settings', 'etl_file_naming_settings',
  'etl_schedule_settings', 'etl_export_history',
  // Import
  'import_configs', 'import_connection_settings', 'import_file_settings',
  'import_field_mappings', 'import_processing_settings',
  'import_schedule_settings', 'import_history', 'import_errors',
  // Voice & settings
  'voice_settings', 'dealer_prompts', 'test_drives',
  'inventory_alerts', 'dealer_settings', 'audit_log',
  // Crew AI
  'crew_ai_agents', 'crew_ai_conversation_routing', 'crew_ai_workflows',
  'crew_ai_performance', 'crew_ai_agent_memory', 'crew_ai_task_log',
];

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Main Schema Migration — server-safe runner');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`  DB source   : ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'DB_* env vars'}`);
    console.log('───────────────────────────────────────────────────────────\n');

    // ── 1. Load SQL file ─────────────────────────────────────────────────────
    const sqlPath = path.join(__dirname, 'main-schema-migration.sql');

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`📖 Loaded: main-schema-migration.sql  (${(sql.length / 1024).toFixed(1)} KB)\n`);

    // ── 2. Execute ───────────────────────────────────────────────────────────
    console.log('⚡ Executing migration …');
    await client.query(sql);
    console.log('✅ Migration SQL executed successfully\n');

    // ── 3. Verify tables ─────────────────────────────────────────────────────
    console.log('🔍 Verifying tables …\n');

    const { rows: existingRows } = await client.query(`
      SELECT table_name
      FROM   information_schema.tables
      WHERE  table_schema = 'public'
      AND    table_type   = 'BASE TABLE';
    `);
    const existingTables = new Set(existingRows.map(r => r.table_name));

    let missing = 0;
    for (const t of EXPECTED_TABLES) {
      if (existingTables.has(t)) {
        console.log(`   ✅  ${t}`);
      } else {
        console.log(`   ❌  ${t}  — MISSING`);
        missing++;
      }
    }

    // ── 4. Index summary ─────────────────────────────────────────────────────
    const { rows: idxRows } = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM   pg_indexes
      WHERE  schemaname = 'public'
      AND    indexname LIKE 'idx_%';
    `);
    console.log(`\n📊 Indexes created : ${idxRows[0].cnt}`);

    // ── 5. Trigger summary ───────────────────────────────────────────────────
    const { rows: trgRows } = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM   information_schema.triggers
      WHERE  trigger_schema = 'public';
    `);
    console.log(`⚡ Triggers created : ${trgRows[0].cnt}`);

    // ── 6. View summary ──────────────────────────────────────────────────────
    const { rows: vwRows } = await client.query(`
      SELECT COUNT(*) AS cnt
      FROM   information_schema.views
      WHERE  table_schema = 'public';
    `);
    console.log(`👁  Views created   : ${vwRows[0].cnt}`);

    // ── 7. Final result ──────────────────────────────────────────────────────
    console.log('\n───────────────────────────────────────────────────────────');
    if (missing === 0) {
      console.log(`🎉 All ${EXPECTED_TABLES.length} tables present — migration complete!`);
    } else {
      console.log(`⚠️  ${missing} table(s) missing — check the errors above.`);
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('   Code   :', err.code);
    console.error('   Detail :', err.detail  || '—');
    console.error('   Hint   :', err.hint    || '—');

    if (err.position) {
      console.error('   Position in SQL:', err.position);
    }

    process.exit(1);

  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
