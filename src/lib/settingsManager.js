// Centralized Settings Manager for DAIVE
// Loads all API, voice, and crew settings once and caches them for reuse
import { pool } from '../database/connection.js';

class SettingsManager {
  constructor() {
    // Cache for all settings
    this.settingsCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Settings structure
    this.defaultSettings = {
      // API Keys
      openai_key: null,
      elevenlabs_key: null,
      deepgram_key: null,
      azure_speech_key: null,
      
      // Voice Settings
      voice_provider: 'elevenlabs',
      voice_speech_provider: 'whisper',
      voice_tts_provider: 'elevenlabs',
      voice_elevenlabs_voice: 'mark', // Changed from 'liam' to 'mark'
      voice_openai_voice: 'alloy',
      voice_language: 'en-US',
      voice_speed: 1.0,
      voice_pitch: 1.0,
      voice_quality: 'standard',
      voice_emotion: 'friendly',
      voice_auto_response: true,
      voice_recording_quality: 'medium',
      
      // Crew AI Settings
      crew_ai_enabled: false,
      crew_ai_max_tokens: 100,
      crew_ai_auto_routing: true,
      crew_ai_enable_sales_crew: true,
      crew_ai_enable_customer_service_crew: true,
      crew_ai_enable_inventory_crew: false,
      crew_ai_crew_collaboration: true,
      crew_ai_agent_memory: true,
      crew_ai_performance_tracking: true,
      crew_ai_fallback_to_traditional: true,
      crew_ai_crew_selection: 'auto',
      
      // TTS Settings
      tts_provider: 'elevenlabs',
      tts_voice: 'mark', // Changed from 'liam' to 'mark'
      tts_model: 'eleven_multilingual_v1', // Using v1 for faster response time
      tts_stability: 0.5,
      tts_similarity_boost: 0.6
    };
  }

  // Get all settings for a dealer (with global fallback)
  async getAllSettings(dealerId = null) {
    const cacheKey = `all_settings_${dealerId || 'global'}`;
    
    // Check cache first
    if (this.settingsCache.has(cacheKey)) {
      const cached = this.settingsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log('⚙️ Using cached settings for dealer:', dealerId || 'global');
        return cached.data;
      }
    }
    
