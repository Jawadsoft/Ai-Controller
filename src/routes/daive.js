import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import DAIVEService from '../lib/daivecrewai.js';
import WhisperService from '../lib/whisper.js';
import DeepgramService from '../lib/deepgram-v3.js';
import DeepgramTTSService from '../lib/deepgram-tts.js';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../database/connection.js';
import { getElevenLabsVoiceId } from '../../elevenlabs-voices.js';



// Function to initialize DAIVE service with max tokens from database
let daiveService = null;

async function initializeDAIVEService(dealerId = null) {
  try {
    if (daiveService) {
      return daiveService;
    }
    
    let maxTokens = 100; // Default to 100 tokens
    
    // Try to load max tokens from database if dealer ID is provided
    if (dealerId) {
      try {
        const query = `
          SELECT max_tokens 
          FROM crew_ai_settings 
          WHERE dealer_id = $1
        `;
        const result = await pool.query(query, [dealerId]);
        
        if (result.rows.length > 0 && result.rows[0].max_tokens) {
          maxTokens = result.rows[0].max_tokens;
          console.log(`📋 Loaded max tokens from database: ${maxTokens} for dealer: ${dealerId}`);
        } else {
          console.log(`📋 No max tokens found in database for dealer: ${dealerId}, using default: ${maxTokens}`);
        }
      } catch (dbError) {
        console.log(`⚠️ Could not load max tokens from database for dealer: ${dealerId}, using default: ${maxTokens}`, dbError.message);
      }
    }
    
    // Create DAIVE service instance with loaded max tokens
    daiveService = new DAIVEService(maxTokens);
    console.log(`✅ DAIVE service initialized with max tokens: ${maxTokens}`);
    
    return daiveService;
  } catch (error) {
    console.error('❌ Error initializing DAIVE service:', error);
    // Fallback to default
    daiveService = new DAIVEService(100);
    return daiveService;
  }
}

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/daive-audio/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `daive-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files only
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Function to get or initialize DAIVE service for a specific dealer
async function getDAIVEServiceForDealer(dealerId) {
  try {
    // If we already have a service instance and it's for the same dealer, return it
    if (daiveService && daiveService.currentDealerId === dealerId) {
      return daiveService;
    }
    
    // Initialize new service for this dealer
    const service = await initializeDAIVEService(dealerId);
    service.currentDealerId = dealerId; // Track which dealer this service is for
    return service;
  } catch (error) {
    console.error('❌ Error getting DAIVE service for dealer:', error);
    // Fallback to default service
    return daiveService || new DAIVEService(100);
  }
}

// Initialize DAIVE service after all imports are loaded
setTimeout(() => {
  initializeDAIVEService('0aa94346-ed1d-420e-8823-bcd97bf6456f');
}, 100);

// Debug: Check what we imported
console.log('🔍 Imported DAIVEService:', typeof DAIVEService);
console.log('🔍 DAIVEService methods:', Object.getOwnPropertyNames(DAIVEService));
if (DAIVEService && typeof DAIVEService === 'function') {
  console.log('🔍 DAIVEService constructor available');
}

// Public routes (no authentication required for customer interactions)

// GET /api/daive/health - Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'D.A.I.V.E.',
    timestamp: new Date().toISOString() 
  });
});

// GET /api/daive/fast-inventory - Fast inventory endpoint (no AI processing)
router.get('/fast-inventory', async (req, res) => {
  try {
    const { dealerId, limit = 10, useCache = 'true' } = req.query;
    
    if (!dealerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dealer ID is required' 
      });
    }

    console.log('🚀 Fast inventory query for dealer:', dealerId);
    const startTime = Date.now();

    // Simple in-memory cache for inventory data
    const cacheKey = `inventory_${dealerId}_${limit}`;
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Check cache first if enabled
    if (useCache === 'true' && global.inventoryCache && global.inventoryCache[cacheKey]) {
      const cached = global.inventoryCache[cacheKey];
      if (Date.now() - cached.timestamp < cacheExpiry) {
        console.log(`✅ Serving inventory from cache (${Date.now() - cached.timestamp}ms old)`);
        return res.json({
          success: true,
          data: {
            ...cached.data,
            responseTime: '0ms (cached)',
            cached: true,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Direct database query - no AI processing
    const query = `
      SELECT 
        id, year, make, model, price, mileage, status, 
        features, dealer_id
      FROM vehicles 
      WHERE dealer_id = $1 
        AND status = 'available'
      ORDER BY year DESC, price DESC
      LIMIT $2
    `;

    // Use a dedicated connection for faster query execution
    const result = await pool.query(query, [dealerId, limit]);
    const vehicles = result.rows;
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log(`✅ Fast inventory query completed in ${responseTime}ms - Found ${vehicles.length} vehicles`);

    // Format response for frontend
    const formattedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      price: vehicle.price,
      mileage: vehicle.mileage,
      status: vehicle.status,
      imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=300&h=200&fit=crop&crop=center', // Default image
      features: vehicle.features
    }));

    const responseData = {
      vehicles: formattedVehicles,
      total: vehicles.length,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };

    // Cache the result
    if (useCache === 'true') {
      if (!global.inventoryCache) global.inventoryCache = {};
      global.inventoryCache[cacheKey] = {
        data: responseData,
        timestamp: Date.now()
      };
      console.log('💾 Inventory data cached for future requests');
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Fast inventory query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory',
      details: error.message
    });
  }
});

// POST /api/daive/clear-inventory-cache - Clear inventory cache
router.post('/clear-inventory-cache', async (req, res) => {
  try {
    const { dealerId } = req.body;
    
    if (dealerId && global.inventoryCache) {
      // Clear specific dealer cache
      Object.keys(global.inventoryCache).forEach(key => {
        if (key.includes(`inventory_${dealerId}`)) {
          delete global.inventoryCache[key];
          console.log(`🗑️ Cleared cache for dealer: ${dealerId}`);
        }
      });
    } else if (global.inventoryCache) {
      // Clear all cache
      global.inventoryCache = {};
      console.log('🗑️ Cleared all inventory cache');
    }

    res.json({
      success: true,
      message: 'Inventory cache cleared successfully'
    });

  } catch (error) {
    console.error('❌ Error clearing inventory cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear inventory cache'
    });
  }
});

// POST /api/daive/crew-ai - Process conversation with Crew AI
router.post('/crew-ai', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, sessionId, message, customerInfo } = req.body;

    console.log('🚀 Crew AI endpoint called with:', {
      vehicleId,
      sessionId,
      messageLength: message?.length || 0,
      customerInfo: customerInfo ? 'Provided' : 'Not provided'
    });

    if (!message) {
      console.log('❌ Validation failed: Message is required');
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    console.log('🚀 Processing conversation with Crew AI...');
    console.log('🔐 Authenticated user:', req.user.id, 'Role:', req.user.role);
    
    // Enhance customerInfo with authenticated user context
    const enhancedCustomerInfo = {
      ...customerInfo,
      userId: req.user.id,
      userRole: req.user.role,
      dealerId: customerInfo.dealerId || req.user.dealer_id
    };
    
    // Get dealer ID for this request
    let dealerId = enhancedCustomerInfo.dealerId;
    if (vehicleId && !dealerId) {
      const vehicleQuery = 'SELECT dealer_id FROM vehicles WHERE id = $1';
      const vehicleResult = await pool.query(vehicleQuery, [vehicleId]);
      if (vehicleResult.rows.length > 0) {
        dealerId = vehicleResult.rows[0].dealer_id;
      }
    }
    
    // Get DAIVE service with current dealer's max tokens
    const currentDAIVEService = await getDAIVEServiceForDealer(dealerId);
    
    const result = await currentDAIVEService.processConversationWithCrew(
      sessionId || currentDAIVEService.generateSessionId(),
      vehicleId,
      message,
      enhancedCustomerInfo
    );

    // Generate speech response if voice is enabled
    let audioResponseUrl = null;
    try {
      // Get dealer-specific voice settings
      const voiceQuery = `
        SELECT 
          vs.enabled,
          vs.tts_provider,
          vs.openai_voice,
          vs.elevenlabs_voice,
          vs.voice_quality
        FROM voice_settings vs
        WHERE vs.dealer_id = $1
      `;
      const voiceResult = await pool.query(voiceQuery, [dealerId]);
      
      if (voiceResult.rows.length > 0 && voiceResult.rows[0].enabled) {
        const voiceSettings = voiceResult.rows[0];
        console.log('🎵 Voice enabled for dealer, TTS handled by Crew AI service');
        
        // TTS generation is already handled by the Crew AI service
        // The audioResponseUrl will come from the Crew AI result
        audioResponseUrl = result.audioResponseUrl || null;
      }
    } catch (ttsError) {
      console.error('❌ Voice settings query failed:', ttsError);
      // Continue without TTS - not critical
    }

    // Return response with Crew AI details
    res.json({
      success: true,
      data: {
        response: result.response || result.aiResponse, // Use 'response' field for frontend compatibility
        message: result.response || result.aiResponse, // Keep 'message' for backward compatibility
        sessionId: result.sessionId || sessionId,
        crewUsed: result.crewUsed || false,
        crewType: result.crewType || 'N/A',
        intent: result.intent || 'UNKNOWN',
        leadScore: result.leadScore || 0,
        shouldHandoff: result.shouldHandoff || false,
        audioResponseUrl,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Crew AI processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process conversation with Crew AI',
      details: error.message
    });
  }
});

// POST /api/daive/crew-ai-settings - Save Crew AI settings
router.post('/crew-ai-settings', async (req, res) => {
  try {
    const { dealerId, ...settings } = req.body;
    
    console.log('⚙️ Saving Crew AI settings:', { dealerId, settings });

    // Save to database (you'll need to create this table)
    const query = `
      INSERT INTO crew_ai_settings (
        dealer_id, enabled, auto_routing, enable_sales_crew, 
        enable_customer_service_crew, enable_inventory_crew, 
        crew_collaboration, agent_memory, performance_tracking, 
        fallback_to_traditional, crew_selection, max_tokens, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT (dealer_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        auto_routing = EXCLUDED.auto_routing,
        enable_sales_crew = EXCLUDED.enable_sales_crew,
        enable_customer_service_crew = EXCLUDED.enable_customer_service_crew,
        enable_inventory_crew = EXCLUDED.enable_inventory_crew,
        crew_collaboration = EXCLUDED.crew_collaboration,
        agent_memory = EXCLUDED.agent_memory,
        performance_tracking = EXCLUDED.performance_tracking,
        fallback_to_traditional = EXCLUDED.fallback_to_traditional,
        crew_selection = EXCLUDED.crew_selection,
        max_tokens = EXCLUDED.max_tokens,
        updated_at = NOW()
    `;

    await pool.query(query, [
      dealerId || null,
      settings.enabled || false,
      settings.autoRouting || false,
      settings.enableSalesCrew || false,
      settings.enableCustomerServiceCrew || false,
      settings.enableInventoryCrew || false,
      settings.crewCollaboration || false,
      settings.agentMemory || false,
      settings.performanceTracking || false,
      settings.fallbackToTraditional || true,
      settings.crewSelection || 'auto',
      settings.maxTokens || 100
    ]);

    // Reinitialize DAIVE service with new max tokens if they changed
    if (settings.maxTokens && daiveService) {
      try {
        // Update the existing DAIVE service instance
        daiveService.updateCrewAISettings({ maxTokens: settings.maxTokens });
        console.log(`🔄 DAIVE service updated with new max tokens: ${settings.maxTokens}`);
      } catch (updateError) {
        console.log('⚠️ Could not update existing DAIVE service, will reinitialize on next request:', updateError.message);
        // Reset the service instance so it gets reinitialized
        daiveService = null;
      }
    }

    res.json({
      success: true,
      message: 'Crew AI settings saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving Crew AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save Crew AI settings',
      details: error.message
    });
  }
});

// GET /api/daive/crew-ai-settings - Get Crew AI settings
router.get('/crew-ai-settings', async (req, res) => {
  try {
    const { dealerId } = req.query;
    
    console.log('📋 Getting Crew AI settings for dealer:', dealerId);

    const query = `
      SELECT * FROM crew_ai_settings 
      WHERE dealer_id = $1 OR (dealer_id IS NULL AND $1 IS NULL)
      ORDER BY dealer_id NULLS LAST
      LIMIT 1
    `;

    const result = await pool.query(query, [dealerId || null]);
    
    if (result.rows.length > 0) {
      const settings = result.rows[0];
      res.json({
        success: true,
        data: {
          enabled: settings.enabled,
          autoRouting: settings.auto_routing,
          enableSalesCrew: settings.enable_sales_crew,
          enableCustomerServiceCrew: settings.enable_customer_service_crew,
          enableInventoryCrew: settings.enable_inventory_crew,
          crewCollaboration: settings.crew_collaboration,
          agentMemory: settings.agent_memory,
          performanceTracking: settings.performance_tracking,
          fallbackToTraditional: settings.fallback_to_traditional,
          crewSelection: settings.crew_selection,
          maxTokens: settings.max_tokens || 300
        }
      });
    } else {
      // Return default settings if none found
      res.json({
        success: true,
        data: {
          enabled: false,
          autoRouting: true,
          enableSalesCrew: true,
          enableCustomerServiceCrew: true,
          enableInventoryCrew: false,
          crewCollaboration: true,
          agentMemory: true,
          performanceTracking: true,
          fallbackToTraditional: true,
          crewSelection: 'auto',
          maxTokens: 100
        }
      });
    }

  } catch (error) {
    console.error('❌ Error getting Crew AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Crew AI settings',
      details: error.message
    });
  }
});

// POST /api/daive/chat - Process text conversation
router.post('/chat', async (req, res) => {
  try {
    const { vehicleId, sessionId, message, customerInfo, useCrewAI = false } = req.body;

    console.log('💬 Chat endpoint called with:', {
      vehicleId,
      sessionId,
      messageLength: message?.length || 0,
      customerInfo: customerInfo ? 'Provided' : 'Not provided',
      useCrewAI
    });

    // Input validation - vehicleId is optional for general dealership conversations
    if (!vehicleId) {
      console.log('ℹ️ No vehicle ID provided - starting general dealership conversation');
    }

    if (!message) {
      console.log('❌ Validation failed: Message is required');
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    console.log('🤖 Processing text conversation with AI...');
    
    // Always use Unified AI for consistent responses
    console.log('🚀 Using Unified AI for enhanced processing...');
            const result = await daiveService.processConversation(
          sessionId || daiveService.generateSessionId(),
          vehicleId,
          message,
          customerInfo || {}
        );

    // Generate speech response if voice is enabled (dealer-specific with global fallback)
    let audioResponseUrl = null;
    try {
      // Get dealer ID from vehicle if not provided directly
      let dealerId = null;
      if (vehicleId) {
        const vehicleQuery = 'SELECT dealer_id FROM vehicles WHERE id = $1';
        const vehicleResult = await pool.query(vehicleQuery, [vehicleId]);
        if (vehicleResult.rows.length > 0) {
          dealerId = vehicleResult.rows[0].dealer_id;
        }
      }

      // Check if voice is enabled (dealer-specific with global fallback)
      const voiceQuery = `
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
      `;
      const voiceResult = await pool.query(voiceQuery, [dealerId]);
      const voiceEnabled = voiceResult.rows.length > 0 && voiceResult.rows[0].setting_value === 'true';
        
      if (voiceEnabled) {
        console.log('🔊 Voice response enabled, generating speech...');
        
        // Get TTS provider setting (dealer-specific with global fallback)
        let ttsProvider = 'elevenlabs'; // Default to ElevenLabs
        const ttsProviderQuery = `
          WITH dealer_setting AS (
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
          LIMIT 1
        `;
        const ttsProviderResult = await pool.query(ttsProviderQuery, [dealerId]);
        if (ttsProviderResult.rows.length > 0) {
          ttsProvider = ttsProviderResult.rows[0].setting_value;
          console.log('🎤 Using TTS provider:', ttsProvider);
        }

        // Get voice provider setting (global for all dealers)
        let voiceProvider = 'elevenlabs'; // Default to ElevenLabs
        const voiceProviderQuery = `
          WITH dealer_setting AS (
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
          LIMIT 1
        `;
        const voiceProviderResult = await pool.query(voiceProviderQuery, [dealerId]);
        if (voiceProviderResult.rows.length > 0) {
          voiceProvider = voiceProviderResult.rows[0].setting_value;
          console.log('🎤 Using voice provider:', voiceProvider);
        }

        // Determine which provider to use
        const providerToUse = ttsProvider !== 'default' ? ttsProvider : voiceProvider;
        console.log('🎤 Final provider to use:', providerToUse);

        if (providerToUse === 'deepgram') {
          // Use Deepgram TTS (global for all dealers)
          console.log('🎤 Using Deepgram TTS...');
          const deepgramQuery = `
            WITH dealer_setting AS (
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
            LIMIT 1
          `;
          const deepgramResult = await pool.query(deepgramQuery, [dealerId]);
          
          if (deepgramResult.rows.length > 0) {
            const deepgramKey = deepgramResult.rows[0].setting_value;
            
            // Generate speech using Deepgram TTS
            const speechResponse = await fetch('https://api.deepgram.com/v1/speak', {
              method: 'POST',
              headers: {
                'Authorization': `Token ${deepgramKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: result.response
              })
            });
            
            if (speechResponse.ok) {
              const audioBuffer = await speechResponse.arrayBuffer();
              const audioFileName = `response-${Date.now()}.mp3`;
              const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
              
              // Save the audio file
              fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
              
              audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              console.log('✅ Deepgram TTS speech response generated successfully');
            } else {
              const errorText = await speechResponse.text();
              console.error('❌ Deepgram TTS failed:', speechResponse.status, errorText);
            }
          } else {
            console.log('⚠️ No Deepgram API key found for TTS');
          }
        } else if (providerToUse === 'openai') {
          // Use OpenAI TTS (global for all dealers)
          console.log('🎤 Using OpenAI TTS...');
          const openaiQuery = `
            WITH dealer_setting AS (
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
            LIMIT 1
          `;
          const openaiResult = await pool.query(openaiQuery, [dealerId]);
          
          if (openaiResult.rows.length > 0) {
            const openaiKey = openaiResult.rows[0].setting_value;
            
            // Get OpenAI voice setting
            let openaiVoice = 'liam'; // Default voice (changed from alloy to liam)
            const voiceQuery = `
              WITH dealer_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id = $1 AND setting_type = 'voice_openai_voice'
              ),
              global_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id IS NULL AND setting_type = 'voice_openai_voice'
              )
              SELECT setting_value FROM dealer_setting
              UNION ALL
              SELECT setting_value FROM global_setting
              WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
              LIMIT 1
            `;
            const voiceResult = await pool.query(voiceQuery, [dealerId]);
            if (voiceResult.rows.length > 0) {
              openaiVoice = voiceResult.rows[0].setting_value;
              console.log('🎤 Using OpenAI voice:', openaiVoice);
            }
            
            // Generate speech using OpenAI TTS
            const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'tts-1-hd',
                input: result.response,
                voice: openaiVoice,
                response_format: 'mp3',
                speed: 1.0
              })
            });
            
            if (speechResponse.ok) {
              const audioBuffer = await speechResponse.arrayBuffer();
              const audioFileName = `response-${Date.now()}.mp3`;
              const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
              
              // Save the audio file
              fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
              
              audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              console.log('✅ OpenAI TTS speech response generated successfully');
            } else {
              const errorText = await speechResponse.text();
              console.error('❌ OpenAI TTS failed:', speechResponse.status, errorText);
            }
          } else {
            console.log('⚠️ No OpenAI API key found for TTS');
          }
        } else if (providerToUse === 'elevenlabs') {
          // Use ElevenLabs TTS (default, global for all dealers)
          console.log('🎤 Using ElevenLabs TTS...');
          const elevenLabsQuery = `
            WITH dealer_setting AS (
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
            LIMIT 1
          `;
          const elevenLabsResult = await pool.query(elevenLabsQuery, [dealerId]);
          
          if (elevenLabsResult.rows.length > 0) {
            const elevenLabsKey = elevenLabsResult.rows[0].setting_value;
            
            // Get selected ElevenLabs voice
            const voiceQuery = `
              WITH dealer_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id = $1 AND setting_type = 'voice_elevenlabs_voice'
              ),
              global_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id IS NULL AND setting_type = 'voice_elevenlabs_voice'
              )
              SELECT setting_value FROM dealer_setting
              UNION ALL
              SELECT setting_value FROM global_setting
              WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
              LIMIT 1
            `;
            const voiceResult = await pool.query(voiceQuery, [dealerId]);
            const selectedVoice = voiceResult.rows.length > 0 ? voiceResult.rows[0].setting_value : 'Liam';
            
            // Generate speech using ElevenLabs with selected voice
            const voiceId = getElevenLabsVoiceId(selectedVoice);
            console.log(`🎤 Using ElevenLabs voice: ${selectedVoice} (ID: ${voiceId})`);
            const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: result.response,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.5
                }
              })
            });
            
            if (speechResponse.ok) {
              const audioBlob = await speechResponse.blob();
              const audioFileName = `response-${Date.now()}.mp3`;
              const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
              
              // Save the audio file
              const buffer = await audioBlob.arrayBuffer();
              fs.writeFileSync(audioPath, Buffer.from(buffer));
              
              audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              console.log('✅ ElevenLabs speech response generated successfully');
            }
          }
        } else {
          console.log('⚠️ Unsupported voice provider:', providerToUse);
        }
      }
    } catch (ttsError) {
      console.error('❌ Text-to-speech error:', ttsError);
      // Continue without audio response
    }

    console.log('✅ Chat processing completed successfully');
    
                    // Structure the response to match frontend expectations
                const responseData = {
                  success: true,
                  data: {
                    response: result.response || result.data?.response || result.message, // The AI response content
                    crewUsed: result.crewUsed || false, // Use actual CrewAI status
                    crewType: result.crewType || 'AI Assistant',
                    intent: result.intent || 'UNKNOWN',
                    leadScore: result.leadScore || 0,
                    shouldHandoff: result.shouldHandoff || false,
                    audioResponseUrl: audioResponseUrl,
                    message: message, // Use the original user message
                    sessionId: result.sessionId || sessionId,
                    timestamp: new Date().toISOString()
                  }
                };
    
    console.log('📤 Sending response:', {
      success: responseData.success,
      hasResponse: !!responseData.data.response,
      responseLength: responseData.data.response?.length || 0,
      leadScore: responseData.data.leadScore,
      shouldHandoff: responseData.data.shouldHandoff
    });
    
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error in chat endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process conversation' 
    });
  }
});

