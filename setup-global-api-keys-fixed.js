import { pool } from './src/database/connection.js';

async function setupGlobalAPIKeysFixed() {
  try {
    console.log('🔑 Setting up Global API Keys (Fixed)...\n');
    
    // First, let's check what API keys we currently have
    const checkQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      ORDER BY setting_type, dealer_id
    `;
    
    const existing = await pool.query(checkQuery);
    
    console.log('📊 Current API Keys:');
    console.log('====================');
    
    if (existing.rows.length === 0) {
      console.log('❌ No API keys found');
    } else {
      existing.rows.forEach(row => {
        const scope = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        const hasKey = row.setting_value && row.setting_value.length > 0;
        const status = hasKey ? '✅ Configured' : '❌ Empty';
        const keyPreview = hasKey ? `${row.setting_value.substring(0, 10)}...` : 'Not set';
        
        console.log(`${row.setting_type}: ${status} (${scope})`);
        console.log(`  Key: ${keyPreview}`);
      });
    }
    
    console.log('\n🔧 Setting up Global API Keys...');
    
    // Move existing dealer-specific keys to global
    const moveToGlobalQuery = `
      UPDATE daive_api_settings 
      SET dealer_id = NULL 
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key') 
      AND dealer_id IS NOT NULL
    `;
    
    const moveResult = await pool.query(moveToGlobalQuery);
    console.log(`✅ Moved ${moveResult.rowCount} dealer-specific keys to global`);
    
    // Remove duplicate global entries (keep only one global entry per key type)
    // Use a simpler approach that works with UUIDs
    const deduplicateQuery = `
      DELETE FROM daive_api_settings 
      WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
      AND dealer_id IS NULL
      AND id NOT IN (
        SELECT DISTINCT ON (setting_type) id
        FROM daive_api_settings 
        WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key')
        AND dealer_id IS NULL
        ORDER BY setting_type, created_at ASC
      )
    `;
    
    const deduplicateResult = await pool.query(deduplicateQuery);
    console.log(`✅ Removed ${deduplicateResult.rowCount} duplicate global entries`);
    
    // Check final status
    const finalCheck = await pool.query(checkQuery);
    
    console.log('\n📊 Final Global API Keys:');
    console.log('==========================');
    
    if (finalCheck.rows.length === 0) {
      console.log('❌ No API keys found');
    } else {
      finalCheck.rows.forEach(row => {
        const scope = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        const hasKey = row.setting_value && row.setting_value.length > 0;
        const status = hasKey ? '✅ Configured' : '❌ Empty';
        const keyPreview = hasKey ? `${row.setting_value.substring(0, 10)}...` : 'Not set';
        
        console.log(`${row.setting_type}: ${status} (${scope})`);
        console.log(`  Key: ${keyPreview}`);
      });
    }
    
    console.log('\n✅ Global API Keys Setup Complete!');
    console.log('\n💡 Benefits of Global API Keys:');
    console.log('- All dealers use the same API keys');
    console.log('- Easier to manage and maintain');
    console.log('- Consistent voice experience across all dealers');
    console.log('- No need to configure keys per dealer');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Add your OpenAI API key (for Whisper transcription)');
    console.log('2. Verify ElevenLabs API key is working (for Jessica voice)');
    console.log('3. Test voice functionality');
    console.log('4. All dealers will now use these global keys');
    
  } catch (error) {
    console.error('❌ Error setting up global API keys:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupGlobalAPIKeysFixed().catch(console.error); 