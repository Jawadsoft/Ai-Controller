#!/usr/bin/env node

/**
 * Customer Schema Migration Script
 * 
 * This script creates the customer tables for QR code access functionality.
 * Run this after the main database schema migration.
 * 
 * Usage:
 *   node scripts/migrate-customer-schema.js
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
    console.log('🚀 Starting Customer Schema Migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/database/customer-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Customer schema migration completed successfully!');
    console.log('');
    console.log('📋 Created tables:');
    console.log('   - customer_sessions (for QR code access tracking)');
    console.log('   - customer_interactions (for user behavior tracking)');
    console.log('   - customer_leads (for lead generation)');
    console.log('');
    console.log('🔧 Created functions:');
    console.log('   - cleanup_expired_customer_sessions()');
    console.log('   - update_customer_session_activity()');
    console.log('');
    console.log('📊 Created indexes for optimal performance');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Restart your application server');
    console.log('   2. Test QR code access functionality');
    console.log('   3. Monitor customer sessions in the database');
    
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
