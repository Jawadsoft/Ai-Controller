import { pool } from './src/database/connection.js';

async function fixAPIKey() {
  try {
    console.log('🔧 FIXING CORRUPTED OPENAI API KEY...\n');
    
    // The correct API key (you should replace this with your actual working key)
    const correctAPIKey = 'YOUR_OPENAI_API_KEY_HERE';
    
    console.log('🔑 Current API key in database:');
    const currentKey = await pool.query(`
      SELECT setting_value FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f' 
      AND setting_type = 'openai_key'
    `);
    
    if (currentKey.rows.length > 0) {
      const key = currentKey.rows[0].setting_value;
      console.log(`   Length: ${key.length} characters`);
      console.log(`   Starts: ${key.substring(0, 20)}...`);
      console.log(`   Ends: ${key.substring(key.length - 20)}`);
      
      if (key.length < 200) {
        console.log('❌ Key appears to be truncated!');
      } else {
        console.log('✅ Key length looks correct');
      }
    }
    
    console.log('\n🔄 Updating API key...');
    
    // Update the API key
    await pool.query(`
      UPDATE daive_api_settings 
      SET setting_value = $1, updated_at = NOW()
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f' 
      AND setting_type = 'openai_key'
    `, [correctAPIKey]);
    
    console.log('✅ API key updated successfully');
    
    // Verify the update
    const updatedKey = await pool.query(`
      SELECT setting_value FROM daive_api_settings 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f' 
      AND setting_type = 'openai_key'
    `);
    
    if (updatedKey.rows.length > 0) {
      const key = updatedKey.rows[0].setting_value;
      console.log('\n🔍 Updated API key details:');
      console.log(`   Length: ${key.length} characters`);
      console.log(`   Starts: ${key.substring(0, 20)}...`);
      console.log(`   Ends: ${key.substring(key.length - 20)}`);
      
      if (key === correctAPIKey) {
        console.log('✅ API key matches exactly!');
      } else {
        console.log('❌ API key still doesn\'t match!');
      }
    }
    
    // Also add a global API key as backup
    console.log('\n🔄 Adding global API key as backup...');
    
    try {
      await pool.query(`
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active, created_at, updated_at)
        VALUES (NULL, 'openai_key', $1, true, NOW(), NOW())
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET setting_value = $1, updated_at = NOW()
      `, [correctAPIKey]);
      
      console.log('✅ Global API key added/updated successfully');
    } catch (error) {
      if (error.code === '23505') { // unique constraint violation
        console.log('ℹ️ Global API key already exists, updating...');
        await pool.query(`
          UPDATE daive_api_settings 
          SET setting_value = $1, updated_at = NOW()
          WHERE dealer_id IS NULL AND setting_type = 'openai_key'
        `, [correctAPIKey]);
        console.log('✅ Global API key updated successfully');
      } else {
        throw error;
      }
    }
    
    console.log('\n🚀 API key fix completed!');
    console.log('📝 Next steps:');
    console.log('   1. Restart your application server');
    console.log('   2. Test the conversation again');
    console.log('   3. The CrewAI agents should now work properly');
    
  } catch (error) {
    console.error('❌ Error fixing API key:', error.message);
  } finally {
    await pool.end();
  }
}

fixAPIKey();
