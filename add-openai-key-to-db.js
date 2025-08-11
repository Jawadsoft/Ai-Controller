// Helper script to add OpenAI API key to database
// Run this to set up your OpenAI API key: node add-openai-key-to-db.js

import { pool } from './src/database/connection.js';

async function addOpenAIKeyToDatabase() {
  try {
    console.log('🔑 Adding OpenAI API key to database...\n');
    
    // Check if daive_api_settings table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daive_api_settings'
      );
    `;
    
    const tableExists = await pool.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ daive_api_settings table does not exist!');
      console.log('💡 Please run the database migration first');
      return;
    }
    
    // Check current OpenAI key settings
    const checkQuery = `
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key'
      ORDER BY dealer_id NULLS FIRST;
    `;
    
    const currentSettings = await pool.query(checkQuery);
    
    console.log('📋 Current OpenAI key settings:');
    if (currentSettings.rows.length === 0) {
      console.log('   No OpenAI key found');
    } else {
      currentSettings.rows.forEach(row => {
        const scope = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        const status = row.setting_value ? '✅ Set' : '❌ Not set';
        console.log(`   ${scope}: ${status}`);
      });
    }
    
    console.log('\n🔧 To add your OpenAI API key:');
    console.log('1. Get your API key from: https://platform.openai.com/api-keys');
    console.log('2. Edit this script and set your actual API key');
    console.log('3. Run this script again');
    
    // Example of how to add the key (commented out for security)
    /*
    const apiKey = 'sk-your-actual-openai-api-key-here';
    
    // Add global OpenAI key
    const insertGlobalQuery = `
      INSERT INTO daive_api_settings (setting_type, setting_value, dealer_id, created_at, updated_at)
      VALUES ('openai_key', $1, NULL, NOW(), NOW())
      ON CONFLICT (setting_type, dealer_id) 
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
    `;
    
    await pool.query(insertGlobalQuery, [apiKey]);
    console.log('✅ OpenAI API key added to global settings');
    
    // Add dealer-specific OpenAI key (optional)
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    const insertDealerQuery = `
      INSERT INTO daive_api_settings (setting_type, setting_value, dealer_id, created_at, updated_at)
      VALUES ('openai_key', $1, $2, NOW(), NOW())
      ON CONFLICT (setting_type, dealer_id) 
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
    `;
    
    await pool.query(insertDealerQuery, [apiKey, dealerId]);
    console.log('✅ OpenAI API key added to dealer settings');
    */
    
    console.log('\n💡 Alternative: Use the DAIVE Settings UI in your frontend to add the API key');
    console.log('   Navigate to: /daive-settings in your application');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the function
addOpenAIKeyToDatabase(); 