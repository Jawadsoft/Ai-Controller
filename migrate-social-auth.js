import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { query } from './src/database/connection.js';

dotenv.config();

const runMigration = async () => {
  try {
    console.log('🔄 Running social authentication migration...');
    
    // Read the migration SQL file
    const migrationSQL = readFileSync('./src/database/migrate-social-auth.sql', 'utf8');
    
    // Execute the migration
    await query(migrationSQL);
    
    console.log('✅ Social authentication migration completed successfully!');
    console.log('📋 Added fields:');
    console.log('   - name (VARCHAR)');
    console.log('   - google_id (VARCHAR, UNIQUE)');
    console.log('   - facebook_id (VARCHAR, UNIQUE)');
    console.log('   - github_id (VARCHAR, UNIQUE)');
    console.log('   - email_verified (BOOLEAN)');
    console.log('   - Indexes for all social IDs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration(); 