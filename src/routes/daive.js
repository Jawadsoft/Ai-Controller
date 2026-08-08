import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import DAIVEService from '../lib/daivecrewai.js';
import settingsManager from '../lib/settingsManager.js';
import { query } from '../database/connection.js';

// Initialize DAIVE service
const daiveService = new DAIVEService();

// Initialize the service when the module loads
let serviceInitialized = false;
async function initializeService() {
  if (!serviceInitialized) {
    try {
      console.log('🚀 Initializing DAIVE Service in routes...');
      await daiveService.initialize();
      serviceInitialized = true;
      console.log('✅ DAIVE Service initialized in routes');
    } catch (error) {
      console.error('❌ Failed to initialize DAIVE Service in routes:', error);
    }
  }
}

// Initialize immediately
initializeService();

// Enhanced function to clean text for TTS generation - makes text sound natural for voice
function cleanTextForTTS(text) {
  if (!text || typeof text !== 'string') return text;
  
  let cleanedText = text;
  
  // Step 1: Remove markdown formatting
  cleanedText = cleanedText
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold formatting
    .replace(/\*(.*?)\*/g, '$1')      // Remove italic formatting
    .replace(/`(.*?)`/g, '$1')        // Remove code formatting
    .replace(/~~(.*?)~~/g, '$1')      // Remove strikethrough
    .replace(/^#{1,6}\s+/gm, '')     // Remove markdown headers
    .trim();
  
  // Step 2: Remove bullet points and lists
  cleanedText = cleanedText
    .replace(/\n\s*•\s*/g, '\n')     // Remove bullet points
    .replace(/\n\s*-\s*/g, '\n')     // Remove dashes
    .replace(/\n\s*\d+\.\s*/g, '\n') // Remove numbered lists
    .trim();
  
  // Step 3: Remove special characters that sound robotic
  cleanedText = cleanedText
    .replace(/[<>{}[\]|\\]/g, '')     // Remove HTML-like brackets and pipes
    .replace(/[~`^]/g, ' ')           // Remove tildes, backticks, carets
    .trim();
  
  // Step 4: Handle common abbreviations
  cleanedText = cleanedText
    .replace(/\bvs\./gi, 'versus')    // vs. → versus
    .replace(/\betc\./gi, 'and so on') // etc. → and so on
    .replace(/\bi\.e\./gi, 'that is') // i.e. → that is
    .replace(/\be\.g\./gi, 'for example') // e.g. → for example
    .replace(/\bMr\./gi, 'Mister')    // Mr. → Mister
    .replace(/\bMrs\./gi, 'Missus')   // Mrs. → Missus
    .replace(/\bDr\./gi, 'Doctor')    // Dr. → Doctor
    .replace(/\bSt\./gi, 'Street')    // St. → Street
    .replace(/\bAve\./gi, 'Avenue')   // Ave. → Avenue
    .replace(/\bBlvd\./gi, 'Boulevard') // Blvd. → Boulevard
    .trim();
  
  // Step 5: Clean up spacing and punctuation
  cleanedText = cleanedText
    .replace(/\s+([.,!?;:])/g, '$1')  // Remove spaces before punctuation
    .replace(/([.,!?;:])\s+/g, '$1 ') // Ensure proper spacing after punctuation
    .replace(/\s+/g, ' ')              // Normalize multiple spaces
    .replace(/\n\s*\n/g, '\n')        // Clean up multiple newlines
    .replace(/^\s+|\s+$/gm, '')       // Trim whitespace from each line
    .trim();
  
  console.log(`🎤 TTS text cleaned: "${text.substring(0, 100)}..." → "${cleanedText.substring(0, 100)}..."`);
  
  return cleanedText;
}

// Volume control helper function for TTS
function addVolumeControl(text, volumeBoost = 0, provider = 'openai') {
  if (!volumeBoost || volumeBoost <= 0) return text;
  
  let processedText = text;
  
  if (provider === 'openai') {
    // OpenAI supports SSML for volume control
    const volumeDb = Math.min(volumeBoost, 20); // Cap at +20dB
    processedText = `<speak><prosody volume="+${volumeDb}dB">${text}</prosody></speak>`;
    console.log(`🔊 OpenAI: Adding volume boost +${volumeDb}dB`);
  } else if (provider === 'elevenlabs') {
    // ElevenLabs uses volume multiplier in voice settings
    // Text remains unchanged, volume is handled in voice_settings
    console.log(`🔊 ElevenLabs: Volume boost ${volumeBoost}% will be applied in voice settings`);
  } else if (provider === 'deepgram') {
    // Deepgram supports SSML for volume control
    const volumeDb = Math.min(volumeBoost, 20); // Cap at +20dB
    processedText = `<speak><prosody volume="+${volumeDb}dB">${text}</prosody></speak>`;
    console.log(`🔊 Deepgram: Adding volume boost +${volumeDb}dB`);
  }
  
  return processedText;
}
import WhisperService from '../lib/whisper.js';
import DeepgramService from '../lib/deepgram-v3.js';
import DeepgramTTSService from '../lib/deepgram-tts.js';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../database/connection.js';
// Removed unused import - voice IDs are hardcoded in the TTS logic

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

// Public routes (no authentication required for customer interactions)

// GET /api/daive/health - Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'D.A.I.V.E.',
    timestamp: new Date().toISOString() 
  });
});

// GET /api/daive/debug - Debug service status (for troubleshooting)
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called - checking DAIVE service status...');
    
    // Get service status
    const serviceStatus = daiveService.getServiceStatus();
    
    // Get detailed debug information
    await daiveService.debugInitialization();
    
    res.json({
      success: true,
      data: {
        serviceStatus,
        message: 'Check server console for detailed debug information',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get debug information' 
    });
  }
});

// POST /api/daive/reinitialize - Manually reinitialize the service (for troubleshooting)
router.post('/reinitialize', async (req, res) => {
  try {
    console.log('🔄 Reinitialize endpoint called - attempting to reinitialize DAIVE service...');
    
    // Reset initialization state
    serviceInitialized = false;
    
    // Reinitialize the service
    await initializeService();
    
    // Get updated service status
    const serviceStatus = daiveService.getServiceStatus();
    
    res.json({
      success: true,
      data: {
        serviceStatus,
        message: 'Service reinitialization completed',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in reinitialize endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reinitialize service' 
    });
  }
});

// POST /api/daive/chat - Process text conversation
router.post('/chat', async (req, res) => {
  try {
    const startTime = Date.now();
    const processTimings = {
      total: 0,
      aiProcessing: 0,
      ttsGeneration: 0,
      databaseQueries: 0,
      settingsRetrieval: 0
    };

    const { vehicleId, sessionId, message, customerInfo, vehicleDetails, action, useCrewAI, conversationContext, dataArray, assignedStaffId, staffQrHash } = req.body;

    if (!message) {
      console.log('❌ Validation failed: Message is required');
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    // Build a user-friendly message if this is a vehicle selection action
    let processedMessage = message;
    let selectedVehicleId = null;
    if ((action === 'vehicle_selection' || action === 'select_vehicle' || action === 'vehicleSelected') && message && vehicleDetails) {
      try {
        // message is the selected vehicle ID according to frontend
        selectedVehicleId = message;
        let selected = null;
        if (Array.isArray(vehicleDetails)) {
          selected = vehicleDetails.find(v => v.id === selectedVehicleId || v.stockNumber === selectedVehicleId || v.stock_number === selectedVehicleId) || null;
        } else if (vehicleDetails && typeof vehicleDetails === 'object') {
          // Frontend sends a single vehicleDetails object on selection
          if (vehicleDetails.id === selectedVehicleId || vehicleDetails.stockNumber === selectedVehicleId || vehicleDetails.stock_number === selectedVehicleId) {
            selected = vehicleDetails;
          } else if (Array.isArray(vehicleDetails.vehicles)) {
            selected = vehicleDetails.vehicles.find(v => v.id === selectedVehicleId || v.stockNumber === selectedVehicleId || v.stock_number === selectedVehicleId) || null;
          }
        }
        if (selected) {
          const year = selected.year || selected?.vehicle?.year;
          const make = selected.make || selected?.vehicle?.make;
          const model = selected.model || selected?.vehicle?.model;
          const price = (selected.price && typeof selected.price === 'string') ? selected.price : (selected.price ? `$${selected.price}` : '');
          const stock = selected.stockNumber || selected.stock_number || selected?.vehicle?.stockNumber || selected?.vehicle?.stock_number;
          processedMessage = `I'm interested in the ${year} ${make} ${model}${price ? ` - ${price}` : ''}${stock ? ` (Stock #${stock})` : ''}`;
        } else if (vehicleDetails && typeof vehicleDetails === 'object') {
          // If we didn't match by ID, still compose from the provided single object
          const year = vehicleDetails.year || vehicleDetails?.vehicle?.year;
          const make = vehicleDetails.make || vehicleDetails?.vehicle?.make;
          const model = vehicleDetails.model || vehicleDetails?.vehicle?.model;
          const price = (vehicleDetails.price && typeof vehicleDetails.price === 'string') ? vehicleDetails.price : (vehicleDetails.price ? `$${vehicleDetails.price}` : '');
          const stock = vehicleDetails.stockNumber || vehicleDetails.stock_number || vehicleDetails?.vehicle?.stockNumber || vehicleDetails?.vehicle?.stock_number;
          if (year && make && model) {
            processedMessage = `I'm interested in the ${year} ${make} ${model}${price ? ` - ${price}` : ''}${stock ? ` (Stock #${stock})` : ''}`;
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to compose friendly selection message:', e.message);
      }
    }

    // Let shoppers drop a chosen vehicle and return to browsing inventory
    let effectiveConversationContext = conversationContext;
    if (action === 'cancel_vehicle_selection' && conversationContext) {
      try {
        effectiveConversationContext = JSON.parse(JSON.stringify(conversationContext));
        const stepSlots = effectiveConversationContext.Daivesteps?.[3]?.slots;
        if (stepSlots?.VehicleSelection) {
          stepSlots.VehicleSelection.hasSelectedVehicle = false;
          stepSlots.VehicleSelection.selectedVehicle = null;
          stepSlots.VehicleSelection.hasRecentSelection = false;
        }
        if (stepSlots && Object.prototype.hasOwnProperty.call(stepSlots, 'inventory_choice')) {
          delete stepSlots.inventory_choice;
        }
        effectiveConversationContext.vehicle_selected = false;
        if (effectiveConversationContext.slots?.VehicleSelection) {
          effectiveConversationContext.slots.VehicleSelection.hasSelectedVehicle = false;
        }
        effectiveConversationContext.vehicleDetails = [];
        console.log('🔄 cancel_vehicle_selection: cleared VehicleSelection in conversation context');
      } catch (e) {
        console.warn('⚠️ cancel_vehicle_selection context patch failed:', e?.message || e);
        effectiveConversationContext = conversationContext;
      }
    } else if (action === 'cancel_vehicle_selection' && !conversationContext) {
      console.warn('⚠️ cancel_vehicle_selection called without conversationContext — selection may not fully reset');
    }

    // Ensure service is initialized
    if (!serviceInitialized) {
      await initializeService();
    }
    
    // CRITICAL FIX: Ensure dealerId is available in customerInfo
    let enhancedCustomerInfo = customerInfo || {};
    // ✅ Attach dataArray to both requestMeta AND conversationContext for proper context flow
    enhancedCustomerInfo.requestMeta = {
      dataArray: Array.isArray(dataArray) ? dataArray : [],
      originalMessage: message,
      processedMessage,
      action
    };
    
    // ✅ CRITICAL: Attach dataArray to conversation context so it flows through to detectVehicleSelection
    if (effectiveConversationContext) {
      if (!enhancedCustomerInfo.conversationContext) {
        enhancedCustomerInfo.conversationContext = effectiveConversationContext;
      }
      enhancedCustomerInfo.conversationContext.dataArray = Array.isArray(dataArray) ? dataArray : [];
      enhancedCustomerInfo.conversationContext.requestMeta = enhancedCustomerInfo.requestMeta;
    }
    
    // Resolve dealerId once here — the service trusts this value and won't re-query.
    if (!enhancedCustomerInfo.dealerId && vehicleId) {
      try {
        const vehicleResult = await pool.query('SELECT dealer_id FROM vehicles WHERE id = $1', [vehicleId]);
        if (vehicleResult.rows.length > 0) enhancedCustomerInfo.dealerId = vehicleResult.rows[0].dealer_id;
      } catch (error) {
        console.warn('⚠️ Could not extract dealerId from vehicle:', error.message);
      }
    }
    if (!enhancedCustomerInfo.dealerId) {
      try {
        const defaultResult = await pool.query('SELECT id FROM dealers LIMIT 1');
        if (defaultResult.rows.length > 0) enhancedCustomerInfo.dealerId = defaultResult.rows[0].id;
        else console.warn('⚠️ No dealers found in database');
      } catch (error) {
        console.error('❌ Database error when getting default dealerId:', error.message);
      }
    }
    
    // Track AI processing time
    const aiStartTime = Date.now();

    let result;
    if (vehicleId) {
      result = await daiveService.processWithSalesCrew(
        processedMessage || message,
        enhancedCustomerInfo,
        enhancedCustomerInfo.dealerId,
        vehicleId
      );
    } else {
      result = await daiveService.processConversationWithOptimizedCrew(
        sessionId || daiveService.generateSessionId(),
        vehicleId,
        processedMessage || message,
        enhancedCustomerInfo,
        vehicleDetails || null
      );
    }
    processTimings.aiProcessing = Date.now() - aiStartTime;

    // Use TTS from result if already generated (prevents duplicate generation)
    let audioResponseUrl = result.audioResponseUrl || null;

    // if (!audioResponseUrl && result.response) {
    //   try {
    //     // dealerId already resolved above — reuse it, no extra DB query
    //     const ttsStartTime = Date.now();
    //     const textForTTS = result.ttsText || result.response;
    //     audioResponseUrl = await daiveService.generateTTSResponse(textForTTS, enhancedCustomerInfo.dealerId);
    //     processTimings.ttsGeneration = Date.now() - ttsStartTime;
    //   } catch (ttsError) {
    //     console.error('❌ Text-to-speech error (fallback):', ttsError);
    //   }
    // }

    // Calculate total time
    processTimings.total = Date.now() - startTime;
    
    console.log('✅ Chat processing completed successfully');
    console.log('🎤 Final TTS result:', {
      hasAudioUrl: !!audioResponseUrl,
      audioUrl: audioResponseUrl,
      responseLength: result.response?.length || 0
    });
    
    // Log comprehensive performance metrics
    console.log('📊 Performance Metrics:', {
      totalTime: processTimings.total + 'ms',
      aiProcessing: processTimings.aiProcessing + 'ms',
      ttsGeneration: processTimings.ttsGeneration + 'ms',
      settingsRetrieval: processTimings.settingsRetrieval + 'ms',
      breakdown: {
        aiPercentage: ((processTimings.aiProcessing / processTimings.total) * 100).toFixed(1) + '%',
        ttsPercentage: ((processTimings.ttsGeneration / processTimings.total) * 100).toFixed(1) + '%',
        settingsPercentage: ((processTimings.settingsRetrieval / processTimings.total) * 100).toFixed(1) + '%'
      }
    });
    
    // ── Case-4 fix: restore assigned_staff_id from customer_staff_claims ────────
    // If the customer cleared localStorage (or uses a different device) but we
    // already have their email/phone in the session, look up the claim so DAIVE
    // still knows which salesperson greeted them.
    if (!assignedStaffId && !staffQrHash && sessionId) {
      try {
        const claimLookup = await pool.query(
          `SELECT csc.staff_id, csc.dealer_id
           FROM customer_staff_claims csc
           WHERE csc.session_id = $1 AND csc.expires_at > NOW()
           LIMIT 1`,
          [sessionId]
        );
        if (claimLookup.rows.length > 0) {
          // Re-inject so the tagging block below picks it up
          req.body.assignedStaffId = claimLookup.rows[0].staff_id;
        }
      } catch (_) { /* non-critical */ }
    }

    // ── Also try to match by customer email/phone if still unresolved ──────────
    if (!assignedStaffId && !staffQrHash && (enhancedCustomerInfo?.email || enhancedCustomerInfo?.phone)) {
      try {
        const emailOrPhone = enhancedCustomerInfo.email || enhancedCustomerInfo.phone;
        const claimByContact = await pool.query(
          `SELECT csc.staff_id
           FROM customer_staff_claims csc
           JOIN daive_conversations dc ON dc.session_id = csc.session_id
           WHERE (dc.customer_email = $1 OR dc.customer_phone = $1)
             AND csc.expires_at > NOW()
           ORDER BY csc.claimed_at DESC
           LIMIT 1`,
          [emailOrPhone]
        );
        if (claimByContact.rows.length > 0) {
          req.body.assignedStaffId = claimByContact.rows[0].staff_id;
        }
      } catch (_) { /* non-critical */ }
    }

    // Fire a bell notification when customer shows high intent (test drive / appointment)
    const msgLower = (processedMessage || message || '').toLowerCase();
    const highIntentKeywords = ['test drive', 'schedule', 'appointment', 'today', 'tomorrow', 'book', 'confirm', 'come in', 'visit'];
    const isHighIntent = highIntentKeywords.some(kw => msgLower.includes(kw));

    if (isHighIntent && result.conversationId) {
      try {
        const dealerIdForNotif = enhancedCustomerInfo?.dealerId || null;
        if (dealerIdForNotif) {
          // Avoid duplicate notifications — only insert if no recent one exists for this conversation
          const recentCheck = await pool.query(`
            SELECT id FROM notifications
            WHERE dealer_id = $1 AND type = 'message'
              AND data->>'conversationId' = $2
              AND created_at > NOW() - INTERVAL '5 minutes'
            LIMIT 1
          `, [dealerIdForNotif, result.conversationId]);

          if (recentCheck.rows.length === 0) {
            const customerName = enhancedCustomerInfo?.name || enhancedCustomerInfo?.customerName || 'A customer';

            // ── Dealer-wide bell notification (existing) ──────────────────────
            await pool.query(`
              INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
            `, [
              dealerIdForNotif,
              'message',
              '📱 Active Customer Chat',
              `${customerName} is in an active chat and showing high interest`,
              JSON.stringify({ conversationId: result.conversationId, triggerMessage: msgLower.substring(0, 100) })
            ]);
            console.log('🔔 High-intent chat notification created for dealer:', dealerIdForNotif);

            // ── Look up the salesperson assigned to this conversation ─────────
            const convStaffRow = await pool.query(
              `SELECT dc.assigned_staff_id, u.email AS staff_email, u.name AS staff_name,
                      d.business_name AS dealer_name, dc.customer_name, dc.vehicle_id
               FROM daive_conversations dc
               LEFT JOIN dealership_staff ds ON ds.id = dc.assigned_staff_id
               LEFT JOIN users u ON u.id = ds.user_id
               LEFT JOIN dealers d ON d.id = dc.dealer_id
               WHERE dc.id = $1`,
              [result.conversationId]
            );

            if (convStaffRow.rows.length > 0 && convStaffRow.rows[0].assigned_staff_id) {
              const staffRow = convStaffRow.rows[0];

              // ── Staff-specific bell notification ──────────────────────────
              await pool.query(`
                INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
              `, [
                dealerIdForNotif,
                'staff_alert',
                `🔔 Your customer needs you — ${staffRow.customer_name || 'Visitor'}`,
                `${staffRow.customer_name || 'Your customer'} said: "${msgLower.substring(0, 80)}"`,
                JSON.stringify({
                  conversationId: result.conversationId,
                  staffId: staffRow.assigned_staff_id,
                  triggerMessage: msgLower.substring(0, 200),
                  customerName: staffRow.customer_name
                })
              ]);

              // ── Direct email to the salesperson ───────────────────────────
              if (staffRow.staff_email) {
                let vehicleInfo = '';
                if (staffRow.vehicle_id) {
                  try {
                    const vRow = await pool.query('SELECT year, make, model FROM vehicles WHERE id = $1', [staffRow.vehicle_id]);
                    if (vRow.rows.length > 0) {
                      const v = vRow.rows[0];
                      vehicleInfo = `${v.year} ${v.make} ${v.model}`;
                    }
                  } catch (_) {}
                }
                const daiveEmailService = await import('../lib/daiveEmailService.js');
                daiveEmailService.default.sendStaffHighIntentAlert({
                  staffEmail: staffRow.staff_email,
                  staffName: staffRow.staff_name,
                  customerName: staffRow.customer_name || customerName,
                  triggerMessage: msgLower.substring(0, 150),
                  vehicleInfo,
                  conversationId: result.conversationId,
                  dealerName: staffRow.dealer_name,
                }).catch(err => console.error('⚠️ Staff email alert failed:', err));
                console.log(`📧 Staff alert queued for ${staffRow.staff_email}`);
              }
            }
          }
        }
      } catch (notifError) {
        console.error('⚠️ Failed to create high-intent chat notification:', notifError);
      }
    }

    // ── Salesperson QR attachment ────────────────────────────────────────────
    // If the customer came via a salesperson's QR, tag the conversation and
    // upsert the customer_staff_claims record for "place-in-line" protection.
    if (result.conversationId && (assignedStaffId || staffQrHash)) {
      try {
        let resolvedStaffId = assignedStaffId;

        if (!resolvedStaffId && staffQrHash) {
          const staffLookup = await pool.query(
            'SELECT id FROM dealership_staff WHERE staff_qr_hash = $1 AND is_active = true LIMIT 1',
            [staffQrHash]
          );
          if (staffLookup.rows.length > 0) {
            resolvedStaffId = staffLookup.rows[0].id;
          }
        }

        if (resolvedStaffId) {
          // Tag the conversation (only if not already tagged)
          await pool.query(
            `UPDATE daive_conversations
             SET assigned_staff_id = $1, updated_at = NOW()
             WHERE id = $2 AND assigned_staff_id IS NULL`,
            [resolvedStaffId, result.conversationId]
          );

          // Upsert customer_staff_claims for the session
          if (sessionId) {
            const dealerIdForClaim = enhancedCustomerInfo?.dealerId || null;
            if (dealerIdForClaim) {
              await pool.query(
                `INSERT INTO customer_staff_claims (session_id, staff_id, dealer_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (session_id) DO NOTHING`,
                [sessionId, resolvedStaffId, dealerIdForClaim]
              );
            }
          }
          console.log(`🤝 Conversation ${result.conversationId} tagged to staff ${resolvedStaffId}`);
        }
      } catch (staffTagError) {
        console.error('⚠️ Failed to tag conversation to staff:', staffTagError);
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        audioResponseUrl,
        // Echo request debugging info
        requestDebug: {
          processedMessage,
          originalMessage: message,
          hasDataArray: Array.isArray(dataArray),
          dataArrayLength: Array.isArray(dataArray) ? dataArray.length : 0
        },
        // Echo back frontend-provided selection arrays for compatibility with older UI expectations
        vehicleSelection: Array.isArray(vehicleDetails) ? vehicleDetails : (vehicleDetails?.vehicles || undefined),
        selectedVehicleId,
        performanceMetrics: {
          totalTime: processTimings.total,
          aiProcessing: processTimings.aiProcessing,
          ttsGeneration: processTimings.ttsGeneration,
          settingsRetrieval: processTimings.settingsRetrieval,
          breakdown: {
            aiPercentage: ((processTimings.aiProcessing / processTimings.total) * 100).toFixed(1) + '%',
            ttsPercentage: ((processTimings.ttsGeneration / processTimings.total) * 100).toFixed(1) + '%',
            settingsPercentage: ((processTimings.settingsRetrieval / processTimings.total) * 100).toFixed(1) + '%'
          }
        }
      }
    });

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
      if (!dealerId && vehicleId) {
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
      
      // If still no dealer ID, return error
      if (!dealerId) {
        console.log('❌ No dealer ID available for voice processing');
        return res.status(400).json({ 
          success: false,
          error: 'Dealer ID is required for voice processing' 
        });
      }
      
      // Get all voice and API settings from centralized settings manager
      const voiceSettings = await settingsManager.getVoiceSettings(dealerId);
      const apiKeys = await settingsManager.getAPIKeys(dealerId);
      
      console.log('🔊 Voice settings from settings manager:', voiceSettings);
      console.log('🔑 API keys from settings manager:', Object.keys(apiKeys).filter(key => apiKeys[key]));
      
      // Process transcription based on provider
      if (voiceSettings.speechProvider === 'deepgram' && apiKeys.deepgram) {
        try {
          console.log('🎯 Using DeepgramService for transcription...');
          const deepgramService = new DeepgramService(apiKeys.deepgram);
          
          const deepgramResult = await deepgramService.transcribeAudioWithOptions(audioFile.path, {
            language: voiceSettings.language?.split('-')[0] || 'en',
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
      } else if (voiceSettings.speechProvider === 'whisper' && apiKeys.openai) {
        try {
          console.log('🎯 Using WhisperService for transcription...');
          const whisperService = new WhisperService(apiKeys.openai);
          
          const whisperResult = await whisperService.transcribeAudioWithOptions(audioFile.path, {
            language: voiceSettings.language?.split('-')[0] || 'en',
            model: 'whisper-1',
            temperature: 0.2, // Slightly higher for better context understanding
            prompt: "This is a car dealership conversation. The customer is looking for vehicles, asking about cars, SUVs, trucks, budget, financing, test drives, and vehicle features. Common terms: Hyundai, Honda, Toyota, Ford, Chevrolet, Nissan, BMW, Mercedes, Audi, sedan, SUV, truck, pre-owned, new, budget, price, financing, test drive, features, color, mileage, year, make, model."
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
        console.log('❌ No API key available for voice provider:', voiceSettings.speechProvider);
        transcription = "Voice recognition is not configured. Please contact the dealer.";
      }
    } catch (sttError) {
      console.error('❌ Speech-to-text error:', sttError);
      transcription = "Sorry, I couldn't process your voice. Please try typing your question.";
    }
    
    // Process with AI
    console.log('🤖 Processing conversation with AI...');
    
    // ✅ NEW: Route to processWithSalesCrew when vehicleId exists for pre-selected vehicle enhancement
    let result;
    if (vehicleId) {
      console.log('🚗 Vehicle ID detected - routing to processWithSalesCrew for pre-selected vehicle enhancement');
      result = await daiveService.processWithSalesCrew(
        transcription,
        customerInfo ? JSON.parse(customerInfo) : {},
        dealerId,
        vehicleId
      );
    } else {
      console.log('📋 No vehicle ID - using standard optimized CrewAI processing');
      result = await daiveService.processConversationWithOptimizedCrew(
        sessionId || daiveService.generateSessionId(),
        vehicleId,
        transcription,
        customerInfo ? JSON.parse(customerInfo) : {}
      );
    }

    // Clean the AI response text for better TTS quality
    const cleanedResponse = cleanTextForTTS(result.response);

    // Generate speech response if voice is enabled
    let audioResponseUrl = null;
    try {
      // Get all voice and TTS settings from centralized settings manager
      const voiceSettings = await settingsManager.getVoiceSettings(dealerId);
      const ttsSettings = await settingsManager.getTTSSettings(dealerId);
      const apiKeys = await settingsManager.getAPIKeys(dealerId);
      
      const voiceEnabled = voiceSettings.enabled;
        
      if (voiceEnabled) {
        console.log('🔊 Voice response enabled, generating speech...');
        
        // Determine which provider to use (prioritize TTS provider if set)
        const providerToUse = ttsSettings.ttsProvider !== 'elevenlabs' ? ttsSettings.ttsProvider : voiceSettings.provider;
        console.log('🎤 Final provider to use:', providerToUse);
        
        if (providerToUse === 'deepgram') {
          // Use Deepgram TTS
          console.log('🎤 Using Deepgram TTS...');
          
          if (apiKeys.deepgram) {
            const deepgramTTS = new DeepgramTTSService(apiKeys.deepgram);
            
            // Get voice settings for Deepgram
            let voiceSettings = {
              model: 'aura-asteria',
              voice: 'asteria',
              encoding: 'mp3',
              container: 'mp3',
              sample_rate: 24000
            };
            
            const ttsResult = await deepgramTTS.synthesizeSpeech(cleanedResponse, voiceSettings);
            
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
          // Use OpenAI TTS
          console.log('🎤 Using OpenAI TTS...');
          
          if (apiKeys.openai) {
            // Generate speech using OpenAI TTS
            const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKeys.openai}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'tts-1-hd',
                input: result.response,
                voice: ttsSettings.openaiVoice,
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
          // Use ElevenLabs TTS (default)
          console.log('🎤 Using ElevenLabs TTS...');
          
          if (apiKeys.elevenlabs) {
            // Map voice names to voice IDs
            const voiceMap = {
              'jessica': 'cgSgspJ2msm6clMCkdW9',
              'rachel': '21m00Tcm4TlvDq8ikWAM',
              'domi': 'AZnzlk1XvdvUeBnXmlld',
              'bella': 'EXAVITQu4vr4xnSDxMaL',
              'antoni': 'ErXwobaYiN019PkySvjV',
              'elli': 'MF3mGyEYCl7XYWbV9V6O',
              'josh': 'TxGEqnHWrfWFTfGW9XjX',
              'arnold': 'VR6AewLTigWG4xSOukaG',
              'adam': 'pNInz6obpgDQGcFmaJgB',
              'sam': 'yoZ06aMxZJJ28mfd3POQ',
              'liam': 'wUwsnXivqGrDWuz1Fc89',
              'mark': 'UgBBYS2sOqTuMpoF3BR0'
            };
            
            const voiceName = ttsSettings.elevenlabsVoice || 'mark';
            const voiceId = voiceMap[voiceName.toLowerCase()] || voiceMap.mark;
            console.log('🎤 Using ElevenLabs voice:', voiceName, '->', voiceId);
            
            // Generate speech using ElevenLabs
            const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: {
                'xi-api-key': apiKeys.elevenlabs,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: cleanedResponse,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: ttsSettings.stability || 0.3,
                  similarity_boost: ttsSettings.similarityBoost || 0.7
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
              console.log('📁 Audio file saved at:', audioPath);
              console.log('🔗 Audio URL:', audioResponseUrl);
            } else {
              const errorText = await speechResponse.text();
              console.error('❌ ElevenLabs TTS failed:', speechResponse.status, errorText);
            }
          } else {
            console.log('⚠️ No ElevenLabs API key found for TTS');
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

// GET /api/daive/conversation/:sessionId/resume
// Returns conversation row + all messages + saved context for resumption
router.get('/conversation/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { pool } = await import('../database/connection.js');

    // 1. Get the conversation row
    const convResult = await pool.query(
      'SELECT * FROM daive_conversations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [sessionId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const conversation = convResult.rows[0];

    // 2. Get all chat messages for this conversation
    const msgResult = await pool.query(
      `SELECT role, content, created_at AS timestamp
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversation.id]
    );

    // 3. Get the saved Daivesteps context
    let savedContext = null;
    try {
      if (daiveService.conversationContextService) {
        savedContext = await daiveService.conversationContextService.getConversationContext(sessionId);
      }
    } catch (ctxErr) {
      console.warn('⚠️ Could not load conversation context for resume:', ctxErr.message);
    }

    res.json({
      success: true,
      conversation: {
        session_id: conversation.session_id,
        updated_at: conversation.updated_at,
        created_at: conversation.created_at,
        dealer_id: conversation.dealer_id,
        customer_name: conversation.customer_name,
        customer_email: conversation.customer_email,
      },
      messages: msgResult.rows,
      context: savedContext
    });

  } catch (error) {
    console.error('Error resuming conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to resume conversation' });
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
    const { page = 1, limit = 20, status, handoff_status, assigned_to_user, start_date, end_date } = req.query;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Role-based filtering: sales agents can only see their assigned conversations
    let finalAssignedToUser = assigned_to_user;
    if (req.user.staff_role === 'sales' && !assigned_to_user) {
      // Sales agents can only see their own assigned conversations
      // We need to get the dealership_staff.id for this user
      const staffQuery = `
        SELECT id FROM dealership_staff 
        WHERE user_id = $1 AND dealer_id = $2
      `;
      const staffResult = await pool.query(staffQuery, [req.user.id, dealerId]);
      console.log('🔍 Staff lookup result for user:', req.user.id, 'dealer:', dealerId, 'result:', staffResult.rows);
      
      if (staffResult.rows.length > 0) {
        finalAssignedToUser = staffResult.rows[0].id;
        console.log('🔍 Using dealership_staff.id:', finalAssignedToUser);
      } else {
        // If no staff record found, return empty results
        return res.json({
          success: true,
          data: {
            conversations: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0
          }
        });
      }
    }

    // Use the new service method for better performance and consistency
    console.log('🔍 Calling daiveService.getConversations with:', { dealerId, page, limit, status, handoff_status, assigned_to_user: finalAssignedToUser });
    console.log('🔍 Service initialized:', serviceInitialized);
    console.log('🔍 Service object:', typeof daiveService);
    
    try {
      const result = await daiveService.getConversations(
        dealerId,
        parseInt(page),
        parseInt(limit),
        status,
        handoff_status,
        finalAssignedToUser,
        start_date || null,
        end_date || null
      );
      
      console.log('✅ getConversations result:', result);
      
      if (result && result.success) {
        res.json(result);
      } else {
        console.error('❌ getConversations failed:', result);
        res.status(500).json({ error: result?.error || 'Failed to get conversations' });
      }
    } catch (error) {
      console.error('❌ Error calling getConversations:', error);
      res.status(500).json({ error: 'Service error: ' + error.message });
    }

  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// PUT /api/daive/conversation/:id/status - Update conversation status
router.put('/conversation/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!status || !['new', 'hot', 'warm', 'cold'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: new, hot, warm, or cold' });
    }

    const query = `
      UPDATE daive_conversations 
      SET lead_status = $1, updated_at = NOW()
      WHERE id = $2 AND dealer_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [status, id, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating conversation status:', error);
    res.status(500).json({ error: 'Failed to update conversation status' });
  }
});

// POST /api/daive/handoff/:id - Accept handoff for a conversation
router.post('/handoff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // First, check if the conversation exists and handoff is requested
    const checkQuery = `
      SELECT 
        dc.id, 
        dc.customer_name, 
        dc.customer_email, 
        dc.customer_phone,
        dc.vehicle_id,
        dc.lead_qualification_score,
        dc.handoff_requested, 
        dc.lead_status, 
        dc.dealer_id,
        dc.handoff_reason,
        dc.assigned_staff_id
      FROM daive_conversations dc
      WHERE dc.id = $1
    `;

    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = checkResult.rows[0];

    // Check if dealer has access to this conversation
    if (conversation.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    // Check if handoff is actually requested
    if (!conversation.handoff_requested) {
      return res.status(400).json({ error: 'No handoff requested for this conversation' });
    }

    // Update the conversation to mark handoff as accepted
    // Note: handoff_requested = false means "no longer requesting handoff"
    // handoff_accepted_at IS NOT NULL means "handoff was accepted"
    const updateQuery = `
      UPDATE daive_conversations 
      SET 
        handoff_requested = false,
        handoff_accepted_at = NOW(),
        handoff_accepted_by = $1,
        lead_status = 'hot',
        updated_at = NOW()
      WHERE id = $2 AND handoff_requested = true
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [dealerId, id]);

    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to update conversation' });
    }

    // Resolve vehicle for lead: conversation.vehicle_id, else latest interest
    let resolvedVehicleId = conversation.vehicle_id || null;
    if (!resolvedVehicleId) {
      try {
        const interestResult = await pool.query(
          `SELECT vehicle_id
           FROM daive_user_interests
           WHERE conversation_id = $1 AND vehicle_id IS NOT NULL
           ORDER BY interest_level DESC NULLS LAST, COALESCE(updated_at, created_at) DESC
           LIMIT 1`,
          [id]
        );
        resolvedVehicleId = interestResult.rows[0]?.vehicle_id || null;
        if (resolvedVehicleId) {
          await pool.query(
            `UPDATE daive_conversations
             SET vehicle_id = $1, updated_at = NOW()
             WHERE id = $2 AND vehicle_id IS NULL`,
            [resolvedVehicleId, id]
          );
          console.log(`✅ Backfilled conversation vehicle_id=${resolvedVehicleId} from interests`);
        }
      } catch (vehicleResolveErr) {
        console.warn('⚠️ Could not resolve vehicle for lead:', vehicleResolveErr.message);
      }
    }

    // Create a lead record from the accepted handoff
    const leadData = {
      dealer_id: dealerId,
      vehicle_id: resolvedVehicleId,
      customer_name: conversation.customer_name || 'Anonymous',
      customer_email: conversation.customer_email || 'no-email@example.com',
      customer_phone: conversation.customer_phone,
      message: `Handoff accepted from D.A.I.V.E. conversation. ${conversation.handoff_reason ? 'Reason: ' + conversation.handoff_reason : ''}`,
      status: 'hot', // Lead status is hot since it's an accepted handoff
      interest_level: conversation.lead_qualification_score >= 80 ? 'high' : 
                     conversation.lead_qualification_score >= 60 ? 'medium' : 'low'
    };

    const assignedStaffId = conversation.assigned_staff_id || null;

    const createLeadQuery = `
      INSERT INTO leads (
        dealer_id, vehicle_id, customer_name, customer_email, 
        customer_phone, message, status, interest_level,
        assigned_to, assigned_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id
    `;

    let leadCreated = false;
    try {
      const leadResult = await pool.query(createLeadQuery, [
        leadData.dealer_id,
        leadData.vehicle_id,
        leadData.customer_name,
        leadData.customer_email,
        leadData.customer_phone,
        leadData.message,
        leadData.status,
        leadData.interest_level,
        assignedStaffId,
        assignedStaffId ? new Date() : null,
      ]);

      if (leadResult.rows.length > 0) {
        leadCreated = true;
        console.log(`🎯 Lead created successfully with ID: ${leadResult.rows[0].id}`);
        
        // Update the conversation to link it to the created lead
        await pool.query(`
          UPDATE daive_conversations 
          SET lead_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [leadResult.rows[0].id, id]);

        // Send lead generation notification email
        try {
          const daiveEmailService = await import('../lib/daiveEmailService.js');
          const leadDataWithId = {
            ...leadData,
            id: leadResult.rows[0].id
          };
          await daiveEmailService.default.sendLeadGenerationNotification(leadDataWithId, dealerId);
          console.log('📧 Lead generation notification email sent');
        } catch (emailError) {
          console.error('⚠️ Failed to send lead generation notification email:', emailError);
        }

        // Insert bell notification for the dealer
        try {
          await pool.query(`
            INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          `, [
            dealerId,
            'new_lead',
            '🎯 New Lead from D.A.I.V.E. Chat',
            `${leadData.customer_name} has been converted to a hot lead via AI chat`,
            JSON.stringify({ leadId: leadResult.rows[0].id, conversationId: id })
          ]);
          console.log('🔔 Bell notification created for new DAIVE lead');
        } catch (notifError) {
          console.error('⚠️ Failed to create bell notification for DAIVE lead:', notifError);
        }
      }
    } catch (leadError) {
      console.error('⚠️ Warning: Failed to create lead record:', leadError);
      // Don't fail the handoff acceptance if lead creation fails
      // The handoff is still accepted successfully
    }

    // Log the handoff acceptance
    console.log(`✅ Handoff accepted for conversation ${id} by dealer ${dealerId}`);

    res.json({
      success: true,
      data: result.rows[0],
      message: leadCreated ? 'Handoff accepted successfully - Lead created' : 'Handoff accepted successfully',
      lead_created: leadCreated
    });

  } catch (error) {
    console.error('Error accepting handoff:', error);
    res.status(500).json({ error: 'Failed to accept handoff' });
  }
});

// POST /api/daive/handoff/:id/request - Request handoff for a conversation
router.post('/handoff/:id/request', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Use the daiveService to request handoff
    const result = await daiveService.requestHandoff(id, reason || 'Manual handoff request');
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Handoff requested successfully'
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to request handoff' });
    }

  } catch (error) {
    console.error('Error requesting handoff:', error);
    res.status(500).json({ error: 'Failed to request handoff' });
  }
});

// GET /api/daive/handoffs - Get all handoff requests for a dealer
router.get('/handoffs', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { page = 1, limit = 10, status = 'all' } = req.query;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    let query = `
      SELECT 
        dc.*,
        v.make, v.model, v.year, v.vin
      FROM daive_conversations dc
      LEFT JOIN vehicles v ON dc.vehicle_id = v.id
      WHERE dc.dealer_id = $1
    `;

    const params = [dealerId];

    // Filter by handoff status
    if (status === 'requested') {
      query += ' AND dc.handoff_requested = true';
    } else if (status === 'accepted') {
      query += ' AND dc.handoff_requested = false AND dc.handoff_accepted_at IS NOT NULL';
    } else if (status === 'pending') {
      query += ' AND dc.handoff_requested = true AND dc.handoff_accepted_at IS NULL';
    }

    query += ' ORDER BY dc.created_at DESC';

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM daive_conversations dc
      WHERE dc.dealer_id = $1
    `;

    if (status === 'requested') {
      countQuery += ' AND dc.handoff_requested = true';
    } else if (status === 'accepted') {
      countQuery += ' AND dc.handoff_requested = false AND dc.handoff_accepted_at IS NOT NULL';
    } else if (status === 'pending') {
      countQuery += ' AND dc.handoff_requested = true AND dc.handoff_accepted_at IS NULL';
    }

    const countResult = await pool.query(countQuery, [dealerId]);

    res.json({
      success: true,
      data: {
        handoffs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching handoffs:', error);
    res.status(500).json({ error: 'Failed to fetch handoffs' });
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
      SELECT 
        dc.id,
        dc.session_id,
        dc.customer_name,
        dc.customer_email,
        dc.customer_phone,
        dc.conversation_type,
        dc.ai_context,
        dc.lead_qualification_score,
        dc.lead_status,
        dc.handoff_requested,
        dc.handoff_to_user_id,
        dc.handoff_reason,
        dc.handoff_requested_at,
        dc.handoff_accepted_at,
        dc.handoff_accepted_by,
        dc.lead_id,
        dc.dealer_id,
        dc.vehicle_id,
        dc.created_at,
        dc.updated_at,
        v.make,
        v.model,
        v.year,
        v.vin,
        v.price,
        v.features,
        c.first_name,
        c.last_name,
        c.email as customer_email_from_table,
        c.phone as customer_phone_from_table
      FROM daive_conversations dc
      LEFT JOIN vehicles v ON dc.vehicle_id = v.id
      LEFT JOIN customers c ON dc.customer_id = c.id
      WHERE dc.id = $1 AND dc.dealer_id = $2
    `;

    const result = await pool.query(query, [id, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get conversation messages from conversation_messages table
    const messagesQuery = `
      SELECT 
        id,
        role,
        content,
        created_at as timestamp
      FROM conversation_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `;

    const messages = await pool.query(messagesQuery, [id]);

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
        messages: messages.rows,
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

// Test endpoint to debug staff query
router.get('/test-staff/:staff_id', authenticateToken, async (req, res) => {
  try {
    const { staff_id } = req.params;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('🔍 Testing staff query for staff_id:', staff_id, 'dealer_id:', dealerId);

    // Test the staff query
    const staffQuery = `
      SELECT ds.id, u.name, u.email 
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = $1 AND ds.dealer_id = $2
    `;
    
    const staffResult = await pool.query(staffQuery, [staff_id, dealerId]);
    
    res.json({
      success: true,
      staff: staffResult.rows[0] || null,
      totalRows: staffResult.rows.length
    });

  } catch (error) {
    console.error('Error testing staff query:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to debug conversation query
router.get('/test-conversation/:conversation_id', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('🔍 Testing conversation query for conversation_id:', conversation_id, 'dealer_id:', dealerId);

    // Test the conversation query
    const conversationQuery = `
      SELECT id, dealer_id, assigned_to, assigned_at, assigned_by
      FROM daive_conversations 
      WHERE id = $1 AND dealer_id = $2
    `;
    
    const conversationResult = await pool.query(conversationQuery, [conversation_id, dealerId]);
    
    res.json({
      success: true,
      conversation: conversationResult.rows[0] || null,
      totalRows: conversationResult.rows.length
    });

  } catch (error) {
    console.error('Error testing conversation query:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/daive/conversation/:id/assign - Assign conversation to staff member
router.post('/conversation/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { staff_id } = req.body;
    const userId = req.user.id;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!staff_id) {
      return res.status(400).json({ error: 'Staff ID is required' });
    }

    // First, verify the conversation exists and belongs to this dealer
    const checkQuery = `
      SELECT id, dealer_id FROM daive_conversations 
      WHERE id = $1 AND dealer_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [id, dealerId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get staff member details from dealership_staff table with user info
    const staffQuery = `
      SELECT ds.id, u.name, u.email 
      FROM dealership_staff ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = $1 AND ds.dealer_id = $2
    `;
    console.log('🔍 Staff query:', staffQuery);
    console.log('🔍 Staff query params:', [staff_id, dealerId]);
    const staffResult = await pool.query(staffQuery, [staff_id, dealerId]);
    console.log('🔍 Staff query result rows:', staffResult.rows.length);

    if (staffResult.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const staff = staffResult.rows[0];
    console.log('🔍 Staff query result:', staff);

    // Update conversation with assignment
    const updateQuery = `
      UPDATE daive_conversations 
      SET assigned_to = $1, assigned_at = NOW(), assigned_by = $2, updated_at = NOW()
      WHERE id = $3 AND dealer_id = $4
    `;

    console.log('🔍 Update query:', updateQuery);
    console.log('🔍 Update params:', [staff_id, userId, id, dealerId]);
    
    const result = await pool.query(updateQuery, [staff_id, userId, id, dealerId]);
    console.log('🔍 Update result:', result);

    res.json({
      success: true,
      data: {
        conversation_id: id,
        assigned_to: staff_id,
        assigned_agent_name: staff.name || 'Unknown',
        assigned_agent_email: staff.email || 'No email',
        assigned_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error assigning conversation:', error);
    res.status(500).json({ error: 'Failed to assign conversation' });
  }
});

// POST /api/daive/conversation/:id/unassign - Unassign conversation from staff member
router.post('/conversation/:id/unassign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Update conversation to remove assignment
    const query = `
      UPDATE daive_conversations 
      SET assigned_to = NULL, assigned_at = NULL, assigned_by = NULL, updated_at = NOW()
      WHERE id = $1 AND dealer_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [id, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error unassigning conversation:', error);
    res.status(500).json({ error: 'Failed to unassign conversation' });
  }
});

// POST /api/daive/prompts - Create/update dealer prompts (supports both single and batch)
router.post('/prompts', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Check if this is a batch operation or single prompt
    if (req.body.prompts && Array.isArray(req.body.prompts)) {
      // Batch operation
      console.log('💾 Processing batch prompt save for dealer:', dealerId);
      console.log('💾 Batch prompts count:', req.body.prompts.length);
      
      const prompts = req.body.prompts;
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const prompt of prompts) {
        const { promptType, promptText } = prompt;
        
        // Skip empty prompts but don't fail the entire batch
        if (!promptType || promptText === undefined || promptText === null) {
          console.log(`⚠️ Skipping invalid prompt:`, { promptType, promptText });
          continue;
        }
        
        try {
          // Upsert prompt
          const query = `
            INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
            VALUES ($1, $2, $3)
            ON CONFLICT (dealer_id, prompt_type) 
            DO UPDATE SET prompt_text = $3, updated_at = NOW()
            RETURNING *
          `;

          const result = await pool.query(query, [dealerId, promptType, promptText]);
          results.push(result.rows[0]);
          successCount++;
          console.log(`✅ Saved prompt ${promptType} successfully`);
        } catch (promptError) {
          console.error(`❌ Error saving prompt ${promptType}:`, promptError);
          errorCount++;
        }
      }
      
      console.log(`🎉 Batch save completed: ${successCount} successful, ${errorCount} errors`);
      
      res.json({
        success: true,
        data: {
          message: `Batch save completed: ${successCount} successful, ${errorCount} errors`,
          results,
          summary: { successCount, errorCount, total: prompts.length }
        }
      });
      
    } else {
      // Single prompt operation (backward compatibility)
      const { promptType, promptText } = req.body;

      if (!promptType || promptText === undefined || promptText === null) {
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
    }

  } catch (error) {
    console.error('Error creating/updating prompts:', error);
    res.status(500).json({ error: 'Failed to create/update prompts' });
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
      ORDER BY dealer_id DESC NULLS LAST
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

// POST /api/daive/api-settings - Save API settings (dealer-specific, supports both single and batch)
router.post('/api-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Check if this is a batch operation or single setting
    if (req.body.settings && Array.isArray(req.body.settings)) {
      // Batch operation
      console.log('💾 Processing batch API settings save for dealer:', dealerId);
      console.log('💾 Batch settings count:', req.body.settings.length);
      
      const settings = req.body.settings;
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const setting of settings) {
        const { settingType, settingValue } = setting;
        
        // Skip invalid settings but don't fail the entire batch
        if (!settingType || settingValue === undefined || settingValue === null) {
          console.log(`⚠️ Skipping invalid setting:`, { settingType, settingValue });
          continue;
        }
        
        // Validate setting type
        const validSettingTypes = ['openai_key', 'elevenlabs_key', 'azure_speech_key', 'deepgram_key', 'voice_provider', 'voice_speech_provider', 'voice_tts_provider', 'openai_tts', 'dealer_id'];
        if (!validSettingTypes.includes(settingType)) {
          console.log(`⚠️ Skipping invalid setting type: ${settingType}`);
          continue;
        }
        
        try {
          // Upsert dealer-specific API setting
          const query = `
            INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
            VALUES ($1, $2, $3)
            ON CONFLICT (dealer_id, setting_type) 
            DO UPDATE SET setting_value = $3, updated_at = NOW()
            RETURNING *
          `;

          const result = await pool.query(query, [dealerId, settingType, settingValue]);
          results.push(result.rows[0]);
          successCount++;
          console.log(`✅ Saved API setting ${settingType} successfully`);
        } catch (settingError) {
          console.error(`❌ Error saving API setting ${settingType}:`, settingError);
          errorCount++;
        }
      }
      
      // Clear the settings cache for this dealer to ensure fresh data
      settingsManager.clearCache(dealerId);
      
      console.log(`🎉 Batch API settings save completed: ${successCount} successful, ${errorCount} errors`);
      
      res.json({
        success: true,
        data: {
          message: `Batch API settings save completed: ${successCount} successful, ${errorCount} errors`,
          results,
          summary: { successCount, errorCount, total: settings.length }
        }
      });
      
    } else {
      // Single setting operation (backward compatibility)
      const { settingType, settingValue } = req.body;

      if (!settingType) {
        return res.status(400).json({ error: 'Setting type is required' });
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

      // Clear the settings cache for this dealer to ensure fresh data
      settingsManager.clearCache(dealerId);

      res.json({
        success: true,
        data: result.rows[0]
      });
    }

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

    // Get all settings from centralized settings manager
    const allSettings = await settingsManager.getAllSettings(dealerId);
    
    // Filter to only include API-related settings
    const apiSettings = {};
    Object.keys(allSettings).forEach(key => {
      if (key.includes('_key') || key.includes('voice_') || key.includes('tts_')) {
        apiSettings[key] = {
          value: allSettings[key],
          isActive: true,
          source: 'dealer' // Since we're getting dealer-specific settings
        };
      }
    });

    res.json({
      success: true,
      data: apiSettings
    });

  } catch (error) {
    console.error('Error getting API settings:', error);
    res.status(500).json({ error: 'Failed to get API settings' });
  }
});

// ========================
// Scenario Flows Endpoints
// ========================

// GET /api/daive/scenarios - fetch dealer-specific scenario steps (all scenarios)
router.get('/scenarios', authenticateToken, async (req, res) => {
  try {
    let dealerId = req.user.dealer_id;
    if (!dealerId && req.user.role === 'super_admin' && req.query.dealerId) {
      dealerId = req.query.dealerId;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });
    const result = await pool.query(
      `SELECT scenario_key, label, step, message_text, response_text
       FROM daive_scenario_flows
       WHERE dealer_id = $1
       ORDER BY scenario_key, step`,
      [dealerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scenarios', reason: error?.message });
  }
});

// POST /api/daive/scenarios - batch upsert scenario steps for a scenario_key
router.post('/scenarios', authenticateToken, async (req, res) => {
  try {
    let dealerId = req.user.dealer_id;
    if (!dealerId && req.user.role === 'super_admin' && req.body?.dealerId) {
      dealerId = req.body.dealerId;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const { scenarioKey, label, steps } = req.body; // steps: [{ step, messageText, responseText }]
    if (!scenarioKey || !Array.isArray(steps)) {
      return res.status(400).json({ success: false, error: 'scenarioKey and steps array are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const s of steps) {
        const { step, messageText, responseText } = s;
        await client.query(
          `INSERT INTO daive_scenario_flows (dealer_id, scenario_key, label, step, message_text, response_text)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (dealer_id, scenario_key, step)
           DO UPDATE SET label = EXCLUDED.label, message_text = EXCLUDED.message_text, response_text = EXCLUDED.response_text, updated_at = NOW()`,
          [dealerId, scenarioKey, label || null, step, messageText || null, responseText || null]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('Error saving scenarios:', txErr);
      res.status(500).json({ success: false, error: 'Failed to save scenarios' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving scenarios:', error);
    res.status(500).json({ success: false, error: 'Failed to save scenarios', reason: error?.message });
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

    // Get the API key for testing from centralized settings manager
    const apiKeys = await settingsManager.getAPIKeys(dealerId);
    
    let apiKey = null;
    switch (apiType) {
      case 'openai':
        apiKey = apiKeys.openai;
        break;
      case 'openai_tts':
        apiKey = apiKeys.openai;
        break;
      case 'elevenlabs':
        apiKey = apiKeys.elevenlabs;
        break;
      case 'deepgram_tts':
        apiKey = apiKeys.deepgram;
        break;
      case 'azure':
        apiKey = apiKeys.azure;
        break;
      case 'deepgram':
        apiKey = apiKeys.deepgram;
        break;
      default:
        return res.status(400).json({ error: 'Unknown API type' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key not found' });
    }

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
              voice: settingsManager.getDefaultSettings().voice_openai_voice,
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
    const { 
      enabled, 
      language, 
      voiceSpeed, 
      voicePitch, 
      voiceProvider, 
      speechProvider, 
      ttsProvider, 
      openaiVoice, 
      elevenLabsVoice,
      // New AI bot voice settings
      autoVoiceResponse,
      voiceQuality,
      voiceEmotion,
      recordingQuality
    } = req.body;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get default settings from settings manager
    const defaultSettings = settingsManager.getDefaultSettings();
    
    // Prepare settings object for batch update
    const settings = {
      'voice_enabled': enabled || defaultSettings.voice_enabled,
      'voice_language': language || defaultSettings.voice_language,
      'voice_speed': voiceSpeed || defaultSettings.voice_speed,
      'voice_pitch': voicePitch || defaultSettings.voice_pitch,
      'voice_provider': voiceProvider || defaultSettings.voice_provider,
      'voice_speech_provider': speechProvider || defaultSettings.voice_speech_provider,
      'voice_tts_provider': ttsProvider || defaultSettings.voice_tts_provider,
      'voice_openai_voice': openaiVoice || defaultSettings.voice_openai_voice,
      'voice_elevenlabs_voice': elevenLabsVoice || defaultSettings.voice_elevenlabs_voice,
      // New AI bot voice settings
      'voice_auto_response': autoVoiceResponse !== undefined ? autoVoiceResponse : defaultSettings.voice_auto_response || true,
      'voice_quality': voiceQuality || defaultSettings.voice_quality || 'hd',
      'voice_emotion': voiceEmotion || defaultSettings.voice_emotion || 'friendly',
      'voice_recording_quality': recordingQuality || defaultSettings.voice_recording_quality || 'high'
    };

    // Use batch update from settings manager for better performance
    const result = await settingsManager.batchUpdateSettings(dealerId, settings);
    
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to save voice settings' });
    }

    res.json({
      success: true,
      data: {
        enabled: settings['voice_enabled'],
        language: settings['voice_language'],
        voiceSpeed: settings['voice_speed'],
        voicePitch: settings['voice_pitch'],
        voiceProvider: settings['voice_provider'],
        speechProvider: settings['voice_speech_provider'],
        ttsProvider: settings['voice_tts_provider'],
        openaiVoice: settings['voice_openai_voice'],
        elevenLabsVoice: settings['voice_elevenlabs_voice'],
        // New AI bot voice settings
        autoVoiceResponse: settings['voice_auto_response'],
        voiceQuality: settings['voice_quality'],
        voiceEmotion: settings['voice_emotion'],
        recordingQuality: settings['voice_recording_quality']
      },
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

    // Get voice settings from centralized settings manager
    const voiceSettings = await settingsManager.getVoiceSettings(dealerId);

    // Map the settings to match the expected frontend structure (same as POST endpoint)
    const mappedSettings = {
      enabled: voiceSettings.enabled,
      language: voiceSettings.language,
      voiceSpeed: voiceSettings.voiceSpeed || voiceSettings.speed, // Handle both field names
      voicePitch: voiceSettings.voicePitch || voiceSettings.pitch, // Handle both field names
      voiceProvider: voiceSettings.provider,
      speechProvider: voiceSettings.speechProvider,
      ttsProvider: voiceSettings.ttsProvider,
      openaiVoice: voiceSettings.openaiVoice,
      elevenLabsVoice: voiceSettings.elevenlabsVoice,
      // Additional AI bot voice settings
      autoVoiceResponse: voiceSettings.autoResponse,
      voiceQuality: voiceSettings.quality,
      voiceEmotion: voiceSettings.emotion,
      recordingQuality: voiceSettings.recordingQuality,
      realtimeEnabled: voiceSettings.realtimeEnabled,
      streamingEnabled: voiceSettings.streamingEnabled,
      responseFormat: voiceSettings.responseFormat,
      ttsModel: voiceSettings.ttsModel,
      ttsStability: voiceSettings.ttsStability,
      ttsSimilarityBoost: voiceSettings.ttsSimilarityBoost
    };

    console.log('🔍 GET voice-settings - Raw settings manager data:', voiceSettings);
    console.log('🔍 GET voice-settings - Mapped frontend data:', mappedSettings);

    res.json({
      success: true,
      data: mappedSettings
    });

  } catch (error) {
    console.error('Error getting voice settings:', error);
    res.status(500).json({ error: 'Failed to get voice settings' });
  }
});

// GET /api/daive/crew-ai-settings - Get Crew AI settings for a dealer
router.get('/crew-ai-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Dealer access required' 
      });
    }

    console.log('🔍 Getting Crew AI settings for dealer:', dealerId);

    // Get Crew AI settings from centralized settings manager (same as voice settings)
    const crewAISettings = await settingsManager.getCrewAISettings(dealerId);
    
    console.log('✅ Crew AI settings retrieved from settings manager:', crewAISettings);
    
    res.json({
      success: true,
      data: {
        enabled: crewAISettings.enabled || false,
        autoRouting: crewAISettings.autoRouting || true,
        enableSalesCrew: crewAISettings.enableSalesCrew || true,
        enableCustomerServiceCrew: crewAISettings.enableCustomerServiceCrew || true,
        enableInventoryCrew: crewAISettings.enableInventoryCrew || false,
        crewCollaboration: crewAISettings.crewCollaboration || true,
        agentMemory: crewAISettings.agentMemory || true,
        performanceTracking: crewAISettings.performanceTracking || true,
        fallbackToTraditional: crewAISettings.fallbackToTraditional || true,
        crewSelection: crewAISettings.crewSelection || 'auto',
        maxTokens: crewAISettings.maxTokens || 300,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error getting Crew AI settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Crew AI settings' 
    });
  }
});

// POST /api/daive/crew-ai-settings - Save Crew AI settings for a dealer
router.post('/crew-ai-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { 
      enabled, autoRouting, enableSalesCrew, enableCustomerServiceCrew,
      enableInventoryCrew, crewCollaboration, agentMemory, performanceTracking,
      fallbackToTraditional, crewSelection, maxTokens
    } = req.body;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Dealer access required' 
      });
    }

    console.log('💾 Saving Crew AI settings for dealer:', dealerId);
    console.log('💾 Settings data:', { 
      enabled, autoRouting, enableSalesCrew, enableCustomerServiceCrew,
      enableInventoryCrew, crewCollaboration, agentMemory, performanceTracking,
      fallbackToTraditional, crewSelection, maxTokens
    });

    // Get default settings from settings manager
    const defaultSettings = settingsManager.getDefaultSettings();
    
    // Prepare settings object for batch update (same pattern as voice settings)
    const settings = {
      'crew_ai_enabled': enabled !== undefined ? enabled : defaultSettings.crew_ai_enabled,
      'crew_ai_auto_routing': autoRouting !== undefined ? autoRouting : defaultSettings.crew_ai_auto_routing,
      'crew_ai_enable_sales_crew': enableSalesCrew !== undefined ? enableSalesCrew : defaultSettings.crew_ai_enable_sales_crew,
      'crew_ai_enable_customer_service_crew': enableCustomerServiceCrew !== undefined ? enableCustomerServiceCrew : defaultSettings.crew_ai_enable_customer_service_crew,
      'crew_ai_enable_inventory_crew': enableInventoryCrew !== undefined ? enableInventoryCrew : defaultSettings.crew_ai_enable_inventory_crew,
      'crew_ai_crew_collaboration': crewCollaboration !== undefined ? crewCollaboration : defaultSettings.crew_ai_crew_collaboration,
      'crew_ai_agent_memory': agentMemory !== undefined ? agentMemory : defaultSettings.crew_ai_agent_memory,
      'crew_ai_performance_tracking': performanceTracking !== undefined ? performanceTracking : defaultSettings.crew_ai_performance_tracking,
      'crew_ai_fallback_to_traditional': fallbackToTraditional !== undefined ? fallbackToTraditional : defaultSettings.crew_ai_fallback_to_traditional,
      'crew_ai_crew_selection': crewSelection || defaultSettings.crew_ai_crew_selection,
      'crew_ai_max_tokens': maxTokens !== undefined ? maxTokens : defaultSettings.crew_ai_max_tokens
    };

    // Use batch update from settings manager for better performance (same as voice settings)
    const result = await settingsManager.batchUpdateSettings(dealerId, settings);
    
    if (!result.success) {
      console.error('❌ Failed to save Crew AI settings via settings manager');
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save Crew AI settings' 
      });
    }

    console.log('✅ Crew AI settings saved successfully via settings manager');

    res.json({
      success: true,
      data: {
        enabled: settings['crew_ai_enabled'],
        autoRouting: settings['crew_ai_auto_routing'],
        enableSalesCrew: settings['crew_ai_enable_sales_crew'],
        enableCustomerServiceCrew: settings['crew_ai_enable_customer_service_crew'],
        enableInventoryCrew: settings['crew_ai_enable_inventory_crew'],
        crewCollaboration: settings['crew_ai_crew_collaboration'],
        agentMemory: settings['crew_ai_agent_memory'],
        performanceTracking: settings['crew_ai_performance_tracking'],
        fallbackToTraditional: settings['crew_ai_fallback_to_traditional'],
        crewSelection: settings['crew_ai_crew_selection'],
        maxTokens: settings['crew_ai_max_tokens'] || 300,
        lastUpdated: new Date().toISOString()
      },
      message: 'Crew AI settings saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving Crew AI settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save Crew AI settings' 
    });
  }
});

// POST /api/daive/ai-bot-settings - Save AI Bot behavior and lead settings
router.post('/ai-bot-settings', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 AI Bot settings route called');
    console.log('🔍 Request body:', req.body);
    console.log('🔍 User object:', req.user);
    
    const { behavior, leadSettings } = req.body;
    
    // Get dealer ID from the authenticated user
    const dealerId = req.user.dealer_id || req.user.dealerId || req.user.id;
    
    console.log('🔍 Extracted dealer ID:', dealerId);
    console.log('🔍 Available user properties:', Object.keys(req.user));
    
    if (!dealerId) {
      console.error('❌ No dealer ID found in user object');
      return res.status(400).json({ 
        success: false, 
        error: 'Dealer ID is required',
        userInfo: {
          hasDealerId: !!req.user.dealer_id,
          hasDealerIdAlt: !!req.user.dealerId,
          hasUserId: !!req.user.id,
          availableProps: Object.keys(req.user)
        }
      });
    }

    console.log('💾 Saving AI Bot settings for dealer:', dealerId);
    console.log('💾 Behavior settings:', behavior);
    console.log('💾 Lead settings:', leadSettings);

    // Prepare settings object for batch update
    const settings = {};
    
    // Add behavior settings if provided
    if (behavior) {
      Object.keys(behavior).forEach(key => {
        settings[`ai_bot_${key}`] = behavior[key];
      });
    }
    
    // Add lead settings if provided
    if (leadSettings) {
      Object.keys(leadSettings).forEach(key => {
        settings[`lead_${key}`] = leadSettings[key];
      });
    }

    console.log('💾 Prepared settings object:', settings);

    // Use batch update from settings manager for better performance
    const result = await settingsManager.batchUpdateSettings(dealerId, settings);
    
    console.log('💾 Settings manager result:', result);
    
    if (!result.success) {
      console.error('❌ Failed to save AI Bot settings:', result.error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save AI Bot settings',
        details: result.error
      });
    }

    console.log('✅ AI Bot settings saved successfully');

    res.json({
      success: true,
      data: {
        behavior,
        leadSettings,
        lastUpdated: new Date().toISOString()
      },
      message: 'AI Bot settings saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving AI Bot settings:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save AI Bot settings',
      details: error.message,
      stack: error.stack
    });
  }
});

// GET /api/daive/prompts/public - Get public prompts (no authentication required)
router.get('/prompts/public', async (req, res) => {
  try {
    const { dealerId } = req.query;
    
    if (!dealerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dealer ID is required' 
      });
    }

    console.log('🔍 Getting public prompts for dealer:', dealerId);

    // Get prompts from centralized settings manager
    // Note: Since prompts are not currently in settingsManager, we'll keep the existing query
    // but this could be moved to settingsManager in the future for consistency
    const query = `
      WITH dealer_prompts AS (
        SELECT prompt_type, prompt_text, 'dealer' as source
        FROM daive_prompts 
        WHERE dealer_id = $1 AND is_active = true
      ),
      global_prompts AS (
        SELECT prompt_type, prompt_text, 'global' as source
        FROM daive_prompts 
        WHERE dealer_id IS NULL AND is_active = true
      )
      SELECT prompt_type, prompt_text, source
      FROM dealer_prompts
      UNION ALL
      SELECT prompt_type, prompt_text, source
      FROM global_prompts
      WHERE prompt_type NOT IN (SELECT prompt_type FROM dealer_prompts)
      ORDER BY prompt_type
    `;

    const result = await pool.query(query, [dealerId]);

    const prompts = {};
    result.rows.forEach(row => {
      prompts[row.prompt_type] = row.prompt_text;
    });

    console.log('✅ Public prompts retrieved:', Object.keys(prompts));
    
    res.json({
      success: true,
      data: prompts
    });

  } catch (error) {
    console.error('❌ Error getting public prompts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get public prompts' 
    });
  }
});

// POST /api/daive/tts - Generate TTS audio for any text
router.post('/tts', async (req, res) => {
  try {
    const startTime = Date.now();
    const processTimings = {
      total: 0,
      textCleaning: 0,
      settingsRetrieval: 0
    };
    
    const { text, dealerId, sessionId, voice, model, saveToUploads, provider } = req.body;
    
    console.log('🎤 TTS endpoint called with:', {
      textLength: text?.length || 0,
      dealerId,
      sessionId,
      voice,
      model,
      saveToUploads,
      provider
    });

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for TTS generation'
      });
    }

    // Track text cleaning time
    const textCleaningStart = Date.now();
    // Clean the text for TTS
    const cleanedText = cleanTextForTTS(text);
    processTimings.textCleaning = Date.now() - textCleaningStart;
    console.log('⏱️ Text cleaning time:', processTimings.textCleaning, 'ms');
    console.log('🧹 Text cleaned for TTS:', cleanedText.substring(0, 100) + '...');

    let audioResponseUrl = null;

    try {
      // Track settings retrieval time
      const settingsStartTime = Date.now();
      // Get all TTS and API settings from centralized settings manager
      const ttsSettings = await settingsManager.getTTSSettings(dealerId);
      const apiKeys = await settingsManager.getAPIKeys(dealerId);
      processTimings.settingsRetrieval = Date.now() - settingsStartTime;
      console.log('⏱️ Settings retrieval time:', processTimings.settingsRetrieval, 'ms');
      
      console.log('🎤 TTS settings from settings manager:', ttsSettings);
      console.log('🔑 API keys from settings manager:', Object.keys(apiKeys).filter(key => apiKeys[key]));
      
      // Get default settings from settings manager
      const defaultSettings = settingsManager.getDefaultSettings();
      
      // Determine TTS provider to use
      let ttsProvider = provider || ttsSettings.ttsProvider || defaultSettings.tts_provider;
      
      // Track TTS generation time
      const ttsStartTime = Date.now();
      
      if (ttsProvider === 'elevenlabs') {
        // Use ElevenLabs TTS
        console.log('🎤 Using ElevenLabs TTS for greeting...');
        
        if (apiKeys.elevenlabs) {
          // Map voice names to ElevenLabs voice IDs
          const voiceMap = {
            'liam': 'wUwsnXivqGrDWuz1Fc89',      // Liam voice
        'mark': 'UgBBYS2sOqTuMpoF3BR0',      // Mark voice
            'jessica': 'cgSgspJ2msm6clMCkdW9',   // Jessica voice
            'rachel': '21m00Tcm4TlvDq8ikWAM',   // Rachel voice
            'alloy': 'alloy',                     // OpenAI voice (fallback)
            'default': 'UgBBYS2sOqTuMpoF3BR0'   // Default to Mark voice
          };
          
          const voiceId = voiceMap[voice] || voiceMap.default;
          console.log(`🎤 Using ElevenLabs voice: ${voice} (ID: ${voiceId})`);
          
          // Generate speech using ElevenLabs
          const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKeys.elevenlabs,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: cleanedText,
                              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: ttsSettings.stability || 0.5,
                similarity_boost: ttsSettings.similarityBoost || 0.5
              }
            })
          });
          
          if (speechResponse.ok) {
            const audioBlob = await speechResponse.blob();
            const audioFileName = `greeting-${voice}-${Date.now()}.mp3`;
            const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
            
            // Ensure directory exists
            const dir = path.dirname(audioPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            // Save the audio file
            const buffer = await audioBlob.arrayBuffer();
            fs.writeFileSync(audioPath, Buffer.from(buffer));
            
            audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
            console.log('✅ ElevenLabs TTS greeting audio generated successfully');
          } else {
            console.error('❌ ElevenLabs TTS failed:', speechResponse.status);
            const errorText = await speechResponse.text();
            console.error('❌ Error response:', errorText);
            
            // 🚀 AUTOMATIC FALLBACK: Try OpenAI TTS when ElevenLabs fails
            console.log('🔄 ElevenLabs failed, automatically falling back to OpenAI TTS...');
            if (apiKeys.openai) {
              try {
                // Map voice names to OpenAI voices
                const openaiVoiceMap = {
                  'liam': 'alloy',      // Map Liam to OpenAI's alloy voice
        'mark': 'alloy',      // Map Mark to OpenAI's alloy voice
                  'jessica': 'nova',    // Map Jessica to OpenAI's nova voice
                  'rachel': 'echo',     // Map Rachel to OpenAI's echo voice
                  'alloy': 'alloy',     // Keep alloy as alloy
                  'default': 'alloy'
                };
                
                const openaiVoice = openaiVoiceMap[voice] || openaiVoiceMap.default;
                console.log(`🎤 Fallback: Using OpenAI voice: ${openaiVoice} for requested voice: ${voice}`);
                
                // Generate speech using OpenAI
                const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKeys.openai}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: model || 'tts-1',
                    voice: openaiVoice,
                    input: cleanedText
                  })
                });
                
                if (openaiResponse.ok) {
                  const audioBlob = await openaiResponse.blob();
                  const audioFileName = `greeting-${voice}-fallback-openai-${Date.now()}.mp3`;
                  const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
                  
                  // Ensure directory exists
                  const dir = path.dirname(audioPath);
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                  }
                  
                  // Save the audio file
                  const buffer = await openaiResponse.arrayBuffer();
                  fs.writeFileSync(audioPath, Buffer.from(buffer));
                  
                  audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
                  console.log('✅ OpenAI TTS fallback successful after ElevenLabs failure');
                } else {
                  console.error('❌ OpenAI TTS fallback also failed:', openaiResponse.status);
                }
              } catch (fallbackError) {
                console.error('❌ OpenAI TTS fallback error:', fallbackError);
              }
            } else {
              console.log('⚠️ No OpenAI API key available for fallback');
            }
          }
        } else {
          console.log('⚠️ No ElevenLabs API key found');
        }
        
      } else if (ttsProvider === 'openai') {
        // Use OpenAI TTS as fallback
        console.log('🎤 Using OpenAI TTS as fallback...');
        
        if (apiKeys.openai) {
          // Map voice names to OpenAI voices
          const openaiVoiceMap = {
            'alloy': 'alloy',
            'echo': 'echo',
            'fable': 'fable',
            'onyx': 'onyx',
            'nova': 'nova',
            'shimmer': 'shimmer',
            'default': defaultSettings.voice_openai_voice
          };
          
          const openaiVoice = openaiVoiceMap[voice] || openaiVoiceMap.default;
          console.log(`🎤 Using OpenAI voice: ${openaiVoice}`);
          
          // Generate speech using OpenAI
          const speechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeys.openai}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model || 'tts-1',
              voice: openaiVoice,
              input: cleanedText
            })
          });
          
          if (speechResponse.ok) {
            const audioBlob = await speechResponse.blob();
            const audioFileName = `greeting-openai-${openaiVoice}-${Date.now()}.mp3`;
            const audioPath = path.join(__dirname, '../../uploads/daive-audio', audioFileName);
            
            // Ensure directory exists
            const dir = path.dirname(audioPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            // Save the audio file
            const buffer = await audioBlob.arrayBuffer();
            fs.writeFileSync(audioPath, Buffer.from(buffer));
            
            audioResponseUrl = `/uploads/daive-audio/${audioFileName}`;
            console.log('✅ OpenAI TTS greeting audio generated successfully');
          } else {
            console.error('❌ OpenAI TTS failed:', speechResponse.status);
            const errorText = await speechResponse.text();
            console.error('❌ Error response:', errorText);
          }
        } else {
          console.log('⚠️ No OpenAI API key found');
        }
      }
      
    } catch (ttsError) {
      console.error('❌ TTS generation error:', ttsError);
    }

    // Complete TTS timing
    processTimings.total = Date.now() - startTime;
    
    // Log comprehensive performance metrics
    console.log('📊 TTS Performance Metrics:', {
      totalTime: processTimings.total + 'ms',
      textCleaning: processTimings.textCleaning + 'ms',
      settingsRetrieval: processTimings.settingsRetrieval + 'ms',
      breakdown: {
        textCleaningPercentage: ((processTimings.textCleaning / processTimings.total) * 100).toFixed(1) + '%',
        settingsPercentage: ((processTimings.settingsRetrieval / processTimings.total) * 100).toFixed(1) + '%'
      }
    });
    
    if (audioResponseUrl) {
      console.log('✅ TTS endpoint completed successfully');
      res.json({
        success: true,
        audioUrl: audioResponseUrl,
        performanceMetrics: {
          totalTime: processTimings.total,
          textCleaning: processTimings.textCleaning,
          settingsRetrieval: processTimings.settingsRetrieval,
          breakdown: {
            textCleaningPercentage: ((processTimings.textCleaning / processTimings.total) * 100).toFixed(1) + '%',
            settingsPercentage: ((processTimings.settingsRetrieval / processTimings.total) * 100).toFixed(1) + '%'
          }
        }
      });
    } else {
      console.log('⚠️ TTS generation failed, returning error');
      res.status(500).json({
        success: false,
        error: 'Failed to generate TTS audio'
      });
    }

  } catch (error) {
    console.error('❌ Error in TTS endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Public endpoint to get TTS settings (no authentication required)
router.get('/tts-settings/public', async (req, res) => {
  try {
    const { dealerId } = req.query;
    
    if (!dealerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dealer ID is required' 
      });
    }

    console.log('🔍 Getting public TTS settings for dealer:', dealerId);

    // Get TTS settings from centralized settings manager
    const ttsSettings = await settingsManager.getTTSSettings(dealerId);
    const apiKeys = await settingsManager.getAPIKeys(dealerId);
    
    // Return only the necessary information for TTS configuration
    const publicSettings = {
      ttsProvider: ttsSettings.ttsProvider || 'openai',
      availableVoices: {
        openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        elevenlabs: ['liam', 'jessica', 'rachel', 'domi', 'bella', 'antoni']
      },
      hasOpenAI: !!apiKeys.openai,
      hasElevenLabs: !!apiKeys.elevenlabs,
              defaultVoice: ttsSettings.ttsProvider === 'elevenlabs' ? 'mark' : 'alloy'
    };

    console.log('✅ Public TTS settings retrieved:', publicSettings);
    
    res.json({
      success: true,
      data: publicSettings
    });

  } catch (error) {
    console.error('❌ Error getting public TTS settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get TTS settings' 
    });
  }
});

