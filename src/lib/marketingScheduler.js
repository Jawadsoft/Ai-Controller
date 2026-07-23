// Marketing Journey Background Scheduler
// Automatically processes enrollments based on next_run_at timestamps
import { query } from '../database/connection.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

class MarketingScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 120000; // Check every 2 minutes
    this.batchSize = 5; // Process up to 5 enrollments per batch
    this.maxRetries = 3;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('📅 Marketing scheduler is already running');
      return;
    }

    console.log('🚀 Starting marketing journey scheduler...');
    this.isRunning = true;
    
    // Run immediately on start
    this.processEnrollments();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.processEnrollments();
    }, this.checkInterval);

    console.log(`✅ Marketing scheduler started (checking every ${this.checkInterval / 1000}s)`);
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('📅 Marketing scheduler is not running');
      return;
    }

    console.log('🛑 Stopping marketing journey scheduler...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Marketing scheduler stopped');
  }

  // Main processing function
  async processEnrollments() {
    try {
      console.log('🔄 Checking for marketing enrollments to process...');
      
      // Get enrollments that are ready to run
      const enrollments = await this.getReadyEnrollments();
      
      if (enrollments.length === 0) {
        console.log('📭 No enrollments ready for processing');
        return;
      }

      console.log(`📧 Found ${enrollments.length} enrollments ready for processing`);
      
      // Process enrollments in batches
      for (let i = 0; i < enrollments.length; i += this.batchSize) {
        const batch = enrollments.slice(i, i + this.batchSize);
        await this.processBatch(batch);
        
        // Small delay between batches to avoid overwhelming the system
        if (i + this.batchSize < enrollments.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

    } catch (error) {
      console.error('❌ Error processing marketing enrollments:', error);
    }
  }

  // Get enrollments that are ready to run
  async getReadyEnrollments() {
    const result = await query(`
      SELECT 
        e.id,
        e.lead_id,
        e.journey_id,
        e.current_step_order,
        e.next_run_at,
        e.status,
        l.full_name,
        l.email,
        l.phone,
        j.name as journey_name,
        s.step_order,
        s.channel as step_channel,
        s.template_subject as step_subject,
        s.template_body as step_body,
        s.delay_minutes
      FROM marketing_enrollments e
      JOIN software_leads l ON e.lead_id = l.id
      JOIN marketing_journeys j ON e.journey_id = j.id
      LEFT JOIN marketing_journey_steps s 
        ON s.journey_id = e.journey_id AND s.step_order = e.current_step_order + 1
      WHERE e.status = 'active'
        AND e.next_run_at IS NOT NULL
        AND e.next_run_at <= NOW()
        AND j.is_active = TRUE
      ORDER BY e.next_run_at ASC
      LIMIT $1
    `, [this.batchSize]);

    return result.rows;
  }

  // Process a batch of enrollments
  async processBatch(enrollments) {
    console.log(`🔄 Processing batch of ${enrollments.length} enrollments...`);
    
    for (const enrollment of enrollments) {
      try {
        await this.processEnrollment(enrollment);
      } catch (error) {
        console.error(`❌ Error processing enrollment ${enrollment.id}:`, error);
        
        // Record the error
        await this.recordError(enrollment.id, error.message);
      }
    }
  }

  // Process a single enrollment
  async processEnrollment(enrollment) {
    console.log(`📧 Processing enrollment ${enrollment.id} for ${enrollment.full_name} (${enrollment.email})`);
    
    // If we don't have a step selected (no step joined), initialize to first step
    if (!enrollment.step_order) {
      console.log(`⚠️ No step selected for enrollment ${enrollment.id}, preparing first step`);
      await this.setFirstStep(enrollment);
      return;
    }

    // Send the current step
    const sendResult = await this.sendStep(enrollment);
    
    if (sendResult.success) {
      // Move to next step
      await this.moveToNextStep(enrollment);
      console.log(`✅ Successfully processed step for ${enrollment.full_name}`);
    } else {
      // Don't throw error - just log and continue with other enrollments
      console.error(`❌ Failed to send step for ${enrollment.full_name}: ${sendResult.error}`);
      
      // Record error but don't stop processing other enrollments
      await this.recordError(enrollment.id, sendResult.error);
      
      // Skip this enrollment for now, will retry later
      console.log(`⏭️ Skipping enrollment ${enrollment.id}, will retry later`);
    }
  }

  // Set the first step for an enrollment
  async setFirstStep(enrollment) {
    const result = await query(`
      SELECT step_order, channel as step_channel, template_subject as step_subject, template_body as step_body, delay_minutes
      FROM marketing_journey_steps
      WHERE journey_id = $1 AND is_active = TRUE
      ORDER BY step_order ASC
      LIMIT 1
    `, [enrollment.journey_id]);

    if (result.rows.length === 0) {
      console.log(`⚠️ No steps found for journey ${enrollment.journey_id}`);
      await this.completeEnrollment(enrollment.id);
      return;
    }

    const firstStep = result.rows[0];
    
    // Set enrollment to before first step (order 0) so next run processes step 1
    await query(`
      UPDATE marketing_enrollments
      SET current_step_order = 0,
          next_run_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [enrollment.id]);

    console.log(`✅ Set first step for enrollment ${enrollment.id}`);
  }

  // Send a step (email or SMS)
  async sendStep(enrollment) {
    try {
      if (enrollment.step_channel === 'email') {
        return await this.sendEmail(enrollment);
      } else if (enrollment.step_channel === 'sms') {
        return await this.sendSMS(enrollment);
      } else {
        throw new Error(`Unknown step type: ${enrollment.step_channel}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send email step
  async sendEmail(enrollment) {
    try {
      // Check if email sending is disabled (development mode)
      if (process.env.DISABLE_EMAIL_SENDING === 'true' || process.env.NODE_ENV === 'development' && !process.env.ENABLE_EMAIL_IN_DEV) {
        console.log(`⚠️ Email sending is disabled. Skipping email to ${enrollment.email}`);
        console.log(`   Set ENABLE_EMAIL_IN_DEV=true in .env to enable emails in development`);
        
        // Return success but don't actually send
        return { success: true, messageId: 'skipped-dev-mode' };
      }

      // Get SMTP settings
      const smtpSettings = await this.getSmtpSettings();
      
      if (!smtpSettings) {
        console.warn('⚠️ SMTP settings not configured. Email sending disabled.');
        console.warn('   Configure SMTP settings in integration_settings table or disable email sending.');
        return { success: false, error: 'SMTP settings not configured' };
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpSettings.host,
        port: Number(smtpSettings.port),
        secure: smtpSettings.secure === 'true',
        auth: {
          user: smtpSettings.user,
          pass: smtpSettings.pass
        }
      });

      // Prepare email content
      const subject = this.processTemplateSimple(enrollment.step_subject, enrollment);
      const body = this.processTemplate(enrollment.step_body, enrollment);

      // Create enhanced plain text version with proper spacing
      const plainTextBody = body
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<div[^>]*>/g, '')
        .replace(/<\/div>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n') // Clean up multiple line breaks
        .trim();

      // Create enhanced HTML version with better formatting
      const enhancedHtmlBody = body
        .replace(/<br\s*\/?>/g, '<br>')
        .replace(/\n/g, '<br>') // Ensure all line breaks are HTML
        .replace(/<br><br>/g, '<br><br>'); // Ensure proper spacing

      // Debug: Log what we're sending
      console.log('📧 Sending email:');
      console.log('To:', enrollment.email);
      console.log('Subject:', subject);
      console.log('HTML Body:', enhancedHtmlBody);
      console.log('Plain Text Body:', plainTextBody);
      console.log('---');

      // Send email with enhanced formatting
      const info = await transporter.sendMail({
        from: smtpSettings.from,
        to: enrollment.email,
        subject: subject,
        html: enhancedHtmlBody,
        text: plainTextBody,
        // Add headers to ensure proper rendering
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'X-Mailer': 'Marketing Scheduler'
        }
      });

      // Record the send
      await this.recordSend(enrollment.id, enrollment.step_order, 'email', enrollment.email, null, 'sent', info.messageId);

      return { success: true, messageId: info.messageId };

    } catch (error) {
      // Log error but don't throw - return error result instead
      console.error(`❌ Email send failed for ${enrollment.email}:`, error.message);
      
      // Record failed send
      await this.recordSend(enrollment.id, enrollment.step_order, 'email', enrollment.email, null, 'failed', null, error.message);
      
      // Return error result instead of throwing
      return { success: false, error: error.message };
    }
  }

  // Send SMS step
  async sendSMS(enrollment) {
    try {
      // Get Twilio settings
      const twilioSettings = await this.getTwilioSettings();
      
      if (!twilioSettings) {
        throw new Error('Twilio settings not configured');
      }

      const accountSid = twilioSettings.account_sid || twilioSettings.accountSid;
      const authToken = twilioSettings.auth_token || twilioSettings.authToken;
      const messagingServiceSid = twilioSettings.messaging_service_sid || twilioSettings.messagingServiceSid;
      const fromNumber = twilioSettings.from_number || twilioSettings.fromNumber;

      if (!accountSid || !authToken) {
        throw new Error('Twilio Account SID/Auth Token missing');
      }
      if (!messagingServiceSid && !fromNumber) {
        throw new Error('Twilio Messaging Service SID or From Number required');
      }

      const client = twilio(accountSid, authToken);

      // Prepare SMS content
      const body = this.processTemplate(enrollment.step_body, enrollment);

      const message = await client.messages.create({
        to: enrollment.phone,
        body,
        ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber })
      });

      // Record the send
      await this.recordSend(
        enrollment.id,
        enrollment.step_order,
        'sms',
        null,
        enrollment.phone,
        'sent',
        message.sid
      );

      return { success: true, messageId: message.sid };

    } catch (error) {
      // Record failed send
      await this.recordSend(enrollment.id, enrollment.step_order, 'sms', null, enrollment.phone, 'failed', null, error.message);
      throw error;
    }
  }

  // Move to next step
  async moveToNextStep(enrollment) {
    // Get next step
    const result = await query(`
      SELECT step_order, delay_minutes
      FROM marketing_journey_steps
      WHERE journey_id = $1 AND is_active = TRUE AND step_order > $2
      ORDER BY step_order ASC
      LIMIT 1
    `, [enrollment.journey_id, enrollment.step_order]);

    if (result.rows.length === 0) {
      // No more steps, complete the journey
      await this.completeEnrollment(enrollment.id);
      return;
    }

    const nextStep = result.rows[0];
    const nextRunAt = new Date(Date.now() + (nextStep.delay_minutes * 60 * 1000));

    // Update enrollment to the current step order and schedule next
    await query(`
      UPDATE marketing_enrollments
      SET current_step_order = $1,
          next_run_at = $2,
          last_sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [nextStep.step_order - 1, nextRunAt, enrollment.id]);

    console.log(`✅ Moved to next step (${nextStep.step_order}) for enrollment ${enrollment.id}, next run: ${nextRunAt.toISOString()}`);
  }

  // Complete an enrollment
  async completeEnrollment(enrollmentId) {
    await query(`
      UPDATE marketing_enrollments
      SET status = 'completed',
          next_run_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [enrollmentId]);

    console.log(`✅ Completed enrollment ${enrollmentId}`);
  }

  // Record a send in the database
  async recordSend(enrollmentId, stepOrder, channel, toAddress, toPhone, status, messageId = null, error = null) {
    // Find step id based on journey and step order
    const stepResult = await query(`
      SELECT id FROM marketing_journey_steps
      WHERE journey_id = (SELECT journey_id FROM marketing_enrollments WHERE id = $1)
        AND step_order = $2
      LIMIT 1
    `, [enrollmentId, stepOrder]);
    const stepId = stepResult.rows[0]?.id || null;

    await query(`
      INSERT INTO marketing_sends (enrollment_id, step_id, channel, to_address, to_phone, status, provider_message_id, error, sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [enrollmentId, stepId, channel, toAddress, toPhone, status, messageId, error]);
  }

  // Record an error
  async recordError(enrollmentId, errorMessage) {
    await query(`
      UPDATE marketing_enrollments
      SET updated_at = NOW()
      WHERE id = $1
    `, [enrollmentId]);
    
    // Could also log to an error table if needed
    console.error(`❌ Error recorded for enrollment ${enrollmentId}: ${errorMessage}`);
  }

  // Process template variables (simple version for subjects)
  processTemplateSimple(template, enrollment) {
    if (!template) return '';
    
    return template
      .replace(/\{\{name\}\}/g, enrollment.full_name || enrollment.name || '')
      .replace(/\{\{full_name\}\}/g, enrollment.full_name || '')
      .replace(/\{\{email\}\}/g, enrollment.email || '')
      .replace(/\{\{phone\}\}/g, enrollment.phone || '')
      .replace(/\{\{company\}\}/g, enrollment.company || '')
      .replace(/\{\{journey_name\}\}/g, enrollment.journey_name || '');
  }

  // Process template variables (enhanced version for body)
  processTemplate(template, enrollment) {
    if (!template) return '';
    
    // Process template variables
    let processed = template
      .replace(/\{\{name\}\}/g, enrollment.full_name || enrollment.name || '')
      .replace(/\{\{full_name\}\}/g, enrollment.full_name || '')
      .replace(/\{\{email\}\}/g, enrollment.email || '')
      .replace(/\{\{phone\}\}/g, enrollment.phone || '')
      .replace(/\{\{company\}\}/g, enrollment.company || '')
      .replace(/\{\{journey_name\}\}/g, enrollment.journey_name || '');
    
    // Ensure proper line breaks - normalize all types to \n first
    processed = processed
      .replace(/\r\n/g, '\n')  // Windows to Unix
      .replace(/\r/g, '\n')     // Mac to Unix
      .replace(/\n{3,}/g, '\n\n'); // Clean up multiple line breaks
    
    // Convert line breaks to HTML
    processed = processed.replace(/\n/g, '<br>');
    
    // Add enhanced HTML styling for better email client compatibility
    if (!processed.includes('<html>') && !processed.includes('<div>') && !processed.includes('<p>')) {
      processed = `
        <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto;">
          ${processed}
        </div>
      `;
    }
    
    return processed;
  }

  // Get SMTP settings
  async getSmtpSettings() {
    // First try to get from database
    try {
      const result = await query(`
        SELECT key, secret FROM integration_settings
        WHERE tenant_id IS NULL AND provider = 'smtp' AND is_active = TRUE
        LIMIT 1
      `);

      const settings = {};
      for (const row of result.rows) {
        settings[row.key] = row.secret;
      }

      if (Object.keys(settings).length > 0) {
        // Ensure required fields exist
        if (settings.host && settings.user && settings.pass) {
          return settings;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error fetching SMTP settings from database:', error.message);
    }

    // Fallback to environment variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('📧 Using SMTP settings from environment variables');
      return {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || '587',
        secure: process.env.SMTP_SECURE === 'true' ? 'true' : 'false',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'info@mitiesoft.com'
      };
    }

    // No SMTP settings found
    return null;
  }

  // Get Twilio settings
  async getTwilioSettings() {
    const result = await query(`
      SELECT key, secret FROM integration_settings
      WHERE tenant_id IS NULL AND provider = 'twilio' AND is_active = TRUE
    `);

    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.secret;
    }

    return Object.keys(settings).length > 0 ? settings : null;
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      batchSize: this.batchSize,
      lastCheck: new Date().toISOString()
    };
  }
}

// Create singleton instance
const marketingScheduler = new MarketingScheduler();

export default marketingScheduler;
