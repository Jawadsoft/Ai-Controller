/**
 * Check Customer Table Migration Status
 * Verifies all required columns exist and shows token status
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkMigrationStatus() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Connected to database\n');

    // Check if customers table exists
    console.log('📋 Checking customers table...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customers'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.error('❌ customers table does not exist!');
      return;
    }
    console.log('✅ customers table exists\n');

    // Get all columns in customers table
    console.log('📊 Checking required columns...');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'customers'
      ORDER BY ordinal_position;
    `);

    const requiredColumns = [
      'id',
      'email',
      'password_hash',
      'first_name',
      'last_name',
      'phone',
      'email_verified',
      'verification_token',
      'verification_token_expires',
      'terms_accepted',
      'privacy_policy_accepted',
      'created_at',
      'updated_at',
      'last_login'
    ];

    const existingColumns = columns.rows.map(col => col.column_name);
    
    console.log('\n📋 Column Status:');
    for (const required of requiredColumns) {
      if (existingColumns.includes(required)) {
        const col = columns.rows.find(c => c.column_name === required);
        console.log(`  ✅ ${required.padEnd(30)} (${col.data_type})`);
      } else {
        console.log(`  ❌ ${required.padEnd(30)} MISSING!`);
      }
    }

    // Check for any extra columns
    const extraColumns = existingColumns.filter(col => !requiredColumns.includes(col));
    if (extraColumns.length > 0) {
      console.log('\n📌 Additional columns found:');
      extraColumns.forEach(col => {
        const colInfo = columns.rows.find(c => c.column_name === col);
        console.log(`  ℹ️  ${col.padEnd(30)} (${colInfo.data_type})`);
      });
    }

    // Check indexes
    console.log('\n🔍 Checking indexes...');
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'customers'
      AND schemaname = 'public';
    `);

    console.log(`Found ${indexes.rows.length} indexes:`);
    indexes.rows.forEach(idx => {
      console.log(`  ✅ ${idx.indexname}`);
    });

    // Check constraints
    console.log('\n🔒 Checking constraints...');
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' 
      AND table_name = 'customers';
    `);

    console.log(`Found ${constraints.rows.length} constraints:`);
    constraints.rows.forEach(con => {
      console.log(`  ✅ ${con.constraint_name.padEnd(40)} (${con.constraint_type})`);
    });

    // Check for any customers
    console.log('\n👥 Checking customer records...');
    const customerCount = await client.query('SELECT COUNT(*) FROM customers');
    console.log(`Total customers: ${customerCount.rows[0].count}`);

    // Check unverified customers
    const unverifiedCount = await client.query(
      'SELECT COUNT(*) FROM customers WHERE email_verified = FALSE'
    );
    console.log(`Unverified customers: ${unverifiedCount.rows[0].count}`);

    // Check expired tokens
    const expiredTokens = await client.query(`
      SELECT COUNT(*) FROM customers 
      WHERE email_verified = FALSE 
      AND verification_token IS NOT NULL
      AND verification_token_expires < NOW()
    `);
    console.log(`Expired tokens: ${expiredTokens.rows[0].count}`);

    // Check valid tokens
    const validTokens = await client.query(`
      SELECT COUNT(*) FROM customers 
      WHERE email_verified = FALSE 
      AND verification_token IS NOT NULL
      AND verification_token_expires > NOW()
    `);
    console.log(`Valid tokens: ${validTokens.rows[0].count}`);

    console.log('\n✅ Migration check complete!\n');

  } catch (error) {
    console.error('❌ Error checking migration:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the check
console.log('🔍 Customer Table Migration Status Check\n');
console.log('Database:', process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('='.repeat(60) + '\n');

checkMigrationStatus().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
