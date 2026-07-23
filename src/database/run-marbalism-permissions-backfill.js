/**
 * Marbalism AI Permissions Backfill
 * Adds 'marbalism_ai' permission to all existing admin staff members
 * who don't already have it in the staff_permissions table.
 *
 * Usage: node src/database/run-marbalism-permissions-backfill.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.DATABASE_CONNECTION_STRING ||
    'postgresql://postgres:dealeriq@localhost:5432/vehicle_management',
});

async function runBackfill() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Marbalism AI permissions backfill...\n');

    // ── 1. Find all admin staff who don't have marbalism_ai permission ────
    const missingResult = await client.query(`
      SELECT ds.id as staff_id, u.email, ds.staff_role, d.business_name
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      JOIN dealers d ON ds.dealer_id = d.id
      WHERE ds.staff_role = 'admin'
        AND ds.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM staff_permissions sp
          WHERE sp.staff_id = ds.id
            AND sp.permission_name = 'marbalism_ai'
        )
      ORDER BY d.business_name, u.email
    `);

    if (missingResult.rows.length === 0) {
      console.log('✅ All admin staff already have marbalism_ai permission. Nothing to do.\n');
      return;
    }

    console.log(`📋 Found ${missingResult.rows.length} admin staff member(s) missing marbalism_ai:\n`);
    missingResult.rows.forEach(row => {
      console.log(`   - ${row.email} (${row.business_name})`);
    });

    // ── 2. Insert marbalism_ai permission for each ─────────────────────────
    console.log('\n⚙️  Adding marbalism_ai permission...');

    let added = 0;
    for (const row of missingResult.rows) {
      await client.query(
        `INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
         VALUES ($1, 'marbalism_ai', true)
         ON CONFLICT (staff_id, permission_name) DO UPDATE SET permission_value = true`,
        [row.staff_id]
      );
      added++;
      console.log(`   ✓ ${row.email}`);
    }

    // ── 3. Verify ──────────────────────────────────────────────────────────
    const verifyResult = await client.query(`
      SELECT COUNT(*)::int as count
      FROM staff_permissions
      WHERE permission_name = 'marbalism_ai' AND permission_value = true
    `);

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Added to : ${added} staff member(s)`);
    console.log(`   Total with marbalism_ai permission: ${verifyResult.rows[0].count}`);

    console.log('\n📝 Next steps:');
    console.log('   1. Restart your server: .\\start-dev');
    console.log('   2. Log in again (hard-refresh browser with Ctrl+Shift+R)');
    console.log('   3. Click "Marbalism AI" in the top navigation\n');

  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runBackfill().catch(console.error);
