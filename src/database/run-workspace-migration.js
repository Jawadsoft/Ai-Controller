/**
 * Finance Deal Workspace Migration Runner
 * Runs finance-deal-workspace-migration.sql with fixes for PostgreSQL limitations
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // 1. Dealer fee & product line items
  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS dealer_fee          DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS warranty_amount     DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gap_amount          DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accessories_amount  DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS include_warranty    BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS include_gap         BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS include_accessories BOOLEAN DEFAULT TRUE`,

  // 2. Vehicle snapshot fields
  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS vehicle_msrp          DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS vehicle_internet_price DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS dealer_discount        DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reconditioning_cost    DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gross_profit           DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS vehicle_stock_number   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS vehicle_trim           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS vehicle_mileage        INT,
    ADD COLUMN IF NOT EXISTS vehicle_image_url      TEXT`,

  // 3. Trade-in vehicle details
  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS trade_in_year       INT,
    ADD COLUMN IF NOT EXISTS trade_in_make       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS trade_in_model      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS trade_in_trim       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS trade_in_vin        VARCHAR(17),
    ADD COLUMN IF NOT EXISTS trade_in_mileage    INT,
    ADD COLUMN IF NOT EXISTS trade_in_color      VARCHAR(50),
    ADD COLUMN IF NOT EXISTS trade_in_image_url  TEXT`,

  // 3b. Trade-in condition (separate to avoid CHECK constraint issues on re-run)
  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS trade_in_condition  VARCHAR(20) DEFAULT 'good'`,

  // 4. Deal stage & deal number
  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS deal_number VARCHAR(20)`,

  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS deal_stage VARCHAR(30) DEFAULT 'lead'`,

  // 5. AI notes
  `ALTER TABLE finance_deals
    ADD COLUMN IF NOT EXISTS ai_notes              TEXT,
    ADD COLUMN IF NOT EXISTS ai_notes_updated_at   TIMESTAMP WITH TIME ZONE`,

  // 6. Credit bureau breakdown on credit_applications
  `ALTER TABLE credit_applications
    ADD COLUMN IF NOT EXISTS experian_score   INT,
    ADD COLUMN IF NOT EXISTS equifax_score    INT,
    ADD COLUMN IF NOT EXISTS transunion_score INT,
    ADD COLUMN IF NOT EXISTS credit_tier      VARCHAR(20)`,

  // 7. Back-fill deal_number using CTE (fixes window-function-in-UPDATE limitation)
  `WITH numbered AS (
    SELECT id,
      'D-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' ||
      LPAD(ROW_NUMBER() OVER (PARTITION BY dealer_id ORDER BY created_at)::TEXT, 4, '0') AS new_num
    FROM finance_deals
    WHERE deal_number IS NULL
  )
  UPDATE finance_deals fd
  SET deal_number = numbered.new_num
  FROM numbered
  WHERE fd.id = numbered.id`,

  // 8. Indexes
  `CREATE INDEX IF NOT EXISTS idx_finance_deals_stage      ON finance_deals(deal_stage)`,
  `CREATE INDEX IF NOT EXISTS idx_finance_deals_deal_number ON finance_deals(deal_number)`,
  `CREATE INDEX IF NOT EXISTS idx_finance_deals_trade_vin  ON finance_deals(trade_in_vin)`,
];

async function run() {
  const client = await pool.connect();
  let ok = 0, failed = 0;

  try {
    for (const sql of statements) {
      const preview = sql.replace(/\s+/g, ' ').trim().slice(0, 60);
      try {
        await client.query(sql);
        console.log(`✅ ${preview}...`);
        ok++;
      } catch (err) {
        if (err.code === '42701') { // column already exists
          console.log(`ℹ️  Already exists: ${preview}...`);
          ok++;
        } else {
          console.error(`❌ ${preview}...\n   ${err.message}`);
          failed++;
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n📊 Done: ${ok} succeeded, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
