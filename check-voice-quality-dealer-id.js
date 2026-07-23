import { pool } from './src/database/connection.js';

async function checkVoiceQualityDealerId() {
  try {
    console.log('🔍 Checking voice quality fields for NULL dealer_id...\n');

    const query = `
      SELECT setting_type, setting_value, dealer_id, created_at, updated_at
      FROM daive_api_settings 
      WHERE setting_type IN ('voice_quality', 'voice_emotion', 'voice_recording_quality', 'voice_auto_response')
      ORDER BY dealer_id NULLS FIRST, setting_type
    `;
    
    const result = await pool.query(query);
    
    console.log('📊 Voice Quality Fields in Database:');
    result.rows.forEach(row => {
      const dealerInfo = row.dealer_id ? `Dealer: ${row.dealer_id}` : 'Dealer: NULL (Global)';
      console.log(`  ${row.setting_type}: ${row.setting_value} (${dealerInfo})`);
      console.log(`    Created: ${row.created_at}, Updated: ${row.updated_at}`);
    });

    // Check if there are any NULL dealer_id entries
    const nullDealerEntries = result.rows.filter(row => row.dealer_id === null);
    if (nullDealerEntries.length > 0) {
      console.log(`\n⚠️ Found ${nullDealerEntries.length} entries with NULL dealer_id:`);
      nullDealerEntries.forEach(row => {
        console.log(`  - ${row.setting_type}: ${row.setting_value}`);
      });
    } else {
      console.log('\n✅ All voice quality fields have proper dealer_id values');
    }

    // Check for duplicate entries
    console.log('\n🔍 Checking for duplicate entries...');
    const duplicateQuery = `
      SELECT setting_type, COUNT(*) as count, 
             array_agg(dealer_id) as dealer_ids,
             array_agg(setting_value) as values
      FROM daive_api_settings 
      WHERE setting_type IN ('voice_quality', 'voice_emotion', 'voice_recording_quality', 'voice_auto_response')
      GROUP BY setting_type
      HAVING COUNT(*) > 1
    `;
    
    const duplicateResult = await pool.query(duplicateQuery);
    if (duplicateResult.rows.length > 0) {
      console.log('⚠️ Found duplicate entries:');
      duplicateResult.rows.forEach(row => {
        console.log(`  ${row.setting_type}: ${row.count} entries`);
        console.log(`    Dealer IDs: ${row.dealer_ids.join(', ')}`);
        console.log(`    Values: ${row.values.join(', ')}`);
      });
    } else {
      console.log('✅ No duplicate entries found');
    }

  } catch (error) {
    console.error('❌ Error checking voice quality fields:', error);
  } finally {
    await pool.end();
  }
}

checkVoiceQualityDealerId();