// POST /api/daive/voice - Process voice conversation
router.post('/voice', upload.single('audio'), async (req, res) => {
  try {
    const { vehicleId, sessionId, customerInfo } = req.body;
    const audioFile = req.file;

    // Enhanced logging for debugging
    console.log('🎤 Voice endpoint called with:', {
      vehicleId,
      sessionId,
      hasAudioFile: !!audioFile,
      audioFileName: audioFile?.filename,
      audioSize: audioFile ? `${(audioFile.size / 1024).toFixed(2)} KB` : 'N/A',
      customerInfo: customerInfo ? 'Provided' : 'Not provided'
    });

    // Input validation - vehicleId is optional for general dealership conversations
    if (!vehicleId) {
      console.log('ℹ️ No vehicle ID provided - starting general dealership conversation');
    }
    
    if (!audioFile) {
      console.log('❌ Validation failed: Audio file is required');
      return res.status(400).json({ 
        success: false,
        error: 'Audio file is required' 
      });
    }

    // Validate audio file size and type
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (audioFile.size > maxSize) {
      console.log('❌ Validation failed: Audio file too large');
      return res.status(400).json({ 
        success: false,
        error: 'Audio file too large (max 10MB)' 
      });
    }

    if (!audioFile.mimetype.startsWith('audio/')) {
      console.log('❌ Validation failed: Invalid file type');
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only audio files are allowed.' 
      });
    }

    const audioFileUrl = `/uploads/daive-audio/${audioFile.filename}`;
    
    // Speech-to-Text using OpenAI Whisper API or Deepgram
    let transcription = "";
    let dealerId = null;
    let openaiKey = null;
    let deepgramKey = null;
    let voiceProvider = 'whisper'; // Default to Whisper
    
    try {
      console.log('🔄 Starting speech-to-text processing...');
      
      // Get dealer ID from customer info or vehicle
      if (customerInfo) {
        try {
          const customerInfoObj = JSON.parse(customerInfo);
          dealerId = customerInfoObj.dealerId;
          console.log('📋 Dealer ID from customer info:', dealerId);
        } catch (e) {
          console.log('⚠️ Could not parse customer info for dealer ID');
        }
      }
      
      // If no dealer ID in customer info, get it from the vehicle
      if (!dealerId) {
        console.log('🔍 Looking up dealer ID from vehicle...');
        const vehicleQuery = `
          SELECT dealer_id FROM vehicles WHERE id = $1
        `;
        const vehicleResult = await pool.query(vehicleQuery, [vehicleId]);
        if (vehicleResult.rows.length > 0) {
          dealerId = vehicleResult.rows[0].dealer_id;
          console.log('✅ Found dealer ID from vehicle:', dealerId);
        } else {
          console.log('❌ Vehicle not found in database');
          return res.status(404).json({ 
            success: false,
            error: 'Vehicle not found' 
          });
        }
      }
      
      // Get speech provider preference (global for all dealers)
      const speechProviderQuery = `
        SELECT setting_value
        FROM daive_api_settings
        WHERE setting_type = 'voice_speech_provider'
        LIMIT 1
      `;
      const speechProviderResult = await pool.query(speechProviderQuery);
      if (speechProviderResult.rows.length > 0) {
        voiceProvider = speechProviderResult.rows[0].setting_value;
        console.log('🎤 Using speech provider:', voiceProvider);
      }
      
      // Get API keys based on provider (global for all dealers)
      if (voiceProvider === 'deepgram') {
        // Get Deepgram API key
        console.log('🔑 Looking up Deepgram API key...');
        const deepgramQuery = `
          SELECT setting_value
          FROM daive_api_settings
          WHERE setting_type = 'deepgram_key'
          LIMIT 1
        `;
        const deepgramResult = await pool.query(deepgramQuery);
        if (deepgramResult.rows.length > 0) {
          deepgramKey = deepgramResult.rows[0].setting_value;
          console.log('✅ Found Deepgram API key');
        } else {
          console.log('⚠️ No Deepgram API key found');
        }
      } else {
        // Get OpenAI API key for Whisper
        console.log('🔑 Looking up OpenAI API key...');
        const apiQuery = `
          SELECT setting_value
          FROM daive_api_settings
          WHERE setting_type = 'openai_key'
          LIMIT 1
        `;
        const apiResult = await pool.query(apiQuery);
        if (apiResult.rows.length > 0) {
          openaiKey = apiResult.rows[0].setting_value;
          console.log('✅ Found OpenAI API key');
        } else {
          console.log('⚠️ No OpenAI API key found');
        }
      }
      
      // Fallback to environment variables
      if (!deepgramKey && voiceProvider === 'deepgram') {
        deepgramKey = process.env.DEEPGRAM_API_KEY;
        console.log('🔧 Using environment variable for Deepgram API key');
      }
      
      if (!openaiKey && voiceProvider === 'whisper') {
        openaiKey = process.env.OPENAI_API_KEY;
        console.log('🔧 Using environment variable for OpenAI API key');
      }
      
      // Process transcription based on provider
      if (voiceProvider === 'deepgram' && deepgramKey) {
        try {
          console.log('🎯 Using DeepgramService for transcription...');
          const deepgramService = new DeepgramService(deepgramKey);
          
          // Get voice settings for language preference (global for all dealers)
          let language = 'en';
          const languageQuery = `
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'voice_language'
            LIMIT 1
          `;
          const languageResult = await pool.query(languageQuery);
          if (languageResult.rows.length > 0) {
            language = languageResult.rows[0].setting_value.split('-')[0];
            console.log('🌍 Using language setting:', language);
          }
          
          const deepgramResult = await deepgramService.transcribeAudioWithOptions(audioFile.path, {
            language: language,
            model: 'nova-2',
            diarize: false
          });
          
          if (deepgramResult.success) {
            transcription = deepgramResult.text;
            console.log('✅ Deepgram transcription successful:', transcription);
          } else {
            console.error('❌ Deepgram transcription failed:', deepgramResult.error);
            transcription = "Sorry, I couldn't understand your voice. Please try again.";
          }
        } catch (deepgramError) {
          console.error('❌ Deepgram API error:', deepgramError);
          transcription = "Sorry, I couldn't process your voice. Please try typing your question.";
        }
      } else if (voiceProvider === 'whisper' && openaiKey) {
        try {
          console.log('🎯 Using WhisperService for transcription...');
          const whisperService = new WhisperService(openaiKey);
          
          // Get voice settings for language preference (global for all dealers)
          let language = 'en';
          const languageQuery = `
            SELECT setting_value
            FROM daive_api_settings
            WHERE dealer_id IS NULL AND setting_type = 'voice_language'
            LIMIT 1
          `;
          const languageResult = await pool.query(languageQuery);
          if (languageResult.rows.length > 0) {
            language = languageResult.rows[0].setting_value.split('-')[0];
            console.log('🌍 Using language setting:', language);
          }
          
          const whisperResult = await whisperService.transcribeAudioWithOptions(audioFile.path, {
            language: language,
            model: 'whisper-1',
            temperature: 0.0
          });
          
          if (whisperResult.success) {
            transcription = whisperResult.text;
            console.log('✅ Whisper transcription successful:', transcription);
          } else {
            console.error('❌ Whisper transcription failed:', whisperResult.error);
            transcription = "Sorry, I couldn't understand your voice. Please try again.";
          }
        } catch (whisperError) {
          console.error('❌ Whisper API error:', whisperError);
          transcription = "Sorry, I couldn't process your voice. Please try typing your question.";
        }
      } else {
        console.log('❌ No API key available for voice provider:', voiceProvider);
        transcription = "Voice recognition is not configured. Please contact the dealer.";
      }
    } catch (sttError) {
      console.error('❌ Speech-to-text error:', sttError);
      transcription = "Sorry, I couldn't process your voice. Please try typing your question.";
    }
    
    // Process with AI - Use Crew AI for enhanced inventory access
    console.log('🤖 Processing conversation with Crew AI for enhanced inventory access...');
    
    // Check if Crew AI is available and enabled
    let result;
    try {
      // Try Crew AI first for enhanced inventory features
      console.log('🚀 Using Crew AI for voice conversation with enhanced inventory access...');
      result = await daiveService.processConversationWithCrew(
        sessionId || daiveService.generateSessionId(),
        vehicleId,
        transcription,
        customerInfo ? JSON.parse(customerInfo) : {}
      );
      console.log('✅ Crew AI processing successful');
      console.log('🚀 Crew AI response includes enhanced inventory features');
      
      // Crew AI processing completed successfully
    } catch (crewError) {
      console.log('⚠️ Crew AI failed, falling back to unified AI:', crewError.message);
      // Fallback to unified AI if Crew AI fails
      result = await daiveService.processConversation(
        sessionId || daiveService.generateSessionId(),
        vehicleId,
        transcription,
        customerInfo ? JSON.parse(customerInfo) : {}
      );
    }

    // Generate speech response if voice is enabled (global for all dealers)
    let audioResponseUrl = null;
    try {
      const voiceQuery = `
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
      `;
      const voiceResult = await pool.query(voiceQuery, [dealerId]);
      const voiceEnabled = voiceResult.rows.length > 0 && voiceResult.rows[0].setting_value === 'true';
        
      if (voiceEnabled) {
        console.log('🔊 Voice response enabled, generating speech...');
        
        // Get TTS provider setting (dealer-specific with global fallback)
        let ttsProvider = 'elevenlabs'; // Default to ElevenLabs
        const ttsProviderQuery = `
          WITH dealer_setting AS (
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
          LIMIT 1
        `;
        const ttsProviderResult = await pool.query(ttsProviderQuery, [dealerId]);
        if (ttsProviderResult.rows.length > 0) {
          ttsProvider = ttsProviderResult.rows[0].setting_value;
          console.log('🎤 Using TTS provider:', ttsProvider);
        }

        // Get voice provider setting (global for all dealers)
        let voiceProvider = 'elevenlabs'; // Default to ElevenLabs
        const voiceProviderQuery = `
          WITH dealer_setting AS (
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
          LIMIT 1
        `;
        const voiceProviderResult = await pool.query(voiceProviderQuery, [dealerId]);
        if (voiceProviderResult.rows.length > 0) {
          voiceProvider = voiceProviderResult.rows[0].setting_value;
          console.log('🎤 Using voice provider:', voiceProvider);
        }

        // Determine which provider to use (prioritize TTS provider if set)
        const providerToUse = ttsProvider !== 'elevenlabs' ? ttsProvider : voiceProvider;
        console.log('🎤 Final provider to use:', providerToUse);
        
        if (providerToUse === 'deepgram') {
          // Use Deepgram TTS (global for all dealers)
          console.log('🎤 Using Deepgram TTS...');
          const deepgramQuery = `
            WITH dealer_setting AS (
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
            LIMIT 1
          `;
          const deepgramResult = await pool.query(deepgramQuery, [dealerId]);
          
          if (deepgramResult.rows.length > 0) {
            const deepgramKey = deepgramResult.rows[0].setting_value;
            const deepgramTTS = new DeepgramTTSService(deepgramKey);
            
            // Get voice settings for Deepgram
            let voiceSettings = {
              model: 'aura-asteria',
              voice: 'asteria',
              encoding: 'mp3',
              container: 'mp3',
              sample_rate: 24000
            };
            
            // Get voice speed and pitch settings (global for all dealers)
            const speedQuery = `
              SELECT setting_value
              FROM daive_api_settings
              WHERE dealer_id IS NULL AND setting_type = 'voice_speed'
              LIMIT 1
            `;
            const speedResult = await pool.query(speedQuery);
            if (speedResult.rows.length > 0) {
              const speed = parseFloat(speedResult.rows[0].setting_value);
              // Deepgram doesn't have direct speed control, but we can adjust other parameters
              console.log('⚡ Voice speed setting:', speed);
            }
            
            const ttsResult = await deepgramTTS.synthesizeSpeech(result.response, voiceSettings);
            
            if (ttsResult.success) {
              const audioFileName = `response-${Date.now()}.mp3`;
              const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
              
              // Save the audio file
              fs.writeFileSync(audioPath, ttsResult.audioBuffer);
              
              audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              console.log('✅ Deepgram TTS speech response generated successfully');
            } else {
              console.error('❌ Deepgram TTS failed:', ttsResult.error);
            }
          } else {
            console.log('⚠️ No Deepgram API key found for TTS');
          }
        } else if (providerToUse === 'openai') {
          // Use OpenAI TTS (global for all dealers)
          console.log('🎤 Using OpenAI TTS...');
          const openaiQuery = `
            WITH dealer_setting AS (
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
            LIMIT 1
          `;
          const openaiResult = await pool.query(openaiQuery, [dealerId]);
          
          if (openaiResult.rows.length > 0) {
            const openaiKey = openaiResult.rows[0].setting_value;
            
            // Get OpenAI voice setting
            let openaiVoice = 'liam'; // Default voice (changed from alloy to liam)
            const voiceQuery = `
              WITH dealer_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id = $1 AND setting_type = 'voice_openai_voice'
              ),
              global_setting AS (
                SELECT setting_value FROM daive_api_settings 
                WHERE dealer_id IS NULL AND setting_type = 'voice_openai_voice'
              )
              SELECT setting_value FROM dealer_setting
              UNION ALL
              SELECT setting_value FROM global_setting
              WHERE NOT EXISTS (SELECT 1 FROM dealer_setting)
              LIMIT 1
            `;
            const voiceResult = await pool.query(voiceQuery, [dealerId]);
            if (voiceResult.rows.length > 0) {
              openaiVoice = voiceResult.rows[0].setting_value;
              console.log('🎤 Using OpenAI voice:', openaiVoice);
            }
            
            // Generate speech using OpenAI TTS
            const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'tts-1-hd',
                input: result.response,
                voice: openaiVoice,
                response_format: 'mp3',
                speed: 1.0
              })
            });
            
            if (speechResponse.ok) {
              const audioBuffer = await speechResponse.arrayBuffer();
              const audioFileName = `response-${Date.now()}.mp3`;
              const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
              
              // Save the audio file
              fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
              
              audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              console.log('✅ OpenAI TTS speech response generated successfully');
            } else {
              const errorText = await speechResponse.text();
              console.error('❌ OpenAI TTS failed:', speechResponse.status, errorText);
            }
          } else {
            console.log('⚠️ No OpenAI API key found for TTS');
          }
        } else if (providerToUse === 'elevenlabs') {
          // Use ElevenLabs TTS (default, global for all dealers)
          console.log('🎤 Using ElevenLabs TTS...');
          const elevenLabsQuery = `
            WITH dealer_setting AS (
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
            LIMIT 1
          `;
          const elevenLabsResult = await pool.query(elevenLabsQuery, [dealerId]);
          
          if (elevenLabsResult.rows.length > 0) {
            const elevenLabsKey = elevenLabsResult.rows[0].setting_value;
            
            // Generate speech using ElevenLabs
            const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
            const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'xi-api-key': elevenLabsKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: result.response,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.5
                }
              })
            });
            
            if (speechResponse.ok) {
              const audioBlob = await speechResponse.blob();
              const audioFileName = `response-${Date.now()}.mp3`;
              const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
              
              // Save the audio file
              const buffer = await audioBlob.arrayBuffer();
              fs.writeFileSync(audioPath, Buffer.from(buffer));
              
              audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
              console.log('✅ ElevenLabs speech response generated successfully');
            }
          }
        } else {
          console.log('⚠️ Unsupported voice provider:', providerToUse);
        }
      }
    } catch (ttsError) {
      console.error('❌ Text-to-speech error:', ttsError);
      // Continue without audio response
    }

    // Save voice session
    if (result.conversationId) {
      console.log('💾 Saving voice session...');
      await daiveService.saveVoiceSession(
        result.conversationId,
        audioFileUrl,
        transcription,
        result.response,
        audioResponseUrl
      );
    }

    console.log('✅ Voice processing completed successfully');
    res.json({
      success: true,
      data: {
        ...result,
        transcription,
        audioResponseUrl
      }
    });

  } catch (error) {
    console.error('❌ Error in voice endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process voice conversation' 
    });
  }
});

