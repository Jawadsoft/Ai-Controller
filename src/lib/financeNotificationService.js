import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { pool } from '../database/connection.js';

class FinanceNotificationService {
  constructor() {
    this.initializeEmailTransport();
    this.initializeTwilioClient();
  }

  /**
   * Initialize email transport (Nodemailer)
   */
  initializeEmailTransport() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'send.one.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD // Support both SMTP_PASS and SMTP_PASSWORD
      }
    });

    // Verify connection
    this.emailTransporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email transport verification failed:', error.message);
      } else {
        console.log('✅ Email service ready');
      }
    });
  }

  /**
   * Initialize Twilio client
   */
  initializeTwilioClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
      console.log('✅ Twilio SMS service ready');
    } else {
      console.warn('⚠️ Twilio credentials not configured - SMS disabled');
      this.twilioClient = null;
    }
  }

  /**
   * Get dealer settings for notifications
   */
  async getDealerSettings(dealerId) {
    try {
      const result = await pool.query(
        'SELECT business_name, email, phone, notification_settings FROM dealers WHERE id = $1',
        [dealerId]
      );
      
      if (result.rows[0]) {
        const dealer = result.rows[0];
        return {
          dealerName: dealer.business_name,
          dealerEmail: dealer.email,
          dealerPhone: dealer.phone,
          notificationSettings: dealer.notification_settings || {
            email_enabled: true,
            sms_enabled: true,
            finance_notifications: true
          }
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching dealer settings:', error);
      return null;
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(to, subject, htmlContent, dealerId, cc = null, attachments = []) {
    try {
      const dealerSettings = await this.getDealerSettings(dealerId);
      
      if (!dealerSettings?.notificationSettings?.email_enabled) {
        console.log('📧 Email notifications disabled for dealer:', dealerId);
        return { success: false, reason: 'disabled' };
      }

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'info@mitiesoft.com';
      
      const mailOptions = {
        from: `"${dealerSettings.dealerName}" <${fromEmail}>`,
        to: to,
        subject,
        html: htmlContent,
        replyTo: dealerSettings.dealerEmail
      };

      // Add CC if provided
      if (cc) {
        mailOptions.cc = cc;
        console.log('📧 CC added to email:', cc);
      }

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
        console.log('📎 Added', attachments.length, 'attachment(s)');
      }

      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.messageId);
      
      // Log notification
      await this.logNotification(dealerId, 'email', to, subject, 'sent');
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      await this.logNotification(dealerId, 'email', to, subject, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(to, message, dealerId) {
    try {
      if (!this.twilioClient) {
        console.log('📱 Twilio not configured - SMS disabled');
        return { success: false, reason: 'not_configured' };
      }

      const dealerSettings = await this.getDealerSettings(dealerId);
      
      if (!dealerSettings?.notificationSettings?.sms_enabled) {
        console.log('📱 SMS notifications disabled for dealer:', dealerId);
        return { success: false, reason: 'disabled' };
      }

      // Format phone number (ensure E.164 format)
      const formattedPhone = this.formatPhoneNumber(to);

      const sms = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      console.log('✅ SMS sent:', sms.sid);
      
      // Log notification
      await this.logNotification(dealerId, 'sms', formattedPhone, message.substring(0, 50), 'sent');
      
      return { success: true, sid: sms.sid };
    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      await this.logNotification(dealerId, 'sms', to, message.substring(0, 50), 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add +1 for US numbers if not present
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    return phone; // Return as-is if format unknown
  }

  /**
   * Log notification in database
   */
  async logNotification(dealerId, type, recipient, content, status, errorMessage = null) {
    try {
      await pool.query(`
        INSERT INTO finance_notifications_log 
          (dealer_id, notification_type, recipient, content, status, error_message, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [dealerId, type, recipient, content, status, errorMessage]);
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Insert a notification into the notifications table so it appears in the bell panel
   */
  async insertDBNotification(dealerId, type, title, message, data = {}) {
    try {
      await pool.query(`
        INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
      `, [dealerId, type, title, message, JSON.stringify(data)]);
      console.log(`🔔 Bell notification inserted [${type}]: ${title}`);
    } catch (error) {
      if (error.code === '42P01') {
        console.warn('⚠️ notifications table does not exist yet — skipping bell insert');
      } else {
        console.error('Error inserting DB notification:', error);
      }
    }
  }

  // ========================================
  // FINANCE-SPECIFIC NOTIFICATION METHODS
  // ========================================

  /**
   * Notify customer: Credit application received
   */
  async notifyCreditApplicationReceived(application, dealerId) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    // Email to customer
    const emailHtml = this.getEmailTemplate('creditApplicationReceived', {
      customerName: application.customer_name,
      dealerName: dealerSettings?.dealerName,
      applicationId: application.id
    });

    await this.sendEmail(
      application.customer_email,
      'Credit Application Received - ' + dealerSettings?.dealerName,
      emailHtml,
      dealerId
    );

    // SMS to customer (if phone provided)
    if (application.customer_phone) {
      const smsMessage = `Hi ${application.customer_name}, we've received your credit application. We'll review it and get back to you within 24 hours. - ${dealerSettings?.dealerName}`;
      await this.sendSMS(application.customer_phone, smsMessage, dealerId);
    }

    // Email to dealer/finance manager
    const dealerEmailHtml = this.getEmailTemplate('newCreditApplicationDealer', {
      customerName: application.customer_name,
      customerEmail: application.customer_email,
      customerPhone: application.customer_phone,
      applicationId: application.id,
      creditScore: application.credit_score
    });

    await this.sendEmail(
      dealerSettings?.dealerEmail,
      'New Credit Application Submitted',
      dealerEmailHtml,
      dealerId
    );

    await this.insertDBNotification(
      dealerId,
      'credit_application',
      '📋 New Credit Application',
      `${application.customer_name} submitted a credit application`,
      { applicationId: application.id, customerEmail: application.customer_email }
    );
  }

  /**
   * Notify customer: Credit application approved
   */
  async notifyCreditApplicationApproved(application, dealerId, approvalDetails) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    // Email to customer
    const emailHtml = this.getEmailTemplate('creditApplicationApproved', {
      customerName: application.customer_name,
      dealerName: dealerSettings?.dealerName,
      approvedAmount: approvalDetails.approved_amount || 'N/A',
      apr: approvalDetails.apr || 'N/A',
      dealerPhone: dealerSettings?.dealerPhone
    });

    await this.sendEmail(
      application.customer_email,
      '✅ Credit Application Approved!',
      emailHtml,
      dealerId
    );

    // SMS to customer
    if (application.customer_phone) {
      const smsMessage = `Great news ${application.customer_name}! Your credit application has been approved. Contact us at ${dealerSettings?.dealerPhone} to proceed. - ${dealerSettings?.dealerName}`;
      await this.sendSMS(application.customer_phone, smsMessage, dealerId);
    }

    await this.insertDBNotification(
      dealerId,
      'credit_application',
      '✅ Credit Application Approved',
      `${application.customer_name}'s credit application has been approved`,
      { applicationId: application.id }
    );
  }

  /**
   * Notify customer: Credit application declined
   */
  async notifyCreditApplicationDeclined(application, dealerId, reason) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    // Email to customer
    const emailHtml = this.getEmailTemplate('creditApplicationDeclined', {
      customerName: application.customer_name,
      dealerName: dealerSettings?.dealerName,
      reason: reason || 'We were unable to approve your application at this time.',
      dealerPhone: dealerSettings?.dealerPhone
    });

    await this.sendEmail(
      application.customer_email,
      'Credit Application Update',
      emailHtml,
      dealerId
    );

    await this.insertDBNotification(
      dealerId,
      'credit_application',
      '❌ Credit Application Declined',
      `${application.customer_name}'s credit application was declined`,
      { applicationId: application.id }
    );
  }

  /**
   * Notify customer: Finance deal created
   */
  async notifyFinanceDealCreated(deal, application, vehicle, dealerId) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    // Email to customer
    const emailHtml = this.getEmailTemplate('financeDealCreated', {
      customerName: application.customer_name,
      dealerName: dealerSettings?.dealerName,
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      monthlyPayment: deal.monthly_payment,
      apr: deal.apr,
      termMonths: deal.term_months,
      downPayment: deal.down_payment,
      dealId: deal.id
    });

    await this.sendEmail(
      application.customer_email,
      'Your Finance Deal is Ready!',
      emailHtml,
      dealerId
    );

    // SMS to customer
    if (application.customer_phone) {
      const smsMessage = `${application.customer_name}, your finance deal for the ${vehicle.year} ${vehicle.make} ${vehicle.model} is ready! $${deal.monthly_payment}/mo for ${deal.term_months} months. Call us: ${dealerSettings?.dealerPhone}`;
      await this.sendSMS(application.customer_phone, smsMessage, dealerId);
    }

    await this.insertDBNotification(
      dealerId,
      'finance_deal',
      '🚗 Finance Deal Created',
      `Deal created for ${application.customer_name} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      { dealId: deal.id, applicationId: application.id }
    );
  }

  /**
   * Notify customer: Signature request
   */
  async notifySignatureRequest(deal, application, signatureUrl, dealerId) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    // Email to customer with CC to info@mitiesoft.com
    const emailHtml = this.getEmailTemplate('signatureRequest', {
      customerName: application.customer_name,
      dealerName: dealerSettings?.dealerName,
      signatureUrl: signatureUrl,
      dealId: deal.id
    });

    await this.sendEmail(
      application.customer_email,
      '✍️ Please Sign Your Finance Documents',
      emailHtml,
      dealerId,
      'info@mitiesoft.com' // CC to info@mitiesoft.com
    );

    // SMS to customer
    if (application.customer_phone) {
      const smsMessage = `Hi ${application.customer_name}, your finance documents are ready to sign: ${signatureUrl} - ${dealerSettings?.dealerName}`;
      await this.sendSMS(application.customer_phone, smsMessage, dealerId);
    }

    await this.insertDBNotification(
      dealerId,
      'signature_request',
      '✍️ Signature Request Sent',
      `Signature request sent to ${application.customer_name} for deal ${deal.id}`,
      { dealId: deal.id, applicationId: application.id }
    );
  }

  /**
   * Notify when document is signed (customer and dealer)
   */
  async notifySignatureCompleted(deal, application, dealerId, recipient = 'customer') {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    if (recipient === 'customer') {
      // Email to customer
      const emailHtml = this.getEmailTemplate('signatureCompleted', {
        customerName: application.customer_name,
        dealerName: dealerSettings?.dealerName,
        dealId: deal.id
      });

      await this.sendEmail(
        application.customer_email,
        'Document Signed Successfully - ' + dealerSettings?.dealerName,
        emailHtml,
        dealerId
      );

      console.log(`✅ Signature completion email sent to customer: ${application.customer_email}`);
    } else {
      // Email to dealer with CC to info@mitiesoft.com
      const emailHtml = this.getEmailTemplate('signatureCompletedDealer', {
        customerName: application.customer_name,
        customerEmail: application.customer_email,
        dealId: deal.id,
        dealerName: dealerSettings?.dealerName,
        signedAt: new Date().toLocaleString()
      });

      await this.sendEmail(
        dealerSettings?.dealerEmail || 'admin@dealer.com',
        `Document Signed by ${application.customer_name}`,
        emailHtml,
        dealerId,
        'info@mitiesoft.com' // CC parameter
      );

      await this.insertDBNotification(
        dealerId,
        'signature_request',
        '✅ Document Signed',
        `${application.customer_name} has signed their finance documents for deal ${deal.id}`,
        { dealId: deal.id, customerEmail: application.customer_email }
      );

      console.log(`✅ Signature completion email sent to dealer`);
    }
  }

  /**
   * Notify: New customer credit application submitted
   * @param {Object} application - Credit application data
   * @param {string} dealerId - Dealer ID
   * @param {string} pdfPath - Path to PDF file (relative to public/)
   */
  async notifyCustomerCreditApplicationSubmitted(application, dealerId, pdfPath) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    // Prepare PDF attachment
    const attachments = [];
    if (pdfPath) {
      attachments.push({
        filename: `credit-application-${application.id}.pdf`,
        path: `./public${pdfPath}`, // Relative to server root
        contentType: 'application/pdf'
      });
    }

    // Email to customer
    const customerEmailHtml = this.getEmailTemplate('creditApplicationReceived', {
      customerName: application.customer_name,
      dealerName: dealerSettings?.dealerName,
      dealerPhone: dealerSettings?.dealerPhone,
      applicationId: application.id,
      vehicleInfo: application.vehicle_make && application.vehicle_model 
        ? `${application.vehicle_year || ''} ${application.vehicle_make} ${application.vehicle_model}`.trim()
        : 'N/A'
    });

    await this.sendEmail(
      application.customer_email,
      '✅ Credit Application Received',
      customerEmailHtml,
      dealerId,
      null,
      attachments
    );

    // Email to dealer (with CC to info@mitiesoft.com)
    const dealerEmailHtml = this.getEmailTemplate('newCreditApplicationDealer', {
      customerName: application.customer_name,
      customerEmail: application.customer_email,
      customerPhone: application.customer_phone || 'N/A',
      vehicleInfo: application.vehicle_make && application.vehicle_model 
        ? `${application.vehicle_year || ''} ${application.vehicle_make} ${application.vehicle_model}`.trim()
        : 'N/A',
      requestedAmount: application.requested_loan_amount 
        ? `$${parseFloat(application.requested_loan_amount).toLocaleString()}`
        : 'N/A',
      applicationId: application.id,
      submittedAt: new Date(application.submitted_at).toLocaleString()
    });

    await this.sendEmail(
      dealerSettings.dealerEmail,
      '🚨 New Customer Credit Application',
      dealerEmailHtml,
      dealerId,
      'info@mitiesoft.com', // CC to info@mitiesoft.com
      attachments
    );

    // SMS to customer (optional)
    if (application.customer_phone) {
      const smsMessage = `Thank you ${application.customer_name}! Your credit application has been received. We'll review it shortly and get back to you. - ${dealerSettings?.dealerName}`;
      await this.sendSMS(application.customer_phone, smsMessage, dealerId);
    }

    await this.insertDBNotification(
      dealerId,
      'credit_application',
      '🚨 New Credit Application',
      `${application.customer_name} submitted a credit application`,
      { applicationId: application.id, customerEmail: application.customer_email, customerPhone: application.customer_phone || null }
    );
  }

  /**
   * Notify dealer: Deal status changed
   */
  async notifyDealerDealStatusChange(deal, oldStatus, newStatus, dealerId) {
    const dealerSettings = await this.getDealerSettings(dealerId);
    
    const emailHtml = this.getEmailTemplate('dealStatusChanged', {
      dealId: deal.id,
      oldStatus: oldStatus,
      newStatus: newStatus,
      customerName: deal.customer_name || 'Unknown',
      vehicleName: deal.vehicle_name || 'Unknown'
    });

    await this.sendEmail(
      dealerSettings?.dealerEmail,
      `Deal Status Update: ${deal.id}`,
      emailHtml,
      dealerId
    );
  }

  /**
   * Get email template by type
   */
  getEmailTemplate(type, data) {
    const templates = {
      creditApplicationReceived: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Credit Application Received</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>Thank you for submitting your credit application with <strong>${data.dealerName}</strong>.</p>
              <p><strong>Application ID:</strong> ${data.applicationId}</p>
              <p>Our finance team is reviewing your application. You can expect to hear from us within <strong>24 hours</strong>.</p>
              <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      creditApplicationApproved: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .highlight { background: #d1fae5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Congratulations!</h1>
              <h2>Your Credit Application is Approved</h2>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>Great news! Your credit application with <strong>${data.dealerName}</strong> has been approved.</p>
              <div class="highlight">
                <p><strong>Approved Amount:</strong> $${data.approvedAmount}</p>
                <p><strong>APR:</strong> ${data.apr}%</p>
              </div>
              <p>Please contact us at <strong>${data.dealerPhone}</strong> to proceed with your vehicle purchase.</p>
              <p>We're excited to help you drive away in your new vehicle!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      creditApplicationDeclined: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6b7280; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Credit Application Update</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>Thank you for your interest in financing with <strong>${data.dealerName}</strong>.</p>
              <p>${data.reason}</p>
              <p>However, we may have other financing options available. Please contact us at <strong>${data.dealerPhone}</strong> to discuss alternative solutions.</p>
              <p>We're committed to helping you find the right vehicle and financing solution.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      financeDealCreated: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .deal-details { background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; }
            .deal-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚗 Your Finance Deal is Ready!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>Congratulations! Your finance deal for the <strong>${data.vehicleName}</strong> has been created.</p>
              
              <div class="deal-details">
                <h3>Finance Details:</h3>
                <div class="deal-row">
                  <span>Monthly Payment:</span>
                  <strong>$${data.monthlyPayment}</strong>
                </div>
                <div class="deal-row">
                  <span>Term:</span>
                  <strong>${data.termMonths} months</strong>
                </div>
                <div class="deal-row">
                  <span>APR:</span>
                  <strong>${data.apr}%</strong>
                </div>
                <div class="deal-row">
                  <span>Down Payment:</span>
                  <strong>$${data.downPayment}</strong>
                </div>
                <div class="deal-row">
                  <span>Deal ID:</span>
                  <strong>${data.dealId}</strong>
                </div>
              </div>
              
              <p>Our team will contact you shortly to finalize the paperwork.</p>
              <p>Thank you for choosing <strong>${data.dealerName}</strong>!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      signatureRequest: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; text-align: center; }
            .button { display: inline-block; background: #8b5cf6; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✍️ Signature Required</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>Your finance documents are ready for signature!</p>
              <p>Please click the button below to review and sign your documents:</p>
              <a href="${data.signatureUrl}" class="button">Sign Documents</a>
              <p style="font-size: 12px; color: #666;">Deal ID: ${data.dealId}</p>
              <p>If you have any questions, please contact us before signing.</p>
              <p>Thank you for choosing <strong>${data.dealerName}</strong>!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      signatureCompleted: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .success-badge { background: #10b981; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 20px 0; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Document Signed Successfully!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <div class="success-badge">✓ Signature Completed</div>
              <p>Your document has been successfully signed and submitted.</p>
              <div class="info-box">
                <h3>What happens next?</h3>
                <ul>
                  <li>We have received your signed document</li>
                  <li>Our team will review and process your application</li>
                  <li>We'll contact you shortly with next steps</li>
                  <li>Keep an eye on your email for updates</li>
                </ul>
              </div>
              <p>If you have any questions, please don't hesitate to contact us at ${data.dealerName}.</p>
              <p>Thank you for your business!</p>
              <p>Best regards,<br>${data.dealerName}</p>
            </div>
            <div class="footer">
              <p>This is an automated notification. © ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      signatureCompletedDealer: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; }
            .content { background: #f9fafb; padding: 30px; }
            .alert-badge { background: #3b82f6; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; margin: 20px 0; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Document Signed</h1>
            </div>
            <div class="content">
              <div class="alert-badge">New Signature Received</div>
              <p>A customer has signed their document.</p>
              <div class="info-box">
                <h3>Customer Details</h3>
                <div class="detail-row"><strong>Name:</strong><span>${data.customerName}</span></div>
                <div class="detail-row"><strong>Email:</strong><span>${data.customerEmail}</span></div>
                <div class="detail-row"><strong>Deal ID:</strong><span>${data.dealId}</span></div>
                <div class="detail-row"><strong>Signed At:</strong><span>${data.signedAt}</span></div>
              </div>
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Review the signed document in the CRM</li>
                <li>Process the application</li>
                <li>Contact the customer for next steps</li>
              </ul>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${data.dealerName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,

      newCreditApplicationDealer: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1f2937; color: white; padding: 20px; }
            .content { background: #f9fafb; padding: 30px; }
            .customer-info { background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Credit Application</h1>
            </div>
            <div class="content">
              <p>A new credit application has been submitted and requires review.</p>
              
              <div class="customer-info">
                <p><strong>Customer:</strong> ${data.customerName}</p>
                <p><strong>Email:</strong> ${data.customerEmail}</p>
                <p><strong>Phone:</strong> ${data.customerPhone}</p>
                <p><strong>Credit Score:</strong> ${data.creditScore || 'Not provided'}</p>
                <p><strong>Application ID:</strong> ${data.applicationId}</p>
              </div>
              
              <p>Please log in to the CRM to review and process this application.</p>
            </div>
            <div class="footer">
              <p>DAIVE CRM Finance Module</p>
            </div>
          </div>
        </body>
        </html>
      `,

      dealStatusChanged: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1f2937; color: white; padding: 20px; }
            .content { background: #f9fafb; padding: 30px; }
            .status-change { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Deal Status Update</h1>
            </div>
            <div class="content">
              <p>Deal status has been updated:</p>
              
              <div class="status-change">
                <p><strong>Deal ID:</strong> ${data.dealId}</p>
                <p><strong>Customer:</strong> ${data.customerName}</p>
                <p><strong>Vehicle:</strong> ${data.vehicleName}</p>
                <p><strong>Previous Status:</strong> ${data.oldStatus}</p>
                <p><strong>New Status:</strong> <span style="color: #2563eb; font-weight: bold;">${data.newStatus}</span></p>
              </div>
              
              <p>Please log in to the CRM for more details.</p>
            </div>
            <div class="footer">
              <p>DAIVE CRM Finance Module</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    return templates[type] || '<p>Notification template not found</p>';
  }
}

export default new FinanceNotificationService();

