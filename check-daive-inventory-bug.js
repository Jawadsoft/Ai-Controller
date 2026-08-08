/**
 * Diagnostic Script: Check DAIVE Inventory Bug
 * 
 * This script checks if there's a mismatch between:
 * 1. The dealer_id used to initialize the inventory service
 * 2. The dealer_id passed to getDealerInventorySummary
 * 
 * Run this on the production server to diagnose the issue.
 */

import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function main() {
  const client = await pool.connect();
  console.log('✅ Connected to database\n');
  console.log('═'.repeat(80));
  console.log('DAIVE INVENTORY BUG DIAGNOSTIC');
  console.log('═'.repeat(80));

  try {
    // 1. Check all dealers in the system
    console.log('\n📋 STEP 1: ALL DEALERS IN SYSTEM');
    console.log('─'.repeat(80));
    const dealersResult = await client.query(`
      SELECT 
        d.id,
        d.business_name,
        d.subscription_status,
        COUNT(v.id) as vehicle_count
      FROM dealers d
      LEFT JOIN vehicles v ON d.id = v.dealer_id 
        AND v.status = 'available'
      GROUP BY d.id, d.business_name, d.subscription_status
      ORDER BY vehicle_count DESC
    `);
    
    console.log(`Found ${dealersResult.rows.length} dealers:\n`);
    dealersResult.rows.forEach(dealer => {
      console.log(`  • ${dealer.business_name}`);
      console.log(`    ID: ${dealer.id}`);
      console.log(`    Status: ${dealer.subscription_status}`);
      console.log(`    Vehicles: ${dealer.vehicle_count}`);
      console.log('');
    });

    // 2. Check Hyundai vehicles per dealer
    console.log('\n📋 STEP 2: HYUNDAI VEHICLES BY DEALER');
    console.log('─'.repeat(80));
    const hyundaiResult = await client.query(`
      SELECT 
        d.business_name as dealer_name,
        v.dealer_id,
        COUNT(*) as hyundai_count,
        COUNT(CASE WHEN v.status = 'available' THEN 1 END) as available_count
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      WHERE LOWER(v.make) = 'hyundai'
      GROUP BY d.business_name, v.dealer_id
      ORDER BY available_count DESC
    `);
    
    if (hyundaiResult.rows.length === 0) {
      console.log('❌ NO HYUNDAI VEHICLES FOUND IN ANY DEALER!');
    } else {
      hyundaiResult.rows.forEach(row => {
        console.log(`  • ${row.dealer_name} (${row.dealer_id})`);
        console.log(`    Total: ${row.hyundai_count} | Available: ${row.available_count}`);
        console.log('');
      });
    }

    // 3. Check the specific dealer ID that DAIVE is using
    const daiveDealerId = 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3'; // From the logs
    console.log('\n📋 STEP 3: DEALER DAIVE IS QUERYING');
    console.log('─'.repeat(80));
    console.log(`Dealer ID: ${daiveDealerId}\n`);
    
    const daiveDealerResult = await client.query(`
      SELECT 
        id,
        business_name,
        subscription_status
      FROM dealers
      WHERE id = $1
    `, [daiveDealerId]);
    
    if (daiveDealerResult.rows.length === 0) {
      console.log('❌ DEALER NOT FOUND IN DATABASE!');
      console.log('   This dealer ID does not exist in the dealers table.');
    } else {
      const dealer = daiveDealerResult.rows[0];
      console.log(`  Name: ${dealer.business_name}`);
      console.log(`  Status: ${dealer.subscription_status}\n`);
    }

    // 4. Check vehicles for the DAIVE dealer
    const daiveVehiclesResult = await client.query(`
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_vehicles,
        COUNT(CASE WHEN LOWER(make) = 'hyundai' AND status = 'available' THEN 1 END) as hyundai_available
      FROM vehicles
      WHERE dealer_id = $1
    `, [daiveDealerId]);
    
    const daiveVehicles = daiveVehiclesResult.rows[0];
    console.log('  Vehicle Count:');
    console.log(`    Total: ${daiveVehicles.total_vehicles}`);
    console.log(`    Available: ${daiveVehicles.available_vehicles}`);
    console.log(`    Hyundai (Available): ${daiveVehicles.hyundai_available}\n`);

    // 5. Show sample of vehicles for this dealer
    if (parseInt(daiveVehicles.total_vehicles) > 0) {
      console.log('  Sample Vehicles:');
      const sampleResult = await client.query(`
        SELECT make, model, year, price, status
        FROM vehicles
        WHERE dealer_id = $1
        ORDER BY make, model
        LIMIT 10
      `, [daiveDealerId]);
      
      sampleResult.rows.forEach(v => {
        console.log(`    ${v.year} ${v.make} ${v.model} - $${v.price} (${v.status})`);
      });
    }

    // 6. Check for make case sensitivity issues
    console.log('\n\n📋 STEP 4: CHECK FOR CASE SENSITIVITY ISSUES');
    console.log('─'.repeat(80));
    const caseCheckResult = await client.query(`
      SELECT 
        make,
        COUNT(*) as count
      FROM vehicles
      WHERE dealer_id = $1
        AND status = 'available'
      GROUP BY make
      ORDER BY count DESC
    `, [daiveDealerId]);
    
    if (caseCheckResult.rows.length === 0) {
      console.log('❌ No vehicles found for this dealer');
    } else {
      console.log('Make names as stored in database (case-sensitive):');
      caseCheckResult.rows.forEach(row => {
        console.log(`  "${row.make}" -> ${row.count} vehicles`);
      });
    }

    // 7. DIAGNOSIS
    console.log('\n\n📋 STEP 5: DIAGNOSIS');
    console.log('─'.repeat(80));
    
    if (parseInt(daiveVehicles.hyundai_available) > 0) {
      console.log('✅ HYUNDAI VEHICLES ARE AVAILABLE in the database!');
      console.log('   The issue is in the code, not the data.\n');
      console.log('🔍 Likely causes:');
      console.log('   1. Inventory service was initialized with a different dealer_id');
      console.log('   2. Case sensitivity mismatch in make comparison');
      console.log('   3. getDealerInventorySummary is filtering by wrong dealer_id\n');
      console.log('💡 Recommended fix:');
      console.log('   Check that inventoryService.initialize(dealerId) is called with');
      console.log(`   the correct dealer ID: ${daiveDealerId}`);
    } else {
      console.log('❌ NO HYUNDAI VEHICLES AVAILABLE for this dealer in database');
      console.log('   This is a data issue, not a code issue.\n');
      console.log('💡 Recommended fix:');
      console.log('   1. Import vehicles for this dealer using the import configuration');
      console.log('   2. Ensure vehicles have status = "available"');
      console.log('   3. Verify make names are spelled correctly (case matters!)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
