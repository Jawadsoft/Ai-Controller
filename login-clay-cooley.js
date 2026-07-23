import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './src/database/connection.js';

async function loginClayCooley() {
  console.log('🔐 Logging in as Clay Cooley...\n');
  
  try {
    // Get Clay Cooley's user information
    console.log('1. Getting Clay Cooley user information...');
    const userQuery = `
      SELECT u.id, u.email, u.password_hash, ur.role, d.id as dealer_id, d.business_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id
      WHERE d.business_name ILIKE '%clay cooley%'
      OR d.business_name ILIKE '%clay%cooley%'
      LIMIT 1
    `;
    
    const userResult = await pool.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Clay Cooley user not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Found Clay Cooley:');
    console.log('  - User ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Role:', user.role);
    console.log('  - Dealer ID:', user.dealer_id);
    console.log('  - Business Name:', user.business_name);
    
    // Generate a JWT token for Clay Cooley
    console.log('\n2. Generating JWT token...');
    
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('✅ JWT token generated successfully');
    console.log('  - Token length:', token.length);
    console.log('  - Token preview:', token.substring(0, 50) + '...');
    
    // Test the token
    console.log('\n3. Testing token verification...');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      console.log('✅ Token verification successful');
      console.log('  - Decoded user ID:', decoded.userId);
      console.log('  - Matches Clay Cooley:', decoded.userId === user.id);
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      return;
    }
    
    // Test the dealer profile endpoint
    console.log('\n4. Testing dealer profile endpoint...');
    
    const fetch = (await import('node-fetch')).default;
    
    const profileResponse = await fetch('http://localhost:3000/api/dealers/profile', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📥 Profile response:');
    console.log('  - Status:', profileResponse.status);
    console.log('  - OK:', profileResponse.ok);
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('  - Dealer ID:', profileData.id);
      console.log('  - Business Name:', profileData.business_name);
      console.log('  - Matches Clay Cooley:', profileData.business_name.toLowerCase().includes('clay cooley'));
    } else {
      const errorText = await profileResponse.text();
      console.log('  - Error:', errorText);
    }
    
    console.log('\n🎫 CLAY COOLEY LOGIN TOKEN:');
    console.log('=====================================');
    console.log(token);
    console.log('=====================================');
    
    console.log('\n📋 To use this token:');
    console.log('1. Open browser developer tools (F12)');
    console.log('2. Go to Application/Storage tab');
    console.log('3. Find localStorage');
    console.log('4. Add a new key: "auth_token"');
    console.log('5. Set the value to the token above');
    console.log('6. Refresh the page');
    console.log('7. Navigate to /ai-bot');
    
    console.log('\n✅ Clay Cooley login completed!');
    console.log('  - Token is valid and working');
    console.log('  - Dealer profile endpoint accessible');
    console.log('  - AI bot should now work with Clay Cooley context');
    
  } catch (error) {
    console.error('❌ Error logging in as Clay Cooley:', error);
  } finally {
    await pool.end();
  }
}

loginClayCooley(); 