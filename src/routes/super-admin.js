import express from 'express';
import { query, pool } from '../database/connection.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';
import { body, validationResult, query as vquery, param } from 'express-validator';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import auditLogger from '../lib/auditLogger.js';
import { superAdminAuditMiddleware } from '../middleware/auditMiddleware.js';
import emailService from '../lib/emailService.js';
import DAIVEService from '../lib/daivecrewai.js';

const router = express.Router();
const daiveService = new DAIVEService();

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ===== Marketing Journeys Utilities =====
async function loadGlobalSmtpSettings() {
  // Expect integration_settings rows for provider='smtp' with keys: host, port, secure, user, pass, from
  const result = await query(
    `SELECT key, secret, config FROM integration_settings 
     WHERE scope = 'global' AND provider = 'smtp' AND is_active = TRUE`
  );
  if (result.rows.length === 0) {
    throw new Error('SMTP settings not configured');
  }
  const settingsMap = {};
  for (const row of result.rows) {
    // prefer secret for sensitive values, fallback to config.value
    const value = row.secret ?? (row.config && row.config.value) ?? null;
    settingsMap[row.key] = value;
  }
  const host = settingsMap.host;
  const port = settingsMap.port ? Number(settingsMap.port) : undefined;
  const secure = settingsMap.secure === true || settingsMap.secure === 'true';
  const user = settingsMap.user;
  const pass = settingsMap.pass;
  const from = settingsMap.from || settingsMap.from_address;
  if (!host || !port || !user || !pass || !from) {
    throw new Error('Incomplete SMTP settings');
  }
  return { host, port, secure, user, pass, from };
}

async function getSmtpTransport() {
  const smtp = await loadGlobalSmtpSettings();
  return {
    transporter: nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass }
    }),
    from: smtp.from
  };
}

async function sendJourneyEmail(to, subject, html, trackingPixelId = null) {
  const { transporter, from } = await getSmtpTransport();
  
  // Add tracking pixel if trackingPixelId is provided
  let htmlWithTracking = html;
  if (trackingPixelId) {
    const trackingPixel = `<img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/super-admin/track/open/${trackingPixelId}" width="1" height="1" style="display:none;" />`;
    htmlWithTracking = html + trackingPixel;
  }
  
  // Add click tracking to all links
  if (trackingPixelId) {
    // Simple regex to find and replace links
    htmlWithTracking = htmlWithTracking.replace(
      /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
      (match, beforeHref, url, afterHref) => {
        const encodedUrl = encodeURIComponent(url);
        const trackedUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/super-admin/track/click/${trackingPixelId}?url=${encodedUrl}`;
        return `<a ${beforeHref}href="${trackedUrl}"${afterHref}>`;
      }
    );
  }
  
  const info = await transporter.sendMail({ 
    from, 
    to, 
    subject, 
    html: htmlWithTracking 
  });
  return info.messageId;
}

// ===== Daive Integration Endpoints =====

// Test Daive connection using existing AI settings
router.post('/daive/test-connection',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      // Import the settings manager to use existing Daive settings
      const { default: SettingsManager } = await import('../lib/settingsManager.js');
      const settingsManager = new SettingsManager();
      
      // Get global Daive settings (same as existing AI settings)
      const allSettings = await settingsManager.getAllSettings(null); // null = global
      const apiKeys = await settingsManager.getAPIKeys(null);
      
      console.log('🔍 Testing Daive connection with settings:', Object.keys(apiKeys).filter(key => apiKeys[key]));
      
      // Check if we have the essential API keys
      const requiredKeys = ['openai_key'];
      const missingKeys = requiredKeys.filter(key => !apiKeys[key]);
      
      if (missingKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required API keys',
          missing: missingKeys,
          available: Object.keys(apiKeys).filter(key => apiKeys[key])
        });
      }
      
      // Test OpenAI connection (most basic Daive dependency)
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: apiKeys.openai_key
        });
        
        // Simple test call
        const testResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test connection' }],
          max_tokens: 5
        });
        
        const status = {
          success: true,
          message: 'Daive connection test successful',
          providers: {
            openai: !!apiKeys.openai_key,
            elevenlabs: !!apiKeys.elevenlabs_key,
            deepgram: !!apiKeys.deepgram_key,
            azure: !!apiKeys.azure_speech_key
          },
          settings: {
            voice_provider: allSettings.voice_provider || 'elevenlabs',
            tts_provider: allSettings.tts_provider || 'elevenlabs',
            crew_ai_enabled: allSettings.crew_ai_enabled || false
          },
          test_response: testResponse.choices[0]?.message?.content || 'OK'
        };
        
        res.json(status);
        
      } catch (apiError) {
        console.error('Daive API test failed:', apiError.message);
        res.status(400).json({
          success: false,
          error: 'API connection test failed',
          details: apiError.message,
          providers: {
            openai: !!apiKeys.openai_key,
            elevenlabs: !!apiKeys.elevenlabs_key,
            deepgram: !!apiKeys.deepgram_key,
            azure: !!apiKeys.azure_speech_key
          }
        });
      }
      
    } catch (error) {
      console.error('Error testing Daive connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test Daive connection',
        details: error.message
      });
    }
  }
);

// Get Daive status and configuration
router.get('/daive/status',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      // Import the settings manager to use existing Daive settings
      const { default: SettingsManager } = await import('../lib/settingsManager.js');
      const settingsManager = new SettingsManager();
      
      // Get global Daive settings
      const allSettings = await settingsManager.getAllSettings(null);
      const apiKeys = await settingsManager.getAPIKeys(null);
      
      const status = {
        success: true,
        daive_status: 'configured',
        providers: {
          openai: {
            configured: !!apiKeys.openai_key,
            status: apiKeys.openai_key ? 'active' : 'missing'
          },
          elevenlabs: {
            configured: !!apiKeys.elevenlabs_key,
            status: apiKeys.elevenlabs_key ? 'active' : 'missing'
          },
          deepgram: {
            configured: !!apiKeys.deepgram_key,
            status: apiKeys.deepgram_key ? 'active' : 'missing'
          },
          azure: {
            configured: !!apiKeys.azure_speech_key,
            status: apiKeys.azure_speech_key ? 'active' : 'missing'
          }
        },
        settings: {
          voice_provider: allSettings.voice_provider || 'elevenlabs',
          voice_speech_provider: allSettings.voice_speech_provider || 'whisper',
          voice_tts_provider: allSettings.voice_tts_provider || 'elevenlabs',
          voice_language: allSettings.voice_language || 'en-US',
          tts_provider: allSettings.tts_provider || 'elevenlabs',
          crew_ai_enabled: allSettings.crew_ai_enabled || false,
          crew_ai_max_tokens: allSettings.crew_ai_max_tokens || 100
        },
        capabilities: {
          voice_processing: !!(apiKeys.openai_key && apiKeys.elevenlabs_key),
          speech_to_text: !!(apiKeys.openai_key || apiKeys.deepgram_key),
          text_to_speech: !!(apiKeys.elevenlabs_key || apiKeys.azure_speech_key),
          crew_ai: !!(apiKeys.openai_key && allSettings.crew_ai_enabled)
        }
      };
      
      res.json(status);
      
    } catch (error) {
      console.error('Error getting Daive status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get Daive status',
        details: error.message
      });
    }
  }
);

// ===== Marketing Scheduler Management =====

// Get scheduler status
router.get('/marketing/scheduler/status',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { default: marketingScheduler } = await import('../lib/marketingScheduler.js');
      const status = marketingScheduler.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduler status',
        details: error.message
      });
    }
  }
);

// Start scheduler
router.post('/marketing/scheduler/start',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { default: marketingScheduler } = await import('../lib/marketingScheduler.js');
      marketingScheduler.start();
      
      res.json({
        success: true,
        message: 'Marketing scheduler started successfully'
      });
    } catch (error) {
      console.error('Error starting scheduler:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start scheduler',
        details: error.message
      });
    }
  }
);

// Stop scheduler
router.post('/marketing/scheduler/stop',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { default: marketingScheduler } = await import('../lib/marketingScheduler.js');
      marketingScheduler.stop();
      
      res.json({
        success: true,
        message: 'Marketing scheduler stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping scheduler:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop scheduler',
        details: error.message
      });
    }
  }
);

// Manual trigger scheduler run
router.post('/marketing/scheduler/trigger',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { default: marketingScheduler } = await import('../lib/marketingScheduler.js');
      
      // Trigger immediate processing
      await marketingScheduler.processEnrollments();
      
      res.json({
        success: true,
        message: 'Scheduler triggered successfully'
      });
    } catch (error) {
      console.error('Error triggering scheduler:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger scheduler',
        details: error.message
      });
    }
  }
);

// Manual trigger (local dev bypass) - no auth when explicitly allowed
router.post('/marketing/scheduler/trigger-local', async (req, res) => {
  try {
    const allowBypass = process.env.ALLOW_LOCAL_SCHEDULER_TRIGGER === 'true';
    
    if (!allowBypass) {
      return res.status(403).json({ success: false, error: 'Bypass not enabled' });
    }

    console.log('🚀 Triggering scheduler via local bypass...');
    const { default: marketingScheduler } = await import('../lib/marketingScheduler.js');
    await marketingScheduler.processEnrollments();

    res.json({ success: true, message: 'Scheduler triggered successfully (local bypass)' });
  } catch (error) {
    console.error('Error triggering scheduler (local):', error);
    res.status(500).json({ success: false, error: 'Failed to trigger scheduler', details: error.message });
  }
});

// ===== Marketing Journeys Endpoints =====

// List marketing journeys
router.get(
  '/marketing/journeys',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
      const offset = (page - 1) * limit;

      const listResult = await query(
        `SELECT * FROM marketing_journeys
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await query(`SELECT COUNT(*)::int AS count FROM marketing_journeys`);
      const total = countResult.rows[0]?.count || 0;

      return res.json({
        success: true,
        data: listResult.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('Error listing journeys:', err);
      res.status(500).json({ error: 'Failed to list journeys' });
    }
  }
);

// Create a new marketing journey
router.post(
  '/marketing/journeys',
  authenticateToken,
  requireSuperAdmin,
  [body('name').isString().isLength({ min: 2 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { name, description } = req.body;
      const result = await query(
        `INSERT INTO marketing_journeys (name, description, created_by)
         VALUES ($1, $2, $3) RETURNING *`,
        [name, description ?? null, req.user.id]
      );
      res.status(201).json({ success: true, journey: result.rows[0] });
    } catch (err) {
      console.error('Error creating journey:', err);
      res.status(500).json({ error: 'Failed to create journey' });
    }
  }
);

// Update a marketing journey
router.put(
  '/marketing/journeys/:journeyId',
  authenticateToken,
  requireSuperAdmin,
  [param('journeyId').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { journeyId } = req.params;
      const { name, description, status } = req.body;

      const result = await query(
        `UPDATE marketing_journeys 
         SET name = $1, description = $2, status = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [name, description, status, journeyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Journey not found' });
      }

      res.json({ success: true, journey: result.rows[0] });
    } catch (err) {
      console.error('Error updating journey:', err);
      res.status(500).json({ error: 'Failed to update journey' });
    }
  }
);

// Delete a marketing journey
router.delete(
  '/marketing/journeys/:journeyId',
  authenticateToken,
  requireSuperAdmin,
  [param('journeyId').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { journeyId } = req.params;

      // First delete all steps
      await query('DELETE FROM marketing_journey_steps WHERE journey_id = $1', [journeyId]);
      
      // Then delete all enrollments
      await query('DELETE FROM marketing_enrollments WHERE journey_id = $1', [journeyId]);
      
      // Finally delete the journey
      const result = await query(
        `DELETE FROM marketing_journeys WHERE id = $1 RETURNING *`,
        [journeyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Journey not found' });
      }

      res.json({ success: true, message: 'Journey deleted successfully' });
    } catch (err) {
      console.error('Error deleting journey:', err);
      res.status(500).json({ error: 'Failed to delete journey' });
    }
  }
);

// Add a step to a journey
router.post(
  '/marketing/journeys/:journeyId/steps',
  authenticateToken,
  requireSuperAdmin,
  [
    param('journeyId').isUUID(),
    body('step_order').isInt({ min: 1 }),
    body('channel').isIn(['email','sms']),
    body('delay_minutes').optional().isInt({ min: 0 }),
    body('template_body').isString().isLength({ min: 1 }),
    body('template_subject').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { journeyId } = req.params;
      const { step_order, channel, delay_minutes = 0, template_subject = null, template_body } = req.body;
      const result = await query(
        `INSERT INTO marketing_journey_steps (journey_id, step_order, channel, delay_minutes, template_subject, template_body)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [journeyId, step_order, channel, delay_minutes, template_subject, template_body]
      );
      res.status(201).json({ success: true, step: result.rows[0] });
    } catch (err) {
      console.error('Error adding journey step:', err);
      res.status(500).json({ error: 'Failed to add journey step' });
    }
  }
);

// List steps for a journey
router.get(
  '/marketing/journeys/:journeyId/steps',
  authenticateToken,
  requireSuperAdmin,
  [param('journeyId').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { journeyId } = req.params;

      const stepsResult = await query(
        `SELECT * FROM marketing_journey_steps
         WHERE journey_id = $1
         ORDER BY step_order ASC`,
        [journeyId]
      );

      return res.json({ success: true, steps: stepsResult.rows });
    } catch (err) {
      console.error('Error listing journey steps:', err);
      res.status(500).json({ error: 'Failed to list journey steps' });
    }
  }
);

// Update a marketing journey step
router.put(
  '/marketing/journey-steps/:stepId',
  authenticateToken,
  requireSuperAdmin,
  [param('stepId').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { stepId } = req.params;
      const { type, subject, body, delay_minutes, step_order } = req.body;

      const result = await query(
        `UPDATE marketing_journey_steps 
         SET channel = $1, template_subject = $2, template_body = $3, delay_minutes = $4, step_order = $5, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [type, subject, body, delay_minutes, step_order, stepId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Journey step not found' });
      }

      res.json({ success: true, step: result.rows[0] });
    } catch (err) {
      console.error('Error updating journey step:', err);
      res.status(500).json({ error: 'Failed to update journey step' });
    }
  }
);

// Delete a marketing journey step
router.delete(
  '/marketing/journey-steps/:stepId',
  authenticateToken,
  requireSuperAdmin,
  [param('stepId').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { stepId } = req.params;

      const result = await query(
        `DELETE FROM marketing_journey_steps WHERE id = $1 RETURNING *`,
        [stepId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Journey step not found' });
      }

      res.json({ success: true, message: 'Journey step deleted successfully' });
    } catch (err) {
      console.error('Error deleting journey step:', err);
      res.status(500).json({ error: 'Failed to delete journey step' });
    }
  }
);

// Enroll a lead into a journey
router.post(
  '/marketing/journeys/:journeyId/enroll',
  authenticateToken,
  requireSuperAdmin,
  [param('journeyId').isUUID(), body('lead_id').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { journeyId } = req.params;
      const { lead_id } = req.body;

      // Determine first step's delay to set next_run_at
      const stepRes = await query(
        `SELECT delay_minutes FROM marketing_journey_steps 
         WHERE journey_id = $1 AND is_active = TRUE
         ORDER BY step_order ASC LIMIT 1`,
        [journeyId]
      );
      const firstDelay = stepRes.rows[0] ? Number(stepRes.rows[0].delay_minutes || 0) : 0;

      const result = await query(
        `INSERT INTO marketing_enrollments (lead_id, journey_id, status, current_step_order, next_run_at)
         VALUES ($1, $2, 'active', 0, NOW() + INTERVAL '${firstDelay} minutes')
         ON CONFLICT (lead_id, journey_id) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [lead_id, journeyId]
      );
      res.status(201).json({ success: true, enrollment: result.rows[0] });
    } catch (err) {
      console.error('Error enrolling lead into journey:', err);
      res.status(500).json({ error: 'Failed to enroll lead' });
    }
  }
);

// Get all enrollments (across all journeys)
router.get(
  '/marketing/enrollments',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const result = await query(
        `SELECT e.*, l.full_name, l.email, l.phone, l.company,
                j.name as journey_name,
                s.step_order as current_step_order,
                s.template_subject as current_step_subject,
                s.template_body as current_step_body,
                s.channel as current_step_channel
         FROM marketing_enrollments e
         JOIN software_leads l ON l.id = e.lead_id
         JOIN marketing_journeys j ON j.id = e.journey_id
         LEFT JOIN marketing_journey_steps s ON s.journey_id = e.journey_id AND s.step_order = e.current_step_order
         ORDER BY e.created_at DESC`,
        []
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('Error getting all enrollments:', err);
      res.status(500).json({ error: 'Failed to get enrollments' });
    }
  }
);

// Get enrollments for a journey
router.get(
  '/marketing/journeys/:journeyId/enrollments',
  authenticateToken,
  requireSuperAdmin,
  [param('journeyId').isUUID()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { journeyId } = req.params;

      const result = await query(
        `SELECT e.*, l.full_name, l.email, l.phone, l.company,
                s.step_order as current_step_order,
                s.template_subject as current_step_subject,
                s.template_body as current_step_body,
                s.channel as current_step_channel
         FROM marketing_enrollments e
         JOIN software_leads l ON l.id = e.lead_id
         LEFT JOIN marketing_journey_steps s ON s.journey_id = e.journey_id AND s.step_order = e.current_step_order
         WHERE e.journey_id = $1
         ORDER BY e.created_at DESC`,
        [journeyId]
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error('Error getting journey enrollments:', err);
      res.status(500).json({ error: 'Failed to get journey enrollments' });
    }
  }
);

