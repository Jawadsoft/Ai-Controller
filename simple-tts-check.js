// Simple TTS Configuration Check
import { pool } from './src/database/connection.js';

async function checkTTSConfig() {
  try {
    console.log('🔍 Checking TTS Configuration...');
    
    // Check API keys
    console.log('\n🔑 Checking API Keys:');
    const apiKeysResult = await pool.query(`
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE setting_type IN ('elevenlabs_key', 'openai_key')
    `);
    
    console.log(`Found ${apiKeysResult.rows.length} API key records`);
    
    if (apiKeysResult.rows.length === 0) {
      console.log('  ❌ No API keys found - this is why TTS is failing!');
    } else {
      apiKeysResult.rows.forEach(row => {
        const hasKey = row.setting_value && row.setting_value.trim() !== '';
        const status = hasKey ? '✅' : '❌';
        const dealer = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        console.log(`  ${status} ${row.setting_type}: ${hasKey ? 'Configured' : 'Empty'} (${dealer})`);
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
        const testFile = path.join(uploadsDir, 'test-write.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('  ✅ Directory is writable');
      } catch (error) {
        console.log(`  ❌ Directory write test failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTTSConfig();
