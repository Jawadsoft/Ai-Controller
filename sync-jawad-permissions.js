import { query, pool } from './src/database/connection.js';

async function syncPermissions() {
  console.log('🔄 Syncing permissions for jawad...\n');
  
  try {
    const staffId = '550b1f70-3568-4d73-972e-f7fe581632f2'; // jawad's staff_id
    const rolePermissions = [
      'rebate_management',
      'followup_settings_management',
      'lead_management',
      'finance_management',
      'customer_management',
      'analytics_dashboard' // Keep existing
    ];

    console.log('📋 Target permissions:', rolePermissions);

    // Delete existing permissions
    await query('DELETE FROM staff_permissions WHERE staff_id = $1', [staffId]);
    console.log('✅ Deleted old permissions');

    // Insert new permissions
    for (const permission of rolePermissions) {
      await query(
        'INSERT INTO staff_permissions (staff_id, permission_name, permission_value) VALUES ($1, $2, $3)',
        [staffId, permission, true]
      );
      console.log(`✅ Added: ${permission}`);
    }

    console.log('\n✨ Permissions synced successfully!');
    console.log('\n👉 Please log out and log back in as "jawad" to see the changes.');

  } catch (error) {
    console.error('❌ Error syncing permissions:', error);
  } finally {
    await pool.end();
  }
}

syncPermissions();

