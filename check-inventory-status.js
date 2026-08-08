/**
 * Inventory Diagnostic Script
 * Checks dealer inventory status and identifies issues
 * 
 * Usage: node check-inventory-status.js [dealerId]
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const DEALER_ID = process.argv[2] || 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';

async function runDiagnostics() {
  console.log('🔍 DEALERIQ INVENTORY DIAGNOSTIC TOOL');
  console.log('=====================================\n');
  console.log(`Checking dealer: ${DEALER_ID}\n`);

  try {
    // Test 1: Check if database connection works
    console.log('📊 Test 1: Database Connection');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Test 2: Count total vehicles in database
    console.log('📊 Test 2: Total Vehicles in Database');
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM vehicles');
    console.log(`Total vehicles in database: ${totalResult.rows[0].total}\n`);

    // Test 3: Check this dealer's vehicles
    console.log('📊 Test 3: This Dealer\'s Inventory');
    const dealerVehicles = await pool.query(
      'SELECT COUNT(*) as total FROM vehicles WHERE dealer_id = $1',
      [DEALER_ID]
    );
    console.log(`Vehicles for dealer ${DEALER_ID}: ${dealerVehicles.rows[0].total}`);
    
    if (dealerVehicles.rows[0].total === '0') {
      console.log('⚠️  WARNING: This dealer has NO vehicles!\n');
    } else {
      console.log('✅ Dealer has vehicles\n');
    }

    // Test 4: Check status breakdown for this dealer
    console.log('📊 Test 4: Vehicle Status Breakdown');
    const statusResult = await pool.query(
      'SELECT status, COUNT(*) as count FROM vehicles WHERE dealer_id = $1 GROUP BY status',
      [DEALER_ID]
    );
    
    if (statusResult.rows.length === 0) {
      console.log('No vehicles found for any status\n');
    } else {
      statusResult.rows.forEach(row => {
        console.log(`  ${row.status}: ${row.count}`);
      });
      console.log('');
    }

    // Test 5: Check makes for this dealer
    console.log('📊 Test 5: Makes Available for This Dealer');
    const makesResult = await pool.query(
      'SELECT make, COUNT(*) as count FROM vehicles WHERE dealer_id = $1 GROUP BY make ORDER BY count DESC',
      [DEALER_ID]
    );
    
    if (makesResult.rows.length === 0) {
      console.log('No makes found\n');
    } else {
      makesResult.rows.forEach(row => {
        console.log(`  ${row.make}: ${row.count}`);
      });
      console.log('');
    }

    // Test 6: Search for Hyundai vehicles (any dealer)
    console.log('📊 Test 6: Hyundai Vehicles in Database (All Dealers)');
    const hyundaiResult = await pool.query(
      `SELECT dealer_id, COUNT(*) as count 
       FROM vehicles 
       WHERE LOWER(make) LIKE '%hyundai%' 
       GROUP BY dealer_id`
    );
    
    if (hyundaiResult.rows.length === 0) {
      console.log('❌ NO Hyundai vehicles found in entire database\n');
    } else {
      console.log('Found Hyundai vehicles:');
      hyundaiResult.rows.forEach(row => {
        const isCurrentDealer = row.dealer_id === DEALER_ID ? ' ← THIS DEALER' : '';
        console.log(`  Dealer ${row.dealer_id}: ${row.count} vehicles${isCurrentDealer}`);
      });
      console.log('');
    }

    // Test 7: Check dealer info
    console.log('📊 Test 7: Dealer Information');
    const dealerInfo = await pool.query(
      'SELECT business_name, city, state FROM dealers WHERE id = $1',
      [DEALER_ID]
    );
    
    if (dealerInfo.rows.length === 0) {
      console.log('⚠️  WARNING: Dealer not found in dealers table!\n');
    } else {
      const dealer = dealerInfo.rows[0];
      console.log(`  Name: ${dealer.business_name}`);
      console.log(`  Location: ${dealer.city}, ${dealer.state}\n`);
    }

    // Test 8: Check recent vehicles added
    console.log('📊 Test 8: Recently Added Vehicles (Last 10)');
    const recentResult = await pool.query(
      `SELECT id, make, model, year, dealer_id, created_at 
       FROM vehicles 
       ORDER BY created_at DESC 
       LIMIT 10`
    );
    
    if (recentResult.rows.length === 0) {
      console.log('No vehicles in database at all\n');
    } else {
      recentResult.rows.forEach(vehicle => {
        const isCurrentDealer = vehicle.dealer_id === DEALER_ID ? ' ← THIS DEALER' : '';
        console.log(`  ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.dealer_id})${isCurrentDealer}`);
      });
      console.log('');
    }

    // Test 9: Check import configurations
    console.log('📊 Test 9: Import Configurations');
    const importConfigs = await pool.query(
      `SELECT id, config_name, is_active, frequency, updated_at 
       FROM import_configs 
       WHERE dealer_id = $1`,
      [DEALER_ID]
    );
    
    if (importConfigs.rows.length === 0) {
      console.log('⚠️  No import configurations found for this dealer\n');
    } else {
      importConfigs.rows.forEach(config => {
        const status = config.is_active ? '✅ Active' : '⏸️  Inactive';
        console.log(`  ${status} - ${config.config_name} (${config.frequency})`);
        console.log(`    Last updated: ${config.updated_at}`);
      });
      console.log('');
    }

    // Summary
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('====================');
    
    const totalVehicles = parseInt(totalResult.rows[0].total);
    const dealerVehicleCount = parseInt(dealerVehicles.rows[0].total);
    
    if (totalVehicles === 0) {
      console.log('❌ CRITICAL: No vehicles in database at all');
      console.log('   → You need to import vehicles or add them manually');
    } else if (dealerVehicleCount === 0) {
      console.log('⚠️  WARNING: Dealer has no vehicles assigned');
      console.log('   → Check if vehicles are assigned to wrong dealer_id');
      console.log('   → Or set up import configuration for this dealer');
    } else {
      console.log(`✅ Dealer has ${dealerVehicleCount} vehicles`);
    }
    
    if (hyundaiResult.rows.length === 0) {
      console.log('❌ No Hyundai vehicles in database');
      console.log('   → Import Hyundai inventory');
    } else {
      const dealerHyundai = hyundaiResult.rows.find(r => r.dealer_id === DEALER_ID);
      if (!dealerHyundai) {
        console.log('⚠️  Hyundai vehicles exist but not for this dealer');
        console.log('   → Check dealer_id assignments');
      } else {
        console.log(`✅ Dealer has ${dealerHyundai.count} Hyundai vehicles`);
      }
    }

    if (importConfigs.rows.length === 0) {
      console.log('⚠️  No import configurations');
      console.log('   → Set up import on Data Import page');
    }

  } catch (error) {
    console.error('❌ Error running diagnostics:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);
