import { pool } from './src/database/connection.js';

async function checkExistingVoiceSettings() {
  try {
    console.log('🔍 Checking existing daive_api_settings table for voice settings...\n');

    // Check the table structure
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'daive_api_settings'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(tableStructureQuery);
    console.log('📋 Table Structure:');
    structureResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
    });

    // Check existing voice-related settings
    const voiceSettingsQuery = `
      SELECT setting_type, setting_value, dealer_id, created_at
      FROM daive_api_settings 
      WHERE setting_type LIKE 'voice_%' OR setting_type LIKE '%voice%'
      ORDER BY dealer_id NULLS FIRST, setting_type
    `;
    
    const voiceSettingsResult = await pool.query(voiceSettingsQuery);
    
    if (voiceSettingsResult.rows.length === 0) {
      console.log('\n❌ No voice-related settings found in daive_api_settings');
    } else {
      console.log('\n📊 Existing Voice-Related Settings:');
      voiceSettingsResult.rows.forEach(setting => {
        console.log(`  ${setting.setting_type}: ${setting.setting_value} (Dealer: ${setting.dealer_id || 'Global'})`);
      });
    }

    // Check all existing settings to see the pattern
    const allSettingsQuery = `
      SELECT setting_type, COUNT(*) as count
      FROM daive_api_settings 
      GROUP BY setting_type
      ORDER BY setting_type
    `;
    
    const allSettingsResult = await pool.query(allSettingsQuery);
    console.log('\n📋 All Setting Types in Table:');
    allSettingsResult.rows.forEach(setting => {
      console.log(`  ${setting.setting_type}: ${setting.count} entries`);
    });

    // Check if we need to add voice settings
    const requiredVoiceSettings = [
      'voice_enabled',
      'voice_tts_provider', 
      'voice_provider',
      'voice_openai_voice',
      'voice_elevenlabs_voice',
      'voice_auto_response',
      'voice_quality',
      'voice_emotion',
      'voice_recording_quality'
    ];

    console.log('\n🎯 Required Voice Settings:');
    requiredVoiceSettings.forEach(settingType => {
      const existing = voiceSettingsResult.rows.find(s => s.setting_type === settingType);
      if (existing) {
        console.log(`  ✅ ${settingType}: ${existing.setting_value}`);
      } else {
        console.log(`  ❌ ${settingType}: Missing`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking existing voice settings:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkExistingVoiceSettings(); 