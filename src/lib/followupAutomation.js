// =====================================================
// DAIVE FOLLOW-UP AUTOMATION SERVICE
// Core engine for automated customer follow-ups
// =====================================================

import { query } from '../database/connection.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

class FollowUpAutomationService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = parseInt(process.env.FOLLOWUP_CHECK_INTERVAL) || 60000; // 1 minute
    this.batchSize = parseInt(process.env.FOLLOWUP_BATCH_SIZE) || 10;
    this.maxRetries = parseInt(process.env.FOLLOWUP_MAX_RETRIES) || 3;
  }

  // =====================================================
  // SCHEDULER CONTROL
  // =====================================================

  start() {
    if (this.isRunning) {
      console.log('📅 Follow-up automation already running');
      return;
    }

    console.log('🚀 Starting DAIVE Follow-Up Automation...');
    console.log(`   Check interval: ${this.checkInterval / 1000}s`);
    console.log(`   Batch size: ${this.batchSize}`);
    this.isRunning = true;
    
    // Run immediately on start
    this.processFollowUps();
    
    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processFollowUps();
    }, this.checkInterval);

    // Store global state
    global.followupSchedulerRunning = true;

    console.log('✅ Follow-up automation started successfully');
  }

  stop() {
    if (!this.isRunning) {
      console.log('📅 Follow-up automation not running');
      return;
    }

    console.log('🛑 Stopping follow-up automation...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    global.followupSchedulerRunning = false;

    console.log('✅ Follow-up automation stopped');
  }

  // =====================================================
  // MAIN PROCESSING LOOP
  // =====================================================

  async processFollowUps() {
    try {
      global.lastFollowupCheck = new Date().toISOString();

      // 1. Check if system is enabled globally
      const systemEnabled = await this.isSystemEnabled();
      if (!systemEnabled) {
        console.log('⏸️  Follow-up system is disabled globally');
        return;
      }

      console.log('🔄 Processing follow-ups...');

      // 2. Detect lifecycle stage changes
      await this.detectLifecycleChanges();

      // 3. Auto-enroll customers
      await this.autoEnrollCustomers();

      // 4. Process ready follow-ups
      await this.processReadyFollowUps();

      // 5. Update engagement scores
      await this.updateEngagementScores();

      // 6. Handle opt-outs
      await this.processOptOuts();

      console.log('✅ Follow-up processing complete');

    } catch (error) {
      console.error('❌ Error in follow-up automation:', error);
    }
  }

  // =====================================================
  // SYSTEM CHECKS
  // =====================================================

  async isSystemEnabled() {
    try {
      // System is considered enabled if ANY dealer has system_enabled = true.
      // The per-dealer filter in processReadyFollowUps already ensures messages
      // are only sent for dealers that individually have system_enabled = true.
      const result = await query(`
        SELECT 1 FROM followup_system_settings
        WHERE system_enabled = true
        LIMIT 1
      `);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking system status:', error);
      return false;
    }
  }

  async getDealerSettings(dealerId) {
    try {
      const result = await query(`
        SELECT * FROM followup_system_settings
        WHERE dealer_id = $1 OR (dealer_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM followup_system_settings WHERE dealer_id = $1
        ))
        ORDER BY dealer_id DESC NULLS LAST
        LIMIT 1
      `, [dealerId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting dealer settings:', error);
      return null;
    }
  }

  // =====================================================
  // LIFECYCLE DETECTION
  // =====================================================

  async detectLifecycleChanges() {
    try {
      // Detect new leads (created in last hour, not yet in lifecycle)
      await query(`
        INSERT INTO customer_lifecycle_stages (lead_id, customer_email, current_stage, engagement_score, last_interaction_at)
        SELECT 
          l.id, 
          l.customer_email, 
          CASE 
            WHEN l.interest_level = 'hot' THEN 'hot_lead'
            WHEN l.interest_level = 'high' THEN 'hot_lead'
            WHEN l.interest_level = 'medium' THEN 'warm_lead'
            ELSE 'cold_lead'
          END,
          CASE 
            WHEN l.interest_level IN ('hot', 'high') THEN 80
            WHEN l.interest_level = 'medium' THEN 60
            ELSE 40
          END,
          NOW()
        FROM leads l
        WHERE l.created_at > NOW() - INTERVAL '1 hour'
          AND NOT EXISTS (
            SELECT 1 FROM customer_lifecycle_stages cls WHERE cls.lead_id = l.id
          )
        ON CONFLICT (lead_id) DO NOTHING
      `);

      // Detect temperature changes (warm → cold if no response for 7 days)
      await query(`
        UPDATE customer_lifecycle_stages
        SET 
          previous_stage = current_stage,
          current_stage = 'cold_lead',
          stage_entered_at = NOW(),
          updated_at = NOW()
        WHERE current_stage IN ('warm_lead', 'hot_lead')
          AND last_interaction_at < NOW() - INTERVAL '7 days'
          AND engagement_score < 40
      `);

      console.log('✅ Lifecycle changes detected and updated');
    } catch (error) {
      console.error('Error detecting lifecycle changes:', error);
    }
  }

  // =====================================================
  // AUTO-ENROLLMENT
  // =====================================================

  async autoEnrollCustomers() {
    try {
      // Get customers not yet enrolled
      const result = await query(`
        SELECT 
          cls.id as lifecycle_stage_id,
          cls.lead_id,
          cls.current_stage,
          cls.engagement_score,
          l.dealer_id,
          fss.auto_enrollment_enabled,
          fss.auto_enrollment_categories,
          fss.min_engagement_score
        FROM customer_lifecycle_stages cls
        JOIN leads l ON cls.lead_id = l.id
        LEFT JOIN followup_system_settings fss ON (
          fss.dealer_id = l.dealer_id OR 
          (fss.dealer_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM followup_system_settings WHERE dealer_id = l.dealer_id
          ))
        )
        WHERE NOT EXISTS (
          SELECT 1 FROM followup_enrollments fe 
          WHERE fe.lifecycle_stage_id = cls.id 
          AND fe.status = 'active'
        )
        AND cls.engagement_score >= COALESCE(fss.min_engagement_score, 30)
        AND COALESCE(fss.auto_enrollment_enabled, true) = true
        AND COALESCE(fss.system_enabled, false) = true
        LIMIT 50
      `);

      for (const customer of result.rows) {
        await this.enrollInAppropriateSequence(customer);
      }

      if (result.rows.length > 0) {
        console.log(`✅ Auto-enrolled ${result.rows.length} customers`);
      }
    } catch (error) {
      console.error('Error in auto-enrollment:', error);
    }
  }

  async enrollInAppropriateSequence(customer) {
    try {
      const category = this.getCategoryForStage(customer.current_stage);

      // Check if this category is enabled
      const categories = customer.auto_enrollment_categories || ['lead_nurture'];
      if (!categories.includes(category)) {
        console.log(`⏭️  Skipping enrollment for ${category} (not enabled)`);
        return;
      }

      // Find appropriate rule template
      const ruleResult = await query(`
        SELECT id, name FROM followup_rule_templates
        WHERE dealer_id = $1
          AND category = $2
          AND is_active = true
        ORDER BY is_system_default DESC, created_at DESC
        LIMIT 1
      `, [customer.dealer_id, category]);

      if (ruleResult.rows.length === 0) {
        console.log(`⚠️  No template found for category: ${category}`);
        return;
      }

      const rule = ruleResult.rows[0];

      // Count total steps
      const stepsResult = await query(`
        SELECT COUNT(*) as count FROM followup_steps
        WHERE rule_template_id = $1 AND is_active = true
      `, [rule.id]);

      const totalSteps = parseInt(stepsResult.rows[0].count);

      // Create enrollment
      await query(`
        INSERT INTO followup_enrollments (
          lead_id, lifecycle_stage_id, rule_template_id, 
          status, current_step_order, total_steps,
          enrollment_source, next_run_at
        ) VALUES ($1, $2, $3, 'active', 0, $4, 'automatic', NOW())
        ON CONFLICT (lead_id, rule_template_id) DO NOTHING
      `, [customer.lead_id, customer.lifecycle_stage_id, rule.id, totalSteps]);

      console.log(`✅ Enrolled lead ${customer.lead_id} in ${category} (${rule.name})`);
    } catch (error) {
      console.error('Error enrolling customer:', error);
    }
  }

  getCategoryForStage(stage) {
    const mapping = {
      'new_lead': 'lead_nurture',
      'warm_lead': 'lead_nurture',
      'hot_lead': 'lead_nurture',
      'cold_lead': 'lead_nurture',
      'visited_no_purchase': 'unsold_visit',
      'purchased': 'post_purchase',
      'service_customer': 'service_customer',
      'at_risk': 'at_risk',
      'churned': 'churn_prevention',
      'loyal_customer': 'long_term_loyalty'
    };
    return mapping[stage] || 'lead_nurture';
  }

  // =====================================================
  // PROCESS READY FOLLOW-UPS
  // =====================================================

  async processReadyFollowUps() {
    try {
      const enrollments = await query(`
        SELECT 
          fe.id as enrollment_id,
          fe.lead_id,
          fe.current_step_order,
          l.customer_name,
          l.customer_email,
          l.customer_phone,
          l.dealer_id,
          fs.id as step_id,
          fs.step_name,
          fs.channel,
          fs.message_template,
          fs.subject_template,
          fs.delay_days,
          fs.delay_hours,
          fs.delay_minutes,
          fss.email_enabled,
          fss.sms_enabled,
          fss.respect_quiet_hours,
          fss.quiet_hours_start,
          fss.quiet_hours_end,
          fss.timezone,
          fss.max_messages_per_day
        FROM followup_enrollments fe
        JOIN leads l ON fe.lead_id = l.id
        JOIN followup_steps fs ON fs.rule_template_id = fe.rule_template_id 
          AND fs.step_order = fe.current_step_order + 1
        JOIN followup_system_settings fss ON (
          fss.dealer_id = l.dealer_id OR 
          (fss.dealer_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM followup_system_settings WHERE dealer_id = l.dealer_id
          ))
        )
        WHERE fe.status = 'active'
          AND fe.next_run_at <= NOW()
          AND fs.is_active = true
          AND fss.system_enabled = true
        ORDER BY fe.next_run_at ASC
        LIMIT $1
      `, [this.batchSize]);

      for (const enrollment of enrollments.rows) {
        await this.sendFollowUp(enrollment);
      }

      if (enrollments.rows.length > 0) {
        console.log(`📧 Processed ${enrollments.rows.length} follow-ups`);
      }
    } catch (error) {
      console.error('Error processing ready follow-ups:', error);
    }
  }

  async sendFollowUp(enrollment) {
    try {
      // Check channel enabled
      if (enrollment.channel === 'email' && !enrollment.email_enabled) {
        console.log(`⏭️  Email disabled for dealer, skipping`);
        await this.skipStep(enrollment, 'email_channel_disabled');
        return;
      }
      if (enrollment.channel === 'sms' && !enrollment.sms_enabled) {
        console.log(`⏭️  SMS disabled for dealer, skipping`);
        await this.skipStep(enrollment, 'sms_channel_disabled');
        return;
      }

      // Skip SMS if customer has no phone number — advance to next step
      if (enrollment.channel === 'sms' && !enrollment.customer_phone) {
        console.log(`⏭️  SMS skipped for ${enrollment.customer_name}: no phone number — advancing to next step`);
        await this.skipStep(enrollment, 'no_phone_number');
        return;
      }

      // Skip email if customer has no real email address
      const invalidEmails = ['no-email@example.com', 'unknown@daive.ai'];
      if (enrollment.channel === 'email' && (!enrollment.customer_email || invalidEmails.includes(enrollment.customer_email))) {
        console.log(`⏭️  Email skipped for ${enrollment.customer_name}: no valid email — advancing to next step`);
        await this.skipStep(enrollment, 'no_email_address');
        return;
      }

      // Check quiet hours
      if (enrollment.respect_quiet_hours && this.isQuietHours(enrollment)) {
        console.log(`🌙 Quiet hours active, delaying message`);
        await this.rescheduleForNextAvailableTime(enrollment);
        return;
      }

      // Check daily limit
      const dailyCount = await this.getDailyMessageCount(enrollment.lead_id);
      if (dailyCount >= enrollment.max_messages_per_day) {
        console.log(`⏸️  Daily message limit reached (${dailyCount}/${enrollment.max_messages_per_day})`);
        await this.rescheduleForTomorrow(enrollment);
        return;
      }

      // Process template
      const message = this.processTemplate(enrollment.message_template, enrollment);
      const subject = this.processTemplate(enrollment.subject_template || '', enrollment);

      // Send based on channel
      let result;
      switch (enrollment.channel) {
        case 'email':
          result = await this.sendEmail(enrollment.customer_email, subject, message);
          break;
        case 'sms':
          result = await this.sendSMS(enrollment.customer_phone, message);
          break;
        default:
          console.log(`⚠️  Unsupported channel: ${enrollment.channel}`);
          await this.skipStep(enrollment, 'unsupported_channel');
          return;
      }

      if (result.success) {
        await this.markStepComplete(enrollment, result);
        console.log(`✅ Sent ${enrollment.channel} to ${enrollment.customer_name}`);
      } else {
        await this.logFailedSend(enrollment, result.error);
        console.log(`❌ Failed to send ${enrollment.channel}: ${result.error}`);
      }

    } catch (error) {
      console.error(`Error sending follow-up:`, error);
      await this.logFailedSend(enrollment, error.message);
    }
  }

  /**
   * Skip a step when it cannot be sent (no phone, no email, disabled channel).
   * Logs the skip in execution_log and advances to the next step timing.
   */
  async skipStep(enrollment, reason) {
    try {
      // Log the skip
      await query(`
        INSERT INTO followup_execution_log (
          enrollment_id, step_id, channel, to_address,
          message_content, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, NOW())
      `, [
        enrollment.enrollment_id,
        enrollment.step_id,
        enrollment.channel,
        enrollment.customer_email || enrollment.customer_phone || 'unknown',
        enrollment.message_template,
        `skipped: ${reason}`
      ]);

      // Advance to next step — use 0 delay so it fires immediately
      const nextRunAt = new Date();

      await query(`
        UPDATE followup_enrollments
        SET current_step_order = current_step_order + 1,
            last_sent_at = NOW(),
            next_run_at  = $1,
            updated_at   = NOW()
        WHERE id = $2
      `, [nextRunAt, enrollment.enrollment_id]);

      // Mark complete if last step
      if (enrollment.current_step_order + 1 >= enrollment.total_steps) {
        await query(`
          UPDATE followup_enrollments
          SET status = 'completed', next_run_at = NULL
          WHERE id = $1
        `, [enrollment.enrollment_id]);
        console.log(`🏁 Sequence completed (all steps skipped or sent) for enrollment ${enrollment.enrollment_id}`);
      }

    } catch (err) {
      console.error('Error in skipStep:', err.message);
    }
  }

  // =====================================================
  // MESSAGE SENDING
  // =====================================================

  async sendEmail(to, subject, body) {
    try {
      // Use existing SMTP environment variables
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { success: false, error: 'Email credentials not configured in .env' };
      }

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

      // Enhanced HTML formatting
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          ${body.replace(/\n/g, '<br>')}
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666;">
            To stop receiving these messages, reply with STOP
          </p>
        </div>
      `;

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'info@mitiesoft.com';
      
      const info = await transporter.sendMail({
        from: `"DAIVE Follow-Up System" <${fromEmail}>`,
        to: to,
        subject: subject,
        html: htmlBody,
        text: body
      });

      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendSMS(to, message) {
    try {
      // Try FOLLOWUP_ variables first, fall back to regular TWILIO_ variables
      const accountSid = process.env.FOLLOWUP_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.FOLLOWUP_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.FOLLOWUP_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        return { success: false, error: 'SMS credentials not configured in .env' };
      }

      const client = twilio(accountSid, authToken);

      // Add opt-out text
      const fullMessage = `${message}\n\nReply STOP to unsubscribe`;

      const result = await client.messages.create({
        to: to,
        from: fromNumber,
        body: fullMessage
      });

      return { success: true, messageId: result.sid };

    } catch (error) {
      console.error('SMS send error:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // TEMPLATE PROCESSING
  // =====================================================

  processTemplate(template, data) {
    if (!template) return '';

    return template
      .replace(/\{\{customer_name\}\}/g, data.customer_name || '')
      .replace(/\{\{first_name\}\}/g, (data.customer_name || '').split(' ')[0])
      .replace(/\{\{email\}\}/g, data.customer_email || '')
      .replace(/\{\{phone\}\}/g, data.customer_phone || '')
      .replace(/\{\{dealer_name\}\}/g, data.dealer_name || '');
  }

  // =====================================================
  // STEP MANAGEMENT
  // =====================================================

  async markStepComplete(enrollment, sendResult) {
    try {
      // Calculate next step timing
      const totalMinutes = 
        (enrollment.delay_days * 24 * 60) + 
        (enrollment.delay_hours * 60) + 
        enrollment.delay_minutes;

      const nextRunAt = new Date(Date.now() + (totalMinutes * 60 * 1000));

      // Update enrollment
      await query(`
        UPDATE followup_enrollments
        SET current_step_order = current_step_order + 1,
            last_sent_at = NOW(),
            next_run_at = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [nextRunAt, enrollment.enrollment_id]);

      // Log execution
      await query(`
        INSERT INTO followup_execution_log (
          enrollment_id, step_id, channel, to_address, 
          message_content, subject_content, status, 
          provider_message_id, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, NOW())
      `, [
        enrollment.enrollment_id,
        enrollment.step_id,
        enrollment.channel,
        enrollment.customer_email || enrollment.customer_phone,
        enrollment.message_template,
        enrollment.subject_template,
        sendResult.messageId
      ]);

      // Check if sequence complete
      if (enrollment.current_step_order + 1 >= enrollment.total_steps) {
        await query(`
          UPDATE followup_enrollments
          SET status = 'completed', next_run_at = NULL
          WHERE id = $1
        `, [enrollment.enrollment_id]);
        console.log(`🎉 Sequence completed for enrollment ${enrollment.enrollment_id}`);
      }

    } catch (error) {
      console.error('Error marking step complete:', error);
    }
  }

  async logFailedSend(enrollment, errorMessage) {
    try {
      await query(`
        INSERT INTO followup_execution_log (
          enrollment_id, step_id, channel, to_address,
          message_content, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, 'failed', $6, NOW())
      `, [
        enrollment.enrollment_id,
        enrollment.step_id,
        enrollment.channel,
        enrollment.customer_email || enrollment.customer_phone,
        enrollment.message_template,
        errorMessage
      ]);
    } catch (error) {
      console.error('Error logging failed send:', error);
    }
  }

  // =====================================================
  // TIMING HELPERS
  // =====================================================

  isQuietHours(enrollment) {
    // Simplified - would need proper timezone handling in production
    const now = new Date();
    const currentHour = now.getHours();
    const quietStart = parseInt(enrollment.quiet_hours_start?.split(':')[0] || 21);
    const quietEnd = parseInt(enrollment.quiet_hours_end?.split(':')[0] || 8);

    if (quietStart > quietEnd) {
      // Crosses midnight
      return currentHour >= quietStart || currentHour < quietEnd;
    } else {
      return currentHour >= quietStart && currentHour < quietEnd;
    }
  }

  async rescheduleForNextAvailableTime(enrollment) {
    const quietEnd = parseInt(enrollment.quiet_hours_end?.split(':')[0] || 8);
    const nextRun = new Date();
    nextRun.setHours(quietEnd, 0, 0, 0);
    
    if (nextRun < new Date()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    await query(`
      UPDATE followup_enrollments
      SET next_run_at = $1
      WHERE id = $2
    `, [nextRun, enrollment.enrollment_id]);
  }

  async rescheduleForTomorrow(enrollment) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM next day

    await query(`
      UPDATE followup_enrollments
      SET next_run_at = $1
      WHERE id = $2
    `, [tomorrow, enrollment.enrollment_id]);
  }

  async getDailyMessageCount(leadId) {
    try {
      const result = await query(`
        SELECT COUNT(*) as count
        FROM followup_execution_log
        WHERE enrollment_id IN (
          SELECT id FROM followup_enrollments WHERE lead_id = $1
        )
        AND DATE(sent_at) = CURRENT_DATE
        AND status = 'sent'
      `, [leadId]);

      return parseInt(result.rows[0]?.count || 0);
    } catch (error) {
      return 0;
    }
  }

  // =====================================================
  // ENGAGEMENT SCORING
  // =====================================================

  async updateEngagementScores() {
    try {
      // Decay scores over time for inactive customers
      await query(`
        UPDATE customer_lifecycle_stages
        SET engagement_score = GREATEST(engagement_score - 1, 0)
        WHERE last_interaction_at < NOW() - INTERVAL '7 days'
          AND engagement_score > 0
      `);

      // Boost scores for active customers
      await query(`
        UPDATE customer_lifecycle_stages
        SET engagement_score = LEAST(engagement_score + 5, 100)
        WHERE last_interaction_at > NOW() - INTERVAL '24 hours'
          AND engagement_score < 100
      `);

    } catch (error) {
      console.error('Error updating engagement scores:', error);
    }
  }

  // =====================================================
  // OPT-OUT HANDLING
  // =====================================================

  async processOptOuts() {
    try {
      // Would integrate with incoming message handler
      // For now, this is a placeholder
    } catch (error) {
      console.error('Error processing opt-outs:', error);
    }
  }

  // =====================================================
  // IMMEDIATE ENROLLMENT (called from conversation hooks)
  // =====================================================

  /**
   * Enroll a lead immediately into the appropriate follow-up sequence.
   * Called directly when a conversation step completes or a handoff is accepted.
   * Falls back gracefully if system is disabled, no template exists, etc.
   *
   * @param {string} leadId     - UUID of the lead record
   * @param {string} dealerId   - UUID of the dealer
   * @param {string} stage      - Lifecycle stage key:
   *   'new_lead' | 'warm_lead' | 'hot_lead' | 'cold_lead' |
   *   'visited_no_purchase' | 'purchased' | 'service_customer' |
   *   'at_risk' | 'churned' | 'loyal_customer'
   * @param {object} [opts]     - Optional: { customerEmail, engagementScore }
   */
  async enrollLeadImmediately(leadId, dealerId, stage, opts = {}) {
    try {
      if (!leadId || !dealerId) {
        console.log('⚠️  enrollLeadImmediately: missing leadId or dealerId, skipping');
        return { success: false, reason: 'missing_ids' };
      }

      // 1. Check system is globally enabled for this dealer
      const settingsResult = await query(`
        SELECT system_enabled, auto_enrollment_enabled, auto_enrollment_categories, min_engagement_score
        FROM followup_system_settings
        WHERE dealer_id = $1 OR (dealer_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM followup_system_settings WHERE dealer_id = $1
        ))
        ORDER BY dealer_id DESC NULLS LAST
        LIMIT 1
      `, [dealerId]);

      if (!settingsResult.rows.length || !settingsResult.rows[0].system_enabled) {
        console.log('⏸️  enrollLeadImmediately: system disabled for dealer, skipping');
        return { success: false, reason: 'system_disabled' };
      }

      const settings = settingsResult.rows[0];
      const category = this.getCategoryForStage(stage);

      // 2. Check this category is enabled in auto-enrollment
      const enabledCategories = settings.auto_enrollment_categories || ['lead_nurture'];
      if (!enabledCategories.includes(category)) {
        console.log(`⏭️  enrollLeadImmediately: category '${category}' not enabled, skipping`);
        return { success: false, reason: 'category_disabled' };
      }

      // 3. Upsert customer_lifecycle_stages
      const engagementScore = opts.engagementScore || (
        stage === 'hot_lead' ? 80 : stage === 'warm_lead' ? 60 : stage === 'purchased' ? 90 : 50
      );

      await query(`
        INSERT INTO customer_lifecycle_stages
          (lead_id, customer_email, current_stage, engagement_score, last_interaction_at)
        SELECT
          l.id,
          COALESCE($3, l.customer_email, 'unknown@daive.ai'),
          $2,
          $4,
          NOW()
        FROM leads l WHERE l.id = $1
        ON CONFLICT (lead_id) DO UPDATE SET
          previous_stage    = customer_lifecycle_stages.current_stage,
          current_stage     = EXCLUDED.current_stage,
          engagement_score  = GREATEST(customer_lifecycle_stages.engagement_score, EXCLUDED.engagement_score),
          last_interaction_at = NOW(),
          updated_at        = NOW()
      `, [leadId, stage, opts.customerEmail || null, engagementScore]);

      // 4. Find the best matching rule template for dealer + category
      const templateResult = await query(`
        SELECT frt.id, frt.name,
               (SELECT COUNT(*) FROM followup_steps fs WHERE fs.rule_template_id = frt.id AND fs.is_active = true) AS step_count
        FROM followup_rule_templates frt
        WHERE (frt.dealer_id = $1 OR frt.dealer_id IS NULL)
          AND frt.category = $2
          AND frt.is_active = true
        ORDER BY
          (frt.dealer_id = $1) DESC,  -- prefer dealer-specific over system defaults
          frt.is_system_default DESC,
          frt.created_at DESC
        LIMIT 1
      `, [dealerId, category]);

      if (!templateResult.rows.length) {
        console.log(`⚠️  enrollLeadImmediately: no active template for category '${category}', skipping`);
        return { success: false, reason: 'no_template' };
      }

      const template = templateResult.rows[0];
      const totalSteps = parseInt(template.step_count);

      if (totalSteps === 0) {
        console.log(`⚠️  enrollLeadImmediately: template '${template.name}' has no active steps, skipping`);
        return { success: false, reason: 'no_steps' };
      }

      // 5. Enroll (ON CONFLICT = already enrolled, skip silently)
      const lifecycleResult = await query(`
        SELECT id FROM customer_lifecycle_stages WHERE lead_id = $1
      `, [leadId]);

      const lifecycleStageId = lifecycleResult.rows[0]?.id || null;

      const enrollResult = await query(`
        INSERT INTO followup_enrollments (
          lead_id, lifecycle_stage_id, rule_template_id,
          status, current_step_order, total_steps,
          enrollment_source, next_run_at
        ) VALUES ($1, $2, $3, 'active', 0, $4, 'daive_conversation', NOW())
        ON CONFLICT (lead_id, rule_template_id) DO NOTHING
        RETURNING id
      `, [leadId, lifecycleStageId, template.id, totalSteps]);

      if (enrollResult.rows.length === 0) {
        console.log(`ℹ️  enrollLeadImmediately: lead ${leadId} already enrolled in '${template.name}'`);
        return { success: true, reason: 'already_enrolled' };
      }

      console.log(`✅ enrollLeadImmediately: lead ${leadId} enrolled in '${template.name}' (${totalSteps} steps, category: ${category})`);
      return { success: true, enrollmentId: enrollResult.rows[0].id, template: template.name };

    } catch (error) {
      console.error('❌ enrollLeadImmediately error:', error.message);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Upsert or find a lead record for a conversation customer, then enroll them.
   * Used when lead_capture completes during conversation (before handoff).
   *
   * @param {string} dealerId
   * @param {object} customerData  - { name, email, phone, interestLevel, vehicleId }
   * @param {string} stage         - Lifecycle stage
   * @param {string} conversationId - daive_conversations.id for linking
   */
  async upsertLeadAndEnroll(dealerId, customerData, stage, conversationId) {
    try {
      if (!dealerId || !customerData?.email) {
        console.log('⚠️  upsertLeadAndEnroll: missing dealerId or customer email, skipping');
        return { success: false, reason: 'missing_data' };
      }

      const interestLevel = customerData.interestLevel ||
        (stage === 'hot_lead' ? 'high' : stage === 'warm_lead' ? 'medium' : 'low');

      // Find or create the lead record
      const existingLead = await query(`
        SELECT id FROM leads
        WHERE dealer_id = $1 AND customer_email = $2
        ORDER BY created_at DESC LIMIT 1
      `, [dealerId, customerData.email]);

      let leadId;
      if (existingLead.rows.length > 0) {
        leadId = existingLead.rows[0].id;
        console.log(`ℹ️  upsertLeadAndEnroll: found existing lead ${leadId}`);
      } else {
        const newLead = await query(`
          INSERT INTO leads (
            dealer_id, vehicle_id, customer_name, customer_email, customer_phone,
            message, status, interest_level, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, NOW(), NOW())
          RETURNING id
        `, [
          dealerId,
          customerData.vehicleId || null,
          customerData.name || 'DAIVE Conversation Customer',
          customerData.email,
          customerData.phone || null,
          'Auto-created from DAIVE conversation',
          interestLevel
        ]);
        leadId = newLead.rows[0].id;
        console.log(`✅ upsertLeadAndEnroll: created new lead ${leadId} for ${customerData.email}`);

        // Link the lead to the conversation
        if (conversationId) {
          await query(`
            UPDATE daive_conversations
            SET lead_id = $1, updated_at = NOW()
            WHERE id = $2 AND lead_id IS NULL
          `, [leadId, conversationId]);
        }
      }

      const enrollResult = await this.enrollLeadImmediately(leadId, dealerId, stage, {
        customerEmail: customerData.email
      });

      return { ...enrollResult, leadId };

    } catch (error) {
      console.error('❌ upsertLeadAndEnroll error:', error.message);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  // =====================================================
  // STATUS
  // =====================================================

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      batchSize: this.batchSize,
      lastCheck: global.lastFollowupCheck || null
    };
  }
}

// Create singleton instance
const followupAutomation = new FollowUpAutomationService();

export default followupAutomation;

