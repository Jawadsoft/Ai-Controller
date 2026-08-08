/**
 * Check Token Status
 * Diagnose why a specific verification token is failing
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkTokenStatus(token) {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Check if token exists
    console.log('🔍 Searching for token:', token);
    console.log('='.repeat(80) + '\n');

    const result = await client.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        email_verified,
        verification_token,
        verification_token_expires,
        created_at,
        updated_at,
        last_login,
        NOW() as current_db_time,
        verification_token_expires > NOW() as is_token_valid,
        EXTRACT(EPOCH FROM (verification_token_expires - NOW())) as seconds_until_expiry,
        EXTRACT(EPOCH FROM (NOW() - verification_token_expires)) as seconds_since_expiry,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_since_registration
      FROM customers 
      WHERE verification_token = $1
    `, [token]);

    if (result.rows.length === 0) {
      console.log('❌ TOKEN NOT FOUND IN DATABASE\n');
      console.log('Possible reasons:');
      console.log('  1. Token never existed (wrong token)');
      console.log('  2. Token was deleted');
      console.log('  3. Customer was deleted');
      console.log('  4. Database mismatch (checking wrong database)\n');

      // Check recent customers
      console.log('📊 Recent customer registrations:');
      const recent = await client.query(`
        SELECT email, created_at, email_verified,
               verification_token_expires > NOW() as has_valid_token
        FROM customers 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      if (recent.rows.length === 0) {
        console.log('  No recent registrations found\n');
      } else {
        recent.rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.email.padEnd(30)} ` +
                     `Registered: ${row.created_at.toISOString()} ` +
                     `Verified: ${row.email_verified} ` +
                     `Token valid: ${row.has_valid_token}`);
        });
      }

      return;
    }

    const customer = result.rows[0];
    
    console.log('✅ TOKEN FOUND!\n');
    console.log('📋 Customer Information:');
    console.log('  ID:', customer.id);
    console.log('  Email:', customer.email);
    console.log('  Name:', `${customer.first_name} ${customer.last_name}`);
    console.log('  Email Verified:', customer.email_verified ? '✅ YES' : '❌ NO');
    console.log('  Registered:', customer.created_at.toISOString());
    console.log('  Last Updated:', customer.updated_at.toISOString());
    console.log('  Hours Since Registration:', parseFloat(customer.hours_since_registration).toFixed(2));
    
    console.log('\n⏰ Token Status:');
    console.log('  Token Expires:', customer.verification_token_expires.toISOString());
    console.log('  Current DB Time:', customer.current_db_time.toISOString());
    console.log('  Token Valid:', customer.is_token_valid ? '✅ YES' : '❌ NO (EXPIRED)');

    if (customer.is_token_valid) {
      const hours = customer.seconds_until_expiry / 3600;
      console.log('  Time Until Expiry:', `${hours.toFixed(2)} hours (${customer.seconds_until_expiry.toFixed(0)} seconds)`);
    } else {
      const hours = customer.seconds_since_expiry / 3600;
      console.log('  Time Since Expired:', `${hours.toFixed(2)} hours ago (${customer.seconds_since_expiry.toFixed(0)} seconds)`);
    }

    console.log('\n🔍 Diagnosis:');
    
    if (customer.email_verified) {
      console.log('  ✅ Email is ALREADY VERIFIED');
      console.log('  ℹ️  This token has already been used successfully');
      console.log('  ✅ Customer can log in now');
    } else if (customer.is_token_valid) {
      console.log('  ✅ Token is VALID and ready to use');
      console.log('  ✅ Verification should work');
      console.log('  📧 Customer should click the link to verify');
    } else {
      console.log('  ❌ Token is EXPIRED');
      console.log(`  ⏰ Expired ${(customer.seconds_since_expiry / 3600).toFixed(2)} hours ago`);
      console.log('  📧 Customer needs to request a new verification email');
      console.log('  🔄 Use "Resend Verification Email" feature');
    }

    console.log('\n✅ Token check complete!\n');

  } catch (error) {
    console.error('❌ Error checking token:', error);
    console.error('Error details:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Get token from command line or use default
const token = process.argv[2] || '9a0287940cb5fba608fb1770deacad23c73c172cc7a77dd35cbc682586476e47';

console.log('🔍 Token Status Check\n');
console.log('Database:', process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('='.repeat(80) + '\n');

if (!token || token.length !== 64) {
  console.error('❌ Invalid token format');
  console.log('Usage: node check-token-status.js <token>');
  console.log('Token should be 64 characters (hex)');
  process.exit(1);
}

checkTokenStatus(token).then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
