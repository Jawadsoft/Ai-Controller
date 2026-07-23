#!/usr/bin/env node

/**
 * Migration script to add staff_management permission to existing sales agents
 * This script updates the database to grant staff management permissions to sales agents
 */

import { query } from './src/database/connection.js';

async function addStaffManagementToSales() {
  try {
    console.log('🔄 Adding staff_management permission to existing sales agents...');

    // First, let's see how many sales agents exist
    const salesCountResult = await query(
      'SELECT COUNT(*) as count FROM dealership_staff WHERE staff_role = $1',
      ['sales']
    );
    const salesCount = salesCountResult.rows[0].count;
    console.log(`📊 Found ${salesCount} sales agents in the database`);

    if (salesCount === 0) {
      console.log('✅ No sales agents found. Migration complete.');
      return;
    }

    // Add staff_management permission to all existing sales agents
    const result = await query(`
      INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
      SELECT 
          ds.id,
          'staff_management',
          true
      FROM dealership_staff ds
      WHERE ds.staff_role = 'sales'
      ON CONFLICT (staff_id, permission_name) DO UPDATE SET
          permission_value = EXCLUDED.permission_value,
          updated_at = NOW()
      RETURNING staff_id
    `);

    console.log(`✅ Successfully updated ${result.rows.length} sales agents with staff_management permission`);

    // Verify the changes
    const verifyResult = await query(`
      SELECT 
          ds.id,
          u.email,
          u.name,
          sp.permission_name,
          sp.permission_value
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      LEFT JOIN staff_permissions sp ON ds.id = sp.staff_id AND sp.permission_name = 'staff_management'
      WHERE ds.staff_role = 'sales'
      ORDER BY u.email
    `);

    console.log('\n📋 Verification - Sales agents with staff_management permission:');
    verifyResult.rows.forEach(row => {
      const status = row.permission_value ? '✅ Has permission' : '❌ Missing permission';
      console.log(`  - ${row.email} (${row.name}): ${status}`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('Sales agents can now access staff management functionality.');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
addStaffManagementToSales()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
