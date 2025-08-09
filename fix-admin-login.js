import dotenv from 'dotenv';
import { query } from './src/database/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const fixAdminLogin = async () => {
  try {
    console.log('🔧 Fixing admin login...');
    
    // Get admin user
    const userResult = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      ['admin@example.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    const adminUser = userResult.rows[0];
    console.log('✅ Admin user found:', adminUser.email);
    
    // Check if role exists
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
    
    console.log('\n🎯 SOLUTION:');
    console.log('1. Clear your browser\'s local storage for localhost:8080');
    console.log('2. Log out and log back in with admin@example.com');
    console.log('3. Or use this fresh token in your browser console:');
    console.log('\nlocalStorage.setItem("auth_token", "' + token + '");');
    console.log('window.location.reload();');
    
    // Test the token
    console.log('\n🧪 Testing token...');
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
      console.log('✅ /me endpoint would return role:', meResult.rows[0].role);
    }
    
  } catch (error) {
    console.error('Error fixing admin login:', error);
  } finally {
    process.exit(0);
  }
};

fixAdminLogin(); 