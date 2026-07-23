import { query, pool } from './src/database/connection.js';

// Configuration - Update these values
const USER_ID_TO_UPDATE = '4023162b-a36e-4a2c-a458-17d536dcaea3';
const NEW_EMAIL = 'info@derleriq.co';

async function updateUserEmail() {
  console.log('📧 Updating user email...\n');
  
  try {
    // 1. Verify user exists
    console.log('1️⃣ Verifying user exists...');
    const userResult = await query(
      `SELECT 
        u.id,
        u.email as current_email,
        u.name,
        ur.role,
        d.id as dealer_id,
        d.business_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id
      WHERE u.id = $1`,
      [USER_ID_TO_UPDATE]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found with ID:', USER_ID_TO_UPDATE);
      return;
    }

    const user = userResult.rows[0];
    console.log('   ✅ User found:');
    console.log(`      Current Email: ${user.current_email}`);
    console.log(`      Name: ${user.name || 'No name'}`);
    console.log(`      Role: ${user.role || 'None'}`);
    console.log(`      Is Dealer Owner: ${user.dealer_id ? 'Yes (' + user.business_name + ')' : 'No'}`);
    console.log('');

    // 2. Check if new email already exists
    console.log('2️⃣ Checking if new email already exists...');
    const emailCheckResult = await query(
      `SELECT id, email, name FROM users WHERE email = $1 AND id != $2`,
      [NEW_EMAIL, USER_ID_TO_UPDATE]
    );

    if (emailCheckResult.rows.length > 0) {
      console.log('   ❌ Email already in use by another user:');
      console.log(`      User ID: ${emailCheckResult.rows[0].id}`);
      console.log(`      Name: ${emailCheckResult.rows[0].name || 'No name'}`);
      console.log('');
      console.log('❌ Cannot proceed. Please choose a different email address.');
      return;
    }
    console.log('   ✅ Email is available\n');

    // 3. Check if email is the same
    if (user.current_email === NEW_EMAIL) {
      console.log('✅ Email is already set to:', NEW_EMAIL);
      console.log('No changes needed.');
      return;
    }

    // 4. Prompt for confirmation
    console.log('━'.repeat(60));
    console.log('⚠️  WARNING: This will update the user\'s email address!');
    console.log('━'.repeat(60));
    console.log('');
    console.log('Change Details:');
    console.log(`   Current Email: ${user.current_email}`);
    console.log(`   New Email:     ${NEW_EMAIL}`);
    console.log('');
    console.log('⚠️  Important Notes:');
    console.log('   • User will need to login with the new email');
    console.log('   • All existing sessions will remain valid');
    console.log('   • Email notifications will be sent to the new address');
    if (user.dealer_id) {
      console.log('   • This user owns a dealership - dealer email is separate');
    }
    console.log('');
    console.log('👉 To proceed, run: node update-user-email.js --confirm');
    console.log('');

    // Check if --confirm flag is present
    const isConfirmed = process.argv.includes('--confirm');

    if (!isConfirmed) {
      console.log('❌ Update cancelled. Run with --confirm flag to proceed.');
      return;
    }

    // 5. Update the email
    console.log('━'.repeat(60));
    console.log('🔄 UPDATING USER EMAIL...');
    console.log('━'.repeat(60));
    console.log('');

    await query('BEGIN');

    try {
      // Update email in users table
      await query(
        `UPDATE users 
         SET email = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [NEW_EMAIL, USER_ID_TO_UPDATE]
      );
      console.log(`   ✅ Updated email from "${user.current_email}" to "${NEW_EMAIL}"`);

      await query('COMMIT');
      console.log('   ✅ Transaction committed\n');

      // 6. Verify the change
      console.log('━'.repeat(60));
      console.log('✅ EMAIL UPDATE SUCCESSFUL!');
      console.log('━'.repeat(60));
      console.log('');

      const verifyResult = await query(
        `SELECT id, email, name, updated_at
         FROM users
         WHERE id = $1`,
        [USER_ID_TO_UPDATE]
      );

      if (verifyResult.rows.length > 0) {
        const updated = verifyResult.rows[0];
        console.log('Updated User Details:');
        console.log(`   Email: ${updated.email} ✅`);
        console.log(`   Name: ${updated.name || 'No name'}`);
        console.log(`   Updated At: ${updated.updated_at}`);
        console.log('');
      }

      console.log('🎉 Email address successfully updated!');
      console.log('');
      console.log('Next Steps:');
      console.log('   1. User should login with the new email: ' + NEW_EMAIL);
      console.log('   2. Old email will no longer work for login');
      console.log('   3. All notifications will be sent to the new email');

    } catch (error) {
      await query('ROLLBACK');
      console.error('❌ Error during update, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error updating email:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateUserEmail();

