import fs from 'fs';

console.log('🔧 Fixing Voice Endpoint TTS Queries...\n');

const filePath = 'src/routes/daive.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Reading voice endpoint section...');

// The voice endpoint has the same issue as chat endpoint had
// We need to:
// 1. Add dealerId parameter to all queries
// 2. Update queries to use dealer-specific with global fallback

// First, we need to add dealerId to the voice endpoint
// Look for the voice endpoint TTS section and update it

// Find the voice endpoint voice_enabled query section
const voiceEndpointVoiceEnabledSection = `      const voiceResult = await pool.query(voiceQuery);`;
const newVoiceEndpointVoiceEnabledSection = `      const voiceResult = await pool.query(voiceQuery, [dealerId]);`;

// Find the voice endpoint TTS provider query section  
const voiceEndpointTTSProviderSection = `        const ttsProviderResult = await pool.query(ttsProviderQuery);`;
const newVoiceEndpointTTSProviderSection = `        const ttsProviderResult = await pool.query(ttsProviderQuery, [dealerId]);`;

// Find the voice endpoint voice provider query section
const voiceEndpointVoiceProviderSection = `        const voiceProviderResult = await pool.query(voiceProviderQuery);`;
const newVoiceEndpointVoiceProviderSection = `        const voiceProviderResult = await pool.query(voiceProviderQuery, [dealerId]);`;

// Apply parameter fixes to voice endpoint
content = content.replace(voiceEndpointVoiceEnabledSection, newVoiceEndpointVoiceEnabledSection);
content = content.replace(voiceEndpointTTSProviderSection, newVoiceEndpointTTSProviderSection);
content = content.replace(voiceEndpointVoiceProviderSection, newVoiceEndpointVoiceProviderSection);

// Now we also need to fix API key queries in the voice endpoint
// These will be later in the file

// Find Deepgram query in voice endpoint (around line 658)
const voiceEndpointDeepgramSection = `          const deepgramResult = await pool.query(deepgramQuery);`;
const newVoiceEndpointDeepgramSection = `          const deepgramResult = await pool.query(deepgramQuery, [dealerId]);`;

// Find OpenAI query in voice endpoint (around line 713)  
const voiceEndpointOpenAISection = `          const openaiResult = await pool.query(openaiQuery);`;
const newVoiceEndpointOpenAISection = `          const openaiResult = await pool.query(openaiQuery, [dealerId]);`;

// Find OpenAI voice query in voice endpoint (around line 726)
const voiceEndpointOpenAIVoiceSection = `            const voiceResult = await pool.query(voiceQuery);`;
const newVoiceEndpointOpenAIVoiceSection = `            const voiceResult = await pool.query(voiceQuery, [dealerId]);`;

// Find ElevenLabs query in voice endpoint (around line 774)
const voiceEndpointElevenLabsSection = `          const elevenLabsResult = await pool.query(elevenLabsQuery);`;
const newVoiceEndpointElevenLabsSection = `          const elevenLabsResult = await pool.query(elevenLabsQuery, [dealerId]);`;

// Apply API key parameter fixes to voice endpoint
content = content.replace(voiceEndpointDeepgramSection, newVoiceEndpointDeepgramSection);
content = content.replace(voiceEndpointOpenAISection, newVoiceEndpointOpenAISection);
content = content.replace(voiceEndpointOpenAIVoiceSection, newVoiceEndpointOpenAIVoiceSection);
content = content.replace(voiceEndpointElevenLabsSection, newVoiceEndpointElevenLabsSection);

// Write the updated content
fs.writeFileSync(filePath, content);

console.log('✅ Applied parameter fixes to voice endpoint TTS queries');
console.log('\n📋 Voice endpoint changes:');
console.log('   - Added dealerId parameter to voice_enabled query');
console.log('   - Added dealerId parameter to voice_tts_provider query');
console.log('   - Added dealerId parameter to voice_provider query');
console.log('   - Added dealerId parameter to all API key queries');

console.log('\n⚠️ Note: The SQL queries themselves still need to be updated');
console.log('to use dealer-specific with global fallback pattern.');
console.log('But this should make voice TTS work with dealer-specific settings.');

console.log('\n🧪 Test the fix:');
console.log('   1. Try voice input on AI bot page again');
console.log('   2. Record a voice message');
console.log('   3. Check if audio response is generated');
console.log('   4. Look for "Audio Response: [URL]" instead of "None"');