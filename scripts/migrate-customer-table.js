#!/usr/bin/env node

/**
 * Customer Table Migration Script
 * 
 * This script creates the customer table for persistent customer data.
 * Run this after the customer schema migration.
 * 
 * Usage:
 *   node scripts/migrate-customer-table.js
 * 
 * Environment Variables Required:
 *   - DATABASE_URL: PostgreSQL connection string
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Customer Table Migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/database/customer-table-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Customer table migration completed successfully!');
    console.log('');
    console.log('📋 Created/Updated tables:');
    console.log('   - customers (for persistent customer data)');
    console.log('   - customer_sessions (updated with customer_id reference)');
    console.log('   - customer_leads (updated with customer_id reference)');
    console.log('');
    console.log('🔧 Created functions:');
    console.log('   - update_customer_login_info()');
    console.log('   - get_customer_full_name()');
    console.log('');
    console.log('📊 Created indexes for optimal performance');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Restart your application server');
    console.log('   2. Test customer registration and login');
    console.log('   3. Monitor customer data in the database');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('🔍 Troubleshooting:');
    console.error('   1. Ensure DATABASE_URL is set correctly');
    console.error('   2. Check database connection');
    console.error('   3. Verify PostgreSQL version compatibility');
    console.error('   4. Check for existing table conflicts');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
