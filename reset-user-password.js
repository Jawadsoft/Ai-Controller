/**
 * Reset password for dealer1@example.com
 * Sets password to 'dealeriq'
 */

import bcrypt from 'bcryptjs';
import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const USER_EMAIL = 'dealer1@example.com';
const NEW_PASSWORD = 'dealeriq';

async function resetPassword() {
  try {
    console.log('🔄 Resetting Password...\n');
    console.log('='.repeat(60));
    console.log('User Email:', USER_EMAIL);
    console.log('New Password:', NEW_PASSWORD);
    console.log('='.repeat(60));
    console.log('');
    
    // Step 1: Check if user exists
    console.log('📋 Step 1: Checking if user exists...');
    const userCheck = await query('SELECT id, email FROM users WHERE email = $1', [USER_EMAIL]);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ User not found!');
      console.log(`   Email: ${USER_EMAIL}`);
      console.log('\n💡 User needs to be registered first.');
      process.exit(1);
    }
    
    const user = userCheck.rows[0];
    console.log('✅ User found!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log('');
    
    // Step 2: Hash the new password
    console.log('📋 Step 2: Hashing new password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    console.log('✅ Password hashed successfully');
    console.log(`   Hash: ${passwordHash.substring(0, 30)}...`);
    console.log('');
    
    // Step 3: Update password in database
    console.log('📋 Step 3: Updating password in database...');
    const updateResult = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email',
      [passwordHash, USER_EMAIL]
    );
    
    if (updateResult.rows.length === 0) {
      console.log('❌ Failed to update password!');
      process.exit(1);
    }
    
    console.log('✅ Password updated successfully!');
    console.log('');
    
    // Step 4: Verify the password works
    console.log('📋 Step 4: Verifying new password...');
    const verifyUser = await query('SELECT password_hash FROM users WHERE email = $1', [USER_EMAIL]);
    const isValid = await bcrypt.compare(NEW_PASSWORD, verifyUser.rows[0].password_hash);
    
    if (isValid) {
      console.log('✅ Password verification successful!');
      console.log('');
    } else {
      console.log('❌ Password verification failed!');
      console.log('   Something went wrong with password update.');
      process.exit(1);
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('✅ PASSWORD RESET COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   User: ${USER_EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`   Status: Reset and verified`);
    console.log('\n💡 You can now login with:');
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    if (error.code === '28P01') {
      console.error('\n💡 Database password authentication failed!');
      console.error('   Fix: Update DB_PASSWORD in .env and restart server');
    }
    
    process.exit(1);
  }
}

resetPassword();

