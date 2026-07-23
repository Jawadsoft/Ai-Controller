import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function createTestUser() {
  try {
    const email = 'test@example.com';
    const password = 'test123';
    
    // Hash the password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      console.log('User already exists, updating password...');
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    } else {
      console.log('Creating new user...');
      await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, passwordHash]);
    }
    
    // Get the user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userResult.rows[0].id;
    
    // Check if dealer profile exists
    const existingDealer = await pool.query('SELECT id FROM dealers WHERE user_id = $1', [userId]);
    
    if (existingDealer.rows.length === 0) {
      console.log('Creating dealer profile...');
      await pool.query(`
        INSERT INTO dealers (
          user_id, business_name, contact_name, email, subscription_plan, subscription_status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, 'Test Dealership', 'Test User', email, 'basic', 'active']);
    }
    
    // Check if user role exists
    const existingRole = await pool.query('SELECT * FROM user_roles WHERE user_id = $1', [userId]);
    
    if (existingRole.rows.length === 0) {
      console.log('Creating user role...');
      await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, 'dealer']);
    }
    
    console.log('Test user created/updated successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('User ID:', userId);
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await pool.end();
  }
}

createTestUser(); 