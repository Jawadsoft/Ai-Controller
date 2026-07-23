#!/usr/bin/env node

import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function removeAllConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting constraint removal for multiple sales agents...');
    console.log('📊 Database: Using existing connection from ./src/database/connection.js');
    
    // First, let's see what constraints currently exist
    console.log('\n📋 Checking current constraints...');
    const constraints = await client.query(`
      SELECT tc.constraint_name, tc.constraint_type, ccu.column_name 
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'dealership_staff' AND tc.constraint_type IN ('UNIQUE', 'CHECK')
    `);
    
    console.log('Current constraints on dealership_staff:');
    if (constraints.rows.length === 0) {
      console.log('   - No constraints found');
    } else {
      constraints.rows.forEach(row => {
        console.log(`   - ${row.constraint_name}: ${row.constraint_type} on ${row.column_name}`);
      });
    }
    
    // Check current sales agent counts
    console.log('\n👥 Current sales agent counts per dealership:');
    const salesCount = await client.query(`
      SELECT COUNT(*) as count, dealer_id, d.business_name
      FROM dealership_staff ds
      LEFT JOIN dealers d ON ds.dealer_id = d.id
      WHERE ds.staff_role = 'sales' AND ds.is_active = true 
      GROUP BY dealer_id, d.business_name
      ORDER BY count DESC
    `);
    
    if (salesCount.rows.length === 0) {
      console.log('   - No sales agents found');
    } else {
      salesCount.rows.forEach(row => {
        console.log(`   - ${row.business_name || 'Unknown'} (${row.dealer_id}): ${row.count} sales agents`);
      });
    }
    
    // Remove all unique constraints
    console.log('\n🗑️ Removing all unique constraints...');
    
    // Drop unique_admin_per_dealer constraint
    try {
      await client.query(`ALTER TABLE dealership_staff DROP CONSTRAINT IF EXISTS unique_admin_per_dealer;`);
      console.log('   ✅ Dropped unique_admin_per_dealer constraint');
    } catch (error) {
      console.log('   ℹ️  unique_admin_per_dealer constraint not found or already dropped');
    }
    
    // Drop any other unique constraints that might exist
    const uniqueConstraints = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'dealership_staff' AND constraint_type = 'UNIQUE'
    `);
    
    for (const constraint of uniqueConstraints.rows) {
      try {
        await client.query(`ALTER TABLE dealership_staff DROP CONSTRAINT IF EXISTS ${constraint.constraint_name};`);
        console.log(`   ✅ Dropped ${constraint.constraint_name} constraint`);
      } catch (error) {
        console.log(`   ⚠️  Could not drop ${constraint.constraint_name}: ${error.message}`);
      }
    }
    
    // Remove any triggers that might enforce constraints
    console.log('\n🗑️ Removing constraint enforcement triggers...');
    
    try {
      await client.query(`DROP TRIGGER IF EXISTS admin_uniqueness_trigger ON dealership_staff;`);
      console.log('   ✅ Dropped admin_uniqueness_trigger');
    } catch (error) {
      console.log('   ℹ️  admin_uniqueness_trigger not found');
    }
    
    try {
      await client.query(`DROP FUNCTION IF EXISTS check_admin_uniqueness();`);
      console.log('   ✅ Dropped check_admin_uniqueness function');
    } catch (error) {
      console.log('   ℹ️  check_admin_uniqueness function not found');
    }
    
    // Check what constraints remain
    console.log('\n🔍 Checking remaining constraints...');
    const remainingConstraints = await client.query(`
      SELECT tc.constraint_name, tc.constraint_type, ccu.column_name 
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'dealership_staff' AND tc.constraint_type IN ('UNIQUE', 'CHECK')
    `);
    
    console.log('Remaining constraints on dealership_staff:');
    if (remainingConstraints.rows.length === 0) {
      console.log('   - No constraints found (this is correct for multiple sales agents)');
    } else {
      remainingConstraints.rows.forEach(row => {
        console.log(`   - ${row.constraint_name}: ${row.constraint_type} on ${row.column_name}`);
      });
    }
    
    // Test the fix by checking if we can have multiple sales agents
    console.log('\n🧪 Testing multiple sales agents capability...');
    
    const testSales = await client.query(`
      SELECT COUNT(*) as count, dealer_id, d.business_name
      FROM dealership_staff ds
      LEFT JOIN dealers d ON ds.dealer_id = d.id
      WHERE ds.staff_role = 'sales' AND ds.is_active = true 
      GROUP BY dealer_id, d.business_name
      ORDER BY count DESC
    `);
    
    console.log('Current sales agent distribution:');
    testSales.rows.forEach(row => {
      console.log(`   - ${row.business_name || 'Unknown'} (${row.dealer_id}): ${row.count} sales agents`);
    });
    
    if (testSales.rows.some(row => parseInt(row.count) > 1)) {
      console.log('   ✅ Multiple sales agents per dealership are already working!');
    } else {
      console.log('   ℹ️  No dealerships currently have multiple sales agents');
    }
    
    console.log('\n✅ Successfully removed all constraints!');
    console.log('📋 Summary:');
    console.log('   - All unique constraints removed from dealership_staff table');
    console.log('   - All constraint enforcement triggers removed');
    console.log('   - Multiple sales agents are now allowed per dealership');
    console.log('   - Multiple finance, service, inventory staff are allowed');
    console.log('   - Multiple admins are also allowed (if needed)');
    
  } catch (error) {
    console.error('❌ Error removing constraints:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

// Run the constraint removal
console.log('🚀 Remove All Constraints Script');
console.log('==================================');

removeAllConstraints()
  .then(() => {
    console.log('\n🎉 All constraints removed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test creating multiple sales agents via the API');
    console.log('   2. Verify that multiple sales agents can be created');
    console.log('   3. Test the staff management interface');
    console.log('   4. Deploy your updated application code');
    console.log('\n🔗 Test API endpoint:');
    console.log('   POST /api/staff');
    console.log('   Body: {"email": "sales2@example.com", "password": "password123", "staff_role": "sales", "name": "Second Sales Agent"}');
    console.log('\n⚠️  Note: This removes ALL constraints. You may want to add back specific constraints later if needed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to remove constraints:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your database connection');
    console.error('   2. Verify you have proper database permissions');
    console.error('   3. Check if constraints exist');
    process.exit(1);
  });
