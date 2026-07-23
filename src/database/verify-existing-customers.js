/**
 * Migration: Verify Existing Customers
 * 
 * This script sets email_verified = TRUE for all existing customers
 * who registered before the email verification system was implemented.
 */

import { query } from './connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyExistingCustomers() {
  try {
    console.log('🔄 Starting migration to verify existing customers...\n');

    // Get count of unverified customers
    const countResult = await query(
      'SELECT COUNT(*) as count FROM customers WHERE email_verified = FALSE'
    );
    
    const unverifiedCount = parseInt(countResult.rows[0].count);
    
    if (unverifiedCount === 0) {
      console.log('✅ No unverified customers found. All customers are already verified!');
      return;
    }
    
    console.log(`📊 Found ${unverifiedCount} unverified customer(s)\n`);

    // List unverified customers
    const customersResult = await query(
      `SELECT id, email, first_name, last_name, created_at 
       FROM customers 
       WHERE email_verified = FALSE
       ORDER BY created_at ASC`
    );

    console.log('📋 Unverified Customers:');
    console.log('─'.repeat(80));
    customersResult.rows.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.email}`);
      console.log(`   Name: ${customer.first_name} ${customer.last_name}`);
      console.log(`   Registered: ${new Date(customer.created_at).toLocaleString()}`);
      console.log('');
    });
    console.log('─'.repeat(80));

    // Update all existing customers to verified
    const updateResult = await query(
      `UPDATE customers 
       SET email_verified = TRUE,
           verification_token = NULL,
           verification_token_expires = NULL,
           updated_at = NOW()
       WHERE email_verified = FALSE`
    );

    const updatedCount = updateResult.rowCount;

    console.log(`\n✅ Successfully verified ${updatedCount} existing customer(s)!\n`);

    // Verify the update
    const verifyResult = await query(
      'SELECT COUNT(*) as count FROM customers WHERE email_verified = TRUE'
    );
    
    const verifiedCount = parseInt(verifyResult.rows[0].count);

    console.log('📊 Final Statistics:');
    console.log('─'.repeat(80));
    console.log(`✅ Total Verified Customers: ${verifiedCount}`);
    console.log(`❌ Unverified Customers: 0`);
    console.log('─'.repeat(80));

    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 All existing customers can now log in without email verification.');
    console.log('💡 New customers will still need to verify their email.\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run migration
console.log('🚀 Email Verification Migration\n');
console.log('This script will verify all existing customers so they can continue');
console.log('accessing the system without email verification.\n');

verifyExistingCustomers();

