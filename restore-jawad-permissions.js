import { query, pool } from './src/database/connection.js';

async function restorePermissions() {
  console.log('🔄 Restoring permissions for jawad to only lead_management and analytics_dashboard...\n');
  
  try {
    const staffId = '550b1f70-3568-4d73-972e-f7fe581632f2'; // jawad's staff_id
    const permissions = [
      'lead_management',
      'analytics_dashboard'
    ];

    console.log('📋 Restoring permissions to:', permissions);

    // Delete existing permissions
    await query('DELETE FROM staff_permissions WHERE staff_id = $1', [staffId]);
    console.log('✅ Deleted all permissions');

    // Insert only these 2 permissions
    for (const permission of permissions) {
      await query(
        'INSERT INTO staff_permissions (staff_id, permission_name, permission_value) VALUES ($1, $2, $3)',
        [staffId, permission, true]
      );
      console.log(`✅ Added: ${permission}`);
    }

    console.log('\n✨ Permissions restored!');
    console.log('\n🔍 Now checking if Finance nav still shows...');
    console.log('   Finance nav requires: finance_management OR rebate_management');
    console.log('   User has: lead_management, analytics_dashboard');
    console.log('   Expected result: Finance nav should NOT show');
    console.log('\n👉 Please log out and log back in as "jawad" to test.');

  } catch (error) {
    console.error('❌ Error restoring permissions:', error);
  } finally {
    await pool.end();
  }
}

restorePermissions();

