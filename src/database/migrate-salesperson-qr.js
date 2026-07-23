/**
 * Migration: Salesperson QR Code & Digital Business Card
 * Adds profile columns to dealership_staff, assigned_staff_id to daive_conversations,
 * and creates customer_staff_claims for the "keep your place in line" feature.
 *
 * Run: node dist/server/database/migrate-salesperson-qr.js
 */

import { query } from './connection.js';

async function runMigration() {
  console.log('🚀 Running salesperson QR migration...\n');

  try {
    // ── 1. Extend dealership_staff ──────────────────────────────────────────
    console.log('📋 Extending dealership_staff table...');
    await query(`
      ALTER TABLE dealership_staff
        ADD COLUMN IF NOT EXISTS staff_qr_hash    TEXT UNIQUE,
        ADD COLUMN IF NOT EXISTS photo_url         TEXT,
        ADD COLUMN IF NOT EXISTS phone             TEXT,
        ADD COLUMN IF NOT EXISTS extension_number  TEXT,
        ADD COLUMN IF NOT EXISTS department        TEXT,
        ADD COLUMN IF NOT EXISTS location          TEXT,
        ADD COLUMN IF NOT EXISTS languages         TEXT[]   DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS specialties       TEXT[]   DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS years_with_company INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS employee_id       TEXT,
        ADD COLUMN IF NOT EXISTS availability_status TEXT   DEFAULT 'available'
    `);
    console.log('✅ dealership_staff extended\n');

    // ── 2. Index on QR hash for fast public lookups ─────────────────────────
    await query(`
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_qr_hash
        ON dealership_staff (staff_qr_hash)
        WHERE staff_qr_hash IS NOT NULL
    `);
    console.log('✅ QR hash index created\n');

    // ── 3. daive_conversations – add assigned_staff_id ──────────────────────
    console.log('📋 Adding assigned_staff_id to daive_conversations...');
    await query(`
      ALTER TABLE daive_conversations
        ADD COLUMN IF NOT EXISTS assigned_staff_id UUID
          REFERENCES dealership_staff(id) ON DELETE SET NULL
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_daive_conversations_assigned_staff
        ON daive_conversations (assigned_staff_id)
        WHERE assigned_staff_id IS NOT NULL
    `);
    console.log('✅ daive_conversations extended\n');

    // ── 4. customer_staff_claims table ──────────────────────────────────────
    console.log('📋 Creating customer_staff_claims table...');
    await query(`
      CREATE TABLE IF NOT EXISTS customer_staff_claims (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id      TEXT        NOT NULL,
        staff_id        UUID        NOT NULL REFERENCES dealership_staff(id) ON DELETE CASCADE,
        dealer_id       UUID        NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
        claimed_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at      TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '8 hours'),
        UNIQUE (session_id)
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_customer_staff_claims_session
        ON customer_staff_claims (session_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_customer_staff_claims_staff
        ON customer_staff_claims (staff_id)
    `);
    console.log('✅ customer_staff_claims table created\n');

    console.log('🎉 Salesperson QR migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
