import { query, pool } from './src/database/connection.js';

// Configuration - Update this user ID
const USER_ID_TO_PROMOTE = '7db8b0e0-52b1-42ab-9750-563410304b9d';

async function promoteToSuperAdmin() {
  console.log('🚀 Promoting user to Super Admin...\n');
  
  try {
    // 1. Verify user exists
    console.log('1️⃣ Verifying user exists...');
    const userResult = await query(
      `SELECT 
        u.id,
        u.email,
        u.name,
        ur.role as current_role,
        d.id as dealer_id,
        d.business_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id
      WHERE u.id = $1`,
      [USER_ID_TO_PROMOTE]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found with ID:', USER_ID_TO_PROMOTE);
      return;
    }

    const user = userResult.rows[0];
    console.log('   ✅ User found:');
    console.log(`      Email: ${user.email}`);
    console.log(`      Name: ${user.name || 'No name'}`);
    console.log(`      Current Role: ${user.current_role || 'None'}`);
    console.log(`      Is Dealer Owner: ${user.dealer_id ? 'Yes (' + user.business_name + ')' : 'No'}`);
    console.log('');

    // 2. Check if user is in dealership_staff
    console.log('2️⃣ Checking dealership staff associations...');
    const staffResult = await query(
      `SELECT ds.id, ds.dealer_id, ds.staff_role, d.business_name
       FROM dealership_staff ds
       JOIN dealers d ON ds.dealer_id = d.id
       WHERE ds.user_id = $1`,
      [USER_ID_TO_PROMOTE]
    );

    if (staffResult.rows.length > 0) {
      console.log(`   ⚠️  User is staff member at ${staffResult.rows.length} dealership(s):`);
      staffResult.rows.forEach(staff => {
        console.log(`      - ${staff.business_name} (role: ${staff.staff_role})`);
      });
      console.log('   ℹ️  Super admins are typically NOT in dealership_staff');
      console.log('   ℹ️  They will be hidden from dealer staff lists\n');
    } else {
      console.log('   ✅ User has no staff associations\n');
    }

    // 3. Check if already super admin
    if (user.current_role === 'super_admin') {
      console.log('✅ User is already a Super Admin! No changes needed.');
      return;
    }

    // 4. Prompt for confirmation
    console.log('━'.repeat(60));
    console.log('⚠️  WARNING: This will promote the user to Super Admin!');
    console.log('━'.repeat(60));
    console.log('');
    console.log('Super Admin Capabilities:');
    console.log('   ✓ Full platform access');
    console.log('   ✓ Manage all dealerships');
    console.log('   ✓ Reset dealership data');
    console.log('   ✓ Manage roles and permissions');
    console.log('   ✓ View system-wide analytics');
    console.log('   ✓ Cannot see dealership operational data (vehicles, leads)');
    console.log('');
    console.log('👉 To proceed, run: node promote-user-to-superadmin.js --confirm');
    console.log('');

    // Check if --confirm flag is present
    const isConfirmed = process.argv.includes('--confirm');

    if (!isConfirmed) {
      console.log('❌ Promotion cancelled. Run with --confirm flag to proceed.');
      return;
    }

    // 5. Promote to super admin
    console.log('━'.repeat(60));
    console.log('🔄 PROMOTING USER TO SUPER ADMIN...');
    console.log('━'.repeat(60));
    console.log('');

    await query('BEGIN');

    try {
      // Update or insert role
      if (user.current_role) {
        // Update existing role
        await query(
          `UPDATE user_roles 
           SET role = 'super_admin', 
               updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1`,
          [USER_ID_TO_PROMOTE]
        );
        console.log(`   ✅ Updated role from "${user.current_role}" to "super_admin"`);
      } else {
        // Insert new role
        await query(
          `INSERT INTO user_roles (user_id, role)
           VALUES ($1, 'super_admin')`,
          [USER_ID_TO_PROMOTE]
        );
        console.log('   ✅ Assigned role "super_admin"');
      }

      // If user is in dealership_staff, we could optionally remove them or keep them
      // Keeping them allows super admin to still manage that specific dealership if needed
      // The backend code will hide them from regular dealer views

      await query('COMMIT');
      console.log('   ✅ Transaction committed\n');

      // 6. Verify the change
      console.log('━'.repeat(60));
      console.log('✅ PROMOTION SUCCESSFUL!');
      console.log('━'.repeat(60));
      console.log('');

      const verifyResult = await query(
        `SELECT u.email, u.name, ur.role
         FROM users u
         JOIN user_roles ur ON u.id = ur.user_id
         WHERE u.id = $1`,
        [USER_ID_TO_PROMOTE]
      );

      if (verifyResult.rows.length > 0) {
        const updated = verifyResult.rows[0];
        console.log('Updated User Details:');
        console.log(`   Email: ${updated.email}`);
        console.log(`   Name: ${updated.name || 'No name'}`);
        console.log(`   Role: ${updated.role} ✅`);
        console.log('');
      }

      console.log('🎉 User is now a Super Admin!');
      console.log('');
      console.log('Next Steps:');
      console.log('   1. User should logout and login again');
      console.log('   2. They will see the Super Admin panel (crown icon)');
      console.log('   3. They can manage all dealerships and system settings');
      console.log('   4. They CANNOT see individual dealership vehicles/leads (by design)');

    } catch (error) {
      await query('ROLLBACK');
      console.error('❌ Error during promotion, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error promoting user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

promoteToSuperAdmin();

