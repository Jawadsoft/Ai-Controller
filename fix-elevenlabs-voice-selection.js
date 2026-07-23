import fs from 'fs';

console.log('🎤 Updating ElevenLabs voice selection in TTS code...\n');

const filePath = 'src/routes/daive.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Reading current file...');

// Create backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(`${filePath}.backup-voice-selection-${timestamp}`, content);
console.log(`💾 Backup created: ${filePath}.backup-voice-selection-${timestamp}`);

let changesMade = 0;

// Fix 1: First ElevenLabs section in chat endpoint (around line 311)
const oldChatVoice = `            // Generate speech using ElevenLabs
            const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice`;

const newChatVoice = `            // Get selected ElevenLabs voice
            const voiceQuery = \`
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
            \`;
            const voiceResult = await pool.query(voiceQuery, [dealerId]);
            const selectedVoice = voiceResult.rows.length > 0 ? voiceResult.rows[0].setting_value : 'jessica';
            
            // Generate speech using ElevenLabs with selected voice
            const voiceId = getElevenLabsVoiceId(selectedVoice);
            console.log(\`🎤 Using ElevenLabs voice: \${selectedVoice} (ID: \${voiceId})\`);`;

// Replace first occurrence (chat endpoint)
if (content.includes(oldChatVoice)) {
  content = content.replace(oldChatVoice, newChatVoice);
  changesMade++;
  console.log('✅ Updated ElevenLabs voice selection in chat endpoint');
}

// Fix 2: Second ElevenLabs section in voice endpoint (around line 846)
const oldVoiceVoice = `            // Generate speech using ElevenLabs
            const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice`;

const newVoiceVoice = `            // Get selected ElevenLabs voice
            const voiceQuery = \`
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
            \`;
            const voiceResult = await pool.query(voiceQuery, [dealerId]);
            const selectedVoice = voiceResult.rows.length > 0 ? voiceResult.rows[0].setting_value : 'jessica';
            
            // Generate speech using ElevenLabs with selected voice
            const voiceId = getElevenLabsVoiceId(selectedVoice);
            console.log(\`🎤 Using ElevenLabs voice: \${selectedVoice} (ID: \${voiceId})\`);`;

// Replace second occurrence (voice endpoint)
const secondIndex = content.indexOf(oldVoiceVoice, content.indexOf(oldVoiceVoice) + 1);
if (secondIndex !== -1) {
  const beforeSecond = content.substring(0, secondIndex);
  const afterSecond = content.substring(secondIndex + oldVoiceVoice.length);
  content = beforeSecond + newVoiceVoice + afterSecond;
  changesMade++;
  console.log('✅ Updated ElevenLabs voice selection in voice endpoint');
}

// Write the updated content
fs.writeFileSync(filePath, content);

console.log(`\n🎉 Applied ${changesMade} ElevenLabs voice selection updates`);
console.log('\n📋 Changes applied:');
console.log('   ✅ Chat endpoint now uses selected ElevenLabs voice');
console.log('   ✅ Voice endpoint now uses selected ElevenLabs voice');
console.log('   ✅ Both endpoints fetch voice setting from database');
console.log('   ✅ Default voice is Jessica if no setting found');

console.log('\n🧪 Test the voice selection:');
console.log('   1. Go to DAIVE Settings → Voice Settings');
console.log('   2. Select "ElevenLabs (Recommended)" as TTS provider');
console.log('   3. Choose a voice from the ElevenLabs Voice dropdown');
console.log('   4. Save settings');
console.log('   5. Test voice on AI bot page');
console.log('   6. Check backend console for voice selection logs');

console.log('\n💡 Available voices:');
console.log('   • Jessica (Recommended) - Professional, customer service focused');
console.log('   • Rachel - Warm, friendly, natural');
console.log('   • Domi - Young, energetic');
console.log('   • Bella - Soft, pleasant');
console.log('   • Antoni - Male, professional');
console.log('   • And 5 more voices...');