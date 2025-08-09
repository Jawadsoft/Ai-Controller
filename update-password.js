import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query } from './src/database/connection.js';

dotenv.config();

async function updatePassword() {
  try {
    console.log('Updating password for dealer1@example.com...');
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('dealeriq', saltRounds);
    
    // Update the user's password
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email',
      [hashedPassword, 'dealer1@example.com']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ User dealer1@example.com not found');
      return;
    }
    
    console.log('✅ Password updated successfully!');
    console.log('User ID:', result.rows[0].id);
    console.log('Email:', result.rows[0].email);
    console.log('New password: dealeriq');
    
  } catch (error) {
    console.error('❌ Error updating password:', error);
  } finally {
    process.exit(0);
  }
}

updatePassword(); 