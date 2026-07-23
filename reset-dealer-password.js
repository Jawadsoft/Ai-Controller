import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function resetDealerPassword() {
  try {
    const email = 'dealer1@example.com';
    const newPassword = 'dealeriq';
    
    // Hash the new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the password
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    
    console.log('Password reset successfully!');
    console.log('Email:', email);
    console.log('New Password:', newPassword);
    
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await pool.end();
  }
}

resetDealerPassword(); 