import fs from 'fs';

console.log('🔧 Fixing TTS to use dealer-specific settings...\n');

// Read the current file
const filePath = 'src/routes/daive.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('📝 Original file read successfully');

// Fix 1: Replace global voice_enabled query with dealer-specific
const oldVoiceEnabledPattern = /WHERE dealer_id IS NULL AND setting_type = 'voice_enabled'/g;
const newVoiceEnabledQuery = `WITH dealer_setting AS (
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
        LIMIT 1`;

// Fix 2: Replace global voice_tts_provider query
const oldTTSProviderPattern = /WHERE dealer_id IS NULL AND setting_type = 'voice_tts_provider'/g;
const newTTSProviderQuery = `WITH dealer_setting AS (
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
          LIMIT 1`;

// Fix 3: Replace global voice_provider query
const oldVoiceProviderPattern = /WHERE dealer_id IS NULL AND setting_type = 'voice_provider'/g;
const newVoiceProviderQuery = `WITH dealer_setting AS (
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
          LIMIT 1`;

// Fix 4: Replace global API key queries
const oldOpenAIKeyPattern = /WHERE dealer_id IS NULL AND setting_type = 'openai_key'/g;
const newOpenAIKeyQuery = `WITH dealer_setting AS (
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
          LIMIT 1`;

const oldElevenLabsKeyPattern = /WHERE dealer_id IS NULL AND setting_type = 'elevenlabs_key'/g;
const newElevenLabsKeyQuery = `WITH dealer_setting AS (
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
          LIMIT 1`;

const oldDeepgramKeyPattern = /WHERE dealer_id IS NULL AND setting_type = 'deepgram_key'/g;
const newDeepgramKeyQuery = `WITH dealer_setting AS (
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
          LIMIT 1`;

// Count occurrences before replacement
const voiceEnabledMatches = content.match(oldVoiceEnabledPattern);
const ttsProviderMatches = content.match(oldTTSProviderPattern);
const voiceProviderMatches = content.match(oldVoiceProviderPattern);
const openaiKeyMatches = content.match(oldOpenAIKeyPattern);
const elevenLabsKeyMatches = content.match(oldElevenLabsKeyPattern);
const deepgramKeyMatches = content.match(oldDeepgramKeyPattern);

console.log('🔍 Found patterns to replace:');
console.log(`   voice_enabled: ${voiceEnabledMatches ? voiceEnabledMatches.length : 0} occurrences`);
console.log(`   voice_tts_provider: ${ttsProviderMatches ? ttsProviderMatches.length : 0} occurrences`);
console.log(`   voice_provider: ${voiceProviderMatches ? voiceProviderMatches.length : 0} occurrences`);
console.log(`   openai_key: ${openaiKeyMatches ? openaiKeyMatches.length : 0} occurrences`);
console.log(`   elevenlabs_key: ${elevenLabsKeyMatches ? elevenLabsKeyMatches.length : 0} occurrences`);
console.log(`   deepgram_key: ${deepgramKeyMatches ? deepgramKeyMatches.length : 0} occurrences`);

// Apply fixes - but we need to be more surgical about this
console.log('\n⚠️ This approach is too broad and might break other parts of the code.');
console.log('💡 Instead, let me create a specific TTS test to verify the issue first.');

console.log('\n🧪 Creating TTS-specific test...');

const testContent = `import { pool } from './src/database/connection.js';

async function testTTSWithDealerSettings() {
  try {
    console.log('🧪 Testing TTS with Dealer-Specific Settings...\\n');
    
    // Test 1: Check if we have dealer-specific voice settings
    console.log('📋 Test 1: Checking Dealer-Specific Voice Settings');
    
    const dealerVoiceQuery = \`
      SELECT dealer_id, setting_type, setting_value
      FROM daive_api_settings
      WHERE dealer_id IS NOT NULL AND setting_type IN ('voice_enabled', 'voice_tts_provider', 'elevenlabs_key', 'openai_key', 'deepgram_key')
      ORDER BY dealer_id, setting_type
    \`;
    
    const dealerResult = await pool.query(dealerVoiceQuery);
    
    if (dealerResult.rows.length > 0) {
      console.log('✅ Found dealer-specific voice settings:');
      let currentDealer = '';
      dealerResult.rows.forEach(row => {
        if (row.dealer_id !== currentDealer) {
          currentDealer = row.dealer_id;
          console.log(\`\\n   Dealer \${row.dealer_id}:\`);
        }
        const maskedValue = row.setting_value && row.setting_value.length > 15 ? 
          row.setting_value.substring(0, 8) + '...' + row.setting_value.substring(row.setting_value.length - 4) :
          row.setting_value;
        console.log(\`     \${row.setting_type}: \${maskedValue}\`);
      });
    } else {
      console.log('❌ No dealer-specific voice settings found');
    }
    
    // Test 2: Check if we have global voice settings
    console.log('\\n📋 Test 2: Checking Global Voice Settings');
    
    const globalVoiceQuery = \`
      SELECT setting_type, setting_value
      FROM daive_api_settings
      WHERE dealer_id IS NULL AND setting_type IN ('voice_enabled', 'voice_tts_provider', 'elevenlabs_key', 'openai_key', 'deepgram_key')
      ORDER BY setting_type
    \`;
    
    const globalResult = await pool.query(globalVoiceQuery);
    
    if (globalResult.rows.length > 0) {
      console.log('✅ Found global voice settings:');
      globalResult.rows.forEach(row => {
        const maskedValue = row.setting_value && row.setting_value.length > 15 ? 
          row.setting_value.substring(0, 8) + '...' + row.setting_value.substring(row.setting_value.length - 4) :
          row.setting_value;
        console.log(\`   \${row.setting_type}: \${maskedValue}\`);
      });
    } else {
      console.log('❌ No global voice settings found');
    }
    
    // Test 3: Test the query pattern used by TTS
    console.log('\\n🔍 Test 3: Testing Current TTS Query Pattern');
    
    const currentTTSQuery = \`
      SELECT setting_value
      FROM daive_api_settings
      WHERE dealer_id IS NULL AND setting_type = 'voice_enabled'
      LIMIT 1
    \`;
    
    const currentResult = await pool.query(currentTTSQuery);
    console.log(\`Current TTS query finds: \${currentResult.rows.length} results\`);
    
    if (currentResult.rows.length > 0) {
      console.log(\`   voice_enabled: \${currentResult.rows[0].setting_value}\`);
    } else {
      console.log('   ❌ No voice_enabled setting found with current query');
    }
    
    // Test 4: Test dealer-specific query with fallback
    console.log('\\n💡 Test 4: Testing Dealer-Specific Query with Global Fallback');
    
    // Get a test dealer ID
    const dealerQuery = 'SELECT id FROM dealers LIMIT 1';
    const dealerIdResult = await pool.query(dealerQuery);
    
    if (dealerIdResult.rows.length > 0) {
      const testDealerId = dealerIdResult.rows[0].id;
      console.log(\`Using test dealer ID: \${testDealerId}\`);
      
      const newTTSQuery = \`
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
      \`;
      
      const newResult = await pool.query(newTTSQuery, [testDealerId]);
      console.log(\`New TTS query finds: \${newResult.rows.length} results\`);
      
      if (newResult.rows.length > 0) {
        console.log(\`   voice_enabled: \${newResult.rows[0].setting_value}\`);
        console.log('   ✅ Dealer-specific query with fallback works!');
      } else {
        console.log('   ❌ Dealer-specific query with fallback failed');
      }
    }
    
    console.log('\\n📝 Summary:');
    console.log('   The issue is that TTS code still uses global queries (dealer_id IS NULL)');
    console.log('   But voice settings are now dealer-specific');
    console.log('   Solution: Update TTS queries to use dealer-specific with global fallback');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testTTSWithDealerSettings();`;

// Write the test file
fs.writeFileSync('test-tts-dealer-specific.js', testContent);
console.log('✅ Created test-tts-dealer-specific.js');

console.log('\n🎯 Next Steps:');
console.log('   1. Run: node test-tts-dealer-specific.js');
console.log('   2. This will confirm the TTS issue');
console.log('   3. Then we can fix specific TTS queries in the code');
