import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.DATABASE_CONNECTION_STRING ||
    'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting vehicle import_config_id migration...');
    const sqlPath = path.join(__dirname, 'migrations', 'add-vehicle-import-config-id.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);

    const col = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'vehicles' AND column_name = 'import_config_id'
    `);
    console.log('Column check:', col.rows[0] || 'MISSING');

    const fn = await client.query(`
      SELECT proname, pronargs FROM pg_proc WHERE proname = 'import_vehicle_from_csv'
    `);
    console.log('Function check:', fn.rows[0] || 'MISSING');

    const tagged = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE import_config_id IS NOT NULL) AS tagged,
        COUNT(*) FILTER (WHERE import_config_id IS NULL) AS untagged
      FROM vehicles
    `);
    console.log('Vehicle tagging:', tagged.rows[0]);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
