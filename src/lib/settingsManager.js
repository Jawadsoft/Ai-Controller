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
      voice_elevenlabs_voice: 'liam', // Changed from 'jessica' to 'liam'
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
      tts_voice: 'liam', // Changed from 'jessica' to 'liam'
      tts_model: 'eleven_multilingual_v2', // Updated to multilingual model
      tts_stability: 0.5,
      tts_similarity_boost: 0.5
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

  // Get API keys
  async getAPIKeys(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return {
      openai: settings.openai_key,
      elevenlabs: settings.elevenlabs_key,
      deepgram: settings.deepgram_key,
      azure: settings.azure_speech_key
    };
  }

  // Get voice settings
  async getVoiceSettings(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return {
      // Core voice settings
      enabled: settings.voice_enabled,
      provider: settings.voice_provider,
      ttsProvider: settings.voice_tts_provider,
      speechProvider: settings.voice_speech_provider,
      
      // Voice selection (specific voices like jessica, alloy, etc.)
      elevenlabsVoice: settings.voice_elevenlabs_voice,
      openaiVoice: settings.voice_openai_voice,
      ttsVoice: settings.tts_voice,
      
      // Voice characteristics
      language: settings.voice_language,
      speed: settings.voice_speed,
      pitch: settings.voice_pitch,
      quality: settings.voice_quality,
      emotion: settings.voice_emotion,
      
      // Voice behavior
      autoResponse: settings.voice_auto_response,
      recordingQuality: settings.voice_recording_quality,
      realtimeEnabled: settings.voice_realtime_enabled,
      streamingEnabled: settings.voice_streaming_enabled,
      responseFormat: settings.voice_response_format,
      
      // TTS specific settings
      ttsModel: settings.tts_model,
      ttsStability: settings.tts_stability,
      ttsSimilarityBoost: settings.tts_similarity_boost
    };
  }

  // Get TTS settings
  async getTTSSettings(dealerId = null) {
    const settings = await this.getAllSettings(dealerId);
    return {
      // Provider settings
      provider: settings.voice_provider,
      ttsProvider: settings.voice_tts_provider,
      speechProvider: settings.voice_speech_provider,
      
      // Voice selection settings - FIXED: Properly map voice_elevenlabs_voice to elevenlabsVoice
      voice: settings.voice_elevenlabs_voice || settings.tts_voice,
      openaiVoice: settings.voice_openai_voice,
      elevenlabsVoice: settings.voice_elevenlabs_voice, // This should now work correctly
      
      // TTS model and quality settings
      model: settings.tts_model || 'eleven_multilingual_v2', // Updated to multilingual model
      stability: settings.tts_stability || 0.5,
      similarityBoost: settings.tts_similarity_boost || 0.5,
      
      // Voice quality and performance settings
      voiceQuality: settings.voice_quality,
      voiceSpeed: settings.voice_speed,
      voicePitch: settings.voice_pitch,
      voiceEmotion: settings.voice_emotion,
      
      // API keys
      apiKey: settings.elevenlabs_key, // For ElevenLabs TTS
      openaiKey: settings.openai_key, // For OpenAI TTS
      
      // Additional voice settings
      language: settings.voice_language,
      autoResponse: settings.voice_auto_response,
      recordingQuality: settings.voice_recording_quality,
      realtimeEnabled: settings.voice_realtime_enabled,
      streamingEnabled: settings.voice_streaming_enabled,
      responseFormat: settings.voice_response_format
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

  // Refresh settings for a specific dealer
  async refreshSettings(dealerId = null) {
    this.clearCache(dealerId);
    return await this.getAllSettings(dealerId);
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