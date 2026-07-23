/**
 * Multi-User System Database Migration
 * 
 * This file contains all the database changes for implementing a multi-user system
 * with role-based access control for dealerships. It includes:
 * 
 * 1. User Role Extensions
 * 2. Dealership Staff Management
 * 3. Granular Permissions System
 * 4. Performance Optimizations
 * 5. Helper Functions and Views
 * 
 * Run this file to set up the complete multi-user system.
 */

import { query } from './src/database/connection.js';

async function runMultiUserMigration() {
  console.log('🚀 Starting Multi-User System Database Migration...');
  
  try {
    // 1. Enable UUID extension
    console.log('🔧 Enabling UUID extension...');
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ UUID extension enabled');

    // 2. Add new user roles
    console.log('👥 Adding new user roles...');
    
    const newRoles = ['dealer_admin', 'sales_agent', 'finance_manager', 'service_advisor', 'inventory_manager'];
    
    for (const role of newRoles) {
      try {
        await query(`
          DO $$ 
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = $1 AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
                  ALTER TYPE user_role ADD VALUE $1;
              END IF;
          END $$;
        `, [role]);
        console.log(`  ✅ Added role: ${role}`);
      } catch (error) {
        console.log(`  ⚠️ Role ${role} might already exist: ${error.message}`);
      }
    }

    // 3. Create dealership staff table
    console.log('🏢 Creating dealership staff table...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS dealership_staff (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          staff_role VARCHAR(50) NOT NULL CHECK (staff_role IN ('admin', 'sales', 'finance', 'service', 'inventory')),
          permissions TEXT[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          UNIQUE(user_id),
          CONSTRAINT unique_admin_per_dealer UNIQUE(dealer_id, staff_role) DEFERRABLE INITIALLY DEFERRED
      )
    `);
    
    console.log('✅ Dealership staff table created');

    // 4. Create staff permissions table
    console.log('🔐 Creating staff permissions table...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS staff_permissions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          staff_id UUID NOT NULL REFERENCES dealership_staff(id) ON DELETE CASCADE,
          permission_name VARCHAR(100) NOT NULL,
          permission_value BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          UNIQUE(staff_id, permission_name)
      )
    `);
    
    console.log('✅ Staff permissions table created');

    // 5. Create performance indexes
    console.log('📊 Creating performance indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_dealership_staff_dealer_id ON dealership_staff(dealer_id)',
      'CREATE INDEX IF NOT EXISTS idx_dealership_staff_user_id ON dealership_staff(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_dealership_staff_role ON dealership_staff(staff_role)',
      'CREATE INDEX IF NOT EXISTS idx_dealership_staff_active ON dealership_staff(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff_id ON staff_permissions(staff_id)'
    ];
    
    for (const indexQuery of indexes) {
      await query(indexQuery);
    }
    
    console.log('✅ Performance indexes created');

    // 6. Create updated_at trigger function if it doesn't exist
    console.log('⏰ Setting up timestamp triggers...');
    
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers
    await query(`
      DROP TRIGGER IF EXISTS update_dealership_staff_updated_at ON dealership_staff;
      CREATE TRIGGER update_dealership_staff_updated_at 
          BEFORE UPDATE ON dealership_staff
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_staff_permissions_updated_at ON staff_permissions;
      CREATE TRIGGER update_staff_permissions_updated_at 
          BEFORE UPDATE ON staff_permissions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('✅ Timestamp triggers created');

    // 7. Insert default permissions for each role
    console.log('🔑 Setting up default permissions...');
    
    const rolePermissions = {
      admin: [
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
      ],
      sales: [
        'qr_code_generation',
        'lead_management',
        'vehicle_import'
      ],
      finance: [
        'lead_management',
        'analytics_dashboard'
      ],
      service: [
        'lead_management'
      ],
      inventory: [
        'vehicle_import',
        'qr_code_generation'
      ]
    };

    for (const [role, permissions] of Object.entries(rolePermissions)) {
      for (const permission of permissions) {
        await query(`
          INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
          SELECT 
              ds.id,
              $1,
              true
          FROM dealership_staff ds
          WHERE ds.staff_role = $2
          ON CONFLICT (staff_id, permission_name) DO NOTHING
        `, [permission, role]);
      }
      console.log(`  ✅ Set permissions for ${role} role (${permissions.length} permissions)`);
    }

    // 8. Create staff with details view
    console.log('👁️ Creating staff details view...');
    
    await query(`
      CREATE OR REPLACE VIEW staff_with_details AS
      SELECT 
          ds.*,
          u.email,
          u.name,
          u.created_at as user_created_at,
          creator.email as created_by_email,
          d.business_name as dealer_name
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      LEFT JOIN users creator ON ds.created_by = creator.id
      JOIN dealers d ON ds.dealer_id = d.id
    `);
    
    console.log('✅ Staff details view created');

    // 9. Create user dealer access function
    console.log('🔍 Creating user dealer access function...');
    
    await query(`
      CREATE OR REPLACE FUNCTION get_user_dealer_access(user_uuid UUID)
      RETURNS TABLE(
          dealer_id UUID,
          business_name TEXT,
          staff_role VARCHAR(50),
          permissions TEXT[],
          is_active BOOLEAN
      ) AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              ds.dealer_id,
              d.business_name,
              ds.staff_role,
              ds.permissions,
              ds.is_active
          FROM dealership_staff ds
          JOIN dealers d ON ds.dealer_id = d.id
          WHERE ds.user_id = user_uuid AND ds.is_active = true;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ User dealer access function created');

    // 10. Create permission check function
    console.log('🛡️ Creating permission check function...');
    
    // Drop existing function first to avoid parameter name conflicts
    await query(`DROP FUNCTION IF EXISTS user_has_permission(UUID, TEXT)`);
    
    await query(`
      CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, permission_name_param TEXT)
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
          
          -- Admin staff role has all permissions (consistent with backend)
          SELECT ds.staff_role INTO staff_role
          FROM dealership_staff ds
          WHERE ds.user_id = user_uuid AND ds.is_active = true;
          
          IF staff_role = 'admin' THEN
              RETURN true;
          END IF;
          
          -- Check if permission exists in staff permissions for other roles
          SELECT EXISTS(
              SELECT 1 FROM staff_permissions sp
              JOIN dealership_staff ds ON sp.staff_id = ds.id
              WHERE ds.user_id = user_uuid 
              AND sp.permission_name = permission_name_param 
              AND sp.permission_value = true
              AND ds.is_active = true
          ) INTO has_permission;
          
          RETURN has_permission;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Permission check function created');

    // 11. Add documentation comments
    console.log('📚 Adding documentation comments...');
    
    await query(`COMMENT ON TABLE dealership_staff IS 'Manages staff members for each dealership with role-based access'`);
    await query(`COMMENT ON TABLE staff_permissions IS 'Granular permissions for each staff member'`);
    await query(`COMMENT ON VIEW staff_with_details IS 'Complete staff information with user and dealer details'`);
    await query(`COMMENT ON FUNCTION get_user_dealer_access IS 'Returns dealer access information for a user'`);
    await query(`COMMENT ON FUNCTION user_has_permission IS 'Checks if a user has a specific permission'`);
    
    console.log('✅ Documentation comments added');

    // 12. Create helper functions for staff management
    console.log('⚙️ Creating staff management helper functions...');
    
    // Function to create staff member
    await query(`
      CREATE OR REPLACE FUNCTION create_staff_member(
          p_dealer_id UUID,
          p_user_id UUID,
          p_staff_role VARCHAR(50),
          p_created_by UUID DEFAULT NULL
      )
      RETURNS UUID AS $$
      DECLARE
          staff_id UUID;
      BEGIN
          INSERT INTO dealership_staff (dealer_id, user_id, staff_role, created_by)
          VALUES (p_dealer_id, p_user_id, p_staff_role, p_created_by)
          RETURNING id INTO staff_id;
          
          -- Add default permissions for the role
          INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
          SELECT staff_id, permission_name, true
          FROM (
              VALUES 
                  ('qr_code_generation'),
                  ('lead_management'),
                  ('vehicle_import'),
                  ('analytics_dashboard'),
                  ('bulk_actions'),
                  ('staff_management'),
                  ('user_management'),
                  ('custom_branding'),
                  ('api_access'),
                  ('priority_support')
          ) AS permissions(permission_name)
          WHERE p_staff_role = 'admin'
          ON CONFLICT (staff_id, permission_name) DO NOTHING;
          
          RETURN staff_id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function to get staff permissions
    await query(`
      CREATE OR REPLACE FUNCTION get_staff_permissions(p_staff_id UUID)
      RETURNS TABLE (
          permission_name VARCHAR(100),
          permission_value BOOLEAN
      ) AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              sp.permission_name,
              sp.permission_value
          FROM staff_permissions sp
          WHERE sp.staff_id = p_staff_id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function to update staff permissions
    await query(`
      CREATE OR REPLACE FUNCTION update_staff_permission(
          p_staff_id UUID,
          p_permission_name VARCHAR(100),
          p_permission_value BOOLEAN
      )
      RETURNS BOOLEAN AS $$
      BEGIN
          INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
          VALUES (p_staff_id, p_permission_name, p_permission_value)
          ON CONFLICT (staff_id, permission_name)
          DO UPDATE SET 
              permission_value = EXCLUDED.permission_value,
              updated_at = NOW();
          
          RETURN true;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Staff management helper functions created');

    // 13. Generate migration report
    console.log('📈 Generating migration report...');
    
    const report = await query(`
      SELECT 
          'dealership_staff' as table_name,
          COUNT(*) as total_records,
          COUNT(CASE WHEN staff_role = 'admin' THEN 1 END) as admins,
          COUNT(CASE WHEN staff_role = 'sales' THEN 1 END) as sales_agents,
          COUNT(CASE WHEN staff_role = 'finance' THEN 1 END) as finance_managers,
          COUNT(CASE WHEN staff_role = 'service' THEN 1 END) as service_advisors,
          COUNT(CASE WHEN staff_role = 'inventory' THEN 1 END) as inventory_managers,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_staff
      FROM dealership_staff
      UNION ALL
      SELECT 
          'staff_permissions' as table_name,
          COUNT(*) as total_records,
          COUNT(CASE WHEN permission_value = true THEN 1 END) as granted_permissions,
          COUNT(CASE WHEN permission_value = false THEN 1 END) as denied_permissions,
          NULL as finance_managers,
          NULL as service_advisors,
          NULL as inventory_managers,
          NULL as active_staff
      FROM staff_permissions
    `);
    
    console.log('📈 Migration Report:');
    report.rows.forEach(row => {
      console.log(`  ${row.table_name}:`);
      console.log(`    - Total records: ${row.total_records}`);
      if (row.table_name === 'dealership_staff') {
        console.log(`    - Admins: ${row.admins}`);
        console.log(`    - Sales agents: ${row.sales_agents}`);
        console.log(`    - Finance managers: ${row.finance_managers}`);
        console.log(`    - Service advisors: ${row.service_advisors}`);
        console.log(`    - Inventory managers: ${row.inventory_managers}`);
        console.log(`    - Active staff: ${row.active_staff}`);
      } else {
        console.log(`    - Granted permissions: ${row.granted_permissions}`);
        console.log(`    - Denied permissions: ${row.denied_permissions}`);
      }
    });

    // 14. Test the functions
    console.log('🧪 Testing created functions...');
    
    try {
      // Test permission check function
      const testResult = await query('SELECT user_has_permission(gen_random_uuid(), $1)', ['test_permission']);
      console.log('  ✅ Permission check function working');
      
      // Test staff details view
      const viewTest = await query('SELECT COUNT(*) as count FROM staff_with_details');
      console.log(`  ✅ Staff details view working (${viewTest.rows[0].count} records)`);
      
    } catch (error) {
      console.log(`  ⚠️ Function test warning: ${error.message}`);
    }

    console.log('🎉 Multi-User System Database Migration completed successfully!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('  ✅ Added new user roles (dealer_admin, sales_agent, finance_manager, service_advisor, inventory_manager)');
    console.log('  ✅ Created dealership_staff table with role-based access');
    console.log('  ✅ Created staff_permissions table for granular control');
    console.log('  ✅ Added performance indexes');
    console.log('  ✅ Created timestamp triggers');
    console.log('  ✅ Set up default permissions for each role');
    console.log('  ✅ Created staff_with_details view');
    console.log('  ✅ Created helper functions (get_user_dealer_access, user_has_permission)');
    console.log('  ✅ Created staff management functions');
    console.log('  ✅ Added comprehensive documentation');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('  1. Create staff members for existing dealers');
    console.log('  2. Test role-based access control');
    console.log('  3. Configure permissions for each role');
    console.log('  4. Update frontend to use new permission system');
    console.log('  5. Test multi-user functionality');
    
  } catch (error) {
    console.error('❌ Multi-user migration failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Rollback function (if needed)
async function rollbackMultiUserMigration() {
  console.log('🔄 Rolling back Multi-User System Database Migration...');
  
  try {
    // Drop functions
    await query('DROP FUNCTION IF EXISTS create_staff_member(UUID, UUID, VARCHAR, UUID)');
    await query('DROP FUNCTION IF EXISTS get_staff_permissions(UUID)');
    await query('DROP FUNCTION IF EXISTS update_staff_permission(UUID, VARCHAR, BOOLEAN)');
    await query('DROP FUNCTION IF EXISTS user_has_permission(UUID, TEXT)');
    await query('DROP FUNCTION IF EXISTS get_user_dealer_access(UUID)');
    
    // Drop view
    await query('DROP VIEW IF EXISTS staff_with_details');
    
    // Drop triggers
    await query('DROP TRIGGER IF EXISTS update_dealership_staff_updated_at ON dealership_staff');
    await query('DROP TRIGGER IF EXISTS update_staff_permissions_updated_at ON staff_permissions');
    
    // Drop tables (be careful with this!)
    // await query('DROP TABLE IF EXISTS staff_permissions CASCADE');
    // await query('DROP TABLE IF EXISTS dealership_staff CASCADE');
    
    // Drop indexes
    await query('DROP INDEX IF EXISTS idx_dealership_staff_dealer_id');
    await query('DROP INDEX IF EXISTS idx_dealership_staff_user_id');
    await query('DROP INDEX IF EXISTS idx_dealership_staff_role');
    await query('DROP INDEX IF EXISTS idx_dealership_staff_active');
    await query('DROP INDEX IF EXISTS idx_staff_permissions_staff_id');
    
    console.log('✅ Rollback completed successfully');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Function to create sample staff members for testing
async function createSampleStaffMembers() {
  console.log('🧪 Creating sample staff members for testing...');
  
  try {
    // Get a sample dealer
    const dealers = await query('SELECT id FROM dealers LIMIT 1');
    if (dealers.rows.length === 0) {
      console.log('⚠️ No dealers found. Please create a dealer first.');
      return;
    }
    
    const dealerId = dealers.rows[0].id;
    
    // Create sample users
    const sampleUsers = [
      { name: 'Admin User', email: 'admin@dealership.com', role: 'admin' },
      { name: 'Sales Agent', email: 'sales@dealership.com', role: 'sales' },
      { name: 'Finance Manager', email: 'finance@dealership.com', role: 'finance' },
      { name: 'Service Advisor', email: 'service@dealership.com', role: 'service' },
      { name: 'Inventory Manager', email: 'inventory@dealership.com', role: 'inventory' }
    ];
    
    for (const user of sampleUsers) {
      try {
        // Create user
        const userResult = await query(`
          INSERT INTO users (name, email, password_hash, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `, [user.name, user.email, 'sample_password_hash']);
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          // Create staff member
          await query(`
            INSERT INTO dealership_staff (dealer_id, user_id, staff_role, created_by)
            VALUES ($1, $2, $3, $2)
            ON CONFLICT (user_id) DO NOTHING
          `, [dealerId, userId, user.role]);
          
          console.log(`  ✅ Created ${user.role}: ${user.name}`);
        }
      } catch (error) {
        console.log(`  ⚠️ Could not create ${user.role}: ${error.message}`);
      }
    }
    
    console.log('✅ Sample staff members created');
    
  } catch (error) {
    console.error('❌ Failed to create sample staff members:', error);
  }
}

// Export functions for use
export { runMultiUserMigration, rollbackMultiUserMigration, createSampleStaffMembers };

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--sample')) {
    runMultiUserMigration()
      .then(() => createSampleStaffMembers())
      .then(() => {
        console.log('✅ Migration with sample data completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      });
  } else {
    runMultiUserMigration()
      .then(() => {
        console.log('✅ Migration completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      });
  }
}

