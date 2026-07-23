import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const NEW_ADMIN_EMAIL = 'admin@dealeriq.co';
const OLD_EMAILS = [
  'admin@mitiesoft.com'
];

async function updateAdminEmail() {
  console.log('🚀 Starting Admin Email Update Process...\n');
  console.log(`📧 New admin email: ${NEW_ADMIN_EMAIL}\n`);
  
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to PostgreSQL database\n');
    
    // Step 1: Find all admin users
    console.log('🔍 Step 1: Finding all admin users...');
    const findQuery = `
      SELECT u.id, u.email, 
             array_agg(ur.role) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE u.email = ANY($1)
      GROUP BY u.id, u.email
    `;
    
    const findResult = await client.query(findQuery, [OLD_EMAILS]);
    
    if (findResult.rows.length === 0) {
      console.log('⚠️  No admin users found with old email addresses\n');
    } else {
      console.log(`✅ Found ${findResult.rows.length} admin user(s):\n`);
      findResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id}`);
        console.log(`      Email: ${user.email}`);
        const roles = user.roles && Array.isArray(user.roles) ? user.roles.filter(r => r !== null).join(', ') : 'None';
        console.log(`      Roles: ${roles}\n`);
      });
    }
    
    // Step 2: Update email for each admin user
    if (findResult.rows.length > 0) {
      console.log('🔄 Step 2: Updating admin email addresses...\n');
      
      for (const user of findResult.rows) {
        try {
          // Check if new email already exists
          const existingUser = await client.query(
            'SELECT id, email FROM users WHERE email = $1',
            [NEW_ADMIN_EMAIL]
          );
          
          if (existingUser.rows.length > 0) {
            console.log(`⚠️  Email ${NEW_ADMIN_EMAIL} already exists for user ID: ${existingUser.rows[0].id}`);
            console.log(`    Skipping update for user: ${user.email}\n`);
            continue;
          }
          
          // Update the email
          const updateResult = await client.query(
            'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [NEW_ADMIN_EMAIL, user.id]
          );
          
          if (updateResult.rows.length > 0) {
            console.log(`✅ Updated user: ${user.email} → ${NEW_ADMIN_EMAIL}`);
            console.log(`   User ID: ${updateResult.rows[0].id}\n`);
          }
        } catch (error) {
          console.error(`❌ Error updating user ${user.email}:`, error.message);
        }
      }
    }
    
    // Step 3: Verify the changes
    console.log('🔍 Step 3: Verifying updated admin user...\n');
    const verifyResult = await client.query(
      `SELECT u.id, u.email,
              array_agg(ur.role) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.email = $1
       GROUP BY u.id, u.email`,
      [NEW_ADMIN_EMAIL]
    );
    
    if (verifyResult.rows.length > 0) {
      const updatedUser = verifyResult.rows[0];
      console.log('✅ Updated admin user verified:');
      console.log(`   📧 Email: ${updatedUser.email}`);
      const roles = updatedUser.roles && Array.isArray(updatedUser.roles) ? updatedUser.roles.filter(r => r !== null).join(', ') : 'None';
      console.log(`   👑 Roles: ${roles}\n`);
    } else {
      console.log('⚠️  No user found with the new email address\n');
    }
    
    // Step 4: Check for any remaining old emails
    console.log('🔍 Step 4: Checking for any remaining old admin emails...\n');
    const remainingCheck = await client.query(
      'SELECT id, email FROM users WHERE email = ANY($1)',
      [OLD_EMAILS]
    );
    
    if (remainingCheck.rows.length > 0) {
      console.log(`⚠️  Found ${remainingCheck.rows.length} user(s) still using old email addresses:\n`);
      remainingCheck.rows.forEach(user => {
        console.log(`   - ID: ${user.id}, Email: ${user.email}`);
      });
      console.log();
    } else {
      console.log('✅ No users remaining with old email addresses\n');
    }
    
    console.log('='.repeat(60));
    console.log('🎉 Admin email update process completed!');
    console.log('='.repeat(60));
    console.log(`\n📋 Summary:`);
    console.log(`   New Admin Email: ${NEW_ADMIN_EMAIL}`);
    console.log(`   Updated Users: ${findResult.rows.length}`);
    console.log(`   Status: ✅ Complete\n`);
    
  } catch (error) {
    console.error('❌ Error updating admin email:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
updateAdminEmail().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

