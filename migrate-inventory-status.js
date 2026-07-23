#!/usr/bin/env node

/**
 * Simple runner script for the inventory status migration
 * Usage: node migrate-inventory-status.js
 */

import { runInventoryStatusMigration } from './run-inventory-status-migration.js';

async function main() {
  try {
    console.log('🚀 Starting Inventory Status Migration...\n');
    
    await runInventoryStatusMigration();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('Your inventory status management is now active.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Please check your database connection and try again.');
    process.exit(1);
  }
}

main();
