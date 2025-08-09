// Login script for dealer user
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './src/database/connection.js';

async function loginDealer() {
  try {
    console.log('🔐 Logging in as dealer...');
    
    // Get the dealer user
    const userResult = await query(
      'SELECT u.*, ur.role FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.email = $1',
      ['dealer1@example.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Dealer user not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Found user:', user.email);
    console.log('Role:', user.role);
    
    // Generate a token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    console.log('\n🎫 Generated JWT Token:');
    console.log(token);
    
    console.log('\n📋 To use this token:');
    console.log('1. Open browser developer tools (F12)');
    console.log('2. Go to Application/Storage tab');
    console.log('3. Find localStorage');
    console.log('4. Add a new key: "token"');
    console.log('5. Set the value to the token above');
    console.log('6. Refresh the page');
    
    // Test the token
    console.log('\n🧪 Testing token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token payload:', decoded);
    
    // Test the auth middleware query
    const authResult = await query(
      'SELECT u.*, ur.role, d.id as dealer_id FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id LEFT JOIN dealers d ON u.id = d.user_id WHERE u.id = $1',
      [decoded.userId]
    );
    
    if (authResult.rows.length > 0) {
      const authUser = authResult.rows[0];
      console.log('\n✅ Auth middleware test:');
      console.log('User ID:', authUser.id);
      console.log('Email:', authUser.email);
      console.log('Role:', authUser.role);
      console.log('Dealer ID:', authUser.dealer_id);
    }
    
  } catch (error) {
    console.error('❌ Error logging in:', error);
  }
}

loginDealer(); 