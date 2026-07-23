/**
 * Run all new finance-related migrations
 * Run this script to apply all new database changes
 * 
 * Usage: node src/database/run-all-new-migrations.js
 */

import { query } from './connection.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  'lenders-schema.sql',
  'templates-schema.sql',
  'signatures-schema.sql',
  'update-credit-apps-lender-link.sql'
];

async function runMigrations() {
  console.log('🚀 Starting new migrations...\n');
  
  for (const migrationFile of migrations) {
    try {
      console.log(`📄 Running migration: ${migrationFile}`);
      
      const sqlPath = path.join(__dirname, migrationFile);
      const sql = await fs.readFile(sqlPath, 'utf-8');
      
      // Run the migration
      await query(sql);
      
      console.log(`✅ ${migrationFile} completed successfully\n`);
    } catch (error) {
      console.error(`❌ Error running ${migrationFile}:`, error.message);
      console.error('Full error:', error);
      process.exit(1);
    }
  }
  
  console.log('🎉 All migrations completed successfully!');
  process.exit(0);
}

runMigrations();