// POST /api/daive/gpt4o-voice - GPT-4o Real-time Voice Conversation
router.post('/gpt4o-voice', upload.single('audio'), async (req, res) => {
  try {
    const { vehicleId, sessionId, customerInfo } = req.body;
    const audioFile = req.file;

    console.log('🚀 GPT-4o Voice endpoint called with:', {
      vehicleId,
      sessionId,
      hasAudioFile: !!audioFile,
      audioFileName: audioFile?.filename,
      audioSize: audioFile ? `${(audioFile.size / 1024).toFixed(2)} KB` : 'N/A',
      customerInfo: customerInfo ? 'Provided' : 'Not provided'
    });

    if (!audioFile) {
      return res.status(400).json({ 
        success: false,
        error: 'Audio file is required' 
      });
    }

    // Validate audio file size and type
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (audioFile.size > maxSize) {
      return res.status(400).json({ 
        success: false,
        error: 'Audio file too large (max 10MB)' 
      });
    }

    if (!audioFile.mimetype.startsWith('audio/')) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only audio files are allowed.' 
      });
    }

    // Get vehicle context if vehicleId is provided
    let vehicleContext = null;
    if (vehicleId) {
      const vehicleQuery = `
        SELECT v.*, d.business_name, d.contact_name, d.phone, d.address, d.city, d.state
        FROM vehicles v
        LEFT JOIN dealers d ON v.dealer_id = d.id
        WHERE v.id = $1
      `;
      const vehicleResult = await pool.query(vehicleQuery, [vehicleId]);
      if (vehicleResult.rows.length > 0) {
        vehicleContext = vehicleResult.rows[0];
      }
    }

    // Get dealer context
    let dealerContext = null;
    const dealerId = customerInfo ? JSON.parse(customerInfo).dealerId : null;
    if (dealerId) {
      const dealerQuery = `
        SELECT business_name, contact_name, phone, address, city, state
        FROM dealers
        WHERE id = $1
      `;
      const dealerResult = await pool.query(dealerQuery, [dealerId]);
      if (dealerResult.rows.length > 0) {
        dealerContext = dealerResult.rows[0];
      }
    }

    // Initialize GPT-4o Voice Service
    const GPT4oVoiceService = (await import('../lib/gpt4o-voice.js')).default;
    const gpt4oVoiceService = new GPT4oVoiceService();

    // Process with GPT-4o
    const conversationContext = {
      vehicleInfo: vehicleContext,
      dealerInfo: dealerContext
    };

    const result = await gpt4oVoiceService.realtimeVoiceConversation(
      audioFile.buffer,
      conversationContext
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to process GPT-4o voice conversation'
      });
    }

    // Save audio response if generated
    let audioResponseUrl = null;
    if (result.audioResponse) {
      const audioFileName = `gpt4o-response-${Date.now()}.mp3`;
      const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
      
      // Save the audio file
      fs.writeFileSync(audioPath, result.audioResponse);
      
      audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
      console.log('✅ GPT-4o audio response saved');
    }

    console.log('✅ GPT-4o voice processing completed successfully');
    res.json({
      success: true,
      data: {
        transcription: result.transcription,
        response: result.response,
        audioResponseUrl,
        model: 'gpt-4o',
        conversationId: sessionId
      }
    });

  } catch (error) {
    console.error('❌ Error in GPT-4o voice endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process GPT-4o voice conversation' 
    });
  }
});

