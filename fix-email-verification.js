// fix-email-verification.js
// Usage: node fix-email-verification.js <email>
// Example: node fix-email-verification.js syedtradeleads@gmail.com

import pg from 'pg';
const { Pool } = pg;

const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node fix-email-verification.js <email>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixEmailVerification(email) {
  const client = await pool.connect();
  try {
    const checkResult = await client.query(
      'SELECT id, email, email_verified, status, created_at FROM customers WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (checkResult.rows.length === 0) {
      console.error(`❌ No customer found with email: ${email}`);
      process.exit(1);
    }

    const customer = checkResult.rows[0];
    console.log('📋 Current customer record:');
    console.log(`   ID:             ${customer.id}`);
    console.log(`   Email:          ${customer.email}`);
    console.log(`   email_verified: ${customer.email_verified}`);
    console.log(`   Status:         ${customer.status}`);
    console.log(`   Created:        ${customer.created_at}`);

    if (customer.email_verified) {
      console.log('✅ Email is already verified — no update needed.');
      process.exit(0);
    }

    await client.query(
      `UPDATE customers 
       SET email_verified = TRUE,
           verification_token = NULL,
           verification_token_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [customer.id]
    );

    console.log(`\n✅ Email verified successfully for: ${customer.email}`);
  } finally {
    client.release();
    await pool.end();
  }
}

fixEmailVerification(email).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
