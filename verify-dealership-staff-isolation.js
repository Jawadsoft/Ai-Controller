import { query, pool } from './src/database/connection.js';

async function verifyDealershipStaffIsolation() {
  console.log('🔍 Verifying Dealership Staff Isolation...\n');
  
  try {
    // 1. Check for super admin accounts that shouldn't be visible to dealers
    console.log('1️⃣ Checking super admin isolation...');
    const superAdminCheck = await query(`
      SELECT 
        ds.id as staff_id,
        u.email,
        u.name,
        ds.dealer_id,
        d.business_name,
        ur.role as user_role
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      JOIN dealers d ON ds.dealer_id = d.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role = 'super_admin'
    `);

    if (superAdminCheck.rows.length > 0) {
      console.log(`   ⚠️  Found ${superAdminCheck.rows.length} super admin(s) in dealership_staff:`);
      superAdminCheck.rows.forEach(sa => {
        console.log(`      - ${sa.email} at ${sa.business_name}`);
      });
      console.log('   ℹ️  Note: This is OK if super admin is managing a specific dealership\n');
    } else {
      console.log('   ✅ No super admin accounts found in regular dealership staff\n');
    }

    // 2. Check all staff members have proper dealer associations
    console.log('2️⃣ Verifying staff-dealer relationships...');
    const orphanedStaff = await query(`
      SELECT ds.id, u.email, ds.dealer_id
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      LEFT JOIN dealers d ON ds.dealer_id = d.id
      WHERE d.id IS NULL
    `);

    if (orphanedStaff.rows.length > 0) {
      console.log(`   ⚠️  Found ${orphanedStaff.rows.length} staff member(s) with invalid dealer_id:`);
      orphanedStaff.rows.forEach(staff => {
        console.log(`      - ${staff.email} (dealer_id: ${staff.dealer_id})`);
      });
      console.log('   ⚠️  These staff members won\'t be visible!\n');
    } else {
      console.log('   ✅ All staff members have valid dealer associations\n');
    }

    // 3. Count staff per dealership
    console.log('3️⃣ Staff count per dealership...');
    const staffCounts = await query(`
      SELECT 
        d.id,
        d.business_name,
        COUNT(ds.id) as staff_count,
        COUNT(CASE WHEN ds.staff_role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN ds.is_active = true THEN 1 END) as active_count
      FROM dealers d
      LEFT JOIN dealership_staff ds ON d.id = ds.dealer_id
      GROUP BY d.id, d.business_name
      ORDER BY staff_count DESC
    `);

    console.log('   📊 Dealership Staff Summary:');
    staffCounts.rows.forEach(dealer => {
      console.log(`      ${dealer.business_name}: ${dealer.staff_count} total (${dealer.active_count} active, ${dealer.admin_count} admin)`);
    });
    console.log('');

    // 4. Check for duplicate email addresses across dealerships
    console.log('4️⃣ Checking for staff members across multiple dealerships...');
    const duplicateUsers = await query(`
      SELECT 
        u.email,
        u.name,
        COUNT(DISTINCT ds.dealer_id) as dealership_count,
        STRING_AGG(DISTINCT d.business_name, ', ') as dealerships
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      JOIN dealers d ON ds.dealer_id = d.id
      GROUP BY u.email, u.name
      HAVING COUNT(DISTINCT ds.dealer_id) > 1
    `);

    if (duplicateUsers.rows.length > 0) {
      console.log(`   ⚠️  Found ${duplicateUsers.rows.length} user(s) working at multiple dealerships:`);
      duplicateUsers.rows.forEach(user => {
        console.log(`      - ${user.email}: ${user.dealership_count} dealerships (${user.dealerships})`);
      });
      console.log('');
    } else {
      console.log('   ✅ No users found across multiple dealerships\n');
    }

    // 5. Verify indexes exist for performance
    console.log('5️⃣ Verifying database indexes...');
    const indexes = await query(`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE tablename IN ('dealership_staff', 'staff_permissions', 'user_roles')
      ORDER BY tablename, indexname
    `);

    console.log('   📋 Current indexes:');
    let currentTable = '';
    indexes.rows.forEach(idx => {
      if (idx.tablename !== currentTable) {
        console.log(`\n      ${idx.tablename}:`);
        currentTable = idx.tablename;
      }
      console.log(`         - ${idx.indexname}`);
    });
    console.log('');

    // 6. Add missing indexes if needed
    console.log('6️⃣ Adding missing indexes (if needed)...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_dealer_id ON dealership_staff(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_user_id ON dealership_staff(user_id);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_staff_role ON dealership_staff(staff_role);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_is_active ON dealership_staff(is_active);
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
    `);
    console.log('   ✅ All necessary indexes verified/created\n');

    // 7. Test query for dealer staff list (this is what the API uses)
    console.log('7️⃣ Testing dealer staff visibility query...');
    const testDealers = await query(`
      SELECT id, business_name FROM dealers LIMIT 3
    `);

    for (const dealer of testDealers.rows) {
      const visibleStaff = await query(`
        SELECT 
          ds.id,
          u.email,
          u.name,
          ds.staff_role,
          ur.role as user_role
        FROM dealership_staff ds
        JOIN users u ON ds.user_id = u.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        WHERE ds.dealer_id = $1
          AND (ur.role IS NULL OR ur.role != 'super_admin')
        ORDER BY ds.created_at DESC
      `, [dealer.id]);

      console.log(`   ${dealer.business_name}:`);
      console.log(`      Visible staff: ${visibleStaff.rows.length}`);
      if (visibleStaff.rows.length > 0) {
        visibleStaff.rows.slice(0, 3).forEach(staff => {
          console.log(`         - ${staff.email} (${staff.staff_role})`);
        });
      }
    }
    console.log('');

    // 8. Summary
    console.log('━'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('━'.repeat(60));

    const totalStaff = await query('SELECT COUNT(*) as count FROM dealership_staff');
    const activeStaff = await query('SELECT COUNT(*) as count FROM dealership_staff WHERE is_active = true');
    const totalDealers = await query('SELECT COUNT(*) as count FROM dealers');
    const superAdmins = await query(`
      SELECT COUNT(*) as count FROM user_roles WHERE role = 'super_admin'
    `);

    console.log(`Total Dealerships: ${totalDealers.rows[0].count}`);
    console.log(`Total Staff Members: ${totalStaff.rows[0].count}`);
    console.log(`Active Staff Members: ${activeStaff.rows[0].count}`);
    console.log(`Super Admins (system): ${superAdmins.rows[0].count}`);
    console.log('');
    console.log('✅ Staff isolation verification complete!');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Dealers should NOT see super admin accounts');
    console.log('   - Each staff member should belong to ONE dealership');
    console.log('   - Super admins manage the platform, not individual dealerships');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyDealershipStaffIsolation();

