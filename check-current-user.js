import { pool } from './src/database/connection.js';

async function checkCurrentUser() {
  try {
    console.log('🔍 Checking current user profiles...\n');
    
    // Get all users with their dealer profiles
    const query = `
      SELECT 
        u.id,
        u.email,
        u.created_at,
        ur.role,
        d.id as dealer_id,
        d.business_name,
        d.contact_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id
      ORDER BY u.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    console.log('📋 User Profiles:\n');
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. User Details:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Dealer ID: ${user.dealer_id || 'None'}`);
      console.log(`   Business Name: ${user.business_name || 'N/A'}`);
      console.log(`   Contact Name: ${user.contact_name || 'N/A'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });
    
    // Check which users need dealer profiles
    const usersWithoutDealerProfiles = result.rows.filter(user => 
      user.role === 'dealer' && !user.dealer_id
    );
    
    if (usersWithoutDealerProfiles.length > 0) {
      console.log('⚠️  Users without dealer profiles:');
      usersWithoutDealerProfiles.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
      console.log('');
    }
    
    // Check which users have dealer profiles but no dealer_id in users table
    const usersWithoutDealerId = result.rows.filter(user => 
      user.dealer_id && user.role === 'dealer'
    );
    
    if (usersWithoutDealerId.length > 0) {
      console.log('⚠️  Users with dealer profiles but missing dealer_id:');
      usersWithoutDealerId.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await pool.end();
  }
}

checkCurrentUser(); 