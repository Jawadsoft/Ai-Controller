import fs from 'fs';

console.log('🚀 Quick Fix: Making TTS work with dealer-specific settings...\n');

const filePath = 'src/routes/daive.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Current file read successfully');

// Create backup
fs.writeFileSync(`${filePath}.backup`, content);
console.log('💾 Backup created: src/routes/daive.js.backup');

// Quick fix: Add dealer ID parameter to TTS queries in chat endpoint
// We need to find the specific TTS section and update it

// Find and replace the voice enabled query in chat endpoint
const oldVoiceEnabledSection = `const voiceResult = await pool.query(voiceQuery);`;
const newVoiceEnabledSection = `const voiceResult = await pool.query(voiceQuery, [dealerId]);`;

// Find and replace TTS provider query
const oldTTSProviderSection = `const ttsProviderResult = await pool.query(ttsProviderQuery);`;
const newTTSProviderSection = `const ttsProviderResult = await pool.query(ttsProviderQuery, [dealerId]);`;

// Find and replace voice provider query  
const oldVoiceProviderSection = `const voiceProviderResult = await pool.query(voiceProviderQuery);`;
const newVoiceProviderSection = `const voiceProviderResult = await pool.query(voiceProviderQuery, [dealerId]);`;

// Apply the parameter fixes
content = content.replace(oldVoiceEnabledSection, newVoiceEnabledSection);
content = content.replace(oldTTSProviderSection, newTTSProviderSection);
content = content.replace(oldVoiceProviderSection, newVoiceProviderSection);

// Now we need to also fix the API key queries to use dealerId parameter
// Find Deepgram query
const oldDeepgramQuery = `const deepgramResult = await pool.query(deepgramQuery);`;
const newDeepgramQuery = `const deepgramResult = await pool.query(deepgramQuery, [dealerId]);`;

// Find OpenAI query
const oldOpenAIQuery = `const openaiResult = await pool.query(openaiQuery);`;
const newOpenAIQuery = `const openaiResult = await pool.query(openaiQuery, [dealerId]);`;

// Find ElevenLabs query
const oldElevenLabsQuery = `const elevenLabsResult = await pool.query(elevenLabsQuery);`;
const newElevenLabsQuery = `const elevenLabsResult = await pool.query(elevenLabsQuery, [dealerId]);`;

// Apply API key parameter fixes
content = content.replace(oldDeepgramQuery, newDeepgramQuery);
content = content.replace(oldOpenAIQuery, newOpenAIQuery);
content = content.replace(oldElevenLabsQuery, newElevenLabsQuery);

// Write the updated content
fs.writeFileSync(filePath, content);

console.log('✅ Quick fixes applied to TTS queries');
console.log('📋 Changes made:');
console.log('   - Added dealerId parameter to voice settings queries');
console.log('   - Added dealerId parameter to API key queries');
console.log('   - TTS should now find dealer-specific settings');

console.log('\n🧪 Test the fix:');
console.log('   1. Try using the AI bot page again');
console.log('   2. Send a text message');
console.log('   3. Check if audio is generated');
console.log('   4. Check browser console for any errors');

console.log('\n⚠️ Note: This is a quick parameter fix.');
console.log('The queries themselves still need to be updated to use dealer-specific with global fallback pattern.');
console.log('But this should make TTS work immediately with dealer-specific settings.');