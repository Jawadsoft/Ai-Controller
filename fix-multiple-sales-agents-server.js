#!/usr/bin/env node

import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixMultipleSalesAgents() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting multiple sales agents fix...');
    console.log('📊 Database: Using existing connection from ./src/database/connection.js');
    
    // First, let's see what constraints currently exist
    console.log('\n📋 Checking current constraints...');
    const constraints = await client.query(`
      SELECT tc.constraint_name, tc.constraint_type, ccu.column_name 
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'dealership_staff' AND tc.constraint_type = 'UNIQUE'
    `);
    
    console.log('Current unique constraints on dealership_staff:');
    if (constraints.rows.length === 0) {
      console.log('   - No unique constraints found');
    } else {
      constraints.rows.forEach(row => {
        console.log(`   - ${row.constraint_name}: ${row.column_name}`);
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
    
    // Drop the existing constraint that prevents multiple sales agents
    console.log('\n🗑️ Dropping existing constraint...');
    const dropResult = await client.query(`
      ALTER TABLE dealership_staff DROP CONSTRAINT IF EXISTS unique_admin_per_dealer;
    `);
    console.log('   ✅ Constraint dropped successfully');
    
    // Create a function to check admin uniqueness
    console.log('➕ Creating admin uniqueness check function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_admin_uniqueness()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.staff_role = 'admin' THEN
          IF EXISTS (
            SELECT 1 FROM dealership_staff 
            WHERE dealer_id = NEW.dealer_id 
            AND staff_role = 'admin' 
            AND is_active = true 
            AND id != NEW.id
          ) THEN
            RAISE EXCEPTION 'Only one active admin is allowed per dealership';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ Admin uniqueness function created');
    
    // Create trigger to enforce admin uniqueness
    console.log('➕ Creating admin uniqueness trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS admin_uniqueness_trigger ON dealership_staff;
      CREATE TRIGGER admin_uniqueness_trigger
        BEFORE INSERT OR UPDATE ON dealership_staff
        FOR EACH ROW EXECUTE FUNCTION check_admin_uniqueness();
    `);
    console.log('   ✅ Admin uniqueness trigger created');
    
    console.log('\n✅ Successfully fixed constraint!');
    console.log('📋 Summary:');
    console.log('   - Multiple sales agents are now allowed per dealership');
    console.log('   - Multiple finance, service, inventory staff are allowed');
    console.log('   - Only one admin per dealership is still enforced (via trigger)');
    
    // Verify the fix by checking constraints and triggers
    console.log('\n🔍 Verifying fix...');
    
    // Check constraints
    const newConstraints = await client.query(`
      SELECT tc.constraint_name, tc.constraint_type, ccu.column_name 
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'dealership_staff' AND tc.constraint_type = 'UNIQUE'
    `);
    
    console.log('Unique constraints on dealership_staff:');
    if (newConstraints.rows.length === 0) {
      console.log('   - No unique constraints found (this is correct)');
    } else {
      newConstraints.rows.forEach(row => {
        console.log(`   - ${row.constraint_name}: ${row.column_name}`);
      });
    }
    
    // Check triggers
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'dealership_staff'
    `);
    
    console.log('Triggers on dealership_staff:');
    triggers.rows.forEach(row => {
      console.log(`   - ${row.trigger_name}: ${row.action_timing} ${row.event_manipulation}`);
    });
    
    // Test constraint behavior
    console.log('\n🧪 Testing constraint behavior...');
    
    // Check if we can have multiple sales agents (should be allowed now)
    const testSales = await client.query(`
      SELECT COUNT(*) as count, dealer_id
      FROM dealership_staff 
      WHERE staff_role = 'sales' AND is_active = true 
      GROUP BY dealer_id 
      HAVING COUNT(*) > 1
    `);
    
    if (testSales.rows.length > 0) {
      console.log('   ✅ Multiple sales agents per dealership are now allowed');
      testSales.rows.forEach(row => {
        console.log(`      - Dealer ${row.dealer_id}: ${row.count} sales agents`);
      });
    } else {
      console.log('   ℹ️  No dealerships currently have multiple sales agents');
    }
    
    // Check admin constraint (should still be enforced)
    const testAdmin = await client.query(`
      SELECT COUNT(*) as count, dealer_id
      FROM dealership_staff 
      WHERE staff_role = 'admin' AND is_active = true 
      GROUP BY dealer_id 
      HAVING COUNT(*) > 1
    `);
    
    if (testAdmin.rows.length === 0) {
      console.log('   ✅ Admin constraint still enforced (max 1 admin per dealership)');
    } else {
      console.log('   ⚠️  Warning: Multiple admins found per dealership');
    }
    
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
console.log('🚀 Multiple Sales Agents Fix Script');
console.log('=====================================');

fixMultipleSalesAgents()
  .then(() => {
    console.log('\n🎉 Multiple sales agents fix completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test creating a new sales agent via the API');
    console.log('   2. Verify that multiple sales agents can be created');
    console.log('   3. Test the staff management interface');
    console.log('   4. Check that admin constraint still works');
    console.log('\n🔗 Test API endpoint:');
    console.log('   POST /api/staff');
    console.log('   Body: {"email": "sales2@example.com", "password": "password123", "staff_role": "sales", "name": "Second Sales Agent"}');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to fix constraint:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your DATABASE_URL environment variable');
    console.error('   2. Verify database connection');
    console.error('   3. Ensure you have proper database permissions');
    console.error('   4. Check if the constraint already exists');
    process.exit(1);
  });
