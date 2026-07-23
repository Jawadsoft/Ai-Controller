import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING
});

/**
 * Untagged vehicles (pre multi-FTP) are assigned to the oldest import config
 * per dealer so the next import from that feed can reconcile correctly without
 * wiping other suppliers.
 */
async function backfill() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE vehicles v
      SET import_config_id = oldest.config_id,
          import_source = COALESCE(NULLIF(v.import_source, ''), oldest.config_name, 'csv'),
          updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (dealer_id)
          dealer_id,
          id AS config_id,
          config_name
        FROM import_configs
        ORDER BY dealer_id, id ASC
      ) oldest
      WHERE v.dealer_id::text = oldest.dealer_id::text
        AND v.import_config_id IS NULL
    `);

    console.log(`Backfilled ${result.rowCount} untagged vehicles to oldest import config per dealer`);

    const check = await client.query(`
      SELECT
        import_config_id,
        import_source,
        COUNT(*)::int AS cnt
      FROM vehicles
      GROUP BY import_config_id, import_source
      ORDER BY import_config_id NULLS LAST
    `);
    console.log('Tagging distribution:', check.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
