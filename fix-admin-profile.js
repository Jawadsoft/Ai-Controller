import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = 'admin@example.com';

async function fixAdminProfile() {
  try {
    console.log('🔧 Fixing admin user profile...');
    
    // Get admin user
    const userResult = await query(
      'SELECT u.id, u.email, ur.role FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.email = $1',
      [ADMIN_EMAIL]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found admin user: ${user.email} (${user.role})`);

    // Check if dealer profile exists
    const dealerResult = await query(
      'SELECT * FROM dealers WHERE user_id = $1',
      [user.id]
    );

    if (dealerResult.rows.length === 0) {
      console.log('🔄 Creating dealer profile for admin...');
      
      await query(
        `INSERT INTO dealers (
          user_id, 
          business_name, 
          contact_name, 
          email, 
          subscription_plan, 
          subscription_status,
          subscription_start_date
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          user.id,
          'System Administration',
          'System Administrator',
          ADMIN_EMAIL,
          'enterprise',
          'active'
        ]
      );
      
      console.log('✅ Dealer profile created for admin');
    } else {
      console.log('✅ Dealer profile already exists');
      console.log(`   Business: ${dealerResult.rows[0].business_name}`);
      console.log(`   Contact: ${dealerResult.rows[0].contact_name}`);
    }

    // Test the profile endpoint
    console.log('\n🧪 Testing profile endpoint...');
    const testResult = await query(
      'SELECT d.*, u.email as user_email FROM dealers d JOIN users u ON d.user_id = u.id WHERE u.email = $1',
      [ADMIN_EMAIL]
    );

    if (testResult.rows.length > 0) {
      console.log('✅ Profile endpoint test successful');
      console.log(`   Business: ${testResult.rows[0].business_name}`);
      console.log(`   Contact: ${testResult.rows[0].contact_name}`);
      console.log(`   Email: ${testResult.rows[0].user_email}`);
      console.log(`   Subscription: ${testResult.rows[0].subscription_plan}`);
    } else {
      console.log('❌ Profile endpoint test failed');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixAdminProfile(); 