import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkUsers() {
  try {
    console.log('👥 Checking users in database...');
    
    // Check users table
    const usersResult = await pool.query(`
      SELECT u.id, u.email, u.created_at, ur.role, d.id as dealer_id, d.business_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id
      ORDER BY u.created_at DESC
    `);
    
    console.log(`📊 Total users: ${usersResult.rows.length}`);
    
    if (usersResult.rows.length > 0) {
      console.log('\n👤 User details:');
      usersResult.rows.forEach((user, index) => {
        console.log(`  ${index + 1}. Email: ${user.email}`);
        console.log(`     Role: ${user.role || 'No role'}`);
        console.log(`     Dealer ID: ${user.dealer_id || 'No dealer profile'}`);
        console.log(`     Business: ${user.business_name || 'N/A'}`);
        console.log(`     Created: ${user.created_at}`);
        console.log('');
      });
    }
    
    // Check if there are any test users or admin users
    const testUsers = usersResult.rows.filter(user => 
      user.email.includes('test') || 
      user.email.includes('admin') || 
      user.email.includes('dealer')
    );
    
    if (testUsers.length > 0) {
      console.log('🧪 Test/Admin users found:');
      testUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.role})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();



