import { pool } from './src/database/connection.js';
import settingsManager from './src/lib/settingsManager.js';

async function checkAndFixCrewAISettings() {
  try {
    console.log('🔍 Checking CrewAI settings in database...');
    
    // Check current CrewAI settings
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    const currentSettings = await settingsManager.getAllSettings(dealerId);
    
    console.log('📊 Current CrewAI settings:', {
      crew_ai_enabled: currentSettings.crew_ai_enabled,
      crew_ai_max_tokens: currentSettings.crew_ai_max_tokens,
      crew_ai_auto_routing: currentSettings.crew_ai_auto_routing
    });
    
    // Check what's in the daive_api_settings table
    const query = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings 
      WHERE setting_type LIKE 'crew_ai%'
      AND (dealer_id = $1 OR dealer_id IS NULL)
      ORDER BY dealer_id NULLS FIRST, setting_type
    `;
    
    const result = await pool.query(query, [dealerId]);
    console.log('📋 CrewAI settings in database:', result.rows);
    
    // If no CrewAI settings exist, create them
    if (result.rows.length === 0) {
      console.log('⚠️ No CrewAI settings found, creating default settings...');
      
      const insertQuery = `
        INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, is_active)
        VALUES 
          ($1, 'crew_ai_enabled', 'true', true),
          ($1, 'crew_ai_max_tokens', '1000', true),
          ($1, 'crew_ai_auto_routing', 'true', true),
          ($1, 'crew_ai_enable_sales_crew', 'true', true),
          ($1, 'crew_ai_enable_customer_service_crew', 'true', true),
          ($1, 'crew_ai_enable_inventory_crew', 'false', true),
          ($1, 'crew_ai_crew_collaboration', 'true', true),
          ($1, 'crew_ai_agent_memory', 'true', true),
          ($1, 'crew_ai_performance_tracking', 'true', true),
          ($1, 'crew_ai_fallback_to_traditional', 'true', true),
          ($1, 'crew_ai_crew_selection', 'auto', true)
        ON CONFLICT (dealer_id, setting_type) 
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `;
      
      await pool.query(insertQuery, [dealerId]);
      console.log('✅ CrewAI settings created successfully');
      
      // Clear cache and reload settings
      settingsManager.clearCache(dealerId);
      const newSettings = await settingsManager.getAllSettings(dealerId);
      
      console.log('📊 New CrewAI settings:', {
        crew_ai_enabled: newSettings.crew_ai_enabled,
        crew_ai_max_tokens: newSettings.crew_ai_max_tokens,
        crew_ai_auto_routing: newSettings.crew_ai_auto_routing
      });
      
    } else {
      // Check if crew_ai_enabled is set to false and update it
      const enabledSetting = result.rows.find(row => row.setting_type === 'crew_ai_enabled');
      if (enabledSetting && enabledSetting.setting_value === 'false') {
        console.log('⚠️ CrewAI is disabled, enabling it...');
        
        const updateQuery = `
          UPDATE daive_api_settings 
          SET setting_value = 'true', updated_at = NOW()
          WHERE dealer_id = $1 AND setting_type = 'crew_ai_enabled'
        `;
        
        await pool.query(updateQuery, [dealerId]);
        console.log('✅ CrewAI enabled successfully');
        
        // Clear cache and reload settings
        settingsManager.clearCache(dealerId);
        const updatedSettings = await settingsManager.getAllSettings(dealerId);
        
        console.log('📊 Updated CrewAI settings:', {
          crew_ai_enabled: updatedSettings.crew_ai_enabled,
          crew_ai_max_tokens: updatedSettings.crew_ai_max_tokens
        });
      }
    }
    
    // Test the CrewAI settings method
    const crewAISettings = await settingsManager.getCrewAISettings(dealerId);
    console.log('🎯 CrewAI settings from manager:', crewAISettings);
    
    console.log('✅ CrewAI settings check and fix completed');
    
  } catch (error) {
    console.error('❌ Error checking/fixing CrewAI settings:', error);
  } finally {
    await pool.end();
  }
}

checkAndFixCrewAISettings();