// GET /api/daive/conversation/:sessionId - Get conversation history
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await daiveService.getConversationHistory(sessionId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Protected routes (authentication required for dealer/admin access)

// GET /api/daive/analytics - Get dealer analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const analytics = await daiveService.getAnalytics(
      dealerId,
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0]
    );

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// GET /api/daive/conversations - Get all conversations for dealer
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { page = 1, limit = 20, status } = req.query;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    let query = `
      SELECT dc.*, v.make, v.model, v.year, v.vin
      FROM daive_conversations dc
      JOIN vehicles v ON dc.vehicle_id = v.id
      WHERE dc.dealer_id = $1
    `;
    
    const params = [dealerId];
    let paramIndex = 2;

    if (status) {
      query += ` AND dc.lead_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY dc.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM daive_conversations dc
      WHERE dc.dealer_id = $1
    `;
    
    const countParams = [dealerId];
    if (status) {
      countQuery += ` AND dc.lead_status = $2`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        conversations: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// GET /api/daive/conversation/:id/details - Get detailed conversation
router.get('/conversation/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const query = `
      SELECT dc.*, v.make, v.model, v.year, v.vin, v.price, v.features
      FROM daive_conversations dc
      JOIN vehicles v ON dc.vehicle_id = v.id
      WHERE dc.id = $1 AND dc.dealer_id = $2
    `;

    const result = await pool.query(query, [id, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get voice sessions for this conversation
    const voiceSessionsQuery = `
      SELECT * FROM daive_voice_sessions
      WHERE conversation_id = $1
      ORDER BY created_at
    `;

    const voiceSessions = await pool.query(voiceSessionsQuery, [id]);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        voiceSessions: voiceSessions.rows
      }
    });

  } catch (error) {
    console.error('Error getting conversation details:', error);
    res.status(500).json({ error: 'Failed to get conversation details' });
  }
});

// POST /api/daive/handoff/:conversationId - Accept handoff
router.post('/handoff/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Update conversation with handoff user
    const query = `
      UPDATE daive_conversations 
      SET handoff_to_user_id = $1, updated_at = NOW()
      WHERE id = $2 AND dealer_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [userId, conversationId, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error accepting handoff:', error);
    res.status(500).json({ error: 'Failed to accept handoff' });
  }
});

// POST /api/daive/prompts - Create/update dealer prompts
router.post('/prompts', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { promptType, promptText } = req.body;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!promptType || !promptText) {
      return res.status(400).json({ error: 'Prompt type and text are required' });
    }

    // Upsert prompt
    const query = `
      INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
      VALUES ($1, $2, $3)
      ON CONFLICT (dealer_id, prompt_type) 
      DO UPDATE SET prompt_text = $3, updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [dealerId, promptType, promptText]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// GET /api/daive/prompts - Get dealer prompts
router.get('/prompts', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const query = `
      SELECT prompt_type, prompt_text, is_active
      FROM daive_prompts
      WHERE dealer_id = $1 OR dealer_id IS NULL
      ORDER BY CASE WHEN dealer_id = $1 THEN 0 ELSE 1 END, dealer_id DESC
    `;

    const result = await pool.query(query, [dealerId]);

    const prompts = {};
    result.rows.forEach(row => {
      prompts[row.prompt_type] = {
        text: row.prompt_text,
        isActive: row.is_active
      };
    });

    res.json({
      success: true,
      data: prompts
    });

  } catch (error) {
    console.error('Error getting prompts:', error);
    res.status(500).json({ error: 'Failed to get prompts' });
  }
});

// POST /api/daive/api-settings - Save API settings (dealer-specific)
router.post('/api-settings', authenticateToken, async (req, res) => {
  try {
    const { settingType, settingValue } = req.body;
    const dealerId = req.user.dealer_id;

    if (!settingType) {
      return res.status(400).json({ error: 'Setting type is required' });
    }

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Validate setting type
    const validSettingTypes = ['openai_key', 'elevenlabs_key', 'azure_speech_key', 'deepgram_key', 'voice_provider', 'voice_speech_provider', 'voice_tts_provider', 'openai_tts', 'dealer_id'];
    if (!validSettingTypes.includes(settingType)) {
      return res.status(400).json({ error: 'Invalid setting type' });
    }

    // Upsert dealer-specific API setting
    const query = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = $3, updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [dealerId, settingType, settingValue]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error saving API setting:', error);
    res.status(500).json({ error: 'Failed to save API setting' });
  }
});

// GET /api/daive/api-settings - Get API settings (dealer-specific with global fallback)
router.get('/api-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get dealer-specific settings with global fallback
    const query = `
      WITH dealer_settings AS (
        SELECT setting_type, setting_value, is_active, 'dealer' as source
        FROM daive_api_settings 
        WHERE dealer_id = $1
      ),
      global_settings AS (
        SELECT setting_type, setting_value, is_active, 'global' as source
        FROM daive_api_settings 
        WHERE dealer_id IS NULL
      )
      SELECT setting_type, setting_value, is_active, source
      FROM dealer_settings
      UNION ALL
      SELECT setting_type, setting_value, is_active, source
      FROM global_settings
      WHERE setting_type NOT IN (SELECT setting_type FROM dealer_settings)
      ORDER BY setting_type
    `;

    const result = await pool.query(query, [dealerId]);

    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_type] = {
        value: row.setting_value,
        isActive: row.is_active,
        source: row.source
      };
    });

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Error getting API settings:', error);
    res.status(500).json({ error: 'Failed to get API settings' });
  }
});

// DELETE /api/daive/api-settings/:settingType - Delete API setting (dealer-specific)
router.delete('/api-settings/:settingType', authenticateToken, async (req, res) => {
  try {
    const { settingType } = req.params;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const query = `
      DELETE FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = $2
      RETURNING *
    `;

    const result = await pool.query(query, [dealerId, settingType]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({
      success: true,
      message: 'API setting deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting API setting:', error);
    res.status(500).json({ error: 'Failed to delete API setting' });
  }
});

// POST /api/daive/test-api - Test API connection
router.post('/test-api', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { apiType } = req.body;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get the API key for testing
    const query = `
      SELECT setting_value
      FROM daive_api_settings
      WHERE dealer_id = $1 AND setting_type = $2
    `;

    const result = await pool.query(query, [dealerId, `${apiType}_key`]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'API key not found' });
    }

    const apiKey = result.rows[0].setting_value;

    // Test the API based on type
    let testResult = { success: false, message: '' };

    switch (apiType) {
      case 'openai':
        // Test OpenAI API
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            testResult = { success: true, message: 'OpenAI API connection successful' };
          } else {
            testResult = { success: false, message: 'OpenAI API connection failed' };
          }
        } catch (error) {
          testResult = { success: false, message: 'OpenAI API connection error' };
        }
        break;

      case 'openai_tts':
        // Test OpenAI TTS API
        try {
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'tts-1-hd',
              input: 'Hello, this is a test of OpenAI TTS.',
              voice: 'liam', // Changed from alloy to liam
              response_format: 'mp3',
              speed: 1.0
            })
          });
          
          if (response.ok) {
            testResult = { success: true, message: 'OpenAI TTS API connection successful' };
          } else {
            const errorText = await response.text();
            testResult = { success: false, message: `OpenAI TTS API connection failed: ${errorText}` };
          }
        } catch (error) {
          testResult = { success: false, message: 'OpenAI TTS API connection error' };
        }
        break;

      case 'elevenlabs':
        // Test ElevenLabs API
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            testResult = { success: true, message: 'ElevenLabs API connection successful' };
          } else {
            testResult = { success: false, message: 'ElevenLabs API connection failed' };
          }
        } catch (error) {
          testResult = { success: false, message: 'ElevenLabs API connection error' };
        }
        break;

      case 'deepgram_tts':
        // Test Deepgram TTS API
        try {
          const deepgramTTS = new DeepgramTTSService(apiKey);
          const testResult = await deepgramTTS.testConnection();
          
          if (testResult.success) {
            testResult = { success: true, message: 'Deepgram TTS API connection successful' };
          } else {
            testResult = { success: false, message: 'Deepgram TTS API connection failed' };
          }
        } catch (error) {
          testResult = { success: false, message: 'Deepgram TTS API connection error' };
        }
        break;

      case 'azure':
        // Test Azure Speech API
        try {
          const response = await fetch('https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken', {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: ''
          });
          
          if (response.ok) {
            testResult = { success: true, message: 'Azure Speech API connection successful' };
          } else {
            testResult = { success: false, message: 'Azure Speech API connection failed' };
          }
        } catch (error) {
          testResult = { success: false, message: 'Azure Speech API connection error' };
        }
        break;

      case 'deepgram':
        // Test Deepgram API
        try {
          const deepgramService = new DeepgramService(apiKey);
          const testResult = await deepgramService.testConnection();
          
          if (testResult.success) {
            testResult = { success: true, message: 'Deepgram API connection successful' };
          } else {
            testResult = { success: false, message: 'Deepgram API connection failed' };
          }
        } catch (error) {
          testResult = { success: false, message: 'Deepgram API connection error' };
        }
        break;

      default:
        testResult = { success: false, message: 'Unknown API type' };
    }

    res.json({
      success: true,
      data: testResult
    });

  } catch (error) {
    console.error('Error testing API:', error);
    res.status(500).json({ error: 'Failed to test API connection' });
  }
});

// POST /api/daive/voice-settings - Save voice settings
router.post('/voice-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { enabled, language, voiceSpeed, voicePitch, voiceProvider, speechProvider, ttsProvider, openaiVoice, elevenLabsVoice } = req.body;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Save voice settings to database
    const settings = {
      enabled: enabled || false,
      language: language || 'en-US',
      voiceSpeed: voiceSpeed || 1.0,
      voicePitch: voicePitch || 1.0,
      voiceProvider: voiceProvider || 'elevenlabs',
      speechProvider: speechProvider || 'whisper',
      ttsProvider: ttsProvider || 'elevenlabs',
      openaiVoice: openaiVoice || 'liam', // Changed from alloy to liam
      elevenLabsVoice: elevenLabsVoice || 'Liam'
    };

    // Store voice settings as dealer-specific in the api_settings table
    const voiceSettingsQuery = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = $3, updated_at = NOW()
      RETURNING *
    `;

    // Save each setting for the specific dealer
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_enabled', settings.enabled.toString()]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_language', settings.language]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_speed', settings.voiceSpeed.toString()]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_pitch', settings.voicePitch.toString()]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_provider', settings.voiceProvider]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_speech_provider', settings.speechProvider]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_tts_provider', settings.ttsProvider]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_openai_voice', settings.openaiVoice]);
    await pool.query(voiceSettingsQuery, [dealerId, 'voice_elevenlabs_voice', settings.elevenLabsVoice]);

    res.json({
      success: true,
      data: settings,
      message: 'Voice settings saved successfully'
    });

  } catch (error) {
    console.error('Error saving voice settings:', error);
    res.status(500).json({ error: 'Failed to save voice settings' });
  }
});

