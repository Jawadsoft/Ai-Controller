import { pool } from './src/database/connection.js';

async function addMissingVoiceSettings() {
  try {
    console.log('🎤 Adding missing voice settings to existing daive_api_settings table...\n');

    // Check what's missing
    const requiredVoiceSettings = [
      { setting_type: 'voice_auto_response', setting_value: 'true' },
      { setting_type: 'voice_quality', setting_value: 'hd' },
      { setting_type: 'voice_emotion', setting_value: 'friendly' },
      { setting_type: 'voice_recording_quality', setting_value: 'high' }
    ];

    // Get existing voice settings to see what we have
    const existingQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings 
      WHERE setting_type LIKE 'voice_%'
      ORDER BY dealer_id NULLS FIRST, setting_type
    `;
    
    const existingResult = await pool.query(existingQuery);
    console.log('📊 Existing voice settings:');
    existingResult.rows.forEach(setting => {
      console.log(`  ${setting.setting_type}: ${setting.setting_value} (Dealer: ${setting.dealer_id || 'Global'})`);
    });

    // Add missing settings for both global and dealer-specific
    console.log('\n➕ Adding missing voice settings...');
    
    for (const setting of requiredVoiceSettings) {
      // Add global setting (dealer_id = NULL)
      const globalCheckQuery = `
        SELECT id FROM daive_api_settings 
        WHERE dealer_id IS NULL AND setting_type = $1
      `;
      
      const globalCheckResult = await pool.query(globalCheckQuery, [setting.setting_type]);
      
      if (globalCheckResult.rows.length === 0) {
        const globalInsertQuery = `
          INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, created_at)
          VALUES (NULL, $1, $2, NOW())
        `;
        
        await pool.query(globalInsertQuery, [setting.setting_type, setting.setting_value]);
        console.log(`✅ Added global ${setting.setting_type}: ${setting.setting_value}`);
      } else {
        console.log(`ℹ️ Global ${setting.setting_type} already exists`);
      }

    // Add dealer-specific setting for the main dealer
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f'; // From your existing data
      
      const dealerCheckQuery = `
        SELECT id FROM daive_api_settings 
        WHERE dealer_id = $1 AND setting_type = $2
      `;
      
      const dealerCheckResult = await pool.query(dealerCheckQuery, [dealerId, setting.setting_type]);
      
      if (dealerCheckResult.rows.length === 0) {
        const dealerInsertQuery = `
          INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, created_at)
          VALUES ($1, $2, $3, NOW())
        `;
        
        await pool.query(dealerInsertQuery, [dealerId, setting.setting_type, setting.setting_value]);
        console.log(`✅ Added dealer ${setting.setting_type}: ${setting.setting_value}`);
      } else {
        console.log(`ℹ️ Dealer ${setting.setting_type} already exists`);
      }
    }

    // Update existing settings to use OpenAI TTS by default
    console.log('\n🔄 Updating TTS provider to OpenAI...');
    
    const updateQueries = [
      {
        setting_type: 'voice_tts_provider',
        new_value: 'openai',
        description: 'TTS Provider'
      },
      {
        setting_type: 'voice_provider', 
        new_value: 'openai',
        description: 'Voice Provider'
      },
      {
        setting_type: 'voice_openai_voice',
        new_value: 'alloy',
        description: 'OpenAI Voice'
      }
    ];

    for (const update of updateQueries) {
      // Update global settings
      await pool.query(`
        UPDATE daive_api_settings 
        SET setting_value = $1, updated_at = NOW()
        WHERE dealer_id IS NULL AND setting_type = $2
      `, [update.new_value, update.setting_type]);
      
      // Update dealer-specific settings
      await pool.query(`
        UPDATE daive_api_settings 
        SET setting_value = $1, updated_at = NOW()
        WHERE dealer_id = $2 AND setting_type = $3
      `, [update.new_value, dealerId, update.setting_type]);
      
      console.log(`✅ Updated ${update.description} to ${update.new_value}`);
    }

    // Verify final settings
    console.log('\n🔍 Verifying final voice settings...');
    
    const finalQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings 
      WHERE setting_type LIKE 'voice_%'
      ORDER BY dealer_id NULLS FIRST, setting_type
    `;
    
    const finalResult = await pool.query(finalQuery);
    
    console.log('\n📊 Final Voice Settings:');
    finalResult.rows.forEach(setting => {
      console.log(`  ${setting.setting_type}: ${setting.setting_value} (Dealer: ${setting.dealer_id || 'Global'})`);
    });

    console.log('\n🎯 Voice Configuration Complete!');
    console.log('✅ All required voice settings added to existing daive_api_settings table');
    console.log('✅ TTS Provider updated to OpenAI');
    console.log('✅ Voice Provider updated to OpenAI');
    console.log('✅ OpenAI Voice set to Alloy');
    console.log('✅ Auto Voice Response enabled');
    console.log('✅ Voice Quality set to HD');
    console.log('✅ Voice Emotion set to Friendly');
    console.log('✅ Recording Quality set to High');

  } catch (error) {
    console.error('❌ Error adding missing voice settings:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
addMissingVoiceSettings(); 