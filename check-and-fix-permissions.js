// check-and-fix-permissions.js
import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndFixPermissions() {
  console.log('🔍 Starting Permission Diagnostic and Fix Script...');
  
  try {
    // 1. Check if user_has_permission function exists
    console.log('\n📋 Step 1: Checking database functions...');
    const functionCheck = await query(`
      SELECT routine_name, routine_type 
      FROM information_schema.routines 
      WHERE routine_name = 'user_has_permission'
    `);
    
    if (functionCheck.rows.length === 0) {
      console.log('❌ user_has_permission function not found. Creating it...');
      
      await query(`
        CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, permission_name TEXT)
        RETURNS BOOLEAN AS $$
        DECLARE
            user_role TEXT;
            staff_role VARCHAR(50);
            has_permission BOOLEAN := false;
        BEGIN
            -- Get user's role
            SELECT ur.role INTO user_role
            FROM user_roles ur
            WHERE ur.user_id = user_uuid;
            
            -- Super admin has all permissions
            IF user_role = 'super_admin' THEN
                RETURN true;
            END IF;
            
            -- Get staff role and check permissions
            SELECT ds.staff_role INTO staff_role
            FROM dealership_staff ds
            WHERE ds.user_id = user_uuid AND ds.is_active = true;
            
            -- Check if permission exists in staff permissions
            SELECT EXISTS(
                SELECT 1 FROM staff_permissions sp
                JOIN dealership_staff ds ON sp.staff_id = ds.id
                WHERE ds.user_id = user_uuid 
                AND sp.permission_name = permission_name 
                AND sp.permission_value = true
                AND ds.is_active = true
            ) INTO has_permission;
            
            RETURN has_permission;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ user_has_permission function created');
    } else {
      console.log('✅ user_has_permission function exists');
    }

    // 2. Check all users and their current status
    console.log('\n👥 Step 2: Checking all users and their permissions...');
    const usersResult = await query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        ur.role,
        ds.id as staff_id,
        ds.staff_role,
        ds.is_active as staff_active,
        ds.dealer_id,
        d.business_name,
        COUNT(sp.id) as permission_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealership_staff ds ON u.id = ds.user_id
      LEFT JOIN dealers d ON ds.dealer_id = d.id
      LEFT JOIN staff_permissions sp ON ds.id = sp.staff_id
      GROUP BY u.id, u.email, u.name, ur.role, ds.id, ds.staff_role, ds.is_active, ds.dealer_id, d.business_name
      ORDER BY u.email
    `);

    console.log(`\n📊 Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name || 'No name'} (${user.email})`);
      console.log(`   - User Role: ${user.role || 'No role'}`);
      console.log(`   - Staff ID: ${user.staff_id || 'No staff record'}`);
      console.log(`   - Staff Role: ${user.staff_role || 'No staff role'}`);
      console.log(`   - Staff Active: ${user.staff_active || 'N/A'}`);
      console.log(`   - Dealer: ${user.business_name || 'No dealer'}`);
      console.log(`   - Permissions: ${user.permission_count || 0}`);
    });

    // 3. Check for users without staff records
    console.log('\n🔍 Step 3: Checking for users without staff records...');
    const usersWithoutStaff = usersResult.rows.filter(user => !user.staff_id);
    
    if (usersWithoutStaff.length > 0) {
      console.log(`⚠️  Found ${usersWithoutStaff.length} users without staff records:`);
      usersWithoutStaff.forEach(user => {
        console.log(`   - ${user.name || 'No name'} (${user.email}) - Role: ${user.role}`);
      });
    } else {
      console.log('✅ All users have staff records');
    }

    // 4. Check for inactive staff
    console.log('\n🔍 Step 4: Checking for inactive staff...');
    const inactiveStaff = usersResult.rows.filter(user => user.staff_id && !user.staff_active);
    
    if (inactiveStaff.length > 0) {
      console.log(`⚠️  Found ${inactiveStaff.length} inactive staff members:`);
      inactiveStaff.forEach(user => {
        console.log(`   - ${user.name || 'No name'} (${user.email}) - Role: ${user.staff_role}`);
      });
    } else {
      console.log('✅ All staff members are active');
    }

    // 5. Check permissions for each user
    console.log('\n🔍 Step 5: Checking permissions for each user...');
    for (const user of usersResult.rows) {
      if (user.staff_id) {
        console.log(`\n👤 Checking permissions for ${user.name} (${user.email}):`);
        
        // Test the user_has_permission function
        const permissionTests = [
          'staff_management',
          'lead_management', 
          'vehicle_import',
          'qr_code_generation'
        ];
        
        for (const permission of permissionTests) {
          try {
            const result = await query(
              'SELECT user_has_permission($1, $2) as has_permission',
              [user.id, permission]
            );
            const hasPermission = result.rows[0].has_permission;
            console.log(`   - ${permission}: ${hasPermission ? '✅' : '❌'}`);
          } catch (error) {
            console.log(`   - ${permission}: ❌ Error - ${error.message}`);
          }
        }
      }
    }

    // 6. Fix permissions for all active users
    console.log('\n🔧 Step 6: Fixing permissions for all active users...');
    
    const activeUsers = usersResult.rows.filter(user => 
      user.staff_id && user.staff_active
    );
    
    if (activeUsers.length === 0) {
      console.log('⚠️  No active users found to fix permissions for');
      return;
    }

    console.log(`🔧 Fixing permissions for ${activeUsers.length} active users...`);

    // Define all permissions
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

    // Start transaction
    await query('BEGIN');

    try {
      for (const user of activeUsers) {
        console.log(`\n👤 Fixing permissions for ${user.name} (${user.email}):`);
        
        // Update staff role to admin
        await query(`
          UPDATE dealership_staff 
          SET staff_role = 'admin', updated_at = NOW()
          WHERE id = $1
        `, [user.staff_id]);
        console.log(`   ✅ Updated role to admin`);

        // Clear existing permissions
        await query(`
          DELETE FROM staff_permissions 
          WHERE staff_id = $1
        `, [user.staff_id]);
        console.log(`   ✅ Cleared existing permissions`);

        // Grant all permissions
        for (const permission of allPermissions) {
          await query(`
            INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
            VALUES ($1, $2, true)
            ON CONFLICT (staff_id, permission_name) DO UPDATE SET
              permission_value = true,
              updated_at = NOW()
          `, [user.staff_id, permission]);
        }
        console.log(`   ✅ Granted all ${allPermissions.length} permissions`);
      }

      // Commit transaction
      await query('COMMIT');
      console.log('\n🎉 Successfully fixed permissions for all active users!');

      // 7. Verify the fixes
      console.log('\n✅ Step 7: Verifying fixes...');
      for (const user of activeUsers) {
        console.log(`\n👤 Verifying permissions for ${user.name} (${user.email}):`);
        
        const permissionTests = [
          'staff_management',
          'lead_management', 
          'vehicle_import',
          'qr_code_generation'
        ];
        
        for (const permission of permissionTests) {
          try {
            const result = await query(
              'SELECT user_has_permission($1, $2) as has_permission',
              [user.id, permission]
            );
            const hasPermission = result.rows[0].has_permission;
            console.log(`   - ${permission}: ${hasPermission ? '✅' : '❌'}`);
          } catch (error) {
            console.log(`   - ${permission}: ❌ Error - ${error.message}`);
          }
        }
      }

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    // 8. Final summary
    console.log('\n📊 Final Summary:');
    console.log(`- Total users checked: ${usersResult.rows.length}`);
    console.log(`- Users without staff records: ${usersWithoutStaff.length}`);
    console.log(`- Inactive staff members: ${inactiveStaff.length}`);
    console.log(`- Active users fixed: ${activeUsers.length}`);
    console.log(`- Permissions granted per user: ${allPermissions.length}`);

  } catch (error) {
    console.error('❌ Error in permission check and fix:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
checkAndFixPermissions()
  .then(() => {
    console.log('\n✨ Permission diagnostic and fix completed successfully!');
    console.log('\n🔄 Please try accessing the staff page again.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
