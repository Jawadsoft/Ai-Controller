import { pool } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFollowUpMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting DAIVE Follow-Up System migration...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '001-create-followup-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    console.log('📋 Creating follow-up tables...');
    await client.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Next steps:');
    console.log('   1. Run: node src/database/seed-followup-defaults.js');
    console.log('   2. Configure .env with email/SMS credentials');
    console.log('   3. Access settings at: /followup/settings');
    console.log('\n🔒 Note: System starts DISABLED for safety');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runFollowUpMigration()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });

