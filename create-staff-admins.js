#!/usr/bin/env node

/**
 * Create Staff Admin for Each Dealer
 * 
 * This script creates a staff admin user for each existing dealer.
 * It will:
 * 1. Find all dealers without staff admins
 * 2. Create a user account for each dealer
 * 3. Create a staff admin record linking the user to the dealer
 * 4. Set up default admin permissions
 */

import { query } from './src/database/connection.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

async function createStaffAdminsForDealers() {
  console.log('🏢 Creating Staff Admins for Each Dealer');
  console.log('==========================================');
  console.log('');

  try {
    // 1. Get all dealers
    console.log('🔍 Finding all dealers...');
    const dealersResult = await query(`
      SELECT 
        d.id as dealer_id,
        d.business_name,
        d.contact_name,
        d.email as dealer_email,
        d.user_id as existing_user_id
      FROM dealers d
      ORDER BY d.business_name
    `);

    if (dealersResult.rows.length === 0) {
      console.log('⚠️ No dealers found in the database');
      return;
    }

    console.log(`✅ Found ${dealersResult.rows.length} dealers`);
    console.log('');

    // 2. Check which dealers already have staff admins
    console.log('🔍 Checking existing staff admins...');
    const existingAdminsResult = await query(`
      SELECT DISTINCT ds.dealer_id
      FROM dealership_staff ds
      WHERE ds.staff_role = 'admin'
    `);

    const existingAdminDealerIds = new Set(existingAdminsResult.rows.map(row => row.dealer_id));
    console.log(`✅ Found ${existingAdminDealerIds.size} dealers with existing staff admins`);
    console.log('');

    // 3. Process each dealer
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const dealer of dealersResult.rows) {
      console.log(`🏢 Processing: ${dealer.business_name}`);
      
      try {
        // Skip if already has admin
        if (existingAdminDealerIds.has(dealer.dealer_id)) {
          console.log(`  ⏭️ Skipping - already has staff admin`);
          skippedCount++;
          continue;
        }

        // Check if dealer already has a user account
        let userId = dealer.existing_user_id;
        
        if (!userId) {
          // Create a new user account for the dealer
          console.log(`  👤 Creating user account...`);
          
          // Generate a temporary password (dealer should change this)
          const tempPassword = `admin_${dealer.business_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_2024`;
          const passwordHash = await bcrypt.hash(tempPassword, 12);
          
          const userResult = await query(`
            INSERT INTO users (name, email, password_hash, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (email) DO UPDATE SET
              name = EXCLUDED.name,
              password_hash = EXCLUDED.password_hash
            RETURNING id
          `, [
            dealer.contact_name || dealer.business_name,
            dealer.dealer_email,
            passwordHash
          ]);
          
          userId = userResult.rows[0].id;
          console.log(`  ✅ User account created/updated: ${dealer.dealer_email}`);
        } else {
          console.log(`  👤 Using existing user account: ${dealer.dealer_email}`);
        }

        // Create staff admin record
        console.log(`  🔑 Creating staff admin record...`);
        
        const staffResult = await query(`
          INSERT INTO dealership_staff (
            dealer_id, 
            user_id, 
            staff_role, 
            permissions, 
            is_active, 
            created_by, 
            created_at
          )
          VALUES ($1, $2, 'admin', '{}', true, $2, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            dealer_id = EXCLUDED.dealer_id,
            staff_role = EXCLUDED.staff_role,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
          RETURNING id
        `, [dealer.dealer_id, userId]);

        const staffId = staffResult.rows[0].id;
        console.log(`  ✅ Staff admin record created/updated`);

        // Add default admin permissions
        console.log(`  🔐 Setting up admin permissions...`);
        
        const adminPermissions = [
          'qr_code_generation',
          'lead_management',
          'vehicle_import',
          'analytics_dashboard',
          'bulk_actions',
          'staff_management',
          'user_management',
          'custom_branding',
          'api_access',
          'priority_support'
        ];

        for (const permission of adminPermissions) {
          await query(`
            INSERT INTO staff_permissions (staff_id, permission_name, permission_value, created_at)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (staff_id, permission_name) DO UPDATE SET
              permission_value = EXCLUDED.permission_value,
              updated_at = NOW()
          `, [staffId, permission]);
        }

        console.log(`  ✅ Admin permissions configured (${adminPermissions.length} permissions)`);
        console.log(`  🎉 Staff admin created successfully!`);
        console.log('');
        
        createdCount++;

      } catch (error) {
        console.log(`  ❌ Error creating staff admin: ${error.message}`);
        console.log(`  📝 Dealer: ${dealer.business_name} (${dealer.dealer_email})`);
        console.log('');
        errorCount++;
      }
    }

    // 4. Generate summary report
    console.log('📊 Summary Report');
    console.log('================');
    console.log(`Total dealers processed: ${dealersResult.rows.length}`);
    console.log(`✅ Staff admins created: ${createdCount}`);
    console.log(`⏭️ Skipped (already have admin): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('');

    // 5. Show current staff admin status
    console.log('👥 Current Staff Admin Status');
    console.log('============================');
    
    const statusResult = await query(`
      SELECT 
        d.business_name,
        d.email as dealer_email,
        u.email as admin_email,
        u.name as admin_name,
        ds.created_at as admin_created_at
      FROM dealers d
      LEFT JOIN dealership_staff ds ON d.id = ds.dealer_id AND ds.staff_role = 'admin'
      LEFT JOIN users u ON ds.user_id = u.id
      ORDER BY d.business_name
    `);

    statusResult.rows.forEach(row => {
      if (row.admin_email) {
        console.log(`✅ ${row.business_name}: ${row.admin_name} (${row.admin_email})`);
      } else {
        console.log(`❌ ${row.business_name}: No staff admin`);
      }
    });

    console.log('');
    console.log('🎉 Staff admin creation completed!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Notify dealers about their new admin accounts');
    console.log('  2. Provide login credentials to dealers');
    console.log('  3. Encourage password changes on first login');
    console.log('  4. Test admin functionality');
    console.log('  5. Create additional staff members as needed');

  } catch (error) {
    console.error('❌ Failed to create staff admins:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Function to generate login credentials report
async function generateLoginCredentialsReport() {
  console.log('📋 Generating Login Credentials Report');
  console.log('=====================================');
  console.log('');

  try {
    const credentialsResult = await query(`
      SELECT 
        d.business_name,
        d.email as dealer_email,
        u.email as admin_email,
        u.name as admin_name,
        ds.created_at as admin_created_at
      FROM dealers d
      JOIN dealership_staff ds ON d.id = ds.dealer_id AND ds.staff_role = 'admin'
      JOIN users u ON ds.user_id = u.id
      ORDER BY d.business_name
    `);

    if (credentialsResult.rows.length === 0) {
      console.log('⚠️ No staff admins found');
      return;
    }

    console.log('🔑 Login Credentials for Staff Admins:');
    console.log('');
    
    credentialsResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.business_name}`);
      console.log(`   Admin: ${row.admin_name}`);
      console.log(`   Email: ${row.admin_email}`);
      console.log(`   Password: admin_${row.business_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_2024`);
      console.log(`   Created: ${row.admin_created_at}`);
      console.log('');
    });

    console.log('⚠️ Important Security Notes:');
    console.log('  - These are temporary passwords');
    console.log('  - Dealers should change passwords on first login');
    console.log('  - Consider sending credentials via secure email');
    console.log('  - Enable two-factor authentication if available');

  } catch (error) {
    console.error('❌ Failed to generate credentials report:', error);
  }
}

// Function to reset a specific dealer's admin password
async function resetDealerAdminPassword(dealerEmail, newPassword) {
  console.log(`🔐 Resetting admin password for dealer: ${dealerEmail}`);
  
  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    const result = await query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = (
        SELECT ds.user_id 
        FROM dealership_staff ds
        JOIN dealers d ON ds.dealer_id = d.id
        WHERE d.email = $2 AND ds.staff_role = 'admin'
      )
      RETURNING email
    `, [passwordHash, dealerEmail]);

    if (result.rows.length > 0) {
      console.log(`✅ Password reset successfully for: ${result.rows[0].email}`);
    } else {
      console.log(`❌ No admin found for dealer: ${dealerEmail}`);
    }

  } catch (error) {
    console.error(`❌ Failed to reset password: ${error.message}`);
  }
}

// Export functions
export { 
  createStaffAdminsForDealers, 
  generateLoginCredentialsReport, 
  resetDealerAdminPassword 
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--credentials')) {
    generateLoginCredentialsReport()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Failed:', error);
        process.exit(1);
      });
  } else if (args.includes('--reset-password')) {
    const dealerEmail = args[args.indexOf('--reset-password') + 1];
    const newPassword = args[args.indexOf('--reset-password') + 2];
    
    if (!dealerEmail || !newPassword) {
      console.log('Usage: node create-staff-admins.js --reset-password <dealer_email> <new_password>');
      process.exit(1);
    }
    
    resetDealerAdminPassword(dealerEmail, newPassword)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Failed:', error);
        process.exit(1);
      });
  } else {
    createStaffAdminsForDealers()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Failed:', error);
        process.exit(1);
      });
  }
}