// Run next step for an enrollment (manual trigger)
router.post(
  '/marketing/enrollments/:enrollmentId/run-next',
  authenticateToken,
  requireSuperAdmin,
  [param('enrollmentId').isUUID()],
  async (req, res) => {
    const client = await query('BEGIN').catch(() => null);
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { enrollmentId } = req.params;

      // Load enrollment with lead and next step
      const enrRes = await query(
        `SELECT e.*, l.email as lead_email, l.full_name as lead_name
         FROM marketing_enrollments e
         JOIN software_leads l ON l.id = e.lead_id
         WHERE e.id = $1 AND e.status = 'active'`,
        [enrollmentId]
      );
      if (enrRes.rows.length === 0) return res.status(404).json({ error: 'Enrollment not found or inactive' });
      const enrollment = enrRes.rows[0];
      const nextOrder = Number(enrollment.current_step_order) + 1;

      const stepRes = await query(
        `SELECT * FROM marketing_journey_steps 
         WHERE journey_id = $1 AND step_order = $2 AND is_active = TRUE`,
        [enrollment.journey_id, nextOrder]
      );
      if (stepRes.rows.length === 0) {
        // No more steps: mark completed
        await query(`UPDATE marketing_enrollments SET status = 'completed', updated_at = NOW() WHERE id = $1`, [enrollmentId]);
        return res.json({ success: true, status: 'completed' });
      }
      const step = stepRes.rows[0];

      let providerMessageId = null;
      let sendStatus = 'sent';

      // Record send first to get the send ID for tracking
      const sendRes = await query(
        `INSERT INTO marketing_sends (enrollment_id, step_id, channel, to_address, status, provider_message_id, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $5='sent' THEN NOW() ELSE NULL END)
         RETURNING *`,
        [enrollmentId, step.id, step.channel, enrollment.lead_email, sendStatus, providerMessageId]
      );

      if (step.channel === 'email') {
        const subject = step.template_subject || 'Message';
        const body = step.template_body
          .replace(/{{\s*name\s*}}/gi, enrollment.lead_name || '')
          .replace(/{{\s*email\s*}}/gi, enrollment.lead_email || '');
        try {
          // Use the tracking pixel ID from the send record
          providerMessageId = await sendJourneyEmail(enrollment.lead_email, subject, body, sendRes.rows[0].tracking_pixel_id);
          
          // Update the send record with the provider message ID
          await query(
            `UPDATE marketing_sends SET provider_message_id = $1 WHERE id = $2`,
            [providerMessageId, sendRes.rows[0].id]
          );
        } catch (e) {
          sendStatus = 'failed';
          providerMessageId = null;
          
          // Update the send record with failed status
          await query(
            `UPDATE marketing_sends SET status = 'failed' WHERE id = $1`,
            [sendRes.rows[0].id]
          );
        }
      } else {
        // SMS channel could be implemented using Twilio settings if available
        sendStatus = 'failed';
        
        // Update the send record with failed status
        await query(
          `UPDATE marketing_sends SET status = 'failed' WHERE id = $1`,
          [sendRes.rows[0].id]
        );
      }

      // Compute next timing
      const nextDelay = Number(step.delay_minutes || 0);
      await query(
        `UPDATE marketing_enrollments 
         SET current_step_order = $1,
             last_sent_at = NOW(),
             next_run_at = CASE WHEN $2 > 0 THEN NOW() + ($2) * INTERVAL '1 minute' ELSE NULL END,
             status = CASE WHEN $3 = 'failed' THEN status ELSE status END,
             updated_at = NOW()
         WHERE id = $4`,
        [nextOrder, nextDelay, sendStatus, enrollmentId]
      );

      res.json({ success: true, send: sendRes.rows[0], next_step_order: nextOrder + 1 });
    } catch (err) {
      console.error('Error running next journey step:', err);
      res.status(500).json({ error: 'Failed to run next step' });
    } finally {
      if (client) await query('COMMIT').catch(() => {});
    }
  }
);

// Utility: load Stripe secret from integration_settings
async function getStripeClient() {
  const result = await query(
    `SELECT secret FROM integration_settings 
     WHERE scope = 'global' AND provider = 'stripe' AND key = 'secret_key' AND is_active = true`
  );
  if (!result.rows.length || !result.rows[0].secret) {
    throw new Error('Stripe secret key not configured');
  }
  const stripeModule = await import('stripe');
  const stripe = new stripeModule.default(result.rows[0].secret);
  return stripe;
}

// =====================================================
// SMTP SETTINGS ROUTES (Simple Method)
// =====================================================

// Get SMTP settings
router.get('/settings/smtp', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT key, secret, config, is_active, created_at, updated_at
      FROM integration_settings 
      WHERE scope = 'global' AND provider = 'smtp'
      ORDER BY key
    `);

    // Convert to simple object format
    const smtpSettings = {};
    result.rows.forEach(row => {
      smtpSettings[row.key] = {
        value: row.secret,
        config: row.config,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    res.json({ success: true, settings: smtpSettings });
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    res.status(500).json({ error: 'Failed to fetch SMTP settings' });
  }
});

// Update SMTP setting
router.put('/settings/smtp/:key', 
  authenticateToken, 
  requireSuperAdmin,
  [
    body('value').notEmpty().withMessage('Value is required'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { key } = req.params;
      const { value, is_active = true } = req.body;

      // Validate key
      const validKeys = ['host', 'port', 'secure', 'user', 'pass', 'from'];
      if (!validKeys.includes(key)) {
        return res.status(400).json({ error: 'Invalid SMTP setting key' });
      }

      // Convert value to string (important for database storage)
      const stringValue = String(value);

      // Check if setting exists
      const existingResult = await query(`
        SELECT id FROM integration_settings 
        WHERE scope = 'global' AND provider = 'smtp' AND key = $1
      `, [key]);

      let result;
      if (existingResult.rows.length > 0) {
        // Update existing setting
        result = await query(`
          UPDATE integration_settings 
          SET secret = $1, is_active = $2, updated_at = NOW()
          WHERE scope = 'global' AND provider = 'smtp' AND key = $3
          RETURNING *
        `, [stringValue, is_active, key]);
      } else {
        // Insert new setting
        result = await query(`
          INSERT INTO integration_settings (scope, provider, key, secret, is_active)
          VALUES ('global', 'smtp', $1, $2, $3)
          RETURNING *
        `, [key, stringValue, is_active]);
      }

      res.json({ 
        success: true, 
        setting: {
          key: result.rows[0].key,
          value: result.rows[0].secret,
          is_active: result.rows[0].is_active,
          updated_at: result.rows[0].updated_at
        }
      });
    } catch (error) {
      console.error('Error updating SMTP setting:', error);
      res.status(500).json({ error: 'Failed to update SMTP setting' });
    }
  }
);

// Test SMTP connection
router.post('/settings/smtp/test', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const smtpSettings = await loadGlobalSmtpSettings();
    
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.pass
      }
    });
    
    // Test the connection
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'SMTP connection successful',
      settings: {
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.secure,
        user: smtpSettings.user,
        from: smtpSettings.from
      }
    });
  } catch (error) {
    console.error('SMTP test failed:', error);
    res.status(400).json({ 
      success: false, 
      message: `SMTP test failed: ${error.message}` 
    });
  }
});

// =====================================================
// SUPER ADMIN GLOBAL SETTINGS ROUTES
// =====================================================

// Get all global integration settings
router.get('/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT provider, key, secret, config, is_active, created_at, updated_at
      FROM integration_settings 
      WHERE scope = 'global' 
      ORDER BY provider, key
    `);

    // Group settings by provider for easier frontend consumption
    const settings = {};
    result.rows.forEach(row => {
      if (!settings[row.provider]) {
        settings[row.provider] = {};
      }
      settings[row.provider][row.key] = {
        secret: row.secret,
        config: row.config,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching global settings:', error);
    res.status(500).json({ error: 'Failed to fetch global settings' });
  }
});

