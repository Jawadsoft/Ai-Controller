#!/usr/bin/env node

/**
 * Multi-User Migration Runner
 * 
 * This script runs the multi-user migration on your server.
 * It handles environment setup and provides clear instructions.
 */

import { runMultiUserMigration, createSampleStaffMembers } from './multi-user-migration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Multi-User Migration Runner');
  console.log('================================');
  console.log('');
  
  // Check environment
  console.log('🔍 Checking environment...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('');
    console.log('Please set your DATABASE_URL in your .env file:');
    console.log('DATABASE_URL=postgresql://username:password@host:port/database');
    console.log('');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL is configured');
  console.log(`📊 Database: ${process.env.DATABASE_URL.split('@')[1] || 'Unknown'}`);
  console.log('');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const includeSample = args.includes('--sample');
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('');
  }
  
  try {
    console.log('🔄 Starting migration...');
    console.log('');
    
    if (!dryRun) {
      // Run the actual migration
      await runMultiUserMigration();
      
      if (includeSample) {
        console.log('');
        console.log('🧪 Creating sample staff members...');
        await createSampleStaffMembers();
      }
      
      console.log('');
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('  1. Test the new multi-user system');
      console.log('  2. Create staff members for your dealers');
      console.log('  3. Configure permissions for each role');
      console.log('  4. Update your frontend to use the new permission system');
      console.log('');
      
    } else {
      console.log('🔍 Dry run completed - no changes made');
      console.log('Remove --dry-run flag to execute the migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('  1. Check your DATABASE_URL is correct');
    console.error('  2. Ensure the database is running');
    console.error('  3. Verify you have the necessary permissions');
    console.error('  4. Check if the tables already exist');
    console.error('');
    console.error('Full error details:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('');
  console.log('⚠️ Migration interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('⚠️ Migration terminated');
  process.exit(0);
});

// Run the migration
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
