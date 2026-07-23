/**
 * Database Migration Runner
 * Adds missing columns to daive_conversations and conversation_messages tables
 * 
 * Usage: node run-migration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './src/database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ Using existing database connection configuration');

async function runMigration() {
  console.log('🚀 Starting database migration...\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-missing-columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📊 Migration size:', migrationSQL.length, 'characters\n');
    
    // Connect to database
    const client = await pool.connect();
    console.log('✅ Connected to database\n');
    
    try {
      // Execute migration
      console.log('⏳ Running migration...\n');
      const result = await client.query(migrationSQL);
      
      console.log('\n✅ Migration completed successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Verify columns exist
      console.log('🔍 Verifying columns...\n');
      
      const verifyQueries = [
        {
          name: 'daive_conversations.customer_id',
          query: `
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'daive_conversations' 
              AND column_name = 'customer_id'
            ) as exists
          `
        },
        {
          name: 'conversation_messages.conversation_type',
          query: `
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'conversation_messages' 
              AND column_name = 'conversation_type'
            ) as exists
          `
        },
        {
          name: 'conversation_messages.conversation_table',
          query: `
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'conversation_messages' 
              AND column_name = 'conversation_table'
            ) as exists
          `
        }
      ];
      
      let allColumnsExist = true;
      
      for (const verify of verifyQueries) {
        const result = await client.query(verify.query);
        const exists = result.rows[0].exists;
        
        if (exists) {
          console.log(`✅ ${verify.name}: EXISTS`);
        } else {
          console.log(`❌ ${verify.name}: MISSING`);
          allColumnsExist = false;
        }
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (allColumnsExist) {
        console.log('🎉 ALL COLUMNS VERIFIED SUCCESSFULLY!\n');
        console.log('Next steps:');
        console.log('1. Restart your Node.js server');
        console.log('2. Test with a message like "hello"');
        console.log('3. Check that no column errors appear\n');
      } else {
        console.log('⚠️  Some columns are still missing.');
        console.log('Please check the error messages above.\n');
      }
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