// GET /api/daive/voice-settings - Get voice settings (dealer-specific with global fallback)
router.get('/voice-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get dealer-specific voice settings with global fallback
    const query = `
      WITH dealer_voice_settings AS (
        SELECT setting_type, setting_value, 'dealer' as source
        FROM daive_api_settings 
        WHERE dealer_id = $1 AND setting_type LIKE 'voice_%'
      ),
      global_voice_settings AS (
        SELECT setting_type, setting_value, 'global' as source
        FROM daive_api_settings 
        WHERE dealer_id IS NULL AND setting_type LIKE 'voice_%'
      )
      SELECT setting_type, setting_value, source
      FROM dealer_voice_settings
      UNION ALL
      SELECT setting_type, setting_value, source
      FROM global_voice_settings
      WHERE setting_type NOT IN (SELECT setting_type FROM dealer_voice_settings)
      ORDER BY setting_type
    `;

    const result = await pool.query(query, [dealerId]);

    const voiceSettings = {
      enabled: false,
      language: 'en-US',
      voiceSpeed: 1.0,
      voicePitch: 1.0,
      voiceProvider: 'elevenlabs',
      speechProvider: 'whisper',
      ttsProvider: 'elevenlabs',
      openaiVoice: 'liam', // Changed from alloy to liam
      elevenLabsVoice: 'Liam'
    };

    result.rows.forEach(row => {
      switch (row.setting_type) {
        case 'voice_enabled':
          voiceSettings.enabled = row.setting_value === 'true';
          break;
        case 'voice_language':
          voiceSettings.language = row.setting_value;
          break;
        case 'voice_speed':
          voiceSettings.voiceSpeed = parseFloat(row.setting_value);
          break;
        case 'voice_pitch':
          voiceSettings.voicePitch = parseFloat(row.setting_value);
          break;
        case 'voice_provider':
          voiceSettings.voiceProvider = row.setting_value;
          break;
        case 'voice_speech_provider':
          voiceSettings.speechProvider = row.setting_value;
          break;
        case 'voice_tts_provider':
          voiceSettings.ttsProvider = row.setting_value;
          break;
        case 'voice_openai_voice':
          voiceSettings.openaiVoice = row.setting_value;
          break;
        case 'voice_elevenlabs_voice':
          voiceSettings.elevenLabsVoice = row.setting_value;
          break;
      }
    });

    res.json({
      success: true,
      data: voiceSettings
    });

  } catch (error) {
    console.error('Error getting voice settings:', error);
    res.status(500).json({ error: 'Failed to get voice settings' });
  }
});

export default router; 