import { query, pool } from './src/database/connection.js';

async function checkStaffPermissions() {
  console.log('🔍 Checking staff permissions...\n');
  
  try {
    // Find the staff member named "jawad"
    const staffResult = await query(`
      SELECT 
        ds.id as staff_id,
        ds.staff_role,
        u.email,
        u.name,
        r.display_name as role_display_name,
        r.permissions as role_permissions
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      LEFT JOIN roles r ON ds.staff_role = r.name
      WHERE u.name ILIKE '%jawad%'
      ORDER BY ds.created_at DESC
      LIMIT 5
    `);

    if (staffResult.rows.length === 0) {
      console.log('❌ No staff member found with name containing "jawad"');
      return;
    }

    console.log(`📋 Found ${staffResult.rows.length} staff member(s):\n`);

    for (const staff of staffResult.rows) {
      console.log(`👤 Staff Member:`);
      console.log(`   Name: ${staff.name}`);
      console.log(`   Email: ${staff.email}`);
      console.log(`   Staff Role: ${staff.staff_role}`);
      console.log(`   Role Display Name: ${staff.role_display_name || 'N/A'}`);
      console.log(`   Staff ID: ${staff.staff_id}`);
      
      // Get actual permissions from staff_permissions table
      const permissionsResult = await query(`
        SELECT permission_name, permission_value
        FROM staff_permissions
        WHERE staff_id = $1
        ORDER BY permission_name
      `, [staff.staff_id]);

      console.log(`\n   📊 Permissions in staff_permissions table:`);
      if (permissionsResult.rows.length === 0) {
        console.log(`   ❌ No permissions found in staff_permissions table!`);
      } else {
        permissionsResult.rows.forEach(p => {
          const icon = p.permission_value ? '✅' : '❌';
          console.log(`   ${icon} ${p.permission_name}: ${p.permission_value}`);
        });
      }

      console.log(`\n   📋 Role Permissions (from roles table):`);
      if (staff.role_permissions && staff.role_permissions.length > 0) {
        staff.role_permissions.forEach(p => {
          console.log(`   - ${p}`);
        });
      } else {
        console.log(`   ❌ No permissions defined in role`);
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Check if finance_management is included
    const hasFinancePermission = await query(`
      SELECT sp.permission_name, sp.permission_value
      FROM staff_permissions sp
      JOIN dealership_staff ds ON sp.staff_id = ds.id
      JOIN users u ON ds.user_id = u.id
      WHERE u.name ILIKE '%jawad%' 
        AND sp.permission_name IN ('finance_management', 'rebate_management')
    `);

    console.log(`🔍 Finance-related permissions check:`);
    if (hasFinancePermission.rows.length > 0) {
      console.log(`   ⚠️  User HAS finance permissions:`);
      hasFinancePermission.rows.forEach(p => {
        console.log(`   - ${p.permission_name}: ${p.permission_value}`);
      });
    } else {
      console.log(`   ✅ User does NOT have finance_management or rebate_management`);
    }

  } catch (error) {
    console.error('❌ Error checking permissions:', error);
  } finally {
    await pool.end();
  }
}

checkStaffPermissions();

