import { pool } from './src/database/connection.js';

async function addDeepgramKey() {
  try {
    console.log('🔑 Adding Deepgram key to database...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    const deepgramKey = 'fc3ae1a1762b2eb96ff9b59813d49f8881030dd2';
    
    // Check if deepgram_key already exists
    const checkQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = 'deepgram_key'
    `;
    
    const checkResult = await pool.query(checkQuery, [dealerId]);
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️ Deepgram key already exists in database');
      console.log(`   Current value: ${checkResult.rows[0].setting_value.substring(0, 20)}...`);
      console.log(`   Active: ${checkResult.rows[0].is_active}`);
      
      // Update the existing key
      const updateQuery = `
        UPDATE daive_api_settings
        SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE dealer_id = $2 AND setting_type = 'deepgram_key'
        RETURNING *
      `;
      
      const updateResult = await pool.query(updateQuery, [deepgramKey, dealerId]);
      
      if (updateResult.rows.length > 0) {
        console.log('✅ Deepgram key updated successfully');
        console.log(`   New value: ${updateResult.rows[0].setting_value.substring(0, 20)}...`);
      }
    } else {
      // Insert new deepgram_key
      const insertQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING *
      `;
      
      const insertResult = await pool.query(insertQuery, [dealerId, 'deepgram_key', deepgramKey]);
      
      if (insertResult.rows.length > 0) {
        console.log('✅ Deepgram key added successfully');
        console.log(`   Value: ${insertResult.rows[0].setting_value.substring(0, 20)}...`);
        console.log(`   Active: ${insertResult.rows[0].is_active}`);
      }
    }
    
    // Verify the key was saved
    const verifyQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = 'deepgram_key'
    `;
    
    const verifyResult = await pool.query(verifyQuery, [dealerId]);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Verification successful:');
      console.log(`   Setting: ${verifyResult.rows[0].setting_type}`);
      console.log(`   Value: ${verifyResult.rows[0].setting_value.substring(0, 20)}...`);
      console.log(`   Active: ${verifyResult.rows[0].is_active}`);
    } else {
      console.log('\n❌ Verification failed: Deepgram key not found');
    }
    
    // Show all settings after the change
    console.log('\n📊 All current settings:');
    const allSettingsQuery = `
      SELECT setting_type, setting_value, is_active
      FROM daive_api_settings
      WHERE dealer_id = $1
      ORDER BY setting_type
    `;
    
    const allSettingsResult = await pool.query(allSettingsQuery, [dealerId]);
    
    allSettingsResult.rows.forEach(row => {
      console.log(`   ${row.setting_type}: ${row.setting_value ? row.setting_value.substring(0, 20) + '...' : 'null'} (${row.is_active ? 'active' : 'inactive'})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding Deepgram key:', error);
  } finally {
    await pool.end();
  }
}

addDeepgramKey(); 