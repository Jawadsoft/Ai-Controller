import dotenv from 'dotenv';
import { query } from './src/database/connection.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const fixAdminToken = async () => {
  try {
    console.log('🔧 Fixing admin token issue...');
    
    // Get admin user
    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@example.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    const adminUser = userResult.rows[0];
    console.log('✅ Admin user found:', adminUser.email);
    
    // Verify role exists
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [adminUser.id]
    );
    
    if (roleResult.rows.length === 0) {
      console.log('❌ No role found. Creating super_admin role...');
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [adminUser.id, 'super_admin']
      );
    } else {
      console.log('✅ Role found:', roleResult.rows[0].role);
    }
    
    // Generate a fresh token
    const token = jwt.sign({ userId: adminUser.id }, process.env.JWT_SECRET);
    
    console.log('\n🎯 COMPLETE SOLUTION:');
    console.log('=====================================');
    console.log('1. Open your browser (Chrome/Firefox)');
    console.log('2. Press F12 to open Developer Tools');
    console.log('3. Go to the Console tab');
    console.log('4. Copy and paste these commands one by one:');
    console.log('\n--- COMMAND 1: Clear old token ---');
    console.log('localStorage.removeItem("auth_token");');
    console.log('\n--- COMMAND 2: Set fresh token ---');
    console.log('localStorage.setItem("auth_token", "' + token + '");');
    console.log('\n--- COMMAND 3: Reload page ---');
    console.log('window.location.reload();');
    console.log('\n=====================================');
    
    // Test the token
    console.log('\n🧪 Token verification:');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token is valid for user ID:', decoded.userId);
    
    // Test the /me endpoint logic
    const meResult = await query(
      `SELECT u.id, u.email, ur.role 
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       WHERE u.id = $1`,
      [decoded.userId]
    );
    
    if (meResult.rows.length > 0) {
      console.log('✅ /me endpoint will return role:', meResult.rows[0].role);
      console.log('✅ isSuperAdmin() should return: true');
    }
    
    console.log('\n📝 After running the commands above:');
    console.log('- You should see "Super Admin" in the header');
    console.log('- User Management should be accessible');
    console.log('- isSuperAdmin() should return true');
    
  } catch (error) {
    console.error('Error fixing admin token:', error);
  } finally {
    process.exit(0);
  }
};

fixAdminToken(); 