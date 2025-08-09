import fs from 'fs';

console.log('🔧 Fixing ALL remaining global queries in voice endpoint...\n');

const filePath = 'src/routes/daive.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Reading current file...');

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(`${filePath}.backup-voice-${timestamp}`, content);
console.log(`💾 Backup created: ${filePath}.backup-voice-${timestamp}`);

// Fix the specific voice endpoint queries (after line 600)
// We need to be very specific to only fix voice endpoint, not chat endpoint

let changesMade = 0;

// Fix 1: voice_enabled query in voice endpoint (around line 612)
const oldVoiceEnabled = `      const voiceQuery = \`
        SELECT setting_value
        FROM daive_api_settings
        WHERE dealer_id IS NULL AND setting_type = 'voice_enabled'
        LIMIT 1
      \`;`;

const newVoiceEnabled = `      const voiceQuery = \`
        WITH dealer_setting AS (
          SELECT setting_value FROM daive_api_settings 
          WHERE dealer_id = $1 AND setting_type = 'voice_enabled'
        ),
        global_setting AS (
          SELECT setting_value FROM daive_api_settings 
          WHERE dealer_id IS NULL AND setting_type = 'voice_enabled'
        )
        SELECT setting_value FROM dealer_setting
        UNION ALL
        SELECT setting_value FROM global_setting
        WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
        LIMIT 1
      \`;`;

if (content.includes(oldVoiceEnabled)) {
  content = content.replace(oldVoiceEnabled, newVoiceEnabled);
  changesMade++;
  console.log('✅ Fixed voice_enabled query in voice endpoint');
}

// Fix 2: voice_tts_provider query in voice endpoint (around line 626)
const oldTTSProvider = `        const ttsProviderQuery = \`
          SELECT setting_value
          FROM daive_api_settings
          WHERE dealer_id IS NULL AND setting_type = 'voice_tts_provider'
          LIMIT 1
        \`;`;

const newTTSProvider = `        const ttsProviderQuery = \`
          WITH dealer_setting AS (
            SELECT setting_value FROM daive_api_settings 
            WHERE dealer_id = $1 AND setting_type = 'voice_tts_provider'
          ),
          global_setting AS (
            SELECT setting_value FROM daive_api_settings 
            WHERE dealer_id IS NULL AND setting_type = 'voice_tts_provider'
          )
          SELECT setting_value FROM dealer_setting
          UNION ALL
          SELECT setting_value FROM global_setting
          WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
          LIMIT 1
        \`;`;

// Only replace the second occurrence (voice endpoint)
const firstTTSIndex = content.indexOf(oldTTSProvider);
const secondTTSIndex = content.indexOf(oldTTSProvider, firstTTSIndex + 1);

if (secondTTSIndex !== -1) {
  const beforeSecond = content.substring(0, secondTTSIndex);
  const afterSecond = content.substring(secondTTSIndex + oldTTSProvider.length);
  content = beforeSecond + newTTSProvider + afterSecond;
  changesMade++;
  console.log('✅ Fixed voice_tts_provider query in voice endpoint');
}

// Fix 3: voice_provider query in voice endpoint (around line 640)
const oldVoiceProvider = `        const voiceProviderQuery = \`
          SELECT setting_value
          FROM daive_api_settings
          WHERE dealer_id IS NULL AND setting_type = 'voice_provider'
          LIMIT 1
        \`;`;

const newVoiceProvider = `        const voiceProviderQuery = \`
          WITH dealer_setting AS (
            SELECT setting_value FROM daive_api_settings 
            WHERE dealer_id = $1 AND setting_type = 'voice_provider'
          ),
          global_setting AS (
            SELECT setting_value FROM daive_api_settings 
            WHERE dealer_id IS NULL AND setting_type = 'voice_provider'
          )
          SELECT setting_value FROM dealer_setting
          UNION ALL
          SELECT setting_value FROM global_setting
          WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
          LIMIT 1
        \`;`;

// Only replace the second occurrence (voice endpoint)
const firstVoiceProviderIndex = content.indexOf(oldVoiceProvider);
const secondVoiceProviderIndex = content.indexOf(oldVoiceProvider, firstVoiceProviderIndex + 1);

if (secondVoiceProviderIndex !== -1) {
  const beforeSecond = content.substring(0, secondVoiceProviderIndex);
  const afterSecond = content.substring(secondVoiceProviderIndex + oldVoiceProvider.length);
  content = beforeSecond + newVoiceProvider + afterSecond;
  changesMade++;
  console.log('✅ Fixed voice_provider query in voice endpoint');
}

// Fix 4: OpenAI key query in voice endpoint (around line 727)
const oldOpenAIVoice = `          const openaiQuery = \`
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'openai_key'
            LIMIT 1
          \`;`;

