import { query, pool } from './src/database/connection.js';

async function cleanupOrphanedUsers() {
  console.log('🧹 Cleaning up orphaned users...\n');
  
  try {
    // 1. Find orphaned users (users with no dealership_staff association)
    console.log('1️⃣ Finding orphaned users...');
    const orphanedUsers = await query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.created_at,
        ur.role as system_role
      FROM users u
      LEFT JOIN dealership_staff ds ON u.id = ds.user_id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id  -- Check if they're a dealer owner
      WHERE ds.id IS NULL  -- No dealership_staff association
        AND d.id IS NULL   -- Not a dealer owner
        AND (ur.role IS NULL OR ur.role != 'super_admin')  -- Not super admin
      ORDER BY u.created_at DESC
    `);

    if (orphanedUsers.rows.length === 0) {
      console.log('   ✅ No orphaned users found! Database is clean.\n');
      return;
    }

    console.log(`   ⚠️  Found ${orphanedUsers.rows.length} orphaned user(s):\n`);
    
    orphanedUsers.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.name || 'No name'})`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log(`      Role: ${user.system_role || 'None'}`);
      console.log('');
    });

    // 2. Ask for confirmation (in production, you'd want to review this list first)
    console.log('━'.repeat(60));
    console.log('⚠️  WARNING: This will PERMANENTLY delete these users!');
    console.log('━'.repeat(60));
    console.log('');
    console.log('👉 Review the list above carefully.');
    console.log('👉 To proceed, run: node cleanup-orphaned-users.js --confirm');
    console.log('');

    // Check if --confirm flag is present
    const isConfirmed = process.argv.includes('--confirm');

    if (!isConfirmed) {
      console.log('❌ Deletion cancelled. Run with --confirm flag to proceed.');
      return;
    }

    // 3. Delete orphaned users
    console.log('━'.repeat(60));
    console.log('🗑️  DELETING ORPHANED USERS...');
    console.log('━'.repeat(60));
    console.log('');

    let deletedCount = 0;

    for (const user of orphanedUsers.rows) {
      try {
        // Start transaction for each user
        await query('BEGIN');

        // Delete from user_roles first
        await query('DELETE FROM user_roles WHERE user_id = $1', [user.id]);
        
        // Delete from users
        await query('DELETE FROM users WHERE id = $1', [user.id]);

        await query('COMMIT');
        
        deletedCount++;
        console.log(`   ✅ Deleted: ${user.email}`);
      } catch (error) {
        await query('ROLLBACK');
        console.error(`   ❌ Failed to delete ${user.email}:`, error.message);
      }
    }

    console.log('');
    console.log('━'.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('━'.repeat(60));
    console.log(`Total orphaned users found: ${orphanedUsers.rows.length}`);
    console.log(`Successfully deleted: ${deletedCount}`);
    console.log(`Failed: ${orphanedUsers.rows.length - deletedCount}`);
    console.log('');
    console.log('✅ Cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupOrphanedUsers();

