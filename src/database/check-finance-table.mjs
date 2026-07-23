import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const r = await pool.query(`SELECT to_regclass('public.dealer_finance_settings') as tbl`);
  console.log('Table exists:', r.rows[0].tbl);

  // Also check if dealer_id column is UUID type
  const c = await pool.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'dealer_finance_settings'
    ORDER BY ordinal_position
  `);
  console.log('Columns:', c.rows.map(r => `${r.column_name}(${r.udt_name})`).join(', '));
} catch(e) {
  console.error('Error:', e.message);
}
await pool.end();