// Get specific global integration setting
router.get('/settings/:provider/:key', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { provider, key } = req.params;

    // Validate provider
    if (!['stripe', 'twilio', 'daive', 'smtp'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const result = await query(`
      SELECT provider, key, secret, config, is_active, created_at, updated_at
      FROM integration_settings 
      WHERE scope = 'global' AND provider = $1 AND key = $2
    `, [provider, key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = result.rows[0];
    res.json({ 
      success: true, 
      setting: {
        provider: setting.provider,
        key: setting.key,
        secret: setting.secret,
        config: setting.config,
        is_active: setting.is_active,
        created_at: setting.created_at,
        updated_at: setting.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching specific setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update global integration setting
router.put('/settings/:provider/:key', 
  authenticateToken, 
  requireSuperAdmin,
  [
    body('secret').optional().isString(),
    body('config').optional().isObject(),
    body('is_active').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { provider, key } = req.params;
      const { secret, config, is_active } = req.body;

      // Validate provider
      if (!['stripe', 'twilio', 'daive', 'smtp'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (secret !== undefined) {
        updates.push(`secret = $${paramCount++}`);
        values.push(secret);
      }
      if (config !== undefined) {
        updates.push(`config = $${paramCount++}`);
        values.push(JSON.stringify(config));
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(provider, key);

      const result = await query(`
        UPDATE integration_settings 
        SET ${updates.join(', ')}
        WHERE scope = 'global' AND provider = $${paramCount++} AND key = $${paramCount++}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Setting not found' });
      }

      res.json({ success: true, setting: result.rows[0] });
    } catch (error) {
      console.error('Error updating global setting:', error);
      res.status(500).json({ error: 'Failed to update global setting' });
    }
  }
);

// =====================================================
// STRIPE SUBSCRIPTION MANAGEMENT
// =====================================================

// Create or link a Stripe customer for a dealer
router.post('/stripe/customers/:dealerId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { dealerId } = req.params;

    const dealerResult = await query('SELECT id, business_name, email, stripe_customer_id FROM dealers WHERE id = $1', [dealerId]);
    if (!dealerResult.rows.length) {
      return res.status(404).json({ error: 'Dealer not found' });
    }
    const dealer = dealerResult.rows[0];

    const stripe = await getStripeClient();

    if (dealer.stripe_customer_id) {
      const customer = await stripe.customers.retrieve(dealer.stripe_customer_id);
      return res.json({ success: true, customer });
    }

    const customer = await stripe.customers.create({
      name: dealer.business_name,
      email: dealer.email || undefined,
      metadata: { dealer_id: dealer.id }
    });

    await query('UPDATE dealers SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2', [customer.id, dealer.id]);

    res.status(201).json({ success: true, customer });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    res.status(500).json({ error: 'Failed to create Stripe customer' });
  }
});

// Create or update a subscription for a dealer
router.post('/stripe/subscriptions/:dealerId', authenticateToken, requireSuperAdmin, [
  body('price_id').isString(),
  body('trial_days').optional().isInt({ min: 0, max: 30 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dealerId } = req.params;
    const { price_id, trial_days } = req.body;

    const dealerResult = await query('SELECT * FROM dealers WHERE id = $1', [dealerId]);
    if (!dealerResult.rows.length) {
      return res.status(404).json({ error: 'Dealer not found' });
    }
    const dealer = dealerResult.rows[0];

    const stripe = await getStripeClient();

    // Ensure customer
    let customerId = dealer.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: dealer.business_name,
        email: dealer.email || undefined,
        metadata: { dealer_id: dealer.id }
      });
      customerId = customer.id;
      await query('UPDATE dealers SET stripe_customer_id = $1 WHERE id = $2', [customerId, dealer.id]);
    }

    // If an active subscription exists, update price; else create new
    if (dealer.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(dealer.stripe_subscription_id);
      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
        proration_behavior: 'create_prorations',
        items: [{ id: subscription.items.data[0].id, price: price_id }]
      });

      await query(
        `UPDATE dealers SET stripe_price_id = $1, subscription_status = $2, subscription_current_period_end = to_timestamp($3), updated_at = NOW() WHERE id = $4`,
        [price_id, updated.status, Math.floor(updated.current_period_end), dealer.id]
      );

      return res.json({ success: true, subscription: updated });
    }

    const created = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      trial_period_days: trial_days,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });

    await query(
      `UPDATE dealers 
         SET stripe_subscription_id = $1, stripe_price_id = $2, subscription_status = $3, subscription_current_period_end = to_timestamp($4), updated_at = NOW() 
       WHERE id = $5`,
      [created.id, price_id, created.status, Math.floor(created.current_period_end || 0), dealer.id]
    );

    res.status(201).json({ success: true, subscription: created });
  } catch (error) {
    console.error('Error creating/updating subscription:', error);
    res.status(500).json({ error: 'Failed to create or update subscription' });
  }
});

// Cancel subscription at period end
router.post('/stripe/subscriptions/:dealerId/cancel', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { dealerId } = req.params;
    const dealerResult = await query('SELECT * FROM dealers WHERE id = $1', [dealerId]);
    if (!dealerResult.rows.length) return res.status(404).json({ error: 'Dealer not found' });
    const dealer = dealerResult.rows[0];
    if (!dealer.stripe_subscription_id) return res.status(400).json({ error: 'No subscription to cancel' });

    const stripe = await getStripeClient();
    const updated = await stripe.subscriptions.update(dealer.stripe_subscription_id, { cancel_at_period_end: true });
    await query('UPDATE dealers SET cancel_at_period_end = true, subscription_status = $1 WHERE id = $2', [updated.status, dealer.id]);

    res.json({ success: true, subscription: updated });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// List invoices for a dealer
router.get('/stripe/invoices/:dealerId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { dealerId } = req.params;
    const dealerResult = await query('SELECT stripe_customer_id FROM dealers WHERE id = $1', [dealerId]);
    if (!dealerResult.rows.length) return res.status(404).json({ error: 'Dealer not found' });
    const { stripe_customer_id } = dealerResult.rows[0];
    if (!stripe_customer_id) return res.status(400).json({ error: 'Dealer not linked to Stripe customer' });

    const stripe = await getStripeClient();
    const invoices = await stripe.invoices.list({ customer: stripe_customer_id, limit: 20 });
    res.json({ success: true, invoices: invoices.data });
  } catch (error) {
    console.error('Error listing invoices:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

// Test integration connectivity
router.post('/settings/:provider/test', 
  authenticateToken, 
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { provider } = req.params;
      
      if (!['stripe', 'twilio', 'daive', 'smtp'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' });
      }

      // Get provider settings
      const settingsResult = await query(`
        SELECT key, secret, config FROM integration_settings 
        WHERE scope = 'global' AND provider = $1 AND is_active = true
      `, [provider]);

      const settings = {};
      settingsResult.rows.forEach(row => {
        settings[row.key] = row.secret;
      });

      let testResult = { success: false, message: 'Test not implemented' };

      // Test Stripe connectivity
      if (provider === 'stripe') {
        const stripe = await import('stripe').catch(() => null);
        if (stripe && settings.secret_key) {
          try {
            const stripeClient = new stripe.default(settings.secret_key);
            await stripeClient.balance.retrieve();
            testResult = { success: true, message: 'Stripe connection successful' };
          } catch (error) {
            testResult = { success: false, message: `Stripe error: ${error.message}` };
          }
        } else {
          testResult = { success: false, message: 'Stripe secret key not configured' };
        }
      }

      // Test Twilio connectivity
      if (provider === 'twilio') {
        const twilio = await import('twilio').catch(() => null);
        if (twilio && settings.account_sid && settings.auth_token) {
          try {
            const client = twilio.default(settings.account_sid, settings.auth_token);
            await client.api.accounts(settings.account_sid).fetch();
            testResult = { success: true, message: 'Twilio connection successful' };
          } catch (error) {
            testResult = { success: false, message: `Twilio error: ${error.message}` };
          }
        } else {
          testResult = { success: false, message: 'Twilio credentials not configured' };
        }
      }

      // Test SMTP connectivity
      if (provider === 'smtp') {
        if (settings.host && settings.port && settings.user && settings.pass) {
          try {
            const transporter = nodemailer.createTransport({
              host: settings.host,
              port: Number(settings.port),
              secure: settings.secure === 'true' || settings.secure === true,
              auth: {
                user: settings.user,
                pass: settings.pass
              }
            });
            
            // Test the connection
            await transporter.verify();
            testResult = { success: true, message: 'SMTP connection successful' };
          } catch (error) {
            testResult = { success: false, message: `SMTP error: ${error.message}` };
          }
        } else {
          testResult = { success: false, message: 'SMTP credentials not configured' };
        }
      }

      res.json(testResult);
    } catch (error) {
      console.error('Error testing integration:', error);
      res.status(500).json({ error: 'Failed to test integration' });
    }
  }
);

// Twilio sender verification
router.post('/settings/twilio/verify-sender', 
  authenticateToken, 
  requireSuperAdmin,
  async (req, res) => {
    try {
      const settingsResult = await query(`
        SELECT key, secret FROM integration_settings 
        WHERE scope = 'global' AND provider = 'twilio' AND is_active = true
      `);

      const settings = {};
      settingsResult.rows.forEach(row => {
        settings[row.key] = row.secret;
      });

      if (!settings.account_sid || !settings.auth_token) {
        return res.status(400).json({ error: 'Twilio credentials not configured' });
      }

      const twilio = await import('twilio');
      const client = twilio.default(settings.account_sid, settings.auth_token);

      // Verify messaging service if configured
      if (settings.messaging_service_sid) {
        try {
          const messagingService = await client.messaging.v1.services(settings.messaging_service_sid).fetch();
          return res.json({ 
            success: true, 
            message: `Messaging service verified: ${messagingService.friendlyName}`,
            service: messagingService
          });
        } catch (error) {
          return res.json({ 
            success: false, 
            message: `Messaging service verification failed: ${error.message}` 
          });
        }
      }

      // Verify phone number if configured
      if (settings.from_number) {
        try {
          const incomingNumbers = await client.incomingPhoneNumbers.list();
          const verifiedNumber = incomingNumbers.find(num => num.phoneNumber === settings.from_number);
          
          if (verifiedNumber) {
            return res.json({ 
              success: true, 
              message: `Phone number verified: ${verifiedNumber.friendlyName}`,
              number: verifiedNumber
            });
          } else {
            return res.json({ 
              success: false, 
              message: `Phone number ${settings.from_number} not found in your Twilio account` 
            });
          }
        } catch (error) {
          return res.json({ 
            success: false, 
            message: `Phone number verification failed: ${error.message}` 
          });
        }
      }

      res.json({ 
        success: false, 
        message: 'No messaging service SID or phone number configured for verification' 
      });

    } catch (error) {
      console.error('Error verifying Twilio sender:', error);
      res.status(500).json({ error: 'Failed to verify Twilio sender' });
    }
  }
);

// =====================================================
// SUBSCRIPTION PLANS MANAGEMENT ROUTES
// =====================================================

// Get all subscription plans
router.get('/subscription/plans', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plans = [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 29,
        currency: 'usd',
        interval: 'month',
        features: [
          'Up to 100 vehicles',
          'Basic lead management',
          'Email support'
        ],
        limits: {
          vehicles: 100,
          leads: 1000,
          users: 5
        }
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: 79,
        currency: 'usd',
        interval: 'month',
        features: [
          'Up to 500 vehicles',
          'Advanced lead management',
          'Marketing automation',
          'Priority support'
        ],
        limits: {
          vehicles: 500,
          leads: 5000,
          users: 15
        }
      },
      {
        id: 'enterprise',
        name: 'Enterprise Plan',
        price: 199,
        currency: 'usd',
        interval: 'month',
        features: [
          'Unlimited vehicles',
          'Full feature access',
          'Custom integrations',
          '24/7 dedicated support'
        ],
        limits: {
          vehicles: -1, // unlimited
          leads: -1, // unlimited
          users: -1 // unlimited
        }
      }
    ];

    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

// Create subscription for a dealer
router.post('/subscription/create', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { dealerId, planId, paymentMethodId } = req.body;

    if (!dealerId || !planId) {
      return res.status(400).json({ error: 'Dealer ID and Plan ID are required' });
    }

    // Get dealer information
    const dealerResult = await query('SELECT id, business_name, email, stripe_customer_id FROM dealers WHERE id = $1', [dealerId]);
    if (!dealerResult.rows.length) {
      return res.status(404).json({ error: 'Dealer not found' });
    }
    const dealer = dealerResult.rows[0];

    // Get plan information
    const plans = {
      basic: { price: 29, name: 'Basic Plan' },
      premium: { price: 79, name: 'Premium Plan' },
      enterprise: { price: 199, name: 'Enterprise Plan' }
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const stripe = await getStripeClient();

    // Create or get Stripe customer
    let customerId = dealer.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: dealer.business_name,
        email: dealer.email || undefined,
        metadata: { dealer_id: dealer.id }
      });
      customerId = customer.id;
      await query('UPDATE dealers SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2', [customerId, dealer.id]);
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: plan.name,
          },
          unit_amount: plan.price * 100, // Convert to cents
          recurring: {
            interval: 'month',
          },
        },
      }],
      metadata: {
        dealer_id: dealer.id,
        plan_id: planId
      }
    });

    // Update dealer subscription info
    await query(
      'UPDATE dealers SET subscription_plan = $1, subscription_status = $2, stripe_subscription_id = $3, updated_at = NOW() WHERE id = $4',
      [planId, 'active', subscription.id, dealer.id]
    );

    res.json({ 
      success: true, 
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: planId,
        amount: plan.price
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Update subscription
router.put('/subscription/:subscriptionId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { planId, status } = req.body;

    const stripe = await getStripeClient();

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (planId) {
      // Update plan
      const plans = {
        basic: { price: 29, name: 'Basic Plan' },
        premium: { price: 79, name: 'Premium Plan' },
        enterprise: { price: 199, name: 'Enterprise Plan' }
      };

      const plan = plans[planId];
      if (!plan) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }

      // Update subscription items
      await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
            },
            unit_amount: plan.price * 100,
            recurring: {
              interval: 'month',
            },
          },
        }],
        metadata: {
          ...subscription.metadata,
          plan_id: planId
        }
      });

      // Update dealer subscription plan
      await query(
        'UPDATE dealers SET subscription_plan = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
        [planId, subscriptionId]
      );
    }

    if (status) {
      // Update subscription status
      if (status === 'canceled') {
        await stripe.subscriptions.cancel(subscriptionId);
        await query(
          'UPDATE dealers SET subscription_status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
          ['canceled', subscriptionId]
        );
      }
    }

    res.json({ success: true, message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Cancel subscription
router.post('/subscription/:subscriptionId/cancel', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const stripe = await getStripeClient();

    // Cancel subscription in Stripe
    await stripe.subscriptions.cancel(subscriptionId, {
      cancellation_details: {
        comment: reason || 'Cancelled by Super Admin'
      }
    });

    // Update dealer subscription status
    await query(
      'UPDATE dealers SET subscription_status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
      ['canceled', subscriptionId]
    );

    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get subscription details
router.get('/subscription/:subscriptionId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const stripe = await getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Get dealer information
    const dealerResult = await query(
      'SELECT id, business_name, email, subscription_plan, subscription_status FROM dealers WHERE stripe_subscription_id = $1',
      [subscriptionId]
    );

    const dealer = dealerResult.rows[0];

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: dealer?.subscription_plan,
        amount: subscription.items.data[0].price.unit_amount / 100,
        currency: subscription.items.data[0].price.currency,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        dealer: dealer
      }
    });
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({ error: 'Failed to fetch subscription details' });
  }
});

// =====================================================
// SOFTWARE LEADS MANAGEMENT ROUTES
// =====================================================

// Get all software leads with filtering and pagination
router.get('/software-leads', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      owner_id, 
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build WHERE clause
    const whereConditions = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (owner_id) {
      whereConditions.push(`owner_id = $${paramCount++}`);
      values.push(owner_id);
    }

    if (search) {
      whereConditions.push(`(
        full_name ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR 
        company ILIKE $${paramCount} OR 
        phone ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sort parameters
    const validSortColumns = ['created_at', 'updated_at', 'full_name', 'email', 'status'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM software_leads ${whereClause}
    `, values);

    const total = parseInt(countResult.rows[0].total);

    // Get leads with owner details
    const leadsResult = await query(`
      SELECT 
        sl.*,
        creator.email as created_by_email,
        owner.email as owner_email,
        owner.name as owner_name
      FROM software_leads sl
      LEFT JOIN users creator ON sl.created_by = creator.id
      LEFT JOIN users owner ON sl.owner_id = owner.id
      ${whereClause}
      ORDER BY sl.${sortColumn} ${sortDirection}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `, [...values, parseInt(limit), offset]);

    res.json({
      success: true,
      leads: leadsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching software leads:', error);
    res.status(500).json({ error: 'Failed to fetch software leads' });
  }
});

// Create new software lead
router.post('/software-leads', 
  authenticateToken, 
  requireSuperAdmin,
  [
    body('full_name').optional().isString().trim(),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().isString().trim(),
    body('company').optional().isString().trim(),
    body('source').optional().isString().trim(),
    body('tags').optional().isArray(),
    body('notes').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        full_name, 
        email, 
        phone, 
        company, 
        source = 'manual', 
        tags = [], 
        notes 
      } = req.body;

      const result = await query(`
        INSERT INTO software_leads (
          created_by, full_name, email, phone, company, source, tags, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [req.user.id, full_name, email, phone, company, source, tags, notes]);

      const newLead = result.rows[0];

      // Log the creation in audit logs
      await query(`
        INSERT INTO audit_logs (user_id, user_email, user_role, action_type, resource_type, resource_id, resource_name, description, success, metadata, created_at)
        VALUES ($1, $2, $3, 'lead_create', 'SoftwareLead', $4, $5, $6, true, $7, NOW())
      `, [
        req.user.id,
        req.user.email,
        req.user.role,
        newLead.id,
        newLead.full_name || newLead.email,
        `New lead created: ${newLead.full_name || newLead.email}`,
        JSON.stringify({
          source: source,
          company: company,
          email: email,
          phone: phone
        })
      ]);

      res.status(201).json({ success: true, lead: newLead });
    } catch (error) {
      console.error('Error creating software lead:', error);
      res.status(500).json({ error: 'Failed to create software lead' });
    }
  }
);

// Update software lead
router.put('/software-leads/:id', 
  authenticateToken, 
  requireSuperAdmin,
  [
    body('full_name').optional().isString().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isString().trim(),
    body('company').optional().isString().trim(),
    body('status').optional().isIn(['new', 'contacted', 'qualified', 'nurturing', 'won', 'lost']),
    body('owner_id').optional().isUUID(),
    body('tags').optional().isArray(),
    body('notes').optional().isString().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = req.body;

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          updateFields.push(`${key} = $${paramCount++}`);
          values.push(updates[key]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Add updated_at
      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(`
        UPDATE software_leads 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount++}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Software lead not found' });
      }

      const updatedLead = result.rows[0];

      // Log the update in audit logs
      const changedFields = Object.keys(updates).filter(key => updates[key] !== undefined);
      await query(`
        INSERT INTO audit_logs (user_id, user_email, user_role, action_type, resource_type, resource_id, resource_name, description, success, metadata, created_at)
        VALUES ($1, $2, $3, 'lead_update', 'SoftwareLead', $4, $5, $6, true, $7, NOW())
      `, [
        req.user.id,
        req.user.email,
        req.user.role,
        updatedLead.id,
        updatedLead.full_name || updatedLead.email,
        `Lead updated: ${changedFields.join(', ')}`,
        JSON.stringify({
          changed_fields: changedFields,
          old_values: {},
          new_values: updates
        })
      ]);

      res.json({ success: true, lead: updatedLead });
    } catch (error) {
      console.error('Error updating software lead:', error);
      res.status(500).json({ error: 'Failed to update software lead' });
    }
  }
);

// Delete software lead
router.delete('/software-leads/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM software_leads WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Software lead not found' });
    }

    res.json({ success: true, message: 'Software lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting software lead:', error);
    res.status(500).json({ error: 'Failed to delete software lead' });
  }
});

// Bulk delete software leads
router.delete('/software-leads/bulk', 
  authenticateToken, 
  requireSuperAdmin,
  [body('ids').isArray().isLength({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ids } = req.body;

      const result = await query(
        `DELETE FROM software_leads WHERE id = ANY($1) RETURNING id`,
        [ids]
      );

      res.json({ 
        success: true, 
        message: `${result.rows.length} software leads deleted successfully`,
        deletedCount: result.rows.length
      });
    } catch (error) {
      console.error('Error bulk deleting software leads:', error);
      res.status(500).json({ error: 'Failed to bulk delete software leads' });
    }
  }
);

// Bulk update software leads status
router.put('/software-leads/bulk/status',
  authenticateToken,
  requireSuperAdmin,
  [
    body('ids').isArray().isLength({ min: 1 }),
    body('status').isIn(['new', 'contacted', 'qualified', 'nurturing', 'won', 'lost'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ids, status } = req.body;

      const result = await query(
        `UPDATE software_leads SET status = $1, updated_at = NOW() WHERE id = ANY($2) RETURNING id`,
        [status, ids]
      );

      res.json({ 
        success: true, 
        message: `${result.rows.length} software leads updated to ${status}`,
        updatedCount: result.rows.length
      });
    } catch (error) {
      console.error('Error bulk updating software leads:', error);
      res.status(500).json({ error: 'Failed to bulk update software leads' });
    }
  }
);

// Import software leads from CSV
router.post('/software-leads/import',
  authenticateToken,
  requireSuperAdmin,
  upload.single('csvFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      const csvData = [];
      const errors = [];
      let rowNumber = 0;

      // Parse CSV
      const stream = Readable.from(req.file.buffer);
      
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (row) => {
            rowNumber++;
            
            // Validate required fields
            if (!row.email) {
              errors.push(`Row ${rowNumber}: Email is required`);
              return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email)) {
              errors.push(`Row ${rowNumber}: Invalid email format`);
              return;
            }

            // Clean and validate data
            const leadData = {
              full_name: row.full_name || row.name || row.fullName || '',
              email: row.email.trim().toLowerCase(),
              phone: row.phone || row.phoneNumber || '',
              company: row.company || row.organization || '',
              source: row.source || 'import',
              status: row.status || 'new',
              tags: row.tags ? row.tags.split(',').map(tag => tag.trim()) : [],
              notes: row.notes || row.comments || '',
              industry: row.industry || '',
              company_size: row.company_size || '',
              budget_range: row.budget_range || '',
              decision_maker: row.decision_maker === 'true' || row.decision_maker === true,
              website: row.website || '',
              linkedin_url: row.linkedin_url || ''
            };

            // Validate status
            const validStatuses = ['new', 'contacted', 'qualified', 'nurturing', 'won', 'lost'];
            if (!validStatuses.includes(leadData.status)) {
              leadData.status = 'new';
            }

            csvData.push(leadData);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (errors.length > 0) {
        return res.status(400).json({ 
          error: 'CSV validation errors', 
          details: errors,
          validRows: csvData.length
        });
      }

      if (csvData.length === 0) {
        return res.status(400).json({ error: 'No valid data found in CSV' });
      }

      // Check for duplicate emails and filter them out
      const emails = csvData.map(lead => lead.email);
      const existingLeads = await query(
        'SELECT email FROM software_leads WHERE email = ANY($1)',
        [emails]
      );

      const existingEmails = existingLeads.rows.map(row => row.email);
      const duplicates = csvData.filter(lead => existingEmails.includes(lead.email));
      const uniqueLeads = csvData.filter(lead => !existingEmails.includes(lead.email));

      // If no unique leads to import, return error
      if (uniqueLeads.length === 0) {
        return res.status(400).json({ 
          error: 'All leads already exist', 
          duplicates: duplicates.map(lead => lead.email),
          message: 'No new leads to import'
        });
      }

      // Insert only unique leads
      const insertedLeads = [];
      for (const leadData of uniqueLeads) {
        const result = await query(`
          INSERT INTO software_leads (
            created_by, full_name, email, phone, company, source, status, tags, notes,
            industry, company_size, budget_range, decision_maker, website, linkedin_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `, [
          req.user.id,
          leadData.full_name,
          leadData.email,
          leadData.phone,
          leadData.company,
          leadData.source,
          leadData.status,
          leadData.tags,
          leadData.notes,
          leadData.industry,
          leadData.company_size,
          leadData.budget_range,
          leadData.decision_maker,
          leadData.website,
          leadData.linkedin_url
        ]);

        insertedLeads.push(result.rows[0]);
      }

      res.status(201).json({ 
        success: true, 
        message: `Import completed: ${insertedLeads.length} new leads inserted, ${duplicates.length} duplicates skipped`,
        leads: insertedLeads,
        importedCount: insertedLeads.length,
        skippedDuplicates: duplicates.length,
        duplicateEmails: duplicates.map(lead => lead.email),
        summary: {
          newInserted: insertedLeads.length,
          duplicates: duplicates.length,
          totalProcessed: csvData.length
        }
      });

    } catch (error) {
      console.error('Error importing software leads:', error);
      res.status(500).json({ error: 'Failed to import software leads' });
    }
  }
);

// Export software leads to CSV
router.get('/software-leads/export',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { status, search } = req.query;

      let whereClause = '';
      const values = [];
      let paramCount = 1;

      if (status) {
        whereClause += `WHERE status = $${paramCount++}`;
        values.push(status);
      }

      if (search) {
        const searchClause = `(
          full_name ILIKE $${paramCount} OR 
          email ILIKE $${paramCount} OR 
          company ILIKE $${paramCount} OR 
          phone ILIKE $${paramCount}
        )`;
        
        if (whereClause) {
          whereClause += ` AND ${searchClause}`;
        } else {
          whereClause = `WHERE ${searchClause}`;
        }
        values.push(`%${search}%`);
        paramCount++;
      }

      const result = await query(`
        SELECT 
          full_name, email, phone, company, source, status, tags, notes, created_at
        FROM software_leads 
        ${whereClause}
        ORDER BY created_at DESC
      `, values);

      // Convert to CSV
      const csvHeader = 'Full Name,Email,Phone,Company,Source,Status,Tags,Notes,Created At\n';
      const csvRows = result.rows.map(row => {
        const tags = Array.isArray(row.tags) ? row.tags.join(';') : '';
        return `"${row.full_name || ''}","${row.email}","${row.phone || ''}","${row.company || ''}","${row.source}","${row.status}","${tags}","${row.notes || ''}","${new Date(row.created_at).toISOString()}"`;
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="software-leads-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } catch (error) {
      console.error('Error exporting software leads:', error);
      res.status(500).json({ error: 'Failed to export software leads' });
    }
  }
);

// Get software lead by ID
router.get('/software-leads/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        sl.*,
        creator.email as created_by_email,
        owner.email as owner_email,
        owner.name as owner_name
      FROM software_leads sl
      LEFT JOIN users creator ON sl.created_by = creator.id
      LEFT JOIN users owner ON sl.owner_id = owner.id
      WHERE sl.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Software lead not found' });
    }

    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Error fetching software lead:', error);
    res.status(500).json({ error: 'Failed to fetch software lead' });
  }
});

// Send email to software lead
router.post('/software-leads/:id/send-email', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, template } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    // Get lead information
    const leadResult = await query('SELECT * FROM software_leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Software lead not found' });
    }

    const lead = leadResult.rows[0];

    if (!lead.email) {
      return res.status(400).json({ error: 'Lead does not have an email address' });
    }

    // Use the existing SMTP configuration function
    const { transporter, from } = await getSmtpTransport();

    // Process template variables
    const processedBody = body
      .replace(/{{\s*name\s*}}/gi, lead.full_name || '')
      .replace(/{{\s*email\s*}}/gi, lead.email || '')
      .replace(/{{\s*company\s*}}/gi, lead.company || '')
      .replace(/{{\s*phone\s*}}/gi, lead.phone || '');

    const processedSubject = subject
      .replace(/{{\s*name\s*}}/gi, lead.full_name || '')
      .replace(/{{\s*company\s*}}/gi, lead.company || '');

    const mailOptions = {
      from: from,
      to: lead.email,
      subject: processedSubject,
      text: processedBody,
      html: processedBody.replace(/\n/g, '<br>')
    };

    const info = await transporter.sendMail(mailOptions);

    // Log the email send in audit logs
    await query(`
      INSERT INTO audit_logs (user_id, user_email, user_role, action_type, resource_type, resource_id, resource_name, description, success, metadata, created_at)
      VALUES ($1, $2, $3, 'email_send', 'SoftwareLead', $4, $5, $6, true, $7, NOW())
    `, [
      req.user.id, 
      req.user.email, 
      req.user.role,
      lead.id, 
      lead.full_name || lead.email,
      `Email sent to ${lead.full_name || lead.email}: "${processedSubject}"`,
      JSON.stringify({
        subject: processedSubject,
        recipient: lead.email,
        messageId: info.messageId,
        template: template || 'custom'
      })
    ]);

    res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Log the error in audit logs
    try {
      await query(`
        INSERT INTO audit_logs (user_id, user_email, user_role, action_type, resource_type, resource_id, resource_name, description, success, error_message, metadata, created_at)
        VALUES ($1, $2, $3, 'email_send', 'SoftwareLead', $4, $5, $6, false, $7, $8, NOW())
      `, [
        req.user.id, 
        req.user.email, 
        req.user.role,
        req.params.id, 
        'Unknown',
        `Failed to send email to lead`,
        error.message,
        JSON.stringify({
          error_type: error.name || 'Unknown',
          error_code: error.code || 'UNKNOWN'
        })
      ]);
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// Get lead activities
router.get('/software-leads/:id/activities', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get activities from audit_logs where the resource is this lead
    const result = await query(`
      SELECT 
        al.id,
        al.action_type,
        al.description,
        al.created_at as timestamp,
        al.user_email as user_email,
        al.user_role as user_role,
        al.success,
        al.error_message,
        al.metadata
      FROM audit_logs al
      WHERE al.resource_type = 'SoftwareLead' 
        AND al.resource_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);

    // Also get activities from marketing_sends if the lead is enrolled in any journeys
    const marketingResult = await query(`
      SELECT 
        ms.id,
        'email_sent' as action_type,
        CASE 
          WHEN ms.status = 'sent' THEN 'Email sent to ' || ms.to_address
          WHEN ms.status = 'failed' THEN 'Email failed to ' || ms.to_address
          ELSE 'Email ' || ms.status || ' to ' || ms.to_address
        END as description,
        ms.sent_at as timestamp,
        'System' as user_email,
        'system' as user_role,
        ms.status = 'sent' as success,
        ms.error as error_message,
        jsonb_build_object('channel', ms.channel, 'to_address', ms.to_address, 'provider_message_id', ms.provider_message_id) as metadata
      FROM marketing_sends ms
      JOIN marketing_enrollments me ON me.id = ms.enrollment_id
      WHERE me.lead_id = $1
      ORDER BY ms.sent_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);

    // Combine and sort all activities
    const allActivities = [
      ...result.rows.map(row => ({
        id: row.id,
        type: row.action_type,
        description: row.description,
        timestamp: row.timestamp,
        user: row.user_email || 'System',
        user_role: row.user_role,
        success: row.success,
        error_message: row.error_message,
        metadata: row.metadata
      })),
      ...marketingResult.rows.map(row => ({
        id: `marketing_${row.id}`,
        type: row.action_type,
        description: row.description,
        timestamp: row.timestamp,
        user: row.user_email,
        user_role: row.user_role,
        success: row.success,
        error_message: row.error_message,
        metadata: row.metadata
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ 
      success: true, 
      activities: allActivities,
      total: allActivities.length
    });

  } catch (error) {
    console.error('Error fetching lead activities:', error);
    res.status(500).json({ error: 'Failed to fetch lead activities' });
  }
});

// Send SMS to software lead
router.post('/software-leads/:id/send-sms', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, template } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get lead information
    const leadResult = await query('SELECT * FROM software_leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Software lead not found' });
    }

    const lead = leadResult.rows[0];

    if (!lead.phone) {
      return res.status(400).json({ error: 'Lead does not have a phone number' });
    }

    // Get Twilio settings
    const twilioResult = await query(`
      SELECT key, secret FROM integration_settings 
      WHERE scope = 'global' AND provider = 'twilio' AND is_active = true
    `);

    if (twilioResult.rows.length < 2) {
      return res.status(400).json({ error: 'Twilio not configured' });
    }

    const twilioSettings = {};
    twilioResult.rows.forEach(row => {
      twilioSettings[row.key] = row.secret;
    });

    if (!twilioSettings.account_sid || !twilioSettings.auth_token) {
      return res.status(400).json({ error: 'Twilio credentials not found' });
    }

    // Send SMS using Twilio
    const twilio = await import('twilio');
    const client = twilio.default(twilioSettings.account_sid, twilioSettings.auth_token);

    const smsResult = await client.messages.create({
      body: message,
      from: twilioSettings.phone_number || process.env.TWILIO_PHONE_NUMBER,
      to: lead.phone
    });

    // Log the SMS send in audit logs
    await query(`
      INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, resource_name, description, success, metadata)
      VALUES ($1, 'sms_send', 'SoftwareLead', $2, $3, 'SMS sent to software lead', true, $4)
    `, [req.user.id, lead.id, lead.full_name || lead.phone, JSON.stringify({ twilio_sid: smsResult.sid })]);

    res.json({ success: true, message: 'SMS sent successfully', twilio_sid: smsResult.sid });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// =====================================================
// DEALER MANAGEMENT ROUTES
// =====================================================

// Get dealer statistics
router.get('/stats', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const dealersResult = await query('SELECT COUNT(*) as total FROM dealers');
    const activeDealersResult = await query('SELECT COUNT(*) as total FROM dealers WHERE subscription_status = $1', ['active']);
    const vehiclesResult = await query('SELECT COUNT(*) as total FROM vehicles');
    const leadsResult = await query('SELECT COUNT(*) as total FROM software_leads');

    res.json({
      success: true,
      totalDealers: parseInt(dealersResult.rows[0].total),
      activeDealers: parseInt(activeDealersResult.rows[0].total),
      totalVehicles: parseInt(vehiclesResult.rows[0].total),
      totalSoftwareLeads: parseInt(leadsResult.rows[0].total)
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

// Get all dealers with pagination
router.get('/dealers', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereConditions = [];
    const values = [];
    let paramCount = 1;

    if (search) {
      whereConditions.push(`(
        business_name ILIKE $${paramCount} OR 
        contact_name ILIKE $${paramCount} OR 
        email ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (status) {
      whereConditions.push(`subscription_status = $${paramCount++}`);
      values.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM dealers ${whereClause}
    `, values);

    const total = parseInt(countResult.rows[0].total);

    // Get dealers with user details
    const dealersResult = await query(`
      SELECT 
        d.*,
        u.email as user_email,
        u.created_at as user_created_at
      FROM dealers d
      LEFT JOIN users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `, [...values, parseInt(limit), offset]);

    res.json({
      success: true,
      dealers: dealersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching dealers:', error);
    res.status(500).json({ error: 'Failed to fetch dealers' });
  }
});

// Get dealer details
router.get('/dealers/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        d.*,
        u.email as user_email,
        u.created_at as user_created_at,
        COUNT(v.id) as vehicle_count,
        COUNT(l.id) as lead_count
      FROM dealers d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN vehicles v ON d.id = v.dealer_id
      LEFT JOIN leads l ON d.id = l.dealer_id
      WHERE d.id = $1
      GROUP BY d.id, u.email, u.created_at
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json({ success: true, dealer: result.rows[0] });
  } catch (error) {
    console.error('Error fetching dealer:', error);
    res.status(500).json({ error: 'Failed to fetch dealer' });
  }
});

// Create new dealer
router.post('/dealers', authenticateToken, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      business_name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      subscription_plan = 'basic',
      subscription_status = 'active',
      password = 'DealerIQ123!' // Default password
    } = req.body;

    // Validate required fields
    if (!business_name || !contact_name || !email) {
      return res.status(400).json({ 
        error: 'Business name, contact name, and email are required' 
      });
    }

    await client.query('BEGIN');

    // Check if email already exists in users table
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already exists in system' });
    }

    // Check if email already exists in dealers table
    const existingDealer = await client.query('SELECT id FROM dealers WHERE email = $1', [email]);
    if (existingDealer.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user account
    const userResult = await client.query(`
      INSERT INTO users (
        email, password_hash, name, created_at, updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, email, name
    `, [email, hashedPassword, contact_name]);

    const userId = userResult.rows[0].id;

    // Create dealer
    const dealerResult = await client.query(`
      INSERT INTO dealers (
        user_id, business_name, contact_name, email, phone, address, city, state, zip_code,
        subscription_plan, subscription_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      userId, business_name, contact_name, email, phone, address, city, state, zip_code,
      subscription_plan, subscription_status
    ]);

    const dealerId = dealerResult.rows[0].id;

    // Create dealership staff record (admin role)
    await client.query(`
      INSERT INTO dealership_staff (
        dealer_id, user_id, staff_role, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
    `, [dealerId, userId, 'admin', true]);

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      dealer: dealerResult.rows[0],
      user: userResult.rows[0],
      message: 'Dealer and user account created successfully',
      loginCredentials: {
        email: email,
        password: password,
        note: 'Please change the password after first login'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating dealer:', error);
    res.status(500).json({ error: 'Failed to create dealer' });
  } finally {
    client.release();
  }
});

// Update dealer
router.put('/dealers/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      business_name,
      contact_name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      subscription_plan,
      subscription_status
    } = req.body;

    // Check if dealer exists
    const existingDealer = await query('SELECT id FROM dealers WHERE id = $1', [id]);
    if (existingDealer.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    // Check if email already exists for another dealer
    if (email) {
      const emailCheck = await query('SELECT id FROM dealers WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (business_name !== undefined) {
      updateFields.push(`business_name = $${paramCount++}`);
      values.push(business_name);
    }
    if (contact_name !== undefined) {
      updateFields.push(`contact_name = $${paramCount++}`);
      values.push(contact_name);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (address !== undefined) {
      updateFields.push(`address = $${paramCount++}`);
      values.push(address);
    }
    if (city !== undefined) {
      updateFields.push(`city = $${paramCount++}`);
      values.push(city);
    }
    if (state !== undefined) {
      updateFields.push(`state = $${paramCount++}`);
      values.push(state);
    }
    if (zip_code !== undefined) {
      updateFields.push(`zip_code = $${paramCount++}`);
      values.push(zip_code);
    }
    if (subscription_plan !== undefined) {
      updateFields.push(`subscription_plan = $${paramCount++}`);
      values.push(subscription_plan);
    }
    if (subscription_status !== undefined) {
      updateFields.push(`subscription_status = $${paramCount++}`);
      values.push(subscription_status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(`
      UPDATE dealers 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    res.json({ 
      success: true, 
      dealer: result.rows[0],
      message: 'Dealer updated successfully' 
    });
  } catch (error) {
    console.error('Error updating dealer:', error);
    res.status(500).json({ error: 'Failed to update dealer' });
  }
});

// Super Admin: toggle Marbalism AI on/off for any dealer
router.patch('/dealers/:id/marbalism-toggle', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const result = await query(
      `UPDATE dealers
       SET marbalism_ai_enabled = $1,
           marbalism_ai_deactivated_by = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, business_name, marbalism_ai_enabled, marbalism_ai_activated_at`,
      [enabled, enabled ? null : req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json({
      success: true,
      dealer: result.rows[0],
      message: `Marbalism AI ${enabled ? 'activated' : 'deactivated'} for ${result.rows[0].business_name}`
    });
  } catch (error) {
    console.error('Marbalism toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle Marbalism AI' });
  }
});

// Helper function for default permissions
function getDefaultPermissions(staffRole) {
  const rolePermissions = {
    'admin': [
      'qr_code_generation',
      'lead_management',
      'vehicle_import',
      'analytics_dashboard',
      'bulk_actions',
      'staff_management',
      'user_management',
      'custom_branding',
      'api_access',
      'priority_support',
      'marbalism_ai'
    ],
    'sales': [
      'qr_code_generation',
      'lead_management',
      'vehicle_import'
    ],
    'finance': [
      'lead_management',
      'analytics_dashboard'
    ],
    'service': [
      'lead_management'
    ],
    'inventory': [
      'vehicle_import',
      'qr_code_generation'
    ]
  };

  return rolePermissions[staffRole] || [];
}

// Add staff member to dealer
router.post('/dealers/:dealerId/staff', authenticateToken, requireSuperAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('staff_role').isIn(['admin', 'sales', 'finance', 'service', 'inventory']),
  body('name').optional().isLength({ min: 2, max: 255 }),
  body('permissions').optional().isArray()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dealerId } = req.params;
    const { email, password, staff_role, permissions = [], name } = req.body;

    // Check if dealer exists
    const dealerCheck = await client.query('SELECT id, business_name FROM dealers WHERE id = $1', [dealerId]);
    if (dealerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    // Check if user already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if role exists in roles table
    const roleCheck = await client.query('SELECT id FROM roles WHERE name = $1', [staff_role]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role - role does not exist' });
    }

    await client.query('BEGIN');

    try {
      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user with verification token
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, email_verified, verification_token, verification_token_expires, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
        [email, passwordHash, name || email.split('@')[0], false, verificationToken, tokenExpiry]
      );
      const userId = userResult.rows[0].id;

      // Create user role
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, 'dealer']
      );

      // Create staff member
      // Pass permissions as array directly (PostgreSQL TEXT[] type)
      // pg library handles array conversion automatically
      const staffResult = await client.query(
        `INSERT INTO dealership_staff (
          dealer_id, 
          user_id, 
          staff_role, 
          permissions, 
          created_by,
          is_active,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
        [dealerId, userId, staff_role, permissions || [], req.user.id, true]
      );

      // Insert default permissions for the role
      const defaultPermissions = getDefaultPermissions(staff_role);
      for (const permission of defaultPermissions) {
        await client.query(
          'INSERT INTO staff_permissions (staff_id, permission_name, permission_value, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [staffResult.rows[0].id, permission, true]
        );
      }

      await client.query('COMMIT');

      // Send staff invitation email with credentials and verification link
      let emailSent = false;
      try {
        // Get dealer business name (we already have it from dealerCheck)
        const businessName = dealerCheck.rows[0]?.business_name || 'Your Dealership';
        
        // Format role name for display
        const roleDisplayName = staff_role.charAt(0).toUpperCase() + staff_role.slice(1);
        
        await emailService.sendStaffInvitationEmail(
          email,
          name || email.split('@')[0],
          password, // Send the plain password (user needs it to login)
          roleDisplayName,
          businessName,
          verificationToken
        );
        console.log(`📧 Invitation email with verification link sent to ${email}`);
        emailSent = true;
      } catch (emailError) {
        console.error('⚠️ Failed to send invitation email:', emailError);
        // Don't fail the request if email fails - staff is already created
      }

      res.status(201).json({
        success: true,
        message: emailSent 
          ? 'Staff member created successfully. Verification email sent.' 
          : 'Staff member created successfully. Email notification failed.',
        staff: staffResult.rows[0],
        user: userResult.rows[0],
        emailSent: emailSent,
        requiresVerification: true
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ 
      error: 'Failed to create staff member',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// ===== AUDIT LOGGING ENDPOINTS =====

// Initialize audit logger middleware for all Super Admin routes
router.use(superAdminAuditMiddleware);

// Get audit logs with filtering and pagination
router.get('/audit/logs', authenticateToken, requireSuperAdmin, [
  vquery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  vquery('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  vquery('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601 format'),
  vquery('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601 format'),
  vquery('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  vquery('tenantId').optional().isUUID().withMessage('Tenant ID must be valid UUID'),
  vquery('actionType').optional().isString().withMessage('Action type must be string'),
  vquery('resourceType').optional().isString().withMessage('Resource type must be string'),
  vquery('success').optional().isBoolean().withMessage('Success must be boolean'),
  vquery('search').optional().isString().withMessage('Search must be string'),
  vquery('category').optional().isString().withMessage('Category must be string'),
  vquery('sortBy').optional().isIn(['created_at', 'action_type', 'user_email', 'success']).withMessage('Invalid sort field'),
  vquery('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Sort order must be ASC or DESC')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      userId,
      tenantId,
      actionType,
      resourceType,
      success,
      search,
      category,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userId,
      tenantId,
      actionType,
      resourceType,
      success: success !== undefined ? success === 'true' : undefined,
      search,
      category
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    const result = await auditLogger.getAuditLogs(filters, pagination);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit log details
router.get('/audit/logs/:id', authenticateToken, requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid audit log ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const result = await query(`
      SELECT *
      FROM audit_log_details
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json({
      success: true,
      log: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Generate audit report
router.post('/audit/reports', authenticateToken, requireSuperAdmin, [
  body('reportType').isIn(['activity_summary', 'security_audit', 'compliance_report', 'custom']).withMessage('Invalid report type'),
  body('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601 format'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601 format'),
  body('filters').optional().isObject().withMessage('Filters must be object'),
  body('includeCharts').optional().isBoolean().withMessage('Include charts must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      reportType,
      startDate,
      endDate,
      filters = {},
      includeCharts = true
    } = req.body;

    const reportConfig = {
      reportType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      filters,
      includeCharts
    };

    const report = await auditLogger.generateAuditReport(reportConfig);

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Error generating audit report:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

// Get audit alerts
router.get('/audit/alerts', authenticateToken, requireSuperAdmin, [
  vquery('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  vquery('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  vquery('alertType').optional().isString().withMessage('Alert type must be string'),
  vquery('severityLevel').optional().isInt({ min: 1, max: 4 }).withMessage('Severity level must be between 1 and 4'),
  vquery('isResolved').optional().isBoolean().withMessage('Is resolved must be boolean'),
  vquery('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  vquery('tenantId').optional().isUUID().withMessage('Tenant ID must be valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 20,
      alertType,
      severityLevel,
      isResolved,
      userId,
      tenantId
    } = req.query;

    const filters = {
      alertType,
      severityLevel: severityLevel ? parseInt(severityLevel) : undefined,
      isResolved: isResolved !== undefined ? isResolved === 'true' : undefined,
      userId,
      tenantId
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await auditLogger.getAuditAlerts(filters, pagination);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error fetching audit alerts:', error);
    res.status(500).json({ error: 'Failed to fetch audit alerts' });
  }
});

// Resolve audit alert
router.post('/audit/alerts/:id/resolve', authenticateToken, requireSuperAdmin, [
  param('id').isUUID().withMessage('Invalid alert ID'),
  body('resolutionNotes').optional().isString().withMessage('Resolution notes must be string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const alert = await auditLogger.resolveAlert(id, req.user.id, resolutionNotes);

    res.json({
      success: true,
      alert
    });

  } catch (error) {
    console.error('Error resolving audit alert:', error);
    res.status(500).json({ error: 'Failed to resolve audit alert' });
  }
});

// Get audit statistics
router.get('/audit/statistics', authenticateToken, requireSuperAdmin, [
  vquery('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = '30d' } = req.query;

    const statistics = await auditLogger.getAuditStatistics(period);

    res.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Export audit logs
router.get('/audit/export', authenticateToken, requireSuperAdmin, [
  vquery('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
  vquery('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601 format'),
  vquery('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601 format'),
  vquery('actionType').optional().isString().withMessage('Action type must be string'),
  vquery('userId').optional().isUUID().withMessage('User ID must be valid UUID'),
  vquery('tenantId').optional().isUUID().withMessage('Tenant ID must be valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      format = 'csv',
      startDate,
      endDate,
      actionType,
      userId,
      tenantId
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      actionType,
      userId,
      tenantId
    };

    const exportData = await auditLogger.exportAuditLogs(filters, format);

    // Set appropriate headers
    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.send(exportData);

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Get audit categories
router.get('/audit/categories', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM audit_categories
      ORDER BY name
    `);

    res.json({
      success: true,
      categories: result.rows
    });

  } catch (error) {
    console.error('Error fetching audit categories:', error);
    res.status(500).json({ error: 'Failed to fetch audit categories' });
  }
});

// Get audit severity levels
router.get('/audit/severity-levels', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM audit_severity_levels
      ORDER BY level
    `);

    res.json({
      success: true,
      severityLevels: result.rows
    });

  } catch (error) {
    console.error('Error fetching audit severity levels:', error);
    res.status(500).json({ error: 'Failed to fetch audit severity levels' });
  }
});

// Cleanup old audit logs (admin only)
router.post('/audit/cleanup', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const deletedCount = await auditLogger.cleanupOldLogs();

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old audit logs`,
      deletedCount
    });

  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({ error: 'Failed to cleanup audit logs' });
  }
});

// ===== ROLE MANAGEMENT ENDPOINTS =====

// Get all roles and their permissions
router.get('/roles', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // First, try to get roles from the roles table
    let rolesFromDB = [];
    try {
      const dbResult = await query(`
        SELECT 
          id,
          name,
          display_name,
          description,
          permissions,
          is_system_role,
          created_at,
          updated_at
        FROM roles
        ORDER BY is_system_role DESC, display_name ASC
      `);
      
      rolesFromDB = dbResult.rows.map(role => ({
        ...role,
        permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions || []
      }));
    } catch (dbError) {
      console.log('Roles table not found, using default roles');
    }

    // If no roles from DB, use default system roles
    if (rolesFromDB.length === 0) {
      const systemRoles = [
        {
          id: 'super_admin',
          name: 'super_admin',
          display_name: 'Super Admin',
          description: 'Full platform access (excludes vehicle/import management)',
          permissions: ['lead_management', 'analytics_dashboard', 'bulk_actions', 'custom_branding', 'api_access', 'priority_support', 'staff_management', 'user_management', 'finance_management', 'rebate_management', 'daive_settings_management', 'followup_settings_management', 'customer_management'],
          is_system_role: true,
          user_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'admin',
          name: 'admin',
          display_name: 'Dealership Admin',
          description: 'Full dealership access with all management capabilities',
          permissions: ['qr_code_generation', 'lead_management', 'vehicle_import', 'analytics_dashboard', 'bulk_actions', 'staff_management', 'user_management', 'custom_branding', 'api_access', 'priority_support', 'finance_management', 'rebate_management', 'daive_settings_management', 'followup_settings_management', 'customer_management'],
          is_system_role: true,
          user_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'sales',
          name: 'sales',
          display_name: 'Sales Representative',
          description: 'Sales-focused access for lead and vehicle operations',
          permissions: ['qr_code_generation', 'lead_management', 'vehicle_import', 'rebate_management', 'followup_settings_management', 'customer_management'],
          is_system_role: true,
          user_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'finance',
          name: 'finance',
          display_name: 'Finance Manager',
          description: 'Finance-focused access for deals, credit apps, and rebates',
          permissions: ['lead_management', 'analytics_dashboard', 'finance_management', 'rebate_management', 'customer_management'],
          is_system_role: true,
          user_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'service',
          name: 'service',
          display_name: 'Service Advisor',
          description: 'Service-focused access for customer management',
          permissions: ['lead_management', 'followup_settings_management', 'customer_management'],
          is_system_role: true,
          user_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'inventory',
          name: 'inventory',
          display_name: 'Inventory Manager',
          description: 'Inventory-focused access for vehicle management',
          permissions: ['vehicle_import', 'qr_code_generation'],
          is_system_role: true,
          user_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Get user counts for system roles
      const roleCountMap = {};
      
      // Get super admin count
      const superAdminCount = await query(`
        SELECT COUNT(*) as count
        FROM user_roles ur
        WHERE ur.role = 'super_admin'
      `);
      roleCountMap['super_admin'] = parseInt(superAdminCount.rows[0].count);

      // Update roles with actual user counts
      const rolesWithCounts = systemRoles.map(role => ({
        ...role,
        user_count: roleCountMap[role.name] || 0
      }));

      res.json({
        success: true,
        roles: rolesWithCounts
      });
    } else {
      // Get user counts for roles from database
      const roleCountMap = {};
      
      for (const role of rolesFromDB) {
        if (role.is_system_role) {
          // For system roles, only super_admin exists in user_roles enum
          if (role.name === 'super_admin') {
            const countResult = await query(`
              SELECT COUNT(*) as count
              FROM user_roles ur
              WHERE ur.role = 'super_admin'
            `);
            roleCountMap[role.id] = parseInt(countResult.rows[0].count);
          } else {
            // For other system roles, check dealership_staff table
            try {
              const countResult = await query(`
                SELECT COUNT(*) as count
                FROM dealership_staff ds
                WHERE ds.staff_role = $1 AND ds.is_active = true
              `, [role.name]);
              roleCountMap[role.id] = parseInt(countResult.rows[0].count);
            } catch (error) {
              console.log(`Warning: Could not count users for role ${role.name}:`, error.message);
              roleCountMap[role.id] = 0;
            }
          }
        } else {
          // For custom roles, you might have a different user assignment table
          roleCountMap[role.id] = 0; // Default to 0 for now
        }
      }

      // Update roles with user counts
      const rolesWithCounts = rolesFromDB.map(role => ({
        ...role,
        user_count: roleCountMap[role.id] || 0
      }));

      res.json({
        success: true,
        roles: rolesWithCounts
      });
    }

  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get available permissions
router.get('/roles/permissions', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const permissions = [
      // Core Features
      { name: 'qr_code_generation', display_name: 'QR Code Generation', description: 'Generate QR codes for vehicles', category: 'Core Features' },
      { name: 'lead_management', display_name: 'Lead Management', description: 'Manage customer leads and follow-ups', category: 'Core Features' },
      { name: 'vehicle_import', display_name: 'Vehicle Import', description: 'Import vehicles from various sources', category: 'Core Features' },
      
      // Analytics & Reporting
      { name: 'analytics_dashboard', display_name: 'Analytics Dashboard', description: 'Access analytics and reporting', category: 'Analytics & Reporting' },
      { name: 'bulk_actions', display_name: 'Bulk Actions', description: 'Perform bulk operations on data', category: 'Analytics & Reporting' },
      
      // Administration
      { name: 'staff_management', display_name: 'Staff Management', description: 'Manage dealership staff members', category: 'Administration' },
      { name: 'user_management', display_name: 'User Management', description: 'Manage user accounts and access', category: 'Administration' },
      
      // Customization
      { name: 'custom_branding', display_name: 'Custom Branding', description: 'Customize dealership branding', category: 'Customization' },
      
      // Technical
      { name: 'api_access', display_name: 'API Access', description: 'Access to API endpoints', category: 'Technical' },
      { name: 'priority_support', display_name: 'Priority Support', description: 'Access to priority customer support', category: 'Technical' }
    ];

    res.json({
      success: true,
      permissions
    });

  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get role statistics
router.get('/roles/statistics', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // Get total users by role
    const roleStats = await query(`
      SELECT 
        'super_admin' as role,
        COUNT(*) as user_count
      FROM user_roles ur
      WHERE ur.role = 'super_admin'
      
      UNION ALL
      
      SELECT 
        ds.staff_role as role,
        COUNT(*) as user_count
      FROM dealership_staff ds
      WHERE ds.is_active = true
      GROUP BY ds.staff_role
      
      ORDER BY user_count DESC
    `);

    // Get permission usage statistics
    const permissionStats = await query(`
      SELECT 
        permission_name,
        COUNT(*) as role_count
      FROM (
        SELECT unnest(permissions) as permission_name
        FROM dealership_staff
        WHERE is_active = true
      ) as permissions
      GROUP BY permission_name
      ORDER BY role_count DESC
    `);

    res.json({
      success: true,
      statistics: {
        role_distribution: roleStats.rows,
        permission_usage: permissionStats.rows,
        total_roles: 6, // System roles
        total_permissions: 10
      }
    });

  } catch (error) {
    console.error('Error fetching role statistics:', error);
    res.status(500).json({ error: 'Failed to fetch role statistics' });
  }
});

// Get users by role
router.get('/roles/:roleName/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { roleName } = req.params;

    if (roleName === 'super_admin') {
      const result = await query(`
        SELECT 
          u.id,
          u.email,
          u.created_at,
          'Super Admin' as role_display_name
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'super_admin'
        ORDER BY u.created_at DESC
      `);

      res.json({
        success: true,
        users: result.rows
      });
    } else {
      const result = await query(`
        SELECT 
          u.id,
          u.email,
          u.created_at,
          ds.staff_role,
          d.business_name as dealer_name,
          ds.is_active
        FROM users u
        JOIN dealership_staff ds ON u.id = ds.user_id
        JOIN dealers d ON ds.dealer_id = d.id
        WHERE ds.staff_role = $1
        ORDER BY u.created_at DESC
      `, [roleName]);

      res.json({
        success: true,
        users: result.rows
      });
    }

  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ error: 'Failed to fetch users by role' });
  }
});

// Create new role
router.post('/roles', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }

    // Check if role already exists
    const existingRole = await query(`
      SELECT id FROM roles WHERE name = $1
    `, [name]);

    if (existingRole.rows.length > 0) {
      return res.status(400).json({ error: 'Role with this name already exists' });
    }

    // Create new role
    const result = await query(`
      INSERT INTO roles (name, display_name, description, permissions, is_system_role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING *
    `, [name, display_name, description, JSON.stringify(permissions || [])]);

    res.json({
      success: true,
      role: {
        ...result.rows[0],
        permissions: typeof result.rows[0].permissions === 'string' ? JSON.parse(result.rows[0].permissions) : result.rows[0].permissions || [],
        user_count: 0
      }
    });

  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role
router.put('/roles/:roleId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, display_name, description, permissions } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }

    // Check if role exists
    const existingRole = await query(`
      SELECT * FROM roles WHERE id = $1
    `, [roleId]);

    if (existingRole.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = existingRole.rows[0];
    let updatedRole;

    // For system roles, only allow permission updates
    if (role.is_system_role) {
      const result = await query(`
        UPDATE roles 
        SET permissions = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [JSON.stringify(permissions || []), roleId]);
      
      updatedRole = result.rows[0];

      // Update staff_permissions table for all staff with this role
      console.log(`🔄 Updating staff_permissions for role: ${name}`);
      
      let staffCount = 0;
      try {
        // Get all staff members with this role
        const staffMembers = await query(`
          SELECT id FROM dealership_staff 
          WHERE staff_role = $1 AND is_active = true
        `, [name]);

        staffCount = staffMembers.rows.length;
        console.log(`📊 Found ${staffCount} staff members with role ${name}`);

        if (staffCount > 0) {
          // Delete old permissions for these staff members
          const staffIds = staffMembers.rows.map(s => s.id);
          await query(`
            DELETE FROM staff_permissions 
            WHERE staff_id = ANY($1)
          `, [staffIds]);

          console.log(`🗑️  Deleted old permissions for ${staffCount} staff members`);

          // Insert new permissions for each staff member
          if (permissions && permissions.length > 0) {
            for (const staffId of staffIds) {
              for (const permission of permissions) {
                await query(`
                  INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
                  VALUES ($1, $2, true)
                  ON CONFLICT (staff_id, permission_name) DO UPDATE
                  SET permission_value = true, updated_at = NOW()
                `, [staffId, permission]);
              }
            }
            console.log(`✅ Added ${permissions.length} permissions for ${staffCount} staff members`);
          }
        }
      } catch (staffError) {
        console.error('⚠️  Warning: Could not update staff_permissions:', staffError);
        // Don't fail the whole request, just log the error
      }

      res.json({
        success: true,
        role: {
          ...updatedRole,
          permissions: typeof updatedRole.permissions === 'string' ? JSON.parse(updatedRole.permissions) : updatedRole.permissions || [],
          user_count: role.user_count || 0
        },
        message: `Role updated successfully. ${staffCount} staff member(s) permissions updated.`
      });
    } else {
      // For custom roles, allow all updates
      const result = await query(`
        UPDATE roles 
        SET name = $1, display_name = $2, description = $3, permissions = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [name, display_name, description, JSON.stringify(permissions || []), roleId]);

      updatedRole = result.rows[0];

      // Update staff_permissions table for custom roles too
      console.log(`🔄 Updating staff_permissions for custom role: ${name}`);
      
      let staffCount = 0;
      try {
        const staffMembers = await query(`
          SELECT id FROM dealership_staff 
          WHERE staff_role = $1 AND is_active = true
        `, [name]);

        staffCount = staffMembers.rows.length;
        if (staffCount > 0) {
          const staffIds = staffMembers.rows.map(s => s.id);
          await query(`
            DELETE FROM staff_permissions 
            WHERE staff_id = ANY($1)
          `, [staffIds]);

          if (permissions && permissions.length > 0) {
            for (const staffId of staffIds) {
              for (const permission of permissions) {
                await query(`
                  INSERT INTO staff_permissions (staff_id, permission_name, permission_value)
                  VALUES ($1, $2, true)
                  ON CONFLICT (staff_id, permission_name) DO UPDATE
                  SET permission_value = true, updated_at = NOW()
                `, [staffId, permission]);
              }
            }
          }
        }
      } catch (staffError) {
        console.error('⚠️  Warning: Could not update staff_permissions:', staffError);
      }

      res.json({
        success: true,
        role: {
          ...updatedRole,
          permissions: typeof updatedRole.permissions === 'string' ? JSON.parse(updatedRole.permissions) : updatedRole.permissions || [],
          user_count: role.user_count || 0
        },
        message: `Role updated successfully. ${staffCount} staff member(s) permissions updated.`
      });
    }

  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role
router.delete('/roles/:roleId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;

    // Check if role exists
    const existingRole = await query(`
      SELECT * FROM roles WHERE id = $1
    `, [roleId]);

    if (existingRole.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = existingRole.rows[0];

    // Prevent deletion of system roles
    if (role.is_system_role) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }

    // Check if role has assigned users
    const userCount = await query(`
      SELECT COUNT(*) as count FROM user_roles WHERE role = $1
    `, [role.name]);

    if (parseInt(userCount.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete role with assigned users' });
    }

    // Delete the role
    await query(`
      DELETE FROM roles WHERE id = $1
    `, [roleId]);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// =====================================================
// EMAIL TRACKING ENDPOINTS
// =====================================================

// Track email opens
router.get('/track/open/:trackingPixelId', async (req, res) => {
  try {
    const { trackingPixelId } = req.params;
    
    // Find the send record
    const sendResult = await query(`
      SELECT s.*, e.lead_id, e.journey_id, l.full_name, l.email
      FROM marketing_sends s
      JOIN marketing_enrollments e ON s.enrollment_id = e.id
      JOIN software_leads l ON e.lead_id = l.id
      WHERE s.tracking_pixel_id = $1 AND s.status = 'sent'
    `, [trackingPixelId]);

    if (sendResult.rows.length === 0) {
      return res.status(404).send('Not found');
    }

    const send = sendResult.rows[0];

    // Check if already opened
    const existingOpen = await query(`
      SELECT id FROM marketing_email_events 
      WHERE send_id = $1 AND event_type = 'open'
    `, [send.id]);

    if (existingOpen.rows.length === 0) {
      // Record the open event
      await query(`
        INSERT INTO marketing_email_events (send_id, event_type, user_agent, ip_address, event_data)
        VALUES ($1, 'open', $2, $3, $4)
      `, [
        send.id,
        req.get('User-Agent') || null,
        req.ip || req.connection.remoteAddress || null,
        JSON.stringify({
          referer: req.get('Referer'),
          timestamp: new Date().toISOString()
        })
      ]);

      // Update the send record
      await query(`
        UPDATE marketing_sends 
        SET opened_at = NOW() 
        WHERE id = $1 AND opened_at IS NULL
      `, [send.id]);

      console.log(`📧 Email opened: ${send.email} (${send.full_name})`);
    }

    // Return a 1x1 transparent pixel
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(pixel);

  } catch (error) {
    console.error('Error tracking email open:', error);
    res.status(500).send('Error');
  }
});

// Track email clicks
router.get('/track/click/:trackingPixelId', async (req, res) => {
  try {
    const { trackingPixelId } = req.params;
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('URL parameter required');
    }

    // Decode the URL
    const decodedUrl = decodeURIComponent(url);

    // Find the send record
    const sendResult = await query(`
      SELECT s.*, e.lead_id, e.journey_id, l.full_name, l.email
      FROM marketing_sends s
      JOIN marketing_enrollments e ON s.enrollment_id = e.id
      JOIN software_leads l ON e.lead_id = l.id
      WHERE s.tracking_pixel_id = $1 AND s.status = 'sent'
    `, [trackingPixelId]);

    if (sendResult.rows.length === 0) {
      return res.status(404).send('Not found');
    }

    const send = sendResult.rows[0];

    // Record the click event
    await query(`
      INSERT INTO marketing_email_events (send_id, event_type, user_agent, ip_address, event_data)
      VALUES ($1, 'click', $2, $3, $4)
    `, [
      send.id,
      req.get('User-Agent') || null,
      req.ip || req.connection.remoteAddress || null,
      JSON.stringify({
        clicked_url: decodedUrl,
        referer: req.get('Referer'),
        timestamp: new Date().toISOString()
      })
    ]);

    // Update the send record
    await query(`
      UPDATE marketing_sends 
      SET clicked_at = NOW() 
      WHERE id = $1
    `, [send.id]);

    console.log(`🔗 Email clicked: ${send.email} (${send.full_name}) -> ${decodedUrl}`);

    // Redirect to the original URL
    res.redirect(decodedUrl);

  } catch (error) {
    console.error('Error tracking email click:', error);
    res.status(500).send('Error');
  }
});

// Track email bounces
router.post('/track/bounce', async (req, res) => {
  try {
    const { messageId, reason, type } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'Message ID required' });
    }

    // Find the send record by provider message ID
    const sendResult = await query(`
      SELECT s.*, e.lead_id, e.journey_id, l.full_name, l.email
      FROM marketing_sends s
      JOIN marketing_enrollments e ON s.enrollment_id = e.id
      JOIN software_leads l ON e.lead_id = l.id
      WHERE s.provider_message_id = $1
    `, [messageId]);

    if (sendResult.rows.length === 0) {
      return res.status(404).json({ error: 'Send record not found' });
    }

    const send = sendResult.rows[0];

    // Record the bounce event
    await query(`
      INSERT INTO marketing_email_events (send_id, event_type, event_data)
      VALUES ($1, 'bounce', $2)
    `, [
      send.id,
      JSON.stringify({
        reason: reason || 'Unknown',
        type: type || 'hard',
        timestamp: new Date().toISOString()
      })
    ]);

    // Update the send record
    await query(`
      UPDATE marketing_sends 
      SET bounced_at = NOW(), status = 'failed' 
      WHERE id = $1
    `, [send.id]);

    console.log(`📧 Email bounced: ${send.email} (${send.full_name}) - ${reason}`);

    res.json({ success: true });

  } catch (error) {
    console.error('Error tracking email bounce:', error);
    res.status(500).json({ error: 'Failed to track bounce' });
  }
});

// Track unsubscribes
router.post('/track/unsubscribe/:trackingPixelId', async (req, res) => {
  try {
    const { trackingPixelId } = req.params;

    // Find the send record
    const sendResult = await query(`
      SELECT s.*, e.lead_id, e.journey_id, l.full_name, l.email
      FROM marketing_sends s
      JOIN marketing_enrollments e ON s.enrollment_id = e.id
      JOIN software_leads l ON e.lead_id = l.id
      WHERE s.tracking_pixel_id = $1 AND s.status = 'sent'
    `, [trackingPixelId]);

    if (sendResult.rows.length === 0) {
      return res.status(404).send('Not found');
    }

    const send = sendResult.rows[0];

    // Record the unsubscribe event
    await query(`
      INSERT INTO marketing_email_events (send_id, event_type, user_agent, ip_address, event_data)
      VALUES ($1, 'unsubscribe', $2, $3, $4)
    `, [
      send.id,
      req.get('User-Agent') || null,
      req.ip || req.connection.remoteAddress || null,
      JSON.stringify({
        timestamp: new Date().toISOString()
      })
    ]);

    // Update the send record
    await query(`
      UPDATE marketing_sends 
      SET unsubscribed_at = NOW() 
      WHERE id = $1
    `, [send.id]);

    // Cancel all future enrollments for this lead
    await query(`
      UPDATE marketing_enrollments 
      SET status = 'cancelled' 
      WHERE lead_id = $1 AND status = 'active'
    `, [send.lead_id]);

    console.log(`📧 Email unsubscribed: ${send.email} (${send.full_name})`);

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>You have been unsubscribed</h2>
          <p>You will no longer receive marketing emails from us.</p>
          <p>Thank you for your time.</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error tracking unsubscribe:', error);
    res.status(500).send('Error');
  }
});

// =====================================================
// MARKETING ANALYTICS API ENDPOINTS
// =====================================================

// Get campaign performance metrics
router.get('/marketing/analytics/campaigns/:journeyId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { days = 30 } = req.query;

    // Get journey info
    const journeyResult = await query(`
      SELECT id, name, description, is_active, created_at
      FROM marketing_journeys 
      WHERE id = $1
    `, [journeyId]);

    if (journeyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const journey = journeyResult.rows[0];
    journey.status = journey.is_active ? 'active' : 'inactive'; // Convert boolean to string

    // Get analytics data
    const analyticsResult = await query(`
      SELECT 
        COALESCE(SUM(emails_sent), 0) as total_sends,
        COALESCE(SUM(emails_delivered), 0) as total_delivered,
        COALESCE(SUM(emails_opened), 0) as total_opens,
        COALESCE(SUM(emails_clicked), 0) as total_clicks,
        COALESCE(SUM(emails_bounced), 0) as total_bounces,
        COALESCE(SUM(emails_unsubscribed), 0) as total_unsubscribes,
        COALESCE(SUM(unique_opens), 0) as unique_opens,
        COALESCE(SUM(unique_clicks), 0) as unique_clicks,
        COALESCE(SUM(conversion_count), 0) as total_conversions,
        COALESCE(SUM(revenue_attributed), 0) as total_revenue
      FROM marketing_campaign_analytics 
      WHERE journey_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `, [journeyId]);

    const analytics = analyticsResult.rows[0];

    // Calculate rates
    const openRate = analytics.total_delivered > 0 ? (analytics.total_opens / analytics.total_delivered) : 0;
    const clickRate = analytics.total_delivered > 0 ? (analytics.total_clicks / analytics.total_delivered) : 0;
    const conversionRate = analytics.total_delivered > 0 ? (analytics.total_conversions / analytics.total_delivered) : 0;
    const bounceRate = analytics.total_sends > 0 ? (analytics.total_bounces / analytics.total_sends) : 0;
    const unsubscribeRate = analytics.total_delivered > 0 ? (analytics.total_unsubscribes / analytics.total_delivered) : 0;

    res.json({
      success: true,
      journey: journey,
      analytics: {
        ...analytics,
        open_rate: Math.round(openRate * 10000) / 100, // Percentage with 2 decimals
        click_rate: Math.round(clickRate * 10000) / 100,
        conversion_rate: Math.round(conversionRate * 10000) / 100,
        bounce_rate: Math.round(bounceRate * 10000) / 100,
        unsubscribe_rate: Math.round(unsubscribeRate * 10000) / 100
      }
    });

  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ error: 'Failed to fetch campaign analytics' });
  }
});

// Get all campaigns analytics overview
router.get('/marketing/analytics/campaigns', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await query(`
      SELECT 
        j.id,
        j.name,
        j.description,
        j.is_active,
        j.created_at,
        COALESCE(SUM(a.emails_sent), 0) as total_sends,
        COALESCE(SUM(a.emails_delivered), 0) as total_delivered,
        COALESCE(SUM(a.emails_opened), 0) as total_opens,
        COALESCE(SUM(a.emails_clicked), 0) as total_clicks,
        COALESCE(SUM(a.unique_opens), 0) as unique_opens,
        COALESCE(SUM(a.unique_clicks), 0) as unique_clicks,
        COALESCE(SUM(a.conversion_count), 0) as total_conversions,
        COALESCE(SUM(a.revenue_attributed), 0) as total_revenue
      FROM marketing_journeys j
      LEFT JOIN marketing_campaign_analytics a ON j.id = a.journey_id 
        AND a.date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY j.id, j.name, j.description, j.is_active, j.created_at
      ORDER BY j.created_at DESC
    `);

    const campaigns = result.rows.map(campaign => {
      const openRate = campaign.total_delivered > 0 ? (campaign.total_opens / campaign.total_delivered) : 0;
      const clickRate = campaign.total_delivered > 0 ? (campaign.total_clicks / campaign.total_delivered) : 0;
      const conversionRate = campaign.total_delivered > 0 ? (campaign.total_conversions / campaign.total_delivered) : 0;

      return {
        ...campaign,
        status: campaign.is_active ? 'active' : 'inactive', // Convert boolean to string
        open_rate: Math.round(openRate * 10000) / 100,
        click_rate: Math.round(clickRate * 10000) / 100,
        conversion_rate: Math.round(conversionRate * 10000) / 100
      };
    });

    res.json({
      success: true,
      campaigns: campaigns
    });

  } catch (error) {
    console.error('Error fetching campaigns analytics:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns analytics' });
  }
});

// Get real-time activity feed
router.get('/marketing/analytics/activity', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(`
      SELECT 
        af.id,
        af.activity_type,
        af.activity_data,
        af.created_at,
        l.full_name,
        l.email,
        j.name as journey_name
      FROM marketing_activity_feed af
      JOIN software_leads l ON af.lead_id = l.id
      JOIN marketing_journeys j ON af.journey_id = j.id
      ORDER BY af.created_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      activities: result.rows
    });

  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// Get lead scoring trends
router.get('/marketing/analytics/lead-scoring/:leadId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { leadId } = req.params;

    // Get lead info
    const leadResult = await query(`
      SELECT id, full_name, email, lead_score, qualification_status
      FROM software_leads 
      WHERE id = $1
    `, [leadId]);

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leadResult.rows[0];

    // Get score history
    const historyResult = await query(`
      SELECT 
        old_score,
        new_score,
        change_reason,
        marketing_trigger_id,
        created_at
      FROM lead_score_history 
      WHERE lead_id = $1
      ORDER BY created_at ASC
    `, [leadId]);

    res.json({
      success: true,
      lead: lead,
      score_history: historyResult.rows
    });

  } catch (error) {
    console.error('Error fetching lead scoring:', error);
    res.status(500).json({ error: 'Failed to fetch lead scoring' });
  }
});

// Get revenue attribution
router.get('/marketing/analytics/revenue-attribution', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await query(`
      SELECT 
        j.id as journey_id,
        j.name as journey_name,
        COUNT(mra.id) as conversion_count,
        COALESCE(SUM(mra.revenue_amount), 0) as total_revenue,
        COALESCE(AVG(mra.revenue_amount), 0) as avg_revenue_per_conversion
      FROM marketing_journeys j
      LEFT JOIN marketing_revenue_attribution mra ON j.id = mra.journey_id
        AND mra.conversion_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY j.id, j.name
      ORDER BY total_revenue DESC
    `);

    // Calculate total attributed revenue
    const totalRevenue = result.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0);

    res.json({
      success: true,
      attribution: result.rows,
      total_attributed_revenue: totalRevenue
    });

  } catch (error) {
    console.error('Error fetching revenue attribution:', error);
    res.status(500).json({ error: 'Failed to fetch revenue attribution' });
  }
});

// Get email template performance
router.get('/marketing/analytics/templates', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        mta.*,
        js.template_subject,
        js.template_body,
        j.name as journey_name
      FROM marketing_template_analytics mta
      JOIN marketing_journey_steps js ON mta.step_id = js.id
      JOIN marketing_journeys j ON js.journey_id = j.id
      ORDER BY mta.total_sends DESC
    `);

    res.json({
      success: true,
      templates: result.rows
    });

  } catch (error) {
    console.error('Error fetching template analytics:', error);
    res.status(500).json({ error: 'Failed to fetch template analytics' });
  }
});

// =====================================================
// RESET DEALERSHIP DATA
// =====================================================

// Get list of all dealers for reset selection
router.get('/dealers-for-reset', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        d.id,
        d.business_name,
        d.contact_name,
        d.email,
        d.city,
        d.state,
        d.created_at,
        (SELECT COUNT(*) FROM vehicles WHERE dealer_id = d.id) as vehicle_count,
        (SELECT COUNT(*) FROM leads WHERE dealer_id = d.id) as lead_count,
        (SELECT COUNT(*) FROM credit_applications 
         WHERE dealer_id = d.id 
         OR conversation_id IN (SELECT id FROM daive_conversations WHERE dealer_id = d.id)
         OR vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = d.id)
         OR customer_id IN (SELECT id FROM customers WHERE dealer_id = d.id)
        ) as finance_count,
        (SELECT COUNT(*) FROM rebates WHERE dealer_id = d.id) as rebate_count,
        (SELECT COUNT(*) FROM daive_conversations WHERE dealer_id = d.id) as conversation_count
      FROM dealers d
      ORDER BY d.business_name
    `);
    
    res.json({ dealers: result.rows });
  } catch (error) {
    console.error('Error fetching dealers for reset:', error);
    res.status(500).json({ error: 'Failed to fetch dealers' });
  }
});

// Reset dealership data (selective or full)
router.post('/reset-dealership-data', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { dealerId, categories, confirmationText } = req.body;
    
    // SAFETY CHECK: Require explicit confirmation
    if (confirmationText !== 'RESET DATA') {
      return res.status(400).json({ 
        error: 'Invalid confirmation text. Type "RESET DATA" exactly.' 
      });
    }
    
    // Verify dealer exists
    const dealerCheck = await query(
      'SELECT id, business_name FROM dealers WHERE id = $1',
      [dealerId]
    );
    
    if (dealerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }
    
    const dealer = dealerCheck.rows[0];
    const deletedCounts = {};
    
    console.log(`🚨 RESET DATA REQUEST for dealer: ${dealer.business_name} (${dealerId})`);
    console.log(`📋 Categories to reset:`, categories);
    console.log(`👤 Requested by: ${req.user?.email || 'unknown'} (${req.user?.id || 'unknown'})`);
    
    // BEGIN TRANSACTION
    console.log('🔄 Starting transaction...');
    await query('BEGIN');
    console.log('✅ Transaction started');
    
    try {
      // ⚠️ IMPORTANT: Delete in correct order to respect foreign key constraints
      // Order: Conversations → Leads (and children) → Rebates (and children) → Vehicles (and children)
      
      // CONVERSATIONS - Delete AI chat conversations FIRST (has FK to leads)
      if (categories.includes('conversations')) {
        const conversationsResult = await query(
          'DELETE FROM daive_conversations WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.conversations = conversationsResult.rowCount || 0;
        console.log(`🗑️  Deleted ${deletedCounts.conversations} conversations`);
      }
      if (categories.includes('vehicles')) {
        // 0. First, clear latest_carfax_report_id references in vehicles table to avoid FK constraint violation
        const clearCarfaxRefsResult = await query(
          'UPDATE vehicles SET latest_carfax_report_id = NULL WHERE dealer_id = $1 AND latest_carfax_report_id IS NOT NULL',
          [dealerId]
        );
        console.log(`🔗 Cleared latest_carfax_report_id references for vehicles`);
        
        // 1. Now safe to delete carfax reports
        const carfaxResult = await query(
          'DELETE FROM carfax_reports WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.carfax_reports = carfaxResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.carfax_reports} carfax reports`);
        
        // 2. Delete chat conversations
        const chatResult = await query(
          'DELETE FROM chat_conversations WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.chat_conversations = chatResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.chat_conversations} chat conversations`);
        
        // 3. Delete application links
        const appLinksResult = await query(
          'DELETE FROM application_links WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.application_links = appLinksResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.application_links} application links`);
        
        // 4. Delete customer leads
        const customerLeadsResult = await query(
          'DELETE FROM customer_leads WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.customer_leads = customerLeadsResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.customer_leads} customer leads`);
        
        // Note: leads, finance_deals, credit_applications, rebate_applications 
        // should be handled by their respective category deletions
        
        // 5. Finally, delete the vehicles themselves
        const vehicleResult = await query(
          'DELETE FROM vehicles WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.vehicles = vehicleResult.rowCount;
        console.log(`🗑️  Deleted ${deletedCounts.vehicles} vehicles for dealer ${dealer.business_name}`);
      }
      
      // LEADS - Delete all leads (must delete all child records first!)
      if (categories.includes('leads')) {
        // 1. Delete lead follow-ups
        const followUpsResult = await query(
          'DELETE FROM lead_follow_ups WHERE lead_id IN (SELECT id FROM leads WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.lead_follow_ups = followUpsResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.lead_follow_ups} lead follow-ups`);
        
        // 2. Delete customer lifecycle stages
        const lifecycleResult = await query(
          'DELETE FROM customer_lifecycle_stages WHERE lead_id IN (SELECT id FROM leads WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.lifecycle_stages = lifecycleResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.lifecycle_stages} lifecycle stages`);
        
        // 3. Delete followup enrollments
        const enrollmentsResult = await query(
          'DELETE FROM followup_enrollments WHERE lead_id IN (SELECT id FROM leads WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.followup_enrollments = enrollmentsResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.followup_enrollments} followup enrollments`);
        
        // 4. Delete followup opt-outs
        const optOutsResult = await query(
          'DELETE FROM followup_opt_outs WHERE lead_id IN (SELECT id FROM leads WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.followup_opt_outs = optOutsResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.followup_opt_outs} followup opt-outs`);
        
        // 5. Delete conversations that reference these leads (if not already deleted)
        if (!categories.includes('conversations')) {
          const relatedConversationsResult = await query(
            'DELETE FROM daive_conversations WHERE dealer_id = $1 AND lead_id IS NOT NULL',
            [dealerId]
          );
          deletedCounts.conversations_auto = relatedConversationsResult.rowCount || 0;
          console.log(`🗑️  Auto-deleted ${deletedCounts.conversations_auto} conversations linked to leads`);
        }
        
        // 6. Finally, delete the leads themselves
        const leadResult = await query(
          'DELETE FROM leads WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.leads = leadResult.rowCount;
        console.log(`🗑️  Deleted ${deletedCounts.leads} leads`);
      }
      
      // FINANCE - Delete finance-related data (handle missing tables gracefully + child records)
      if (categories.includes('finance')) {
        console.log('💰 Starting finance data deletion...');

        // Helper: safely delete from a table, silently skipping non-existent tables
        const safeDelete = async (tableName, whereClause, params = [dealerId]) => {
          try {
            console.log(`   🔍 DELETE FROM ${tableName} WHERE ${whereClause}`);
            const result = await query(`DELETE FROM ${tableName} WHERE ${whereClause}`, params);
            console.log(`   ✅ Deleted ${result.rowCount || 0} rows from ${tableName}`);
            return result.rowCount || 0;
          } catch (error) {
            if (error.code === '42P01') {
              console.log(`   ⚠️  Table ${tableName} doesn't exist, skipping`);
              return 0;
            }
            console.error(`   ❌ Error deleting from ${tableName}:`, error.message);
            throw error;
          }
        };

        // ── Step 0: Pre-collect all affected IDs ──────────────────────────────
        // finance_deals may have dealer_id = NULL when created via the AI bot
        // (linked only through vehicle_id or conversation_id), so we must use
        // ALL possible linkages to find every deal that belongs to this dealer.
        let dealIds = [];
        let appIds = [];

        try {
          const dealIdsResult = await query(
            `SELECT id FROM finance_deals
             WHERE dealer_id = $1
               OR vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)
               OR conversation_id IN (SELECT id FROM daive_conversations WHERE dealer_id = $1)`,
            [dealerId]
          );
          dealIds = dealIdsResult.rows.map(r => r.id);
          console.log(`💰 Found ${dealIds.length} finance_deals for dealer`);
        } catch (err) {
          console.warn('⚠️  Could not pre-collect finance_deal IDs:', err.message);
        }

        try {
          const appIdsResult = await query(
            `SELECT id FROM credit_applications
             WHERE dealer_id = $1
               OR conversation_id IN (SELECT id FROM daive_conversations WHERE dealer_id = $1)
               OR vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)
               OR customer_id IN (SELECT id FROM customers WHERE dealer_id = $1)`,
            [dealerId]
          );
          appIds = appIdsResult.rows.map(r => r.id);
          console.log(`💰 Found ${appIds.length} credit_applications for dealer`);
        } catch (err) {
          console.warn('⚠️  Could not pre-collect credit_application IDs:', err.message);
        }

        // Build PostgreSQL ANY-array params for ID-based deletions
        const dealIdsParam  = dealIds.length  ? dealIds  : ['00000000-0000-0000-0000-000000000000'];
        const appIdsParam   = appIds.length   ? appIds   : ['00000000-0000-0000-0000-000000000000'];

        // ── Step 1: Delete finance_deal_products ─────────────────────────────
        deletedCounts.finance_deal_products = await safeDelete(
          'finance_deal_products',
          'deal_id = ANY($1::uuid[])',
          [dealIdsParam]
        );
        console.log(`🗑️  Deleted ${deletedCounts.finance_deal_products} finance_deal_products`);

        // ── Step 2: Delete signature_requests (cascade takes care of signature_events) ─
        // Also delete by dealer_id to catch any not linked to a deal
        deletedCounts.signature_requests = await safeDelete(
          'signature_requests',
          'deal_id = ANY($1::uuid[])',
          [dealIdsParam]
        );
        // Catch any remaining linked only by dealer_id
        const sigByDealer = await safeDelete('signature_requests', 'dealer_id = $1');
        deletedCounts.signature_requests = (deletedCounts.signature_requests || 0) + sigByDealer;
        console.log(`🗑️  Deleted ${deletedCounts.signature_requests} signature_requests`);

        // ── Step 3: Clear circular FK refs on finance_deals before deleting children ─
        // finance_deals.latest_deal_sheet_id → generated_deal_sheets (ON DELETE SET NULL)
        // finance_deals.signature_request_id → signature_requests   (ON DELETE SET NULL)
        // Null these out now so generated_deal_sheets / signature_requests deletions
        // don't trigger SET NULL cascades on rows we're about to delete anyway.
        try {
          await query(
            `UPDATE finance_deals
             SET latest_deal_sheet_id = NULL, signature_request_id = NULL
             WHERE id = ANY($1::uuid[])`,
            [dealIdsParam]
          );
        } catch (err) {
          console.warn('⚠️  Could not clear circular FK refs on finance_deals:', err.message);
        }

        // ── Step 4: Delete generated_deal_sheets ─────────────────────────────
        deletedCounts.generated_deal_sheets_finance = await safeDelete(
          'generated_deal_sheets',
          'deal_id = ANY($1::uuid[])',
          [dealIdsParam]
        );
        console.log(`🗑️  Deleted ${deletedCounts.generated_deal_sheets_finance} generated_deal_sheets`);

        // ── Step 5: Delete lender_submissions ────────────────────────────────
        // Delete by deal_id, application_id, AND dealer_id to catch all
        const lsByDeal = await safeDelete(
          'lender_submissions',
          'deal_id = ANY($1::uuid[])',
          [dealIdsParam]
        );
        const lsByApp = await safeDelete(
          'lender_submissions',
          'application_id = ANY($1::uuid[])',
          [appIdsParam]
        );
        const lsByDealer = await safeDelete('lender_submissions', 'dealer_id = $1');
        deletedCounts.lender_submissions = (lsByDeal || 0) + (lsByApp || 0) + (lsByDealer || 0);
        console.log(`🗑️  Deleted ${deletedCounts.lender_submissions} lender_submissions`);

        // ── Step 6: Clear application_id on finance_deals (FK to credit_applications) ─
        try {
          await query(
            `UPDATE finance_deals SET application_id = NULL WHERE id = ANY($1::uuid[])`,
            [dealIdsParam]
          );
        } catch (err) {
          console.warn('⚠️  Could not clear application_id on finance_deals:', err.message);
        }

        // ── Step 7: Delete finance_deals ─────────────────────────────────────
        deletedCounts.finance_deals = await safeDelete(
          'finance_deals',
          'id = ANY($1::uuid[])',
          [dealIdsParam]
        );
        // Also catch any remaining by dealer_id (safety net)
        const dealsByDealer = await safeDelete('finance_deals', 'dealer_id = $1');
        deletedCounts.finance_deals = (deletedCounts.finance_deals || 0) + dealsByDealer;
        console.log(`🗑️  Deleted ${deletedCounts.finance_deals} finance_deals`);

        // ── Step 8: Delete credit_applications ───────────────────────────────
        deletedCounts.credit_applications = await safeDelete(
          'credit_applications',
          'id = ANY($1::uuid[])',
          [appIdsParam]
        );
        // Safety net: also delete by dealer_id directly
        const appsByDealer = await safeDelete('credit_applications', 'dealer_id = $1');
        deletedCounts.credit_applications = (deletedCounts.credit_applications || 0) + appsByDealer;
        console.log(`🗑️  Deleted ${deletedCounts.credit_applications} credit_applications`);

        // ── Step 9: Delete finance programs (finance_terms_master, dealer-specific only) ─
        deletedCounts.finance_programs = await safeDelete('finance_terms_master', 'dealer_id = $1');
        console.log(`🗑️  Deleted ${deletedCounts.finance_programs} finance_terms_master rows`);

        // ── Step 10: Delete lenders ───────────────────────────────────────────
        deletedCounts.lenders = await safeDelete('lenders', 'dealer_id = $1');
        console.log(`🗑️  Deleted ${deletedCounts.lenders} lenders`);

        // ── Step 11: Delete finance notification logs ─────────────────────────
        deletedCounts.finance_notifications_log = await safeDelete('finance_notifications_log', 'dealer_id = $1');
        console.log(`🗑️  Deleted ${deletedCounts.finance_notifications_log} finance_notifications_log rows`);

        console.log(`✅ Finance reset complete — apps: ${deletedCounts.credit_applications || 0}, deals: ${deletedCounts.finance_deals || 0}, programs: ${deletedCounts.finance_programs || 0}, lenders: ${deletedCounts.lenders || 0}`);
      }
      
      // VEHICLES - Delete all vehicle inventory and related data (must delete child records first!)
      // Note: Must be AFTER leads since leads reference vehicles
      if (categories.includes('vehicles')) {
        // 1. Delete carfax reports
        const carfaxResult = await query(
          'DELETE FROM carfax_reports WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.carfax_reports = carfaxResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.carfax_reports} carfax reports`);
        
        // 2. Delete chat conversations
        const chatResult = await query(
          'DELETE FROM chat_conversations WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.chat_conversations = chatResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.chat_conversations} chat conversations`);
        
        // 3. Delete application links
        const appLinksResult = await query(
          'DELETE FROM application_links WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.application_links = appLinksResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.application_links} application links`);
        
        // 4. Delete customer leads
        const customerLeadsResult = await query(
          'DELETE FROM customer_leads WHERE vehicle_id IN (SELECT id FROM vehicles WHERE dealer_id = $1)',
          [dealerId]
        );
        deletedCounts.customer_leads = customerLeadsResult.rowCount || 0;
        console.log(`🗑️  Auto-deleted ${deletedCounts.customer_leads} customer leads`);
        
        // Note: leads, finance_deals, credit_applications, rebate_applications 
        // should be handled by their respective category deletions
        
        // 5. Finally, delete the vehicles themselves
        const vehicleResult = await query(
          'DELETE FROM vehicles WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.vehicles = vehicleResult.rowCount;
        console.log(`🗑️  Deleted ${deletedCounts.vehicles} vehicles for dealer ${dealer.business_name}`);
      }
      
      // REBATES - Delete rebate data
      if (categories.includes('rebates')) {
        // Rebate applications
        const rebateAppsResult = await query(
          'DELETE FROM rebate_applications WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.rebate_applications = rebateAppsResult.rowCount || 0;
        
        // Rebates
        const rebatesResult = await query(
          'DELETE FROM rebates WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.rebates = rebatesResult.rowCount || 0;
        
        console.log(`🗑️  Deleted ${deletedCounts.rebates} rebates, ${deletedCounts.rebate_applications} applications`);
      }
      
      // CUSTOMERS - Delete customer accounts
      if (categories.includes('customers')) {
        const customersResult = await query(
          'DELETE FROM customers WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.customers = customersResult.rowCount || 0;
        console.log(`🗑️  Deleted ${deletedCounts.customers} customers`);
      }
      
      // STAFF - Delete dealership staff (DANGEROUS - be careful!)
      if (categories.includes('staff')) {
        // First delete staff permissions
        await query(`
          DELETE FROM staff_permissions 
          WHERE staff_id IN (
            SELECT id FROM dealership_staff WHERE dealer_id = $1
          )
        `, [dealerId]);
        
        const staffResult = await query(
          'DELETE FROM dealership_staff WHERE dealer_id = $1',
          [dealerId]
        );
        deletedCounts.staff = staffResult.rowCount || 0;
        console.log(`🗑️  Deleted ${deletedCounts.staff} staff members`);
      }
      
      // SETTINGS - Reset settings to defaults (handle missing tables gracefully)
      if (categories.includes('settings')) {
        const safeDelete = async (tableName) => {
          try {
            const result = await query(`DELETE FROM ${tableName} WHERE dealer_id = $1`, [dealerId]);
            return result.rowCount || 0;
          } catch (error) {
            if (error.code === '42P01') {
              console.log(`   ⚠️  Table ${tableName} doesn't exist, skipping`);
              return 0;
            }
            throw error;
          }
        };
        
        deletedCounts.daive_settings = await safeDelete('daive_settings');
        deletedCounts.followup_settings = await safeDelete('followup_settings');
        deletedCounts.prompts = await safeDelete('daive_prompts');
        deletedCounts.voice_settings = await safeDelete('voice_settings');
        
        console.log(`🗑️  Reset settings: ${deletedCounts.daive_settings || 0} DAIVE, ${deletedCounts.followup_settings || 0} follow-up, ${deletedCounts.prompts || 0} prompts, ${deletedCounts.voice_settings || 0} voice`);
      }
      
      // DOCUMENTS - Delete generated documents (handle missing tables gracefully)
      if (categories.includes('documents')) {
        const safeDelete = async (tableName) => {
          try {
            const result = await query(`DELETE FROM ${tableName} WHERE dealer_id = $1`, [dealerId]);
            return result.rowCount || 0;
          } catch (error) {
            if (error.code === '42P01') {
              console.log(`   ⚠️  Table ${tableName} doesn't exist, skipping`);
              return 0;
            }
            throw error;
          }
        };
        
        deletedCounts.signatures = await safeDelete('e_signatures');
        deletedCounts.deal_sheets = await safeDelete('generated_deal_sheets');
        deletedCounts.templates = await safeDelete('deal_sheet_templates');
        
        console.log(`🗑️  Deleted documents: ${deletedCounts.deal_sheets || 0} deal sheets, ${deletedCounts.templates || 0} templates, ${deletedCounts.signatures || 0} signatures`);
      }
      
      // NOTIFICATIONS - Delete notifications (handle missing table gracefully)
      if (categories.includes('notifications')) {
        try {
          const notificationsResult = await query('DELETE FROM notifications WHERE dealer_id = $1', [dealerId]);
          deletedCounts.notifications = notificationsResult.rowCount || 0;
          console.log(`🗑️  Deleted ${deletedCounts.notifications} notifications`);
        } catch (error) {
          if (error.code === '42P01') {
            console.log(`   ⚠️  Table notifications doesn't exist, skipping`);
            deletedCounts.notifications = 0;
          } else {
            throw error;
          }
        }
      }
      
      // ANALYTICS - Delete analytics data (handle missing table gracefully)
      if (categories.includes('analytics')) {
        try {
          const analyticsResult = await query('DELETE FROM daive_analytics WHERE dealer_id = $1', [dealerId]);
          deletedCounts.analytics = analyticsResult.rowCount || 0;
          console.log(`🗑️  Deleted ${deletedCounts.analytics} analytics records`);
        } catch (error) {
          if (error.code === '42P01') {
            console.log(`   ⚠️  Table daive_analytics doesn't exist, skipping`);
            deletedCounts.analytics = 0;
          } else {
            throw error;
          }
        }
      }
      
      // Log audit trail - temporarily disabled due to constraint issues
      // TODO: Fix audit_logs table constraints to allow this action type
      console.log('📝 Audit log: Reset dealership data', {
        dealer: dealer.business_name,
        categories: categories,
        deletedCounts: deletedCounts,
        user: req.user?.email
      });
      
      // COMMIT TRANSACTION
      console.log('💾 Committing transaction...');
      await query('COMMIT');
      console.log('✅ Transaction committed successfully');
      
      console.log(`✅ Successfully reset data for dealer: ${dealer.business_name}`);
      console.log(`📊 Summary:`, deletedCounts);
      
      res.json({
        success: true,
        message: `Successfully reset data for ${dealer.business_name}`,
        dealer: dealer,
        deletedCounts: deletedCounts
      });
      
    } catch (error) {
      // ROLLBACK on error
      await query('ROLLBACK');
      console.error('❌ Error during reset, transaction rolled back:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error resetting dealership data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to reset dealership data',
      details: error.message,
      errorType: error.name
    });
  }
});

// =====================================================
// DELETE DEALERSHIP COMPLETELY
// =====================================================

router.delete('/dealers/:dealerId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { dealerId } = req.params;

    // Verify dealer exists
    const dealerResult = await query(
      'SELECT id, business_name FROM dealers WHERE id = $1',
      [dealerId]
    );

    if (dealerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }

    const dealer = dealerResult.rows[0];
    console.log(`🚨 DELETING DEALERSHIP: ${dealer.business_name} (${dealerId})`);

    // Start transaction
    await query('BEGIN');

    try {
      const deletedCounts = {};

      // Order matters due to foreign key constraints!
      
      // 1. Delete analytics
      const analyticsResult = await query('DELETE FROM daive_analytics WHERE dealer_id = $1', [dealerId]);
      deletedCounts.analytics = analyticsResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.analytics} analytics records`);

      // 2. Delete conversations (before leads)
      const conversationsResult = await query('DELETE FROM daive_conversations WHERE dealer_id = $1', [dealerId]);
      deletedCounts.conversations = conversationsResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.conversations} conversations`);

      // 3. Delete lead-related data
      await query('DELETE FROM lead_follow_ups WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM customer_lifecycle_stages WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM followup_enrollments WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM followup_opt_outs WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM customer_leads WHERE dealer_id = $1', [dealerId]);
      
      const leadsResult = await query('DELETE FROM leads WHERE dealer_id = $1', [dealerId]);
      deletedCounts.leads = leadsResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.leads} leads`);

      // 4. Delete finance data
      await query('DELETE FROM finance_deal_products WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM lender_submissions WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM generated_deal_sheets WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM signature_requests WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM finance_deals WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM credit_applications WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM finance_programs WHERE dealer_id = $1', [dealerId]);
      const lendersResult = await query('DELETE FROM lenders WHERE dealer_id = $1', [dealerId]);
      deletedCounts.finance = lendersResult.rowCount || 0;
      console.log(`🗑️  Deleted finance data`);

      // 5. Delete rebates
      await query('DELETE FROM rebate_applications WHERE dealer_id = $1', [dealerId]);
      const rebatesResult = await query('DELETE FROM rebates WHERE dealer_id = $1', [dealerId]);
      deletedCounts.rebates = rebatesResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.rebates} rebates`);

      // 6. Delete vehicles
      await query('DELETE FROM carfax_reports WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM application_links WHERE dealer_id = $1', [dealerId]);
      const vehiclesResult = await query('DELETE FROM vehicles WHERE dealer_id = $1', [dealerId]);
      deletedCounts.vehicles = vehiclesResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.vehicles} vehicles`);

      // 7. Delete customers
      const customersResult = await query('DELETE FROM customers WHERE dealer_id = $1', [dealerId]);
      deletedCounts.customers = customersResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.customers} customers`);

      // 8. Delete settings
      await query('DELETE FROM daive_settings WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM followup_settings WHERE dealer_id = $1', [dealerId]);
      await query('DELETE FROM daive_prompts WHERE dealer_id = $1', [dealerId]);
      console.log(`🗑️  Deleted settings`);

      // 9. Delete notifications
      const notificationsResult = await query('DELETE FROM notifications WHERE dealer_id = $1', [dealerId]);
      deletedCounts.notifications = notificationsResult.rowCount || 0;
      console.log(`🗑️  Deleted ${deletedCounts.notifications} notifications`);

      // 10. Delete staff AND their user accounts
      console.log(`🚨 Deleting staff members and their user accounts...`);
      
      // Get all staff user IDs first
      const staffUsersResult = await query(`
        SELECT ds.id as staff_id, ds.user_id, u.email
        FROM dealership_staff ds
        JOIN users u ON ds.user_id = u.id
        WHERE ds.dealer_id = $1
      `, [dealerId]);

      console.log(`   Found ${staffUsersResult.rows.length} staff members to delete`);

      for (const staff of staffUsersResult.rows) {
        // Delete staff permissions
        await query('DELETE FROM staff_permissions WHERE staff_id = $1', [staff.staff_id]);
        
        // Delete dealership_staff record
        await query('DELETE FROM dealership_staff WHERE id = $1', [staff.staff_id]);
        
        // Delete user_roles
        await query('DELETE FROM user_roles WHERE user_id = $1', [staff.user_id]);
        
        // Delete user account
        await query('DELETE FROM users WHERE id = $1', [staff.user_id]);
        
        console.log(`   ✅ Deleted staff and user: ${staff.email}`);
      }

      deletedCounts.staff = staffUsersResult.rows.length;

      // 11. Delete dealer's own user account (if exists)
      const dealerOwnerResult = await query(`
        SELECT user_id FROM dealers WHERE id = $1 AND user_id IS NOT NULL
      `, [dealerId]);

      if (dealerOwnerResult.rows.length > 0 && dealerOwnerResult.rows[0].user_id) {
        const ownerId = dealerOwnerResult.rows[0].user_id;
        
        // Delete user_roles
        await query('DELETE FROM user_roles WHERE user_id = $1', [ownerId]);
        
        // Delete user account
        const ownerEmailResult = await query('SELECT email FROM users WHERE id = $1', [ownerId]);
        await query('DELETE FROM users WHERE id = $1', [ownerId]);
        
        console.log(`   ✅ Deleted dealer owner user: ${ownerEmailResult.rows[0]?.email}`);
      }

      // 12. Finally, delete the dealer record itself
      await query('DELETE FROM dealers WHERE id = $1', [dealerId]);
      console.log(`🗑️  Deleted dealer record: ${dealer.business_name}`);

      await query('COMMIT');
      console.log(`✅ DEALERSHIP COMPLETELY DELETED: ${dealer.business_name}`);

      res.json({
        success: true,
        message: `Dealership "${dealer.business_name}" and all associated data have been completely deleted`,
        dealer: dealer,
        deletedCounts: deletedCounts
      });

    } catch (error) {
      await query('ROLLBACK');
      console.error('❌ Error during dealership deletion, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error deleting dealership:', error);
    res.status(500).json({
      error: 'Failed to delete dealership',
      details: error.message
    });
  }
});

// ─── CONVERSATION MONITOR (SuperAdmin only) ──────────────────────────────────

// GET /api/super-admin/conv-monitor/conversations
// Returns paginated conversations across ALL dealers (or filtered by dealer_id)
router.get(
  '/conv-monitor/conversations',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { dealer_id, page = 1, limit = 30, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let conditions = [];
      const params   = [];

      if (dealer_id) {
        params.push(dealer_id);
        conditions.push(`dc.dealer_id = $${params.length}`);
      }
      if (status === 'handoff') conditions.push('dc.handoff_requested = true');

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const dataResult = await pool.query(`
        SELECT
          dc.id,
          dc.session_id,
          dc.dealer_id,
          d.business_name                                    AS dealer_name,
          dc.customer_name,
          dc.customer_email,
          dc.handoff_requested,
          dc.handoff_accepted_at,
          dc.lead_status,
          dc.created_at,
          dc.updated_at,
          (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = dc.id) AS message_count
        FROM daive_conversations dc
        LEFT JOIN dealers d ON dc.dealer_id = d.id
        ${where}
        ORDER BY dc.updated_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, parseInt(limit), offset]);

      const countResult = await pool.query(
        `SELECT COUNT(*) AS total FROM daive_conversations dc ${where}`,
        params
      );

      res.json({
        success:     true,
        data:        dataResult.rows,
        total:       parseInt(countResult.rows[0].total),
        page:        parseInt(page),
        limit:       parseInt(limit),
        totalPages:  Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit)),
      });
    } catch (err) {
      console.error('❌ [conv-monitor] list error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/super-admin/conv-monitor/conversations/:sessionId/messages
// Returns full message thread + saved Daivesteps context for a session
router.get(
  '/conv-monitor/conversations/:sessionId/messages',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      const convResult = await pool.query(
        'SELECT * FROM daive_conversations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
        [sessionId]
      );
      if (convResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }
      const conversation = convResult.rows[0];

      const msgResult = await pool.query(
        `SELECT role, content, created_at AS timestamp
         FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversation.id]
      );

      let savedContext = null;
      try {
        if (daiveService.conversationContextService) {
          savedContext = await daiveService.conversationContextService.getConversationContext(sessionId);
        }
      } catch (_) { /* context optional */ }

      res.json({
        success:      true,
        conversation,
        messages:     msgResult.rows,
        context:      savedContext,
      });
    } catch (err) {
      console.error('❌ [conv-monitor] messages error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/super-admin/conv-monitor/conversations/:sessionId/analyze
// Runs the daivecrewai gap analysis on the full conversation thread
router.post(
  '/conv-monitor/conversations/:sessionId/analyze',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Load conversation row
      const convResult = await pool.query(
        'SELECT * FROM daive_conversations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
        [sessionId]
      );
      if (convResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }
      const conversation = convResult.rows[0];

      // Load messages
      const msgResult = await pool.query(
        `SELECT role, content, created_at AS timestamp
         FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversation.id]
      );

      // Load context
      let savedContext = null;
      try {
        if (daiveService.conversationContextService) {
          savedContext = await daiveService.conversationContextService.getConversationContext(sessionId);
        }
      } catch (_) { /* context optional */ }

      // Run gap analysis
      const analysis = await daiveService.analyzeConversationGaps(msgResult.rows, savedContext || {});

      res.json({
        success:      true,
        sessionId,
        dealerName:   conversation.dealer_name || null,
        messageCount: msgResult.rows.length,
        analysis,
      });
    } catch (err) {
      console.error('❌ [conv-monitor] analyze error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── END CONVERSATION MONITOR ─────────────────────────────────────────────────

// ─── DEALER APPROVAL MANAGEMENT ───────────────────────────────────────────────

// Get all pending dealers
router.get('/dealers/pending', 
  authenticateToken, 
  requireSuperAdmin, 
  async (req, res) => {
    try {
      const result = await query(
        `SELECT 
          d.id, 
          d.user_id, 
          d.business_name, 
          d.contact_name, 
          d.email, 
          d.phone, 
          d.city, 
          d.state,
          d.subscription_status,
          d.created_at,
          u.email as user_email
        FROM dealers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.subscription_status = 'pending_approval'
        ORDER BY d.created_at DESC`
      );

      res.json({
        success: true,
        dealers: result.rows
      });
    } catch (error) {
      console.error('Error fetching pending dealers:', error);
      res.status(500).json({ error: 'Failed to fetch pending dealers' });
    }
  }
);

// Approve a dealer
router.post('/dealers/:dealerId/approve',
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { dealerId } = req.params;

      // Get dealer info
      const dealerResult = await query(
        `SELECT d.*, u.email as user_email 
         FROM dealers d 
         INNER JOIN users u ON d.user_id = u.id
         WHERE d.id = $1`,
        [dealerId]
      );

      if (dealerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Dealer not found' });
      }

      const dealer = dealerResult.rows[0];

      if (dealer.subscription_status === 'active') {
        return res.status(400).json({ error: 'Dealer is already approved' });
      }

      // Update dealer status to active
      await query(
        `UPDATE dealers 
         SET subscription_status = 'active', 
             updated_at = NOW() 
         WHERE id = $1`,
        [dealerId]
      );

      // Send approval email
      try {
        const daiveEmailService = await import('../lib/daiveEmailService.js');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        
        const subject = '✅ Your DealerIQ Account Has Been Approved!';
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Approved</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
              .header h1 { margin: 0; font-size: 24px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; font-weight: bold; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Account Approved!</h1>
                <p>Welcome to DealerIQ</p>
              </div>
              
              <p>Hi ${dealer.contact_name},</p>
              
              <p>Great news! Your DealerIQ account for <strong>${dealer.business_name}</strong> has been approved by our admin team.</p>
              
              <p>You can now log in and start using all the features:</p>
              <ul>
                <li>AI-powered vehicle information assistant (D.A.I.V.E.)</li>
                <li>QR code generation for vehicles</li>
                <li>Customer engagement tracking</li>
                <li>Lead management</li>
                <li>And much more!</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${frontendUrl}" class="button">Log In to DealerIQ</a>
              </div>
              
              <p>If you have any questions or need assistance getting started, please don't hesitate to reach out to our support team.</p>
              
              <div class="footer">
                <p>This email was sent by DealerIQ.</p>
                <p>Need help? Contact us at ${process.env.SMTP_USER || 'support@dealeriq.co'}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await daiveEmailService.default.transporter.sendMail({
          from: `DealerIQ <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: dealer.user_email,
          subject: subject,
          html: htmlContent
        });

        console.log(`✅ Approval email sent to ${dealer.user_email}`);
      } catch (emailError) {
        console.error('❌ Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }

      res.json({
        success: true,
        message: 'Dealer approved successfully',
        dealer: {
          id: dealer.id,
          business_name: dealer.business_name,
          email: dealer.user_email
        }
      });
    } catch (error) {
      console.error('Error approving dealer:', error);
      res.status(500).json({ error: 'Failed to approve dealer' });
    }
  }
);

// Reject a dealer
router.post('/dealers/:dealerId/reject',
  authenticateToken,
  requireSuperAdmin,
  [
    body('reason').optional().isString()
  ],
  async (req, res) => {
    try {
      const { dealerId } = req.params;
      const { reason } = req.body;

      // Get dealer info
      const dealerResult = await query(
        `SELECT d.*, u.email as user_email 
         FROM dealers d 
         INNER JOIN users u ON d.user_id = u.id
         WHERE d.id = $1`,
        [dealerId]
      );

      if (dealerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Dealer not found' });
      }

      const dealer = dealerResult.rows[0];

      // Update dealer status to rejected
      await query(
        `UPDATE dealers 
         SET subscription_status = 'rejected', 
             updated_at = NOW() 
         WHERE id = $1`,
        [dealerId]
      );

      // Send rejection email
      try {
        const daiveEmailService = await import('../lib/daiveEmailService.js');
        
        const subject = 'DealerIQ Account Application Update';
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Application Update</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
              .header h1 { margin: 0; font-size: 24px; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Account Application Update</h1>
              </div>
              
              <p>Hi ${dealer.contact_name},</p>
              
              <p>Thank you for your interest in DealerIQ for <strong>${dealer.business_name}</strong>.</p>
              
              <p>After reviewing your application, we are unable to approve your account at this time.</p>
              
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              
              <p>If you have any questions or would like to discuss this decision, please contact our support team.</p>
              
              <div class="footer">
                <p>This email was sent by DealerIQ.</p>
                <p>Need help? Contact us at ${process.env.SMTP_USER || 'support@dealeriq.co'}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await daiveEmailService.default.transporter.sendMail({
          from: `DealerIQ <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
          to: dealer.user_email,
          subject: subject,
          html: htmlContent
        });

        console.log(`📧 Rejection email sent to ${dealer.user_email}`);
      } catch (emailError) {
        console.error('❌ Failed to send rejection email:', emailError);
        // Don't fail the rejection if email fails
      }

      res.json({
        success: true,
        message: 'Dealer rejected',
        dealer: {
          id: dealer.id,
          business_name: dealer.business_name,
          email: dealer.user_email
        }
      });
    } catch (error) {
      console.error('Error rejecting dealer:', error);
      res.status(500).json({ error: 'Failed to reject dealer' });
    }
  }
);

// ─── END DEALER APPROVAL MANAGEMENT ───────────────────────────────────────────

export default router;
