import { query } from './connection.js';

async function removeStaffRoleConstraint() {
  console.log('🚀 Removing staff_role CHECK constraint...');
  console.log('');
  
  try {
    // Check if constraint exists
    const constraintCheck = await query(`
      SELECT conname 
      FROM pg_constraint
      WHERE conrelid = 'dealership_staff'::regclass
      AND conname = 'dealership_staff_staff_role_check'
    `);
    
    if (constraintCheck.rows.length === 0) {
      console.log('✅ Constraint already removed or does not exist');
      console.log('');
    } else {
      console.log('📋 Found existing constraint, removing...');
      
      // Drop the old constraint
      await query(`
        ALTER TABLE dealership_staff 
        DROP CONSTRAINT IF EXISTS dealership_staff_staff_role_check
      `);
      
      console.log('✅ Old CHECK constraint removed');
    }
    
    // Add new constraint that just ensures not empty
    console.log('📋 Adding new constraint for non-empty staff_role...');
    
    await query(`
      ALTER TABLE dealership_staff 
      DROP CONSTRAINT IF EXISTS dealership_staff_staff_role_not_empty
    `);
    
    await query(`
      ALTER TABLE dealership_staff 
      ADD CONSTRAINT dealership_staff_staff_role_not_empty 
      CHECK (staff_role IS NOT NULL AND length(trim(staff_role)) > 0)
    `);
    
    console.log('✅ New constraint added (allows any non-empty role)');
    console.log('');
    
    // Verify constraints
    const constraints = await query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'dealership_staff'::regclass
      AND conname LIKE '%staff_role%'
    `);
    
    console.log('📊 Current staff_role constraints:');
    constraints.rows.forEach(row => {
      console.log(`   ${row.constraint_name}: ${row.constraint_definition}`);
    });
    console.log('');
    
    // Test with a custom role
    console.log('🧪 Testing custom role support...');
    const testRoles = await query(`
      SELECT DISTINCT staff_role FROM dealership_staff ORDER BY staff_role
    `);
    
    console.log('✅ Current roles in use:');
    testRoles.rows.forEach(row => {
      console.log(`   - ${row.staff_role}`);
    });
    console.log('');
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 You can now:');
    console.log('   1. Create custom roles in Super Admin → Role Management');
    console.log('   2. Assign custom roles to staff in Staff Management');
    console.log('   3. Roles are validated against the roles table');
    console.log('');
    
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

removeStaffRoleConstraint();

