import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function listAllUsers() {
  try {
    console.log('👥 Listing all users in the system...\n');
    
    const userResult = await query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        ur.role,
        d.business_name,
        d.contact_name
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      LEFT JOIN dealers d ON u.id = d.user_id
      ORDER BY u.created_at DESC
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No users found in the database');
      return;
    }

    console.log(`✅ Found ${userResult.rows.length} user(s):\n`);
    
    userResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. User Details:`);
      console.log(`   ID: ${user.id || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Role: ${user.role || 'No role assigned'}`);
      console.log(`   Business: ${user.business_name || 'N/A'}`);
      console.log(`   Contact: ${user.contact_name || 'N/A'}`);
      console.log(`   Created: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}`);
      console.log('');
    });

    // Show role statistics
    const roleStats = await query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM user_roles 
      GROUP BY role 
      ORDER BY count DESC
    `);

    console.log('📊 Role Statistics:');
    roleStats.rows.forEach(stat => {
      console.log(`   ${stat.role}: ${stat.count} user(s)`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

listAllUsers(); 