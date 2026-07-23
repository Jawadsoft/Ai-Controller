// Check TTS Configuration and API Keys
import { pool } from './src/database/connection.js';

async function checkTTSConfiguration() {
  try {
    console.log('🔍 Checking TTS Configuration...');
    
    // Check API keys
    console.log('\n🔑 Checking API Keys:');
    const apiKeysResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE setting_type IN ('elevenlabs_key', 'openai_key', 'deepgram_key')
      ORDER BY dealer_id NULLS FIRST, setting_type
    `);
    
    if (apiKeysResult.rows.length === 0) {
      console.log('  ❌ No API keys found in daive_api_settings');
    } else {
      apiKeysResult.rows.forEach(row => {
        const hasKey = row.setting_value && row.setting_value.trim() !== '';
        const status = hasKey ? '✅' : '❌';
        const dealer = row.dealer_id ? `(Dealer: ${row.dealer_id})` : '(Global)';
        console.log(`  ${status} ${row.setting_type}: ${hasKey ? 'Configured' : 'Empty'} ${dealer}`);
      });
    }
    
    // Check voice settings
    console.log('\n🎤 Checking Voice Settings:');
    const voiceSettingsResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE setting_type LIKE 'voice_%' OR setting_type LIKE 'tts_%'
      ORDER BY dealer_id NULLS FIRST, setting_type
    `);
    
    if (voiceSettingsResult.rows.length === 0) {
      console.log('  ❌ No voice settings found');
    } else {
      voiceSettingsResult.rows.forEach(row => {
        const hasValue = row.setting_value && row.setting_value.trim() !== '';
        const status = hasValue ? '✅' : '❌';
        const dealer = row.dealer_id ? `(Dealer: ${row.dealer_id})` : '(Global)';
        console.log(`  ${status} ${row.setting_type}: ${hasValue ? row.setting_value : 'Not set'} ${dealer}`);
      });
    }
    
    // Check uploads directory
    console.log('\n📁 Checking Uploads Directory:');
    const fs = await import('fs');
    const path = await import('path');
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'daive-audio');
    const dirExists = fs.existsSync(uploadsDir);
    console.log(`  ${dirExists ? '✅' : '❌'} Directory exists: ${uploadsDir}`);
    
    if (dirExists) {
      try {
        const stats = fs.statSync(uploadsDir);
        console.log(`  📊 Directory permissions: ${stats.mode.toString(8)}`);
        console.log(`  📊 Directory owner: ${stats.uid}`);
        
        // Test write access
        const testFile = path.join(uploadsDir, 'test-write.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('  ✅ Directory is writable');
      } catch (error) {
        console.log(`  ❌ Directory write test failed: ${error.message}`);
      }
    }
    
    // Check global settings
    console.log('\n🌐 Checking Global Settings:');
    const globalSettingsResult = await pool.query(`
      SELECT setting_type, setting_value 
      FROM daive_api_settings 
      WHERE dealer_id IS NULL
      ORDER BY setting_type
    `);
    
    if (globalSettingsResult.rows.length === 0) {
      console.log('  ❌ No global settings found');
    } else {
      globalSettingsResult.rows.forEach(row => {
        const hasValue = row.setting_value && row.setting_value.trim() !== '';
        const status = hasValue ? '✅' : '❌';
        console.log(`  ${status} ${row.setting_type}: ${hasValue ? 'Configured' : 'Not set'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking TTS configuration:', error.message);
  } finally {
    await pool.end();
  }
}

checkTTSConfiguration();
