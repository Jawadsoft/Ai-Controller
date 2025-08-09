import bcrypt from 'bcryptjs';
import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'finance786';

async function checkAndCreateAdminUser() {
  try {
    console.log('🔍 Checking if admin user exists...');
    
    // Check if user exists
    const userResult = await query(
      'SELECT u.id, u.email, u.password_hash, ur.role FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.email = $1',
      [ADMIN_EMAIL]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('✅ Admin user found:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role || 'No role assigned'}`);
      console.log(`   User ID: ${user.id}`);
      
      // Test password
      const isValidPassword = await bcrypt.compare(ADMIN_PASSWORD, user.password_hash);
      console.log(`   Password valid: ${isValidPassword ? '✅ Yes' : '❌ No'}`);
      
      if (!isValidPassword) {
        console.log('🔄 Updating admin password...');
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
        
        await query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [newPasswordHash, ADMIN_EMAIL]
        );
        console.log('✅ Admin password updated successfully!');
      }
      
      // Check if user has a role
      if (!user.role) {
        console.log('🔄 Assigning super_admin role...');
        await query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET role = $2',
          [user.id, 'super_admin']
        );
        console.log('✅ Super admin role assigned!');
      }
      
    } else {
      console.log('❌ Admin user not found. Creating...');
      
      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
      
      // Start transaction
      await query('BEGIN');
      
      try {
        // Create user
        const userResult = await query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
          [ADMIN_EMAIL, passwordHash]
        );
        const userId = userResult.rows[0].id;
        
        // Create user role
        await query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
          [userId, 'super_admin']
        );
        
        // Create dealer profile (optional for admin)
        await query(
          'INSERT INTO dealers (user_id, business_name, contact_name, email, subscription_plan, subscription_status) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, 'System Admin', 'Administrator', ADMIN_EMAIL, 'enterprise', 'active']
        );
        
        await query('COMMIT');
        
        console.log('✅ Admin user created successfully!');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log(`   Role: super_admin`);
        console.log(`   User ID: ${userId}`);
        
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    }
    
    // Test login
    console.log('\n🧪 Testing login...');
    const testUserResult = await query(
      'SELECT u.id, u.email, u.password_hash, ur.role FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.email = $1',
      [ADMIN_EMAIL]
    );
    
    if (testUserResult.rows.length > 0) {
      const testUser = testUserResult.rows[0];
      const testPasswordValid = await bcrypt.compare(ADMIN_PASSWORD, testUser.password_hash);
      
      if (testPasswordValid) {
        console.log('✅ Login test successful!');
        console.log('   You can now sign in with:');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
      } else {
        console.log('❌ Login test failed - password mismatch');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAndCreateAdminUser(); 