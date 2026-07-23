// grant-admin-permissions-to-all-active-users.js
import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function grantAdminPermissionsToAllActiveUsers() {
  console.log('🚀 Starting Admin Permission Grant Script...');
  
  try {
    // 1. Get all active staff members
    console.log('📋 Fetching all active staff members...');
    const activeStaffResult = await query(`
      SELECT 
        ds.id as staff_id,
        ds.user_id,
        ds.staff_role,
        ds.dealer_id,
        u.email,
        u.name,
        d.business_name as dealer_name
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      JOIN dealers d ON ds.dealer_id = d.id
      WHERE ds.is_active = true
      ORDER BY d.business_name, u.name
    `);

    const activeStaff = activeStaffResult.rows;
    console.log(`✅ Found ${activeStaff.length} active staff members`);

    if (activeStaff.length === 0) {
      console.log('⚠️  No active staff members found. Exiting...');
      return;
    }

    // 2. Define all available permissions
    const allPermissions = [
      'qr_code_generation',
      'lead_management', 
      'vehicle_import',
      'analytics_dashboard',
      'bulk_actions',
      'staff_management',
      'user_management',
      'custom_branding',
      'api_access',
      'priority_support'
    ];

    console.log('🔐 Granting admin permissions to all active users...');

    // 3. Start transaction
    await query('BEGIN');

    try {
      let updatedCount = 0;

      for (const staff of activeStaff) {
        console.log(`👤 Processing: ${staff.name} (${staff.email}) - ${staff.staff_role} at ${staff.dealer_name}`);

        // Update staff role to admin
        await query(`
          UPDATE dealership_staff 
          SET staff_role = 'admin', updated_at = NOW()
          WHERE id = $1
        `, [staff.staff_id]);

        // Clear existing permissions
        await query(`
          DELETE FROM staff_permissions 
          WHERE staff_id = $1
        `, [staff.staff_id]);

        // Grant all permissions
        for (const permission of allPermissions) {
          await query(`
            INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
            VALUES ($1, $2, true)
            ON CONFLICT (staff_id, permission_name) DO UPDATE SET
              permission_value = true,
              updated_at = NOW()
          `, [staff.staff_id, permission]);
        }

        updatedCount++;
        console.log(`✅ Updated ${staff.name} with admin role and all permissions`);
      }

      // 4. Commit transaction
      await query('COMMIT');

      console.log(`\n🎉 Successfully granted admin permissions to ${updatedCount} active users!`);
      
      // 5. Display summary
      console.log('\n📊 Summary:');
      console.log(`- Total active staff processed: ${updatedCount}`);
      console.log(`- All users now have 'admin' role`);
      console.log(`- All users now have all ${allPermissions.length} permissions`);
      
      // 6. Show final status
      const finalStatusResult = await query(`
        SELECT 
          ds.staff_role,
          COUNT(*) as count,
          STRING_AGG(u.name, ', ') as names
        FROM dealership_staff ds
        JOIN users u ON ds.user_id = u.id
        WHERE ds.is_active = true
        GROUP BY ds.staff_role
        ORDER BY ds.staff_role
      `);

      console.log('\n📈 Final Role Distribution:');
      finalStatusResult.rows.forEach(row => {
        console.log(`- ${row.staff_role}: ${row.count} users (${row.names})`);
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error granting admin permissions:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
grantAdminPermissionsToAllActiveUsers()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
