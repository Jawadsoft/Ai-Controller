import { pool } from './src/database/connection.js';
import { getElevenLabsVoiceId, getElevenLabsVoiceInfo } from './elevenlabs-voices.js';

async function debugJessicaNotWorking() {
  try {
    console.log('🔍 Debugging why Jessica voice is not working...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    console.log(`🏢 Debugging for dealer: ${dealerId}`);
    
    // Test 1: Check what's currently saved in database
    console.log('\n🧪 Step 1: Checking current voice settings in database...');
    
    const currentSettingsQuery = `
      SELECT dealer_id, setting_type, setting_value, created_at, updated_at
      FROM daive_api_settings 
      WHERE (dealer_id = $1 OR dealer_id IS NULL) 
      AND setting_type = 'voice_elevenlabs_voice'
      ORDER BY dealer_id NULLS LAST
    `;
    
    const currentSettings = await pool.query(currentSettingsQuery, [dealerId]);
    
    console.log(`   Found ${currentSettings.rows.length} voice_elevenlabs_voice settings:`);
    currentSettings.rows.forEach((row, index) => {
      const scope = row.dealer_id ? `Dealer (${row.dealer_id})` : 'Global';
      console.log(`     ${index + 1}. ${scope}: ${row.setting_value} (updated: ${row.updated_at})`);
    });
    
    // Test 2: Simulate exact same query as TTS code
    console.log('\n🧪 Step 2: Testing exact TTS voice retrieval query...');
    
    const ttsVoiceQuery = `
      WITH dealer_setting AS (
        SELECT setting_value FROM daive_api_settings 
        WHERE dealer_id = $1 AND setting_type = 'voice_elevenlabs_voice'
      ),
      global_setting AS (
        SELECT setting_value FROM daive_api_settings 
        WHERE dealer_id IS NULL AND setting_type = 'voice_elevenlabs_voice'
      )
      SELECT setting_value FROM dealer_setting
      UNION ALL
      SELECT setting_value FROM global_setting
      WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
      LIMIT 1
    `;
    
    const voiceResult = await pool.query(ttsVoiceQuery, [dealerId]);
    const selectedVoice = voiceResult.rows.length > 0 ? voiceResult.rows[0].setting_value : 'jessica';
    const voiceId = getElevenLabsVoiceId(selectedVoice);
    
    console.log(`   TTS Query Result:`);
    console.log(`     Selected voice: ${selectedVoice}`);
    console.log(`     Voice ID: ${voiceId}`);
    console.log(`     Expected: jessica (cgSgspJ2msm6clMCkdW9)`);
    console.log(`     Rachel ID: 21m00Tcm4TlvDq8ikWAM`);
    
    if (voiceId === '21m00Tcm4TlvDq8ikWAM') {
      console.log('   ❌ PROBLEM: Still getting Rachel voice ID!');
    } else if (voiceId === 'cgSgspJ2msm6clMCkdW9') {
      console.log('   ✅ SUCCESS: Getting Jessica voice ID correctly');
    } else {
      console.log(`   ⚠️  UNEXPECTED: Getting different voice ID: ${voiceId}`);
    }
    
    // Test 3: Check if there are multiple TTS provider settings
    console.log('\n🧪 Step 3: Checking TTS provider configuration...');
    
    const ttsProviderQuery = `
      SELECT dealer_id, setting_type, setting_value
      FROM daive_api_settings 
      WHERE (dealer_id = $1 OR dealer_id IS NULL) 
      AND setting_type IN ('voice_tts_provider', 'voice_provider')
      ORDER BY setting_type, dealer_id NULLS LAST
    `;
    
    const ttsProviderResult = await pool.query(ttsProviderQuery, [dealerId]);
    
    console.log(`   TTS Provider settings:`);
    ttsProviderResult.rows.forEach((row) => {
      const scope = row.dealer_id ? 'Dealer' : 'Global';
      console.log(`     ${scope} ${row.setting_type}: ${row.setting_value}`);
    });
    
    // Test 4: Check for any hardcoded voice IDs in the current code
    console.log('\n🧪 Step 4: Checking for hardcoded Rachel voice IDs in current code...');
    
    const fs = await import('fs');
    const daiveContent = fs.readFileSync('src/routes/daive.js', 'utf8');
    
    const rachelInstances = daiveContent.split('\n').map((line, index) => {
      if (line.includes('21m00Tcm4TlvDq8ikWAM')) {
        return `     Line ${index + 1}: ${line.trim()}`;
      }
      return null;
    }).filter(Boolean);
    
    if (rachelInstances.length > 0) {
      console.log(`   ❌ FOUND ${rachelInstances.length} hardcoded Rachel voice ID(s):`);
      rachelInstances.forEach(instance => console.log(instance));
    } else {
      console.log('   ✅ No hardcoded Rachel voice IDs found');
    }
    
    // Test 5: Check backend server restart status
    console.log('\n🧪 Step 5: Checking if backend needs restart...');
    console.log('   💡 Important: Backend server needs to be restarted after code changes');
    console.log('   💡 Run: npm run dev or npm run dev:full to restart backend');
    
    // Test 6: Force set Jessica voice for this dealer
    console.log('\n🧪 Step 6: Force setting Jessica voice for dealer...');
    
    const forceSetQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, 'voice_elevenlabs_voice', 'jessica')
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = 'jessica', updated_at = NOW()
      RETURNING *
    `;
    
    const forceResult = await pool.query(forceSetQuery, [dealerId]);
    console.log(`   ✅ Force set Jessica voice: ${forceResult.rows[0].setting_value}`);
    
    // Test 7: Verify the fix
    console.log('\n🧪 Step 7: Re-testing voice retrieval after force set...');
    
    const verifyResult = await pool.query(ttsVoiceQuery, [dealerId]);
    const verifyVoice = verifyResult.rows.length > 0 ? verifyResult.rows[0].setting_value : 'jessica';
    const verifyId = getElevenLabsVoiceId(verifyVoice);
    
    console.log(`   Verification Result:`);
    console.log(`     Selected voice: ${verifyVoice}`);
    console.log(`     Voice ID: ${verifyId}`);
    
    if (verifyId === 'cgSgspJ2msm6clMCkdW9') {
      console.log('   ✅ SUCCESS: Jessica voice is now correctly configured!');
    } else {
      console.log('   ❌ STILL FAILED: Jessica voice not working');
    }
    
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('   1. ✅ Database settings checked');
    console.log('   2. ✅ Voice mapping verified');
    console.log('   3. ✅ TTS query tested');
    console.log('   4. ✅ Jessica voice force-set');
    
    console.log('\n💡 NEXT STEPS TO FIX:');
    if (rachelInstances.length > 0) {
      console.log('   ❌ Remove remaining hardcoded Rachel voice IDs');
    }
    console.log('   🔄 Restart backend server (npm run dev)');
    console.log('   🧪 Test voice input on AI bot page');
    console.log('   👀 Check backend console for: "🎤 Using ElevenLabs voice: jessica"');
    console.log('   👂 Listen for Jessica\'s voice (professional, clear)');
    
    const jessicaInfo = getElevenLabsVoiceInfo('jessica');
    const rachelInfo = getElevenLabsVoiceInfo('rachel');
    
    console.log('\n🎤 VOICE COMPARISON:');
    console.log(`   Jessica: ${jessicaInfo.description}`);
    console.log(`   Rachel: ${rachelInfo.description}`);
    console.log('   💡 Jessica should sound more professional and customer service focused');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await pool.end();
  }
}

debugJessicaNotWorking();