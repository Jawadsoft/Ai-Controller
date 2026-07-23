import { query } from './connection.js';

async function removeUniqueRoleConstraint() {
  console.log('🚀 Removing unique role per dealer constraint...');
  console.log('');
  
  try {
    // Check if constraint exists
    const constraintCheck = await query(`
      SELECT conname 
      FROM pg_constraint
      WHERE conrelid = 'dealership_staff'::regclass
      AND conname = 'unique_admin_per_dealer'
    `);
    
    if (constraintCheck.rows.length === 0) {
      console.log('✅ Constraint already removed or does not exist');
      console.log('');
      process.exit(0);
    }
    
    console.log('📋 Found unique_admin_per_dealer constraint');
    console.log('⚠️  This constraint prevents multiple staff with the same role per dealer');
    console.log('');
    
    // Drop the constraint
    await query(`
      ALTER TABLE dealership_staff 
      DROP CONSTRAINT IF EXISTS unique_admin_per_dealer
    `);
    
    console.log('✅ Constraint removed successfully');
    console.log('');
    
    console.log('🎉 Migration completed!');
    console.log('');
    console.log('📝 Now you can:');
    console.log('   1. Assign multiple staff members to the same custom role');
    console.log('   2. Have multiple admins per dealership if needed');
    console.log('   3. Create flexible organizational structures');
    console.log('');
    
    // Show current staff distribution
    const staffDist = await query(`
      SELECT dealer_id, staff_role, COUNT(*) as count
      FROM dealership_staff
      GROUP BY dealer_id, staff_role
      ORDER BY dealer_id, staff_role
    `);
    
    if (staffDist.rows.length > 0) {
      console.log('📊 Current staff distribution:');
      const dealerGroups = {};
      staffDist.rows.forEach(row => {
        if (!dealerGroups[row.dealer_id]) {
          dealerGroups[row.dealer_id] = [];
        }
        dealerGroups[row.dealer_id].push(`${row.staff_role}: ${row.count}`);
      });
      
      Object.keys(dealerGroups).forEach(dealerId => {
        console.log(`   Dealer ${dealerId.substring(0, 8)}...:`);
        dealerGroups[dealerId].forEach(info => {
          console.log(`      - ${info}`);
        });
      });
      console.log('');
    }
    
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

removeUniqueRoleConstraint();

