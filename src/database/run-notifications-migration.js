import { up } from './migrations/create-notifications-table.js';
import { pool } from './connection.js';

async function runMigration() {
  console.log('🚀 Running notifications table migration...');
  
  try {
    await up();
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();

