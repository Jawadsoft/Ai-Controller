/**
 * Rebates Module Migration Runner
 * Run this script to set up the rebates tables and functions
 * 
 * Usage: node src/database/run-rebates-migration.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function runRebatesMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Rebates Module Migration...\n');
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, 'migrations', 'add-rebates-module.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration SQL...');
    await client.query(migrationSQL);
    
    console.log('\n✅ Rebates Module Migration Completed Successfully!\n');
    
    // Verify tables were created
    console.log('🔍 Verifying installation...');
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('rebates', 'rebate_applications')
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    tablesCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Verify functions were created
    const functionsCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('get_eligible_rebates_for_vehicle', 'apply_rebate_to_vehicles')
      ORDER BY routine_name
    `);
    
    console.log('\n🔧 Created functions:');
    functionsCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.routine_name}`);
    });
    
    console.log('\n🎉 Rebates module is ready to use!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. Navigate to /rebates in your application');
    console.log('   3. Create your first rebate!');
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runRebatesMigration().catch(console.error);