const newOpenAIVoice = `          const openaiQuery = \`
            WITH dealer_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id = $1 AND setting_type = 'openai_key'
            ),
            global_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id IS NULL AND setting_type = 'openai_key'
            )
            SELECT setting_value FROM dealer_setting
            UNION ALL
            SELECT setting_value FROM global_setting
            WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
            LIMIT 1
          \`;`;

// Only replace the second occurrence (voice endpoint)
const firstOpenAIIndex = content.indexOf(oldOpenAIVoice);
const secondOpenAIIndex = content.indexOf(oldOpenAIVoice, firstOpenAIIndex + 1);

if (secondOpenAIIndex !== -1) {
  const beforeSecond = content.substring(0, secondOpenAIIndex);
  const afterSecond = content.substring(secondOpenAIIndex + oldOpenAIVoice.length);
  content = beforeSecond + newOpenAIVoice + afterSecond;
  changesMade++;
  console.log('✅ Fixed openai_key query in voice endpoint');
}

// Fix 5: OpenAI voice setting query in voice endpoint (around line 749)
const oldOpenAIVoiceSetting = `            const voiceQuery = \`
              SELECT setting_value
              FROM daive_api_settings
              WHERE dealer_id IS NULL AND setting_type = 'voice_openai_voice'
              LIMIT 1
            \`;`;

const newOpenAIVoiceSetting = `            const voiceQuery = \`
              WITH dealer_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id = $1 AND setting_type = 'voice_openai_voice'
              ),
              global_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id IS NULL AND setting_type = 'voice_openai_voice'
              )
              SELECT setting_value FROM dealer_setting
              UNION ALL
              SELECT setting_value FROM global_setting
              WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
              LIMIT 1
            \`;`;

// Only replace the second occurrence (voice endpoint)
const firstOpenAIVoiceIndex = content.indexOf(oldOpenAIVoiceSetting);
const secondOpenAIVoiceIndex = content.indexOf(oldOpenAIVoiceSetting, firstOpenAIVoiceIndex + 1);

if (secondOpenAIVoiceIndex !== -1) {
  const beforeSecond = content.substring(0, secondOpenAIVoiceIndex);
  const afterSecond = content.substring(secondOpenAIVoiceIndex + oldOpenAIVoiceSetting.length);
  content = beforeSecond + newOpenAIVoiceSetting + afterSecond;
  changesMade++;
  console.log('✅ Fixed voice_openai_voice query in voice endpoint');
}

// Fix 6: ElevenLabs key query in voice endpoint (around line 806)
const oldElevenLabsVoice = `          const elevenLabsQuery = \`
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'elevenlabs_key'
            LIMIT 1
          \`;`;

const newElevenLabsVoice = `          const elevenLabsQuery = \`
            WITH dealer_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id = $1 AND setting_type = 'elevenlabs_key'
            ),
            global_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id IS NULL AND setting_type = 'elevenlabs_key'
            )
            SELECT setting_value FROM dealer_setting
            UNION ALL
            SELECT setting_value FROM global_setting
            WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
            LIMIT 1
          \`;`;

// Only replace the second occurrence (voice endpoint)
const firstElevenLabsIndex = content.indexOf(oldElevenLabsVoice);
const secondElevenLabsIndex = content.indexOf(oldElevenLabsVoice, firstElevenLabsIndex + 1);

if (secondElevenLabsIndex !== -1) {
  const beforeSecond = content.substring(0, secondElevenLabsIndex);
  const afterSecond = content.substring(secondElevenLabsIndex + oldElevenLabsVoice.length);
  content = beforeSecond + newElevenLabsVoice + afterSecond;
  changesMade++;
  console.log('✅ Fixed elevenlabs_key query in voice endpoint');
}

// Write the updated content
fs.writeFileSync(filePath, content);

console.log(`\n🎉 Applied ${changesMade} critical voice endpoint query fixes`);
console.log('\n📋 Voice endpoint should now work with dealer-specific settings');
console.log('   ✅ voice_enabled query updated');
console.log('   ✅ voice_tts_provider query updated');
console.log('   ✅ voice_provider query updated');
console.log('   ✅ openai_key query updated');
console.log('   ✅ voice_openai_voice query updated');
console.log('   ✅ elevenlabs_key query updated');

console.log('\n🧪 Test the fix:');
console.log('   1. Try voice input on AI bot page');
console.log('   2. Record a voice message');
console.log('   3. Check for "Audio Response: /uploads/daive-audio/..." instead of "None"');
console.log('   4. Audio should play automatically');

console.log('\n💡 If still not working:');
console.log('   - Check backend console for TTS generation logs');
console.log('   - Verify uploads/daive-audio/ directory exists');
console.log('   - Check ElevenLabs API key validity');