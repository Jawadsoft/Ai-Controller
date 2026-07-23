import { pool } from './src/database/connection.js';

async function debugVoiceTTSDetailed() {
  try {
    console.log('🔍 Detailed Voice TTS Debug...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    console.log(`🏢 Debugging for dealer: ${dealerId}`);
    
    // Check all remaining global queries in voice endpoint
    console.log('\n📋 Checking for remaining global queries in voice endpoint...');
    
    // Test all the TTS-related queries that might still be global
    const queries = [
      { name: 'voice_enabled', type: 'voice_enabled' },
      { name: 'voice_tts_provider', type: 'voice_tts_provider' },
      { name: 'voice_provider', type: 'voice_provider' },
      { name: 'deepgram_key', type: 'deepgram_key' },
      { name: 'openai_key', type: 'openai_key' },
      { name: 'elevenlabs_key', type: 'elevenlabs_key' },
      { name: 'voice_openai_voice', type: 'voice_openai_voice' },
      { name: 'voice_speed', type: 'voice_speed' },
      { name: 'voice_language', type: 'voice_language' }
    ];
    
    for (const query of queries) {
      // Test old global query
      const globalQuery = `
        SELECT setting_value FROM daive_api_settings
        WHERE dealer_id IS NULL AND setting_type = $1
        LIMIT 1
      `;
      
      const globalResult = await pool.query(globalQuery, [query.type]);
      
      // Test new dealer-specific query
      const dealerQuery = `
        WITH dealer_setting AS (
          SELECT setting_value FROM daive_api_settings 
          WHERE dealer_id = $1 AND setting_type = $2
        ),
        global_setting AS (
          SELECT setting_value FROM daive_api_settings 
          WHERE dealer_id IS NULL AND setting_type = $2
        )
        SELECT setting_value FROM dealer_setting
        UNION ALL
        SELECT setting_value FROM global_setting
        WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
        LIMIT 1
      `;
      
      const dealerResult = await pool.query(dealerQuery, [dealerId, query.type]);
      
      console.log(`   ${query.name}:`);
      console.log(`     Global query: ${globalResult.rows.length} results`);
      console.log(`     Dealer query: ${dealerResult.rows.length} results`);
      
      if (dealerResult.rows.length > 0) {
        const value = dealerResult.rows[0].setting_value;
        const maskedValue = value && value.length > 15 ? 
          value.substring(0, 8) + '...' + value.substring(value.length - 4) : value;
        console.log(`     Value: ${maskedValue}`);
      }
    }
    
    // Check if there are any voice endpoint queries still using global pattern
    console.log('\n🔍 Checking voice endpoint code for remaining global queries...');
    
    const fs = await import('fs');
    const content = fs.readFileSync('src/routes/daive.js', 'utf8');
    
    // Look for voice endpoint section (after line 600)
    const lines = content.split('\n');
    const voiceEndpointStart = lines.findIndex(line => line.includes('POST /api/daive/voice'));
    const voiceEndpointEnd = lines.findIndex((line, index) => 
      index > voiceEndpointStart && line.includes('export default router')
    );
    
    console.log(`   Voice endpoint: lines ${voiceEndpointStart + 1} to ${voiceEndpointEnd + 1}`);
    
    // Check for remaining global queries in voice endpoint
    const voiceEndpointLines = lines.slice(voiceEndpointStart, voiceEndpointEnd);
    const globalQueries = voiceEndpointLines.filter(line => 
      line.includes('dealer_id IS NULL') && line.includes('setting_type')
    );
    
    console.log(`   Found ${globalQueries.length} remaining global queries in voice endpoint:`);
    globalQueries.forEach((line, index) => {
      const lineNumber = voiceEndpointStart + voiceEndpointLines.indexOf(line) + 1;
      console.log(`     Line ${lineNumber}: ${line.trim()}`);
    });
    
    if (globalQueries.length > 0) {
      console.log('\n❌ PROBLEM FOUND: Voice endpoint still has global queries!');
      console.log('These queries will return 0 results and cause TTS to fail.');
    } else {
      console.log('\n✅ No global queries found in voice endpoint');
    }
    
    // Check for missing parameters
    const queryExecutions = voiceEndpointLines.filter(line => 
      line.includes('pool.query') && line.includes('Query')
    );
    
    console.log(`\n🔍 Found ${queryExecutions.length} query executions in voice endpoint:`);
    queryExecutions.forEach((line, index) => {
      const lineNumber = voiceEndpointStart + voiceEndpointLines.indexOf(line) + 1;
      const hasParameter = line.includes('[dealerId]') || line.includes(', [');
      console.log(`     Line ${lineNumber}: ${hasParameter ? '✅' : '❌'} ${line.trim()}`);
    });
    
    console.log('\n💡 Next steps:');
    if (globalQueries.length > 0) {
      console.log('   1. Update remaining global queries to use dealer-specific pattern');
      console.log('   2. Ensure all query executions have [dealerId] parameter');
    } else {
      console.log('   1. Check backend console for TTS generation errors');
      console.log('   2. Check if audio files are being created in uploads/daive-audio/');
      console.log('   3. Verify ElevenLabs API key is working');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await pool.end();
  }
}

debugVoiceTTSDetailed();