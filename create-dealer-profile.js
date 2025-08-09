import dotenv from 'dotenv';
import { query } from './src/database/connection.js';

dotenv.config();

async function createDealerProfile() {
  try {
    console.log('Creating dealer profile for dealer1@example.com...');
    
    // First, get the user ID
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      ['dealer1@example.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User dealer1@example.com not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('Found user ID:', userId);
    
    // Check if dealer profile already exists
    const existingDealer = await query(
      'SELECT id FROM dealers WHERE user_id = $1',
      [userId]
    );
    
    if (existingDealer.rows.length > 0) {
      console.log('✅ Dealer profile already exists for this user');
      return;
    }
    
    // Create dealer profile
    const dealerResult = await query(
      `INSERT INTO dealers (
        user_id, 
        business_name, 
        contact_name, 
        email, 
        phone, 
        address, 
        city, 
        state, 
        zip_code,
        description,
        established_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING id, business_name`,
      [
        userId,
        'Sample Auto Dealership',
        'John Doe',
        'dealer1@example.com',
        '(555) 123-4567',
        '123 Main Street',
        'Anytown',
        'CA',
        '90210',
        'A trusted automotive dealership providing quality vehicles and excellent customer service.',
        2020
      ]
    );
    
    console.log('✅ Dealer profile created successfully!');
    console.log('Dealer ID:', dealerResult.rows[0].id);
    console.log('Business Name:', dealerResult.rows[0].business_name);
    
    // Also create a user role if it doesn't exist
    const existingRole = await query(
      'SELECT id FROM user_roles WHERE user_id = $1',
      [userId]
    );
    
    if (existingRole.rows.length === 0) {
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, 'dealer']
      );
      console.log('✅ User role created: dealer');
    } else {
      console.log('✅ User role already exists');
    }
    
  } catch (error) {
    console.error('❌ Error creating dealer profile:', error);
  } finally {
    process.exit(0);
  }
}

createDealerProfile(); 