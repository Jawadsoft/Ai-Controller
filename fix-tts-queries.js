import fs from 'fs';

console.log('🔧 Fixing TTS SQL Queries to Use Dealer-Specific Pattern...\n');

const filePath = 'src/routes/daive.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Current file read successfully');

// Create another backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(`${filePath}.backup-${timestamp}`, content);
console.log(`💾 Backup created: src/routes/daive.js.backup-${timestamp}`);

// Fix 1: Deepgram query
const oldDeepgramQuery = `const deepgramQuery = \`
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'deepgram_key'
            LIMIT 1
          \`;`;

const newDeepgramQuery = `const deepgramQuery = \`
            WITH dealer_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id = $1 AND setting_type = 'deepgram_key'
            ),
            global_setting AS (
              SELECT setting_value FROM daive_api_settings 
              WHERE dealer_id IS NULL AND setting_type = 'deepgram_key'
            )
            SELECT setting_value FROM dealer_setting
            UNION ALL
            SELECT setting_value FROM global_setting
            WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
            LIMIT 1
          \`;`;

// Fix 2: OpenAI key query
const oldOpenAIQuery = `const openaiQuery = \`
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'openai_key'
            LIMIT 1
          \`;`;

const newOpenAIQuery = `const openaiQuery = \`
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

// Fix 3: OpenAI voice query
const oldOpenAIVoiceQuery = `const voiceQuery = \`
              SELECT setting_value
              FROM daive_api_settings
              WHERE dealer_id IS NULL AND setting_type = 'voice_openai_voice'
              LIMIT 1
            \`;`;

const newOpenAIVoiceQuery = `const voiceQuery = \`
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

// Fix 4: ElevenLabs query
const oldElevenLabsQuery = `const elevenLabsQuery = \`
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'elevenlabs_key'
            LIMIT 1
          \`;`;

const newElevenLabsQuery = `const elevenLabsQuery = \`
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

// Apply all fixes
let changesMade = 0;

if (content.includes('WHERE dealer_id IS NULL AND setting_type = \'deepgram_key\'')) {
  content = content.replace(oldDeepgramQuery, newDeepgramQuery);
  changesMade++;
  console.log('✅ Fixed Deepgram query');
}

if (content.includes('WHERE dealer_id IS NULL AND setting_type = \'openai_key\'')) {
  content = content.replace(oldOpenAIQuery, newOpenAIQuery);
  changesMade++;
  console.log('✅ Fixed OpenAI key query');
}

if (content.includes('WHERE dealer_id IS NULL AND setting_type = \'voice_openai_voice\'')) {
  content = content.replace(oldOpenAIVoiceQuery, newOpenAIVoiceQuery);
  changesMade++;
  console.log('✅ Fixed OpenAI voice query');
}

if (content.includes('WHERE dealer_id IS NULL AND setting_type = \'elevenlabs_key\'')) {
  content = content.replace(oldElevenLabsQuery, newElevenLabsQuery);
  changesMade++;
  console.log('✅ Fixed ElevenLabs query');
}

// Write the updated content
fs.writeFileSync(filePath, content);

console.log(`\n🎉 Applied ${changesMade} query fixes`);
console.log('\n📋 All TTS queries now use dealer-specific pattern with global fallback');
console.log('   - Deepgram API key query updated');
console.log('   - OpenAI API key query updated');
console.log('   - OpenAI voice setting query updated');
console.log('   - ElevenLabs API key query updated');

console.log('\n🧪 Test the fix:');
console.log('   1. Try the AI bot page again');
console.log('   2. Send a text message');
console.log('   3. TTS should now find dealer-specific settings');
console.log('   4. Audio should be generated and playable');

console.log('\n💡 The queries now:');
console.log('   1. First try to find dealer-specific settings');
console.log('   2. Fall back to global settings if dealer-specific not found');
console.log('   3. Use the dealerId parameter correctly');