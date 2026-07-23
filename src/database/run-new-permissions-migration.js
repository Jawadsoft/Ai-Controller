import { query } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runNewPermissionsMigration() {
  console.log('🚀 Starting New Permissions Migration...');
  console.log('');
  
  try {
    // Check if dealership_staff table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'dealership_staff'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  dealership_staff table does not exist.');
      console.log('Please run the multi-user migration first:');
      console.log('   node src/database/migrate-multi-user.js');
      process.exit(1);
    }
    
    // Check existing staff members
    const staffCount = await query('SELECT COUNT(*) as count FROM dealership_staff');
    console.log(`📊 Found ${staffCount.rows[0].count} existing staff members`);
    
    if (staffCount.rows[0].count === 0) {
      console.log('⚠️  No staff members found. Migration will be skipped.');
      console.log('Note: New permissions will be automatically assigned when staff members are created.');
      process.exit(0);
    }
    
    console.log('');
    console.log('💾 Adding new permissions to existing staff members...');
    
    // Add permissions for ADMIN role
    const adminResult = await query(`
      INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
      SELECT 
          ds.id,
          permission_name,
          true
      FROM dealership_staff ds
      CROSS JOIN (
          VALUES 
              ('finance_management'),
              ('rebate_management'),
              ('daive_settings_management'),
              ('followup_settings_management'),
              ('customer_management')
      ) AS permissions(permission_name)
      WHERE ds.staff_role = 'admin'
      ON CONFLICT (staff_id, permission_name) DO NOTHING
      RETURNING *;
    `);
    console.log(`✅ Added ${adminResult.rows.length} permissions for ADMIN staff`);
    
    // Add permissions for SALES role
    const salesResult = await query(`
      INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
      SELECT 
          ds.id,
          permission_name,
          true
      FROM dealership_staff ds
      CROSS JOIN (
          VALUES 
              ('rebate_management'),
              ('followup_settings_management'),
              ('customer_management')
      ) AS permissions(permission_name)
      WHERE ds.staff_role = 'sales'
      ON CONFLICT (staff_id, permission_name) DO NOTHING
      RETURNING *;
    `);
    console.log(`✅ Added ${salesResult.rows.length} permissions for SALES staff`);
    
    // Add permissions for FINANCE role
    const financeResult = await query(`
      INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
      SELECT 
          ds.id,
          permission_name,
          true
      FROM dealership_staff ds
      CROSS JOIN (
          VALUES 
              ('finance_management'),
              ('rebate_management'),
              ('customer_management')
      ) AS permissions(permission_name)
      WHERE ds.staff_role = 'finance'
      ON CONFLICT (staff_id, permission_name) DO NOTHING
      RETURNING *;
    `);
    console.log(`✅ Added ${financeResult.rows.length} permissions for FINANCE staff`);
    
    // Add permissions for SERVICE role
    const serviceResult = await query(`
      INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
      SELECT 
          ds.id,
          permission_name,
          true
      FROM dealership_staff ds
      CROSS JOIN (
          VALUES 
              ('followup_settings_management'),
              ('customer_management')
      ) AS permissions(permission_name)
      WHERE ds.staff_role = 'service'
      ON CONFLICT (staff_id, permission_name) DO NOTHING
      RETURNING *;
    `);
    console.log(`✅ Added ${serviceResult.rows.length} permissions for SERVICE staff`);
    
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    
    // Verify permissions
    console.log('📋 Verifying permissions by role...');
    console.log('');
    const result = await query(`
      SELECT 
        ds.staff_role,
        COUNT(DISTINCT sp.permission_name) as permission_count,
        ARRAY_AGG(DISTINCT sp.permission_name ORDER BY sp.permission_name) as permissions
      FROM dealership_staff ds
      LEFT JOIN staff_permissions sp ON ds.id = sp.staff_id
      WHERE sp.permission_value = true
      GROUP BY ds.staff_role
      ORDER BY ds.staff_role
    `);
    
    result.rows.forEach(row => {
      console.log(`📌 ${row.staff_role.toUpperCase()}: ${row.permission_count} permissions`);
      console.log(`   ${row.permissions.join(', ')}`);
      console.log('');
    });
    
    // Show total permissions added
    const totalNew = await query(`
      SELECT COUNT(*) as total
      FROM staff_permissions
      WHERE permission_name IN (
        'finance_management',
        'rebate_management',
        'daive_settings_management',
        'followup_settings_management',
        'customer_management'
      )
    `);
    
    console.log(`✨ Total new permission entries: ${totalNew.rows[0].total}`);
    console.log('');
    console.log('🔄 Users will see updated permissions after logging out and back in.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('');
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runNewPermissionsMigration();