    try {
      console.log('⚙️ Loading fresh settings for dealer:', dealerId || 'global');
      
      let query, params;
      
      if (dealerId) {
        // Get dealer-specific settings with global fallback
        query = `
          WITH dealer_settings AS (
            SELECT setting_type, setting_value, is_active, 'dealer' as source
            FROM daive_api_settings 
            WHERE dealer_id = $1 AND is_active = true
          ),
          global_settings AS (
            SELECT setting_type, setting_value, is_active, 'global' as source
            FROM daive_api_settings 
            WHERE dealer_id IS NULL AND is_active = true
          )
          SELECT setting_type, setting_value, is_active, source
          FROM dealer_settings
          UNION ALL
          SELECT setting_type, setting_value, is_active, source
          FROM global_settings
          WHERE setting_type NOT IN (SELECT setting_type FROM dealer_settings)
          ORDER BY setting_type
        `;
        params = [dealerId];
      } else {
        // Get global settings only
        query = `
          SELECT setting_type, setting_value, is_active, 'global' as source
          FROM daive_api_settings 
          WHERE dealer_id IS NULL AND is_active = true
          ORDER BY setting_type
        `;
        params = [];
      }
      
      const result = await pool.query(query, params);
      
      // Build settings object with defaults and overrides
      const settings = { ...this.defaultSettings };
      
      result.rows.forEach(row => {
        if (row.setting_value !== null) {
          settings[row.setting_type] = row.setting_value;
        }
      });
      
      // Cache the settings
      this.settingsCache.set(cacheKey, {
        data: settings,
        timestamp: Date.now()
      });
      
      console.log('✅ Settings loaded and cached successfully');
      return settings;
      
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      console.log('⚠️ Using default settings due to error');
      return { ...this.defaultSettings };
    }
  }

  // Get specific setting value
  async getSetting(settingType, dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return settings[settingType];
  }

  // Get API keys with fallback to global/superadmin keys
  async getAPIKeys(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    
    const dealerKeys = {
      openai: settings.openai_key,
      elevenlabs: settings.elevenlabs_key,
      deepgram: settings.deepgram_key,
      azure: settings.azure_speech_key
    };
    
    // If dealer has no API keys configured, fallback to global/superadmin keys
    if (dealerId && (!dealerKeys.openai || !dealerKeys.elevenlabs)) {
      console.log(`⚠️ Dealer ${dealerId} missing API keys, falling back to global/superadmin keys`);
      
      try {
        const globalSettings = await this.getAllSettings(null); // null = global/superadmin settings
        
        return {
          openai: dealerKeys.openai || globalSettings.openai_key,
          elevenlabs: dealerKeys.elevenlabs || globalSettings.elevenlabs_key,
          deepgram: dealerKeys.deepgram || globalSettings.deepgram_key,
          azure: dealerKeys.azure || globalSettings.azure_speech_key
        };
      } catch (error) {
        console.error('❌ Failed to load global API keys:', error);
        return dealerKeys; // Return dealer keys even if empty
      }
    }
    
    return dealerKeys;
  }

  // Get available API keys from any dealer (useful for fallback scenarios)
  async getAvailableAPIKeys() {
    try {
      console.log('🔍 Looking for available API keys across all dealers...');
      
      // CRITICAL FIX: Prioritize dealer-specific keys over global keys
      // First try to find from any dealer (prioritize dealer-specific)
      console.log('🔍 Searching for dealer-specific API keys first...');
      
      const dealerQuery = `
        SELECT setting_type, setting_value, dealer_id
        FROM daive_api_settings 
        WHERE setting_type IN ('openai_key', 'elevenlabs_key', 'deepgram_key', 'azure_speech_key')
        AND setting_value IS NOT NULL 
        AND setting_value != ''
        AND dealer_id IS NOT NULL
        ORDER BY setting_type
      `;
      
      const dealerResult = await pool.query(dealerQuery);
      
      const availableKeys = {
        openai: null,
        elevenlabs: null,
        deepgram: null,
        azure: null
      };
      
      // Process dealer-specific keys first
      if (dealerResult.rows.length > 0) {
        dealerResult.rows.forEach(row => {
          const keyType = row.setting_type.replace('_key', '');
          if (keyType === 'azure_speech') {
            availableKeys.azure = row.setting_value;
          } else {
            availableKeys[keyType] = row.setting_value;
          }
        });
        
        console.log('✅ Found API keys from dealer settings:', Object.keys(availableKeys).filter(key => availableKeys[key]));
        return availableKeys;
      }
      
      // Only fallback to global settings if no dealer keys found
      console.log('🔍 No dealer-specific keys found, trying global settings...');
      
      const globalSettings = await this.getAllSettings();
      availableKeys.openai = globalSettings.openai_key;
      availableKeys.elevenlabs = globalSettings.elevenlabs_key;
      availableKeys.deepgram = globalSettings.deepgram_key;
      availableKeys.azure = globalSettings.azure_speech_key;
      
      // If we have any global keys, return them
      if (Object.values(availableKeys).some(key => key)) {
        console.log('✅ Found API keys in global settings (fallback)');
        return availableKeys;
      }
      
      console.log('⚠️ No API keys found in database');
      return availableKeys;
      
    } catch (error) {
      console.error('❌ Error getting available API keys:', error);
      return {
        openai: null,
        elevenlabs: null,
        deepgram: null,
        azure: null
      };
    }
  }

  // Get voice settings
  async getVoiceSettings(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return {
      // Core voice settings - Extract value from the object structure
      enabled: settings.voice_enabled?.value || settings.voice_enabled,
      provider: settings.voice_provider?.value || settings.voice_provider,
      ttsProvider: settings.voice_tts_provider?.value || settings.voice_tts_provider,
      speechProvider: settings.voice_speech_provider?.value || settings.voice_speech_provider,
      
      // Voice selection (specific voices like jessica, alloy, etc.) - Extract value from the object structure
      elevenlabsVoice: settings.voice_elevenlabs_voice?.value || settings.voice_elevenlabs_voice,
      openaiVoice: settings.voice_openai_voice?.value || settings.voice_openai_voice,
      ttsVoice: settings.tts_voice?.value || settings.tts_voice,
      
      // Voice characteristics - Extract value from the object structure
      language: settings.voice_language?.value || settings.voice_language,
      speed: settings.voice_speed?.value || settings.voice_speed,
      pitch: settings.voice_pitch?.value || settings.voice_pitch,
      quality: settings.voice_quality?.value || settings.voice_quality,
      emotion: settings.voice_emotion?.value || settings.voice_emotion,
      
      // Voice behavior - Extract value from the object structure
      autoResponse: settings.voice_auto_response?.value || settings.voice_auto_response,
      recordingQuality: settings.voice_recording_quality?.value || settings.voice_recording_quality,
      realtimeEnabled: settings.voice_realtime_enabled?.value || settings.voice_realtime_enabled,
      streamingEnabled: settings.voice_streaming_enabled?.value || settings.voice_streaming_enabled,
      responseFormat: settings.voice_response_format?.value || settings.voice_response_format,
      
      // TTS specific settings - Extract value from the object structure
      ttsModel: settings.tts_model?.value || settings.tts_model,
      ttsStability: settings.tts_stability?.value || settings.tts_stability,
      ttsSimilarityBoost: settings.tts_similarity_boost?.value || settings.tts_similarity_boost
    };
  }

  // Get TTS settings
  async getTTSSettings(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return {
      // Provider settings - Extract value from the object structure
      provider: settings.voice_provider?.value || settings.voice_provider,
      ttsProvider: settings.voice_tts_provider?.value || settings.voice_tts_provider,
      speechProvider: settings.voice_speech_provider?.value || settings.voice_speech_provider,
      
      // Voice selection settings - Extract value from the object structure
      voice: settings.voice_elevenlabs_voice?.value || settings.voice_elevenlabs_voice || settings.tts_voice,
      openaiVoice: settings.voice_openai_voice?.value || settings.voice_openai_voice,
      elevenlabsVoice: settings.voice_elevenlabs_voice?.value || settings.voice_elevenlabs_voice, // This should now work correctly
      
      // TTS model and quality settings
      model: settings.tts_model || 'eleven_multilingual_v1', // Using v1 for faster response time
      stability: settings.tts_stability || 0.5,
      similarityBoost: settings.tts_similarity_boost || 0.6,
      
      // Voice quality and performance settings - Extract value from the object structure
      voiceQuality: settings.voice_quality?.value || settings.voice_quality,
      voiceSpeed: settings.voice_speed?.value || settings.voice_speed,
      voicePitch: settings.voice_pitch?.value || settings.voice_pitch,
      voiceEmotion: settings.voice_emotion?.value || settings.voice_emotion,
      
      // API keys - Extract value from the object structure
      apiKey: settings.elevenlabs_key?.value || settings.elevenlabs_key, // For ElevenLabs TTS
      openaiKey: settings.openai_key?.value || settings.openai_key, // For OpenAI TTS
      
      // Additional voice settings - Extract value from the object structure
      language: settings.voice_language?.value || settings.voice_language,
      autoResponse: settings.voice_auto_response?.value || settings.voice_auto_response,
      recordingQuality: settings.voice_recording_quality?.value || settings.voice_recording_quality,
      realtimeEnabled: settings.voice_realtime_enabled?.value || settings.voice_realtime_enabled,
      streamingEnabled: settings.voice_streaming_enabled?.value || settings.voice_streaming_enabled,
      responseFormat: settings.voice_response_format?.value || settings.voice_response_format
    };
  }

  // Get Crew AI settings
  async getCrewAISettings(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return {
      enabled: settings.crew_ai_enabled,
      maxTokens: settings.crew_ai_max_tokens,
      autoRouting: settings.crew_ai_auto_routing,
      enableSalesCrew: settings.crew_ai_enable_sales_crew,
      enableCustomerServiceCrew: settings.crew_ai_enable_customer_service_crew,
      enableInventoryCrew: settings.crew_ai_enable_inventory_crew,
      crewCollaboration: settings.crew_ai_crew_collaboration,
      agentMemory: settings.crew_ai_agent_memory,
      performanceTracking: settings.crew_ai_performance_tracking,
      fallbackToTraditional: settings.crew_ai_fallback_to_traditional,
      crewSelection: settings.crew_ai_crew_selection
    };
  }

  // Clear cache for a specific dealer or all
  clearCache(dealerId = null) {
    if (dealerId) {
      this.settingsCache.delete(`all_settings_${dealerId}`);
      console.log('🗑️ Cleared cache for dealer:', dealerId);
    } else {
      this.settingsCache.clear();
      console.log('🗑️ Cleared all settings cache');
    }
  }

  // Batch insert/update multiple settings for a dealer
  async batchUpdateSettings(dealerId, settings) {
    try {
      console.log('⚙️ Batch updating settings for dealer:', dealerId);
      
      // Use a transaction for better performance and consistency
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const upsertQuery = `
          INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (dealer_id, setting_type) 
          DO UPDATE SET setting_value = $3, updated_at = NOW()
        `;
        
        // Execute all updates in parallel
        const updatePromises = Object.entries(settings).map(([settingType, settingValue]) => {
          return client.query(upsertQuery, [dealerId, settingType, settingValue.toString()]);
        });
        
        await Promise.all(updatePromises);
        
        await client.query('COMMIT');
        
        // Clear cache for this dealer
        this.clearCache(dealerId);
        
        console.log('✅ Batch settings update completed successfully');
        return { success: true, updatedCount: Object.keys(settings).length };
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Error in batch settings update:', error);
      return { success: false, error: error.message };
    }
  }

  // Refresh settings for a specific dealer
  async refreshSettings(dealerId = null) {
    this.clearCache(dealerId);
    return await this.getAllSettings(dealerId);
  }

  // Get default settings (useful for fallbacks and initial values)
  getDefaultSettings() {
    return {
      // API Keys
      openai_key: null,
      elevenlabs_key: null,
      deepgram_key: null,
      azure_speech_key: null,
      
      // Voice Settings
      voice_provider: 'elevenlabs',
      voice_speech_provider: 'whisper',
      voice_tts_provider: 'elevenlabs',
      voice_elevenlabs_voice: 'mark',
      voice_openai_voice: 'alloy',
      voice_language: 'en-US',
      voice_speed: 1.0,
      voice_pitch: 1.0,
      voice_enabled: false,
      // New AI bot voice settings
      voice_auto_response: true,
      voice_quality: 'hd',
      voice_emotion: 'friendly',
      voice_recording_quality: 'high',
      
      // Crew AI Settings
      crew_ai_enabled: false,
      crew_ai_max_tokens: 300,
      crew_ai_auto_routing: true,
      crew_ai_enable_sales_crew: true,
      crew_ai_enable_customer_service_crew: true,
      crew_ai_enable_inventory_crew: false,
      crew_ai_crew_collaboration: true,
      crew_ai_agent_memory: true,
      crew_ai_performance_tracking: true,
      crew_ai_fallback_to_traditional: true,
      crew_ai_crew_selection: 'auto',
      
      // TTS Settings
      tts_provider: 'elevenlabs',
      tts_voice: 'mark',
      tts_model: 'eleven_multilingual_v1', // Using v1 for faster response time
      tts_stability: 0.5,
      tts_similarity_boost: 0.5
    };
  }

  // Get settings summary for debugging
  async getSettingsSummary(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    const summary = {
      dealerId: dealerId || 'global',
      apiKeys: {
        openai: !!settings.openai_key,
        elevenlabs: !!settings.elevenlabs_key,
        deepgram: !!settings.deepgram_key,
        azure: !!settings.azure_speech_key
      },
      voice: {
        provider: settings.voice_provider,
        ttsProvider: settings.voice_tts_provider,
        speechProvider: settings.voice_speech_provider
      },
      crewAI: {
        enabled: settings.crew_ai_enabled,
        maxTokens: settings.crew_ai_max_tokens
      },
      cacheStatus: {
        hasCache: this.settingsCache.has(`all_settings_${dealerId || 'global'}`),
        cacheSize: this.settingsCache.size
      }
    };
    
    return summary;
  }

  // Initialize settings manager
  async initialize() {
    console.log('🚀 Initializing Settings Manager...');
    
    // Pre-load global settings
    await this.getAllSettings();
    
    console.log('✅ Settings Manager initialized successfully');
  }
}

// Create singleton instance
const settingsManager = new SettingsManager();

export default settingsManager; 