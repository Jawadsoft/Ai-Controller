import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting credit applications enhancement migration...\n');
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'enhance-credit-applications.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Run the migration
    console.log('📝 Executing migration...');
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Summary of changes:');
    console.log('   - Added borrower information fields (DOB, address)');
    console.log('   - Added vehicle information fields');
    console.log('   - Added loan details fields');
    console.log('   - Added enhanced employment fields');
    console.log('   - Added signature and authorization fields');
    console.log('   - Added PDF document tracking');
    console.log('   - Added indexes for better performance');
    console.log('   - Added data validation constraints');
    
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