// Test endpoint to check audio file generation
router.get('/test-audio/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const audioPath = path.join(__dirname, '../../uploads/daive-audio', filename);
    
    console.log('🔍 Testing audio file access:', {
      filename,
      fullPath: audioPath,
      exists: fs.existsSync(audioPath)
    });
    
    if (fs.existsSync(audioPath)) {
      const stats = fs.statSync(audioPath);
      console.log('📊 Audio file stats:', {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
      
      res.json({
        success: true,
        exists: true,
        size: stats.size,
        path: audioPath,
        url: `/uploads/daive-audio/${filename}`
      });
    } else {
      res.json({
        success: false,
        exists: false,
        path: audioPath
      });
    }
  } catch (error) {
    console.error('❌ Error testing audio file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/daive/deal-conversation/:conversationId/messages
// Load prior customer DAIVE messages + structured slot context for a deal
// (read-only — no live session state is touched)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/deal-conversation/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ success: false, error: 'Dealer access required' });
    }

    const { pool } = await import('../database/connection.js');

    // Get conversation metadata (verify it belongs to this dealer)
    const convResult = await pool.query(
      `SELECT id, session_id, customer_name, customer_email, customer_phone,
              lead_qualification_score, lead_status, ai_context
       FROM daive_conversations
       WHERE id = $1 AND dealer_id = $2`,
      [conversationId, dealerId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const conv = convResult.rows[0];

    // Get all messages in chronological order
    const msgResult = await pool.query(
      `SELECT role, content, created_at as timestamp
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conv.id]
    );

    // Get structured slot context from conversation_context_optimized table
    // This contains Daivesteps (vehicle prefs, budget, trade-in, finance slots, etc.)
    let slotContext = null;
    if (conv.session_id) {
      try {
        const ctxResult = await pool.query(
          `SELECT daivesteps, budget_info, vehicle_preferences, finance_info,
                  customer_profile, test_drive_info, appointment_info,
                  lead_qualification_score, lead_status, current_step,
                  selected_vehicles, shared_vehicles
           FROM conversation_context_optimized
           WHERE session_id = $1
           LIMIT 1`,
          [conv.session_id]
        );
        if (ctxResult.rows.length > 0) {
          slotContext = ctxResult.rows[0];
        }
      } catch (ctxErr) {
        console.warn('⚠️ Could not load slot context for deal conversation:', ctxErr.message);
      }
    }

    res.json({
      success: true,
      conversation: {
        id: conv.id,
        session_id: conv.session_id,
        customer_name: conv.customer_name,
        customer_email: conv.customer_email,
        customer_phone: conv.customer_phone,
        lead_score: conv.lead_qualification_score,
        lead_status: conv.lead_status,
      },
      messages: msgResult.rows,
      // Structured slot data collected during the DAIVE purchase journey
      slot_context: slotContext ? {
        daivesteps: slotContext.daivesteps || {},
        budget_info: slotContext.budget_info || {},
        vehicle_preferences: slotContext.vehicle_preferences || {},
        finance_info: slotContext.finance_info || {},
        customer_profile: slotContext.customer_profile || {},
        test_drive_info: slotContext.test_drive_info || {},
        appointment_info: slotContext.appointment_info || {},
        current_step: slotContext.current_step,
        selected_vehicles: slotContext.selected_vehicles || [],
      } : null,
    });
  } catch (error) {
    console.error('Error loading deal conversation messages:', error);
    res.status(500).json({ success: false, error: 'Failed to load conversation', message: error.message });
  }
});

// =====================================================
// DEALER FINANCE SETTINGS (taxes, fees, add-ons)
// =====================================================

/**
 * GET /api/daive/finance-settings
 * Returns the dealer's default tax rates, fees, and add-ons.
 * Used by DAIVE to quote out-the-door prices.
 */
router.get('/finance-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    const result = await query(
      `SELECT * FROM dealer_finance_settings WHERE dealer_id = $1 LIMIT 1`,
      [dealerId]
    );

    const USA_DEFAULTS = {
      sales_tax_rate: 0.0625,
      title_fee: 33,
      license_fee: 51,
      registration_fee: 150,
      inspection_fee: 25,
      doc_fee: 499,
      acquisition_fee: 895,
      dealer_addons_total: 0,
      addon_description: '',
      state_code: 'TX'
    };

    const data = result.rows.length > 0 ? result.rows[0] : USA_DEFAULTS;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching dealer finance settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch finance settings' });
  }
});

/**
 * PUT /api/daive/finance-settings
 * Upserts the dealer's default tax rates, fees, and add-ons.
 */
router.put('/finance-settings', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    const {
      sales_tax_rate,
      title_fee,
      license_fee,
      registration_fee,
      inspection_fee,
      doc_fee,
      acquisition_fee,
      dealer_addons_total,
      addon_description,
      state_code
    } = req.body;

    const result = await query(
      `INSERT INTO dealer_finance_settings
         (dealer_id, sales_tax_rate, title_fee, license_fee, registration_fee,
          inspection_fee, doc_fee, acquisition_fee, dealer_addons_total,
          addon_description, state_code, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (dealer_id) DO UPDATE SET
         sales_tax_rate    = EXCLUDED.sales_tax_rate,
         title_fee         = EXCLUDED.title_fee,
         license_fee       = EXCLUDED.license_fee,
         registration_fee  = EXCLUDED.registration_fee,
         inspection_fee    = EXCLUDED.inspection_fee,
         doc_fee           = EXCLUDED.doc_fee,
         acquisition_fee   = EXCLUDED.acquisition_fee,
         dealer_addons_total = EXCLUDED.dealer_addons_total,
         addon_description = EXCLUDED.addon_description,
         state_code        = EXCLUDED.state_code,
         updated_at        = NOW()
       RETURNING *`,
      [
        dealerId,
        parseFloat(sales_tax_rate) || 0,
        parseFloat(title_fee) || 0,
        parseFloat(license_fee) || 0,
        parseFloat(registration_fee) || 0,
        parseFloat(inspection_fee) || 0,
        parseFloat(doc_fee) || 0,
        parseFloat(acquisition_fee) || 0,
        parseFloat(dealer_addons_total) || 0,
        addon_description || '',
        (state_code || '').toUpperCase().slice(0, 2)
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error saving dealer finance settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save finance settings' });
  }
});

// PATCH /api/daive/test-drive-appointments/:id — update day, time, or status
router.patch('/test-drive-appointments/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const { id } = req.params;
    const { scheduled_day, scheduled_time, status, notes } = req.body;

    const allowed = ['scheduled', 'completed', 'cancelled', 'no_show'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const setParts = [];
    const params   = [];
    let   idx      = 1;

    if (scheduled_day  !== undefined) { setParts.push(`scheduled_day  = $${idx++}`); params.push(scheduled_day); }
    if (scheduled_time !== undefined) { setParts.push(`scheduled_time = $${idx++}`); params.push(scheduled_time); }
    if (status         !== undefined) { setParts.push(`status         = $${idx++}`); params.push(status); }
    if (notes          !== undefined) { setParts.push(`notes          = $${idx++}`); params.push(notes); }

    if (setParts.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    setParts.push(`updated_at = NOW()`);
    params.push(id, dealerId);

    const result = await pool.query(
      `UPDATE test_drive_appointments
          SET ${setParts.join(', ')}
        WHERE id = $${idx} AND dealer_id = $${idx + 1}
        RETURNING *`,
      params
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating test drive appointment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/daive/test-drive-appointments — list scheduled test drives for the dealer
router.get('/test-drive-appointments', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const { status, start_date, end_date } = req.query;

    let query = `
      SELECT
        tda.id,
        tda.conversation_id,
        tda.session_id,
        tda.customer_name,
        tda.customer_email,
        tda.vehicle_id,
        tda.vehicle_name,
        tda.scheduled_day,
        tda.scheduled_time,
        tda.scheduled_date,
        tda.status,
        tda.notes,
        tda.created_at,
        tda.updated_at,
        v.make, v.model, v.year, v.vin, v.price,
        dc.lead_status, dc.lead_qualification_score
      FROM test_drive_appointments tda
      LEFT JOIN vehicles v          ON tda.vehicle_id      = v.id
      LEFT JOIN daive_conversations dc ON tda.conversation_id = dc.id
      WHERE tda.dealer_id = $1
    `;
    const params = [dealerId];
    let idx = 2;

    if (status && status !== 'all') {
      query += ` AND tda.status = $${idx++}`;
      params.push(status);
    }
    if (start_date) {
      query += ` AND tda.created_at >= $${idx++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND tda.created_at < ($${idx++}::date + interval '1 day')`;
      params.push(end_date);
    }
    query += ` ORDER BY tda.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching test drive appointments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
