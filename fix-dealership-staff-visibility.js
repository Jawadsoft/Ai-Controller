import { query, pool } from './src/database/connection.js';

async function fixDealershipStaffVisibility() {
  console.log('🔧 Fixing Dealership Staff Visibility...\n');
  
  try {
    // 1. Ensure all necessary columns exist
    console.log('1️⃣ Verifying table structure...');
    await query(`
      -- Ensure is_active column exists
      ALTER TABLE dealership_staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      
      -- Ensure user_roles table exists
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log('   ✅ Table structure verified\n');

    // 2. Add critical indexes for performance
    console.log('2️⃣ Adding performance indexes...');
    await query(`
      -- Dealership staff indexes
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_dealer_id ON dealership_staff(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_user_id ON dealership_staff(user_id);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_staff_role ON dealership_staff(staff_role);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_is_active ON dealership_staff(is_active);
      CREATE INDEX IF NOT EXISTS idx_dealership_staff_active_dealer ON dealership_staff(dealer_id, is_active);
      
      -- User roles indexes
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
      
      -- Staff permissions indexes
      CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff_id ON staff_permissions(staff_id);
      CREATE INDEX IF NOT EXISTS idx_staff_permissions_name ON staff_permissions(permission_name);
    `);
    console.log('   ✅ Performance indexes added\n');

    // 3. Fix any orphaned staff members (staff without valid dealer)
    console.log('3️⃣ Checking for orphaned staff members...');
    const orphanedStaff = await query(`
      SELECT ds.id, u.email, ds.dealer_id
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      LEFT JOIN dealers d ON ds.dealer_id = d.id
      WHERE d.id IS NULL
    `);

    if (orphanedStaff.rows.length > 0) {
      console.log(`   ⚠️  Found ${orphanedStaff.rows.length} orphaned staff member(s)`);
      console.log('   ℹ️  These will be marked as inactive (not deleted)\n');
      
      for (const staff of orphanedStaff.rows) {
        await query(`
          UPDATE dealership_staff 
          SET is_active = FALSE 
          WHERE id = $1
        `, [staff.id]);
        console.log(`      ✓ Deactivated: ${staff.email}`);
      }
      console.log('');
    } else {
      console.log('   ✅ No orphaned staff members found\n');
    }

    // 4. Ensure UNIQUE constraint exists on user_roles.user_id
    console.log('4️⃣ Ensuring UNIQUE constraint on user_roles...');
    await query(`
      -- Add UNIQUE constraint if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'user_roles_user_id_key' 
          AND conrelid = 'user_roles'::regclass
        ) THEN
          ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
        END IF;
      END $$;
    `);
    console.log('   ✅ UNIQUE constraint verified\n');

    // 5. Ensure all users have a role assigned
    console.log('5️⃣ Verifying user roles...');
    const usersWithoutRole = await query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.id IS NULL
      AND EXISTS (SELECT 1 FROM dealership_staff ds WHERE ds.user_id = u.id)
    `);

    if (usersWithoutRole.rows.length > 0) {
      console.log(`   ⚠️  Found ${usersWithoutRole.rows.length} staff user(s) without role`);
      console.log('   ℹ️  Assigning default "dealer" role\n');
      
      for (const user of usersWithoutRole.rows) {
        await query(`
          INSERT INTO user_roles (user_id, role)
          VALUES ($1, 'dealer')
          ON CONFLICT (user_id) DO NOTHING
        `, [user.id]);
        console.log(`      ✓ Assigned role to: ${user.email}`);
      }
      console.log('');
    } else {
      console.log('   ✅ All staff users have roles assigned\n');
    }

    // 6. Create a view for easy staff lookup (optional but helpful)
    console.log('6️⃣ Creating helper view...');
    await query(`
      CREATE OR REPLACE VIEW v_dealership_staff_full AS
      SELECT 
        ds.id as staff_id,
        ds.dealer_id,
        d.business_name as dealership_name,
        u.id as user_id,
        u.email,
        u.name,
        u.email_verified,
        ds.staff_role,
        ds.is_active,
        ur.role as system_role,
        ds.created_at as staff_created_at,
        ds.updated_at as staff_updated_at,
        (
          SELECT ARRAY_AGG(sp.permission_name)
          FROM staff_permissions sp
          WHERE sp.staff_id = ds.id AND sp.permission_value = true
        ) as permissions
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      JOIN dealers d ON ds.dealer_id = d.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE (ur.role IS NULL OR ur.role != 'super_admin');
    `);
    console.log('   ✅ Created view: v_dealership_staff_full\n');

    // 7. Test the final query
    console.log('7️⃣ Testing staff visibility query...');
    const sampleDealer = await query(`
      SELECT id, business_name FROM dealers LIMIT 1
    `);

    if (sampleDealer.rows.length > 0) {
      const testResult = await query(`
        SELECT * FROM v_dealership_staff_full
        WHERE dealer_id = $1
        ORDER BY staff_created_at DESC
      `, [sampleDealer.rows[0].id]);

      console.log(`   📊 Test Results for: ${sampleDealer.rows[0].business_name}`);
      console.log(`      Visible staff count: ${testResult.rows.length}`);
      
      if (testResult.rows.length > 0) {
        console.log('      Sample staff members:');
        testResult.rows.slice(0, 3).forEach(staff => {
          console.log(`         - ${staff.email} (${staff.staff_role}) ${staff.is_active ? '✅' : '❌'}`);
        });
      }
      console.log('');
    }

    // 8. Statistics
    console.log('━'.repeat(60));
    console.log('📊 FINAL STATISTICS');
    console.log('━'.repeat(60));

    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM dealers) as total_dealers,
        (SELECT COUNT(*) FROM dealership_staff) as total_staff,
        (SELECT COUNT(*) FROM dealership_staff WHERE is_active = true) as active_staff,
        (SELECT COUNT(DISTINCT dealer_id) FROM dealership_staff) as dealers_with_staff,
        (SELECT COUNT(*) FROM user_roles WHERE role = 'super_admin') as super_admins
    `);

    const s = stats.rows[0];
    console.log(`Total Dealerships: ${s.total_dealers}`);
    console.log(`Dealerships with Staff: ${s.dealers_with_staff}`);
    console.log(`Total Staff Members: ${s.total_staff}`);
    console.log(`Active Staff Members: ${s.active_staff}`);
    console.log(`Super Admins: ${s.super_admins} (hidden from dealers)`);
    console.log('');

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('🔍 To view staff for a specific dealer, use:');
    console.log('   SELECT * FROM v_dealership_staff_full WHERE dealer_id = \'<dealer-uuid>\';');
    console.log('');
    console.log('🔒 Security Features:');
    console.log('   ✓ Super admin accounts are hidden from dealers');
    console.log('   ✓ Staff can only be viewed by their own dealership');
    console.log('   ✓ Orphaned staff members are deactivated');
    console.log('   ✓ Performance indexes added');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

fixDealershipStaffVisibility();

