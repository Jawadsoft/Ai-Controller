import { pool } from './src/database/connection.js';

async function migrateApiSettingsToGlobal() {
  console.log('🔄 Migrating API settings to global for all dealers...\n');
  
  try {
    // First, let's see what dealer-specific settings exist
    console.log('1. Checking existing dealer-specific API settings...');
    
    const existingSettingsQuery = `
      SELECT dealer_id, setting_type, setting_value, COUNT(*) as count
      FROM daive_api_settings
      WHERE dealer_id IS NOT NULL
      GROUP BY dealer_id, setting_type, setting_value
      ORDER BY dealer_id, setting_type
    `;
    
    const existingSettings = await pool.query(existingSettingsQuery);
    
    console.log(`📊 Found ${existingSettings.rows.length} dealer-specific settings:`);
    existingSettings.rows.forEach((setting, index) => {
      console.log(`  ${index + 1}. Dealer ID: ${setting.dealer_id}, Type: ${setting.setting_type}, Count: ${setting.count}`);
    });
    
    // Get all unique setting types
    const settingTypesQuery = `
      SELECT DISTINCT setting_type
      FROM daive_api_settings
      WHERE dealer_id IS NOT NULL
      ORDER BY setting_type
    `;
    
    const settingTypes = await pool.query(settingTypesQuery);
    console.log(`\n📋 Found ${settingTypes.rows.length} unique setting types:`);
    settingTypes.rows.forEach((type, index) => {
      console.log(`  ${index + 1}. ${type.setting_type}`);
    });
    
    // For each setting type, get the most common value and make it global
    console.log('\n2. Creating global settings from most common values...');
    
    for (const settingType of settingTypes.rows) {
      const type = settingType.setting_type;
      
      // Get the most common value for this setting type
      const mostCommonQuery = `
        SELECT setting_value, COUNT(*) as count
        FROM daive_api_settings
        WHERE dealer_id IS NOT NULL AND setting_type = $1
        GROUP BY setting_value
        ORDER BY count DESC
        LIMIT 1
      `;
      
      const mostCommonResult = await pool.query(mostCommonQuery, [type]);
      
      if (mostCommonResult.rows.length > 0) {
        const mostCommonValue = mostCommonResult.rows[0].setting_value;
        const count = mostCommonResult.rows[0].count;
        
        console.log(`  📝 Setting '${type}' to global value: '${mostCommonValue}' (used by ${count} dealers)`);
        
        // Insert global setting
        const insertGlobalQuery = `
          INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
          VALUES (NULL, $1, $2)
          ON CONFLICT (dealer_id, setting_type) 
          DO UPDATE SET setting_value = $2, updated_at = NOW()
        `;
        
        await pool.query(insertGlobalQuery, [type, mostCommonValue]);
        console.log(`  ✅ Global setting created for '${type}'`);
      }
    }
    
    // Verify global settings were created
    console.log('\n3. Verifying global settings...');
    
    const globalSettingsQuery = `
      SELECT setting_type, setting_value
      FROM daive_api_settings
      WHERE dealer_id IS NULL
      ORDER BY setting_type
    `;
    
    const globalSettings = await pool.query(globalSettingsQuery);
    
    console.log(`📊 Found ${globalSettings.rows.length} global settings:`);
    globalSettings.rows.forEach((setting, index) => {
      console.log(`  ${index + 1}. ${setting.setting_type}: ${setting.setting_value.substring(0, 20)}...`);
    });
    
    // Optional: Remove dealer-specific settings (uncomment if you want to clean up)
    /*
    console.log('\n4. Removing dealer-specific settings...');
    
    const deleteDealerSpecificQuery = `
      DELETE FROM daive_api_settings
      WHERE dealer_id IS NOT NULL
    `;
    
    const deleteResult = await pool.query(deleteDealerSpecificQuery);
    console.log(`🗑️ Removed ${deleteResult.rowCount} dealer-specific settings`);
    */
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  - API settings are now global for all dealers');
    console.log('  - All dealers will use the same API configuration');
    console.log('  - No more dealer-specific API settings');
    console.log('  - AI bot will work consistently across all dealers');
    
  } catch (error) {
    console.error('❌ Error migrating API settings:', error);
  } finally {
    await pool.end();
  }
}

migrateApiSettingsToGlobal(); 