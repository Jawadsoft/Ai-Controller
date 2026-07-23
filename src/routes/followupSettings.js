import express from 'express';
import { query } from '../database/connection.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import followupAutomation from '../lib/followupAutomation.js';

const router = express.Router();

// Require followup_settings_management permission for all routes (after authentication)
router.use(requirePermission('followup_settings_management'));

// =====================================================
// IMPORTANT: Specific routes MUST come before parameterized routes!
// Express matches routes in order, so /status must be before /:dealerId
// =====================================================

// =====================================================
// GET SYSTEM STATUS
// =====================================================

router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Get active enrollments count
    const activeEnrollments = await query(`
      SELECT COUNT(*) as count FROM followup_enrollments 
      WHERE status = 'active'
    `);

    // Get messages sent today
    const messagesToday = await query(`
      SELECT COUNT(*) as count FROM followup_execution_log
      WHERE DATE(sent_at) = CURRENT_DATE AND status = 'sent'
    `);

    // Get pending messages (next hour)
    const pending = await query(`
      SELECT COUNT(*) as count FROM followup_enrollments
      WHERE status = 'active' AND next_run_at <= NOW() + INTERVAL '1 hour'
    `);

    // Get scheduler status
    const schedulerStatus = followupAutomation.getStatus();

    res.json({
      success: true,
      status: {
        active_enrollments: parseInt(activeEnrollments.rows[0]?.count || 0),
        messages_sent_today: parseInt(messagesToday.rows[0]?.count || 0),
        pending_messages: parseInt(pending.rows[0]?.count || 0),
        scheduler_running: schedulerStatus.isRunning,
        last_check: schedulerStatus.lastCheck
      }
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

router.get('/health', async (req, res) => {
  try {
    const status = followupAutomation.getStatus();
    
    res.json({
      success: true,
      health: {
        scheduler_running: status.isRunning,
        last_check: status.lastCheck,
        check_interval: status.checkInterval,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

// =====================================================
// TEST EMAIL
// =====================================================

router.post('/test/email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    // Validate environment variables (use existing SMTP config)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({ 
        error: 'Email not configured',
        details: 'Please add SMTP_HOST, SMTP_USER, SMTP_PASS to your .env file'
      });
    }

    // Create transporter using existing config
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Send test email
    await transporter.sendMail({
      from: `"DAIVE Follow-Up System" <${process.env.SMTP_USER || 'info@mitiesoft.com'}>`,
      to: email,
      subject: '✅ Test Email - DAIVE Follow-Up System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">✅ Test Successful!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; line-height: 1.6;">
              This is a test email from your <strong>DAIVE Follow-Up Automation System</strong>.
            </p>
            
            <div style="background: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
              <p style="margin: 0;"><strong>Configuration Details:</strong></p>
              <ul style="margin: 10px 0;">
                <li>SMTP Host: ${process.env.SMTP_HOST}</li>
                <li>From Email: ${process.env.SMTP_USER || 'info@mitiesoft.com'}</li>
                <li>Status: ✅ Working</li>
              </ul>
            </div>

            <p style="color: #10b981; font-weight: bold; font-size: 18px;">
              🎉 Your email configuration is set up correctly!
            </p>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              You can now use this email address to send automated follow-ups to your customers.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p>DAIVE Follow-Up Automation System</p>
          </div>
        </div>
      `,
      text: `
✅ Test Email Successful!

This is a test email from your DAIVE Follow-Up Automation System.

Configuration Details:
- SMTP Host: ${process.env.SMTP_HOST}
- From Email: ${process.env.SMTP_USER || 'info@mitiesoft.com'}
- Status: ✅ Working

Your email configuration is set up correctly!
You can now use this email to send automated follow-ups to your customers.
      `
    });

    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      details: {
        from: process.env.SMTP_USER || 'info@mitiesoft.com',
        to: email,
        smtp_host: process.env.SMTP_HOST
      }
    });

  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// =====================================================
// TEST SMS
// =====================================================

router.post('/test/sms', authenticateToken, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Validate environment variables (use existing or FOLLOWUP_ prefixed)
    const accountSid = process.env.FOLLOWUP_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.FOLLOWUP_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.FOLLOWUP_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ 
        error: 'SMS not configured',
        details: 'Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to your .env file'
      });
    }

    // Create Twilio client
    const client = twilio(accountSid, authToken);

    // Send test SMS
    const message = await client.messages.create({
      to: phone,
      from: fromNumber,
      body: '✅ Test SMS from DAIVE Follow-Up System - Your SMS configuration is working correctly! Reply STOP to unsubscribe.'
    });

    res.json({ 
      success: true, 
      message: 'Test SMS sent successfully',
      details: {
        from: fromNumber,
        to: phone,
        message_sid: message.sid
      }
    });

  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ 
      error: 'Failed to send test SMS',
      details: error.message
    });
  }
});

// =====================================================
// GET SETTINGS (Parameterized route - MUST come after specific routes)
// =====================================================

router.get('/:dealerId', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.params;

    // Get dealer-specific settings or fallback to defaults
    const result = await query(`
      SELECT * FROM followup_system_settings
      WHERE dealer_id = $1 OR (dealer_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM followup_system_settings WHERE dealer_id = $1
      ))
      ORDER BY dealer_id DESC NULLS LAST
      LIMIT 1
    `, [dealerId]);

    const settings = result.rows[0] || {
      system_enabled: false,
      email_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: false,
      messenger_enabled: false,
      push_notification_enabled: false,
      auto_enrollment_enabled: true,
      auto_enrollment_categories: ['lead_nurture'],
      respect_quiet_hours: true,
      quiet_hours_start: '21:00',
      quiet_hours_end: '08:00',
      timezone: 'America/New_York',
      max_messages_per_day: 5,
      min_delay_between_messages_hours: 4,
      min_engagement_score: 30,
      pause_on_low_engagement: true,
      email_use_env: true,
      sms_use_env: true
    };

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching follow-up settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// =====================================================
// UPDATE SETTINGS (Parameterized route)
// =====================================================

router.put('/:dealerId', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.params;
    const settings = req.body;
    const userId = req.user.id;

    // Upsert settings
    await query(`
      INSERT INTO followup_system_settings (
        dealer_id, system_enabled, email_enabled, sms_enabled,
        whatsapp_enabled, messenger_enabled, push_notification_enabled,
        auto_enrollment_enabled, auto_enrollment_categories,
        respect_quiet_hours, quiet_hours_start, quiet_hours_end, timezone,
        max_messages_per_day, min_delay_between_messages_hours,
        min_engagement_score, pause_on_low_engagement,
        email_use_env, sms_use_env, last_modified_by, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
      )
      ON CONFLICT (dealer_id) DO UPDATE SET
        system_enabled = $2,
        email_enabled = $3,
        sms_enabled = $4,
        whatsapp_enabled = $5,
        messenger_enabled = $6,
        push_notification_enabled = $7,
        auto_enrollment_enabled = $8,
        auto_enrollment_categories = $9,
        respect_quiet_hours = $10,
        quiet_hours_start = $11,
        quiet_hours_end = $12,
        timezone = $13,
        max_messages_per_day = $14,
        min_delay_between_messages_hours = $15,
        min_engagement_score = $16,
        pause_on_low_engagement = $17,
        email_use_env = $18,
        sms_use_env = $19,
        last_modified_by = $20,
        updated_at = NOW()
    `, [
      dealerId,
      settings.system_enabled,
      settings.email_enabled,
      settings.sms_enabled,
      settings.whatsapp_enabled || false,
      settings.messenger_enabled || false,
      settings.push_notification_enabled || false,
      settings.auto_enrollment_enabled,
      JSON.stringify(settings.auto_enrollment_categories),
      settings.respect_quiet_hours,
      settings.quiet_hours_start,
      settings.quiet_hours_end,
      settings.timezone,
      settings.max_messages_per_day,
      settings.min_delay_between_messages_hours,
      settings.min_engagement_score,
      settings.pause_on_low_engagement,
      settings.email_use_env !== false, // default true
      settings.sms_use_env !== false, // default true
      userId
    ]);

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating follow-up settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
