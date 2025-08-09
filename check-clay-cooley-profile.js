import { query } from './src/database/connection.js';

async function checkClayCooleyProfile() {
  try {
    console.log('🔍 Checking Clay Cooley profile...');
    
    // First, find Clay Cooley's user record
    const userResult = await query(
      'SELECT * FROM users WHERE email LIKE $1 OR business_name LIKE $2',
      ['%clay%', '%clay%']
    );
    
    console.log('📋 Found users:', userResult.rows.length);
    userResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. User:`, {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        contact_name: user.contact_name,
        role: user.role
      });
    });
    
    // Check for dealer profiles
    const dealerResult = await query(
      'SELECT d.*, u.email, u.business_name, u.contact_name FROM dealers d JOIN users u ON d.user_id = u.id WHERE u.email LIKE $1 OR u.business_name LIKE $2',
      ['%clay%', '%clay%']
    );
    
    console.log('🏢 Dealer profiles found:', dealerResult.rows.length);
    dealerResult.rows.forEach((dealer, index) => {
      console.log(`${index + 1}. Dealer:`, {
        id: dealer.id,
        user_id: dealer.user_id,
        business_name: dealer.business_name,
        contact_name: dealer.contact_name,
        email: dealer.email
      });
    });
    
    // Check all users with dealer profiles
    const allDealers = await query(
      'SELECT d.*, u.email, u.business_name, u.contact_name FROM dealers d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC'
    );
    
    console.log('\n📊 All dealer profiles:');
    allDealers.rows.forEach((dealer, index) => {
      console.log(`${index + 1}. ${dealer.business_name} (${dealer.contact_name}) - ${dealer.email}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkClayCooleyProfile(); 