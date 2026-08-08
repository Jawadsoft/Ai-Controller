import nodemailer from 'nodemailer';
import emailConfig from '../config/emailConfig.js';

class DAIVEEmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Reinitialize the email transporter (useful after env vars are loaded)
   */
  reinitialize() {
    console.log('🔄 Reinitializing email transporter...');
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // PRIORITY 1: Try SMTP with custom host FIRST (more reliable for business emails)
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log('🔍 Attempting SMTP configuration from environment variables...');
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        console.log(`✅ D.A.I.V.E. Email Service configured with SMTP (from .env)`);
        console.log(`   📧 Server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
        console.log(`   📧 Sender: ${process.env.SMTP_USER}`);
        console.log(`   🔧 Secure: ${process.env.SMTP_SECURE === 'true'}`);
        
        // Test the connection
        this.testConnection();
        return;
      }

      // PRIORITY 2: Try Gmail as fallback
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        console.log('🔍 Attempting Gmail configuration from environment variables...');
        console.log(`   📧 User: ${process.env.GMAIL_USER}`);
        console.log(`   🔑 Password length: ${process.env.GMAIL_APP_PASSWORD.length} characters`);
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });
        console.log('✅ D.A.I.V.E. Email Service configured with Gmail (from .env)');
        console.log(`   📧 Sender: ${process.env.GMAIL_USER}`);
        
        // Test the connection
        this.testConnection();
        return;
      }

      // PRIORITY 2: Try config file (only if env vars not set)
      if (emailConfig.gmail.user && emailConfig.gmail.appPassword && emailConfig.gmail.appPassword !== 'your-gmail-app-password') {
        console.log('🔍 Attempting Gmail configuration from config file...');
        this.transporter = nodemailer.createTransport({
          service: emailConfig.gmail.service,
          auth: {
            user: emailConfig.gmail.user,
            pass: emailConfig.gmail.appPassword,
          },
        });
        console.log('✅ D.A.I.V.E. Email Service configured with Gmail (from config file)');
        return;
      }

      if (emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.password && emailConfig.smtp.password !== 'your-gmail-app-password') {
        console.log('🔍 Attempting SMTP configuration from config file...');
        this.transporter = nodemailer.createTransport({
          host: emailConfig.smtp.host,
          port: emailConfig.smtp.port,
          secure: emailConfig.smtp.secure,
          auth: {
            user: emailConfig.smtp.user,
            pass: emailConfig.smtp.password,
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        console.log(`✅ D.A.I.V.E. Email Service configured with SMTP (from config file)`);
        return;
      }

      console.log('❌ No email configuration found for D.A.I.V.E. notifications');
      console.log('📝 Set environment variables or update src/config/emailConfig.js');
      console.log('   Environment variables (recommended):');
      console.log('   - GMAIL_USER and GMAIL_APP_PASSWORD');
      console.log('   - OR SMTP_HOST, SMTP_USER, SMTP_PASS');
    } catch (error) {
      console.error('❌ Error initializing email transporter:', error);
      console.error('   Error details:', error.message);
    }
  }

  /**
   * Test email connection
   */
  async testConnection() {
    if (!this.transporter) {
      console.log('⚠️ No email transporter to test');
      return false;
    }

    try {
      console.log('🔍 Testing email connection...');
      await this.transporter.verify();
      console.log('✅ Email connection verified successfully!');
      return true;
    } catch (error) {
      console.error('❌ Email connection test failed:', error.message);
      console.error('   Code:', error.code);
      console.error('   Command:', error.command);
      
      if (error.code === 'EAUTH') {
        console.error('   🔑 Authentication failed - check your email credentials');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        console.error('   🌐 Connection failed - check your network/firewall settings');
      }
      
      return false;
    }
  }

  /**
   * Get notification email from dealer settings or use default
   */
  async getNotificationEmail(dealerId) {
    try {
      const { pool } = await import('../database/connection.js');
      
      // Get notification email from dealer settings
      const settingsQuery = `
        SELECT setting_value 
        FROM daive_api_settings 
        WHERE dealer_id = $1 AND setting_type = 'lead_notificationEmail'
      `;
      
      const result = await pool.query(settingsQuery, [dealerId]);
      
      if (result.rows.length > 0 && result.rows[0].setting_value) {
        return result.rows[0].setting_value;
      }
      
      // Fallback to default email from config
      return emailConfig.defaultNotificationEmail;
    } catch (error) {
      console.error('Error getting notification email:', error);
      return emailConfig.defaultNotificationEmail;
    }
  }

  /**
   * Send handoff request notification email
   */
  async sendHandoffRequestNotification(conversationData, dealerId) {
    if (!this.transporter) {
      console.log('❌ Email transporter not configured, skipping handoff notification');
      return false;
    }

    try {
      const notificationEmail = await this.getNotificationEmail(dealerId);
      
      const { customer_name, customer_email, customer_phone, lead_qualification_score, handoff_reason, vehicle_id } = conversationData;
      
      // Get vehicle information if available
      let vehicleInfo = '';
      if (vehicle_id) {
        try {
          const { pool } = await import('../database/connection.js');
          const vehicleQuery = 'SELECT make, model, year, vin FROM vehicles WHERE id = $1';
          const vehicleResult = await pool.query(vehicleQuery, [vehicle_id]);
          if (vehicleResult.rows.length > 0) {
            const v = vehicleResult.rows[0];
            vehicleInfo = `${v.year} ${v.make} ${v.model} (VIN: ${v.vin})`;
          }
        } catch (error) {
          console.error('Error fetching vehicle info:', error);
        }
      }

      const subject = `🚨 D.A.I.V.E. Handoff Request - ${customer_name || 'Anonymous Customer'}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>D.A.I.V.E. Handoff Request</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info-box { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 15px 0; }
            .customer-info { background: #e8f5e8; border: 1px solid #c3e6c3; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .score { font-size: 18px; font-weight: bold; color: #28a745; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
            .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤖 D.A.I.V.E. Handoff Request</h1>
              <p>AI Assistant requires human intervention</p>
            </div>
            
            <div class="alert">
              <strong>⚠️ Action Required:</strong> A customer conversation requires immediate human attention and has been flagged for handoff.
            </div>
            
            <div class="customer-info">
              <h3>👤 Customer Information</h3>
              <p><strong>Name:</strong> ${customer_name || 'Anonymous'}</p>
              <p><strong>Email:</strong> ${customer_email || 'Not provided'}</p>
              <p><strong>Phone:</strong> ${customer_phone || 'Not provided'}</p>
              <p><strong>Lead Score:</strong> <span class="score">${lead_qualification_score}%</span></p>
            </div>
            
            ${vehicleInfo ? `
            <div class="info-box">
              <h3>🚗 Vehicle Interest</h3>
              <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
            </div>
            ` : ''}
            
            <div class="info-box">
              <h3>📝 Handoff Reason</h3>
              <p>${handoff_reason || 'Customer requested human assistance or AI determined handoff was necessary'}</p>
            </div>
            
            <div class="info-box">
              <h3>⏰ Next Steps</h3>
              <ol>
                <li>Log into your D.A.I.V.E. Analytics dashboard</li>
                <li>Navigate to the "Conversations & Handoffs" section</li>
                <li>Find this conversation and click "Accept Handoff"</li>
                <li>Contact the customer to continue the conversation</li>
              </ol>
            </div>
            
            <div class="footer">
              <p>This notification was sent by D.A.I.V.E. (Dealer AI Vehicle Expert) - Your AI Assistant for automotive sales.</p>
              <p>Please respond to this handoff request promptly to maintain customer satisfaction.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
D.A.I.V.E. HANDOFF REQUEST

A customer conversation requires immediate human attention.

CUSTOMER INFORMATION:
- Name: ${customer_name || 'Anonymous'}
- Email: ${customer_email || 'Not provided'}
- Phone: ${customer_phone || 'Not provided'}
- Lead Score: ${lead_qualification_score}%

${vehicleInfo ? `VEHICLE INTEREST: ${vehicleInfo}` : ''}

HANDOFF REASON:
${handoff_reason || 'Customer requested human assistance or AI determined handoff was necessary'}

NEXT STEPS:
1. Log into your D.A.I.V.E. Analytics dashboard
2. Navigate to the "Conversations & Handoffs" section
3. Find this conversation and click "Accept Handoff"
4. Contact the customer to continue the conversation

This notification was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).
Please respond to this handoff request promptly.
      `;

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';

      await this.transporter.sendMail({
        from: fromEmail,
        to: notificationEmail,
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`✅ Handoff request notification sent to ${notificationEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending handoff request notification:', error);
      return false;
    }
  }

  /**
   * Send handoff acceptance notification email
   */
  async sendHandoffAcceptanceNotification(conversationData, dealerId, acceptedBy) {
    if (!this.transporter) {
      console.log('❌ Email transporter not configured, skipping handoff acceptance notification');
      return false;
    }

    try {
      const notificationEmail = await this.getNotificationEmail(dealerId);
      
      const { customer_name, customer_email, customer_phone, lead_qualification_score, vehicle_id } = conversationData;
      
      // Get vehicle information if available
      let vehicleInfo = '';
      if (vehicle_id) {
        try {
          const { pool } = await import('../database/connection.js');
          const vehicleQuery = 'SELECT make, model, year, vin FROM vehicles WHERE id = $1';
          const vehicleResult = await pool.query(vehicleQuery, [vehicle_id]);
          if (vehicleResult.rows.length > 0) {
            const v = vehicleResult.rows[0];
            vehicleInfo = `${v.year} ${v.make} ${v.model} (VIN: ${v.vin})`;
          }
        } catch (error) {
          console.error('Error fetching vehicle info:', error);
        }
      }

      const subject = `✅ D.A.I.V.E. Handoff Accepted - ${customer_name || 'Anonymous Customer'}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>D.A.I.V.E. Handoff Accepted</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info-box { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 15px 0; }
            .customer-info { background: #e8f5e8; border: 1px solid #c3e6c3; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .score { font-size: 18px; font-weight: bold; color: #28a745; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ D.A.I.V.E. Handoff Accepted</h1>
              <p>Handoff has been successfully accepted and lead created</p>
            </div>
            
            <div class="success">
              <strong>✅ Success:</strong> The handoff request has been accepted and a lead has been created in your system.
            </div>
            
            <div class="customer-info">
              <h3>👤 Customer Information</h3>
              <p><strong>Name:</strong> ${customer_name || 'Anonymous'}</p>
              <p><strong>Email:</strong> ${customer_email || 'Not provided'}</p>
              <p><strong>Phone:</strong> ${customer_phone || 'Not provided'}</p>
              <p><strong>Lead Score:</strong> <span class="score">${lead_qualification_score}%</span></p>
            </div>
            
            ${vehicleInfo ? `
            <div class="info-box">
              <h3>🚗 Vehicle Interest</h3>
              <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
            </div>
            ` : ''}
            
            <div class="info-box">
              <h3>👨‍💼 Accepted By</h3>
              <p>User ID: ${acceptedBy}</p>
              <p>Status: Lead created and marked as "Hot"</p>
            </div>
            
            <div class="info-box">
              <h3>📋 Next Steps</h3>
              <ol>
                <li>Contact the customer using the provided information</li>
                <li>Follow up on their vehicle interest</li>
                <li>Update lead status in your CRM system</li>
                <li>Schedule test drive or meeting if appropriate</li>
              </ol>
            </div>
            
            <div class="footer">
              <p>This notification was sent by D.A.I.V.E. (Dealer AI Vehicle Expert) - Your AI Assistant for automotive sales.</p>
              <p>The lead has been automatically created in your system and is ready for follow-up.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
D.A.I.V.E. HANDOFF ACCEPTED

The handoff request has been successfully accepted and a lead has been created.

CUSTOMER INFORMATION:
- Name: ${customer_name || 'Anonymous'}
- Email: ${customer_email || 'Not provided'}
- Phone: ${customer_phone || 'Not provided'}
- Lead Score: ${lead_qualification_score}%

${vehicleInfo ? `VEHICLE INTEREST: ${vehicleInfo}` : ''}

ACCEPTED BY: User ID ${acceptedBy}
STATUS: Lead created and marked as "Hot"

NEXT STEPS:
1. Contact the customer using the provided information
2. Follow up on their vehicle interest
3. Update lead status in your CRM system
4. Schedule test drive or meeting if appropriate

This notification was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).
The lead has been automatically created in your system.
      `;

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';

      await this.transporter.sendMail({
        from: fromEmail,
        to: notificationEmail,
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`✅ Handoff acceptance notification sent to ${notificationEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending handoff acceptance notification:', error);
      return false;
    }
  }

  /**
   * Send lead generation notification email
   */
  async sendLeadGenerationNotification(leadData, dealerId) {
    if (!this.transporter) {
      console.log('❌ Email transporter not configured, skipping lead generation notification');
      return false;
    }

    try {
      const notificationEmail = await this.getNotificationEmail(dealerId);
      
      const { customer_name, customer_email, customer_phone, interest_level, vehicle_id } = leadData;
      
      // Get vehicle information if available
      let vehicleInfo = '';
      if (vehicle_id) {
        try {
          const { pool } = await import('../database/connection.js');
          const vehicleQuery = 'SELECT make, model, year, vin FROM vehicles WHERE id = $1';
          const vehicleResult = await pool.query(vehicleQuery, [vehicle_id]);
          if (vehicleResult.rows.length > 0) {
            const v = vehicleResult.rows[0];
            vehicleInfo = `${v.year} ${v.make} ${v.model} (VIN: ${v.vin})`;
          }
        } catch (error) {
          console.error('Error fetching vehicle info:', error);
        }
      }

      const subject = `🎯 New Lead Generated - ${customer_name || 'Anonymous Customer'}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Lead Generated</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .lead { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info-box { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 15px 0; }
            .customer-info { background: #e8f5e8; border: 1px solid #c3e6c3; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .interest-level { font-size: 18px; font-weight: bold; color: #ff6b6b; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 New Lead Generated</h1>
              <p>D.A.I.V.E. has identified a qualified lead</p>
            </div>
            
            <div class="lead">
              <strong>🎯 New Lead:</strong> A qualified lead has been automatically generated by D.A.I.V.E. and requires your attention.
            </div>
            
            <div class="customer-info">
              <h3>👤 Customer Information</h3>
              <p><strong>Name:</strong> ${customer_name || 'Anonymous'}</p>
              <p><strong>Email:</strong> ${customer_email || 'Not provided'}</p>
              <p><strong>Phone:</strong> ${customer_phone || 'Not provided'}</p>
              <p><strong>Interest Level:</strong> <span class="interest-level">${interest_level || 'Medium'}</span></p>
            </div>
            
            ${vehicleInfo ? `
            <div class="info-box">
              <h3>🚗 Vehicle Interest</h3>
              <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
            </div>
            ` : ''}
            
            <div class="info-box">
              <h3>📋 Lead Details</h3>
              <p><strong>Lead ID:</strong> ${leadData.id}</p>
              <p><strong>Status:</strong> ${leadData.status || 'New'}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="info-box">
              <h3>📞 Next Steps</h3>
              <ol>
                <li>Contact the customer within 24 hours</li>
                <li>Follow up on their vehicle interest</li>
                <li>Schedule a test drive or meeting</li>
                <li>Update lead status in your CRM</li>
              </ol>
            </div>
            
            <div class="footer">
              <p>This notification was sent by D.A.I.V.E. (Dealer AI Vehicle Expert) - Your AI Assistant for automotive sales.</p>
              <p>This lead was automatically generated based on conversation analysis and customer interest indicators.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
NEW LEAD GENERATED

D.A.I.V.E. has identified a qualified lead that requires your attention.

CUSTOMER INFORMATION:
- Name: ${customer_name || 'Anonymous'}
- Email: ${customer_email || 'Not provided'}
- Phone: ${customer_phone || 'Not provided'}
- Interest Level: ${interest_level || 'Medium'}

${vehicleInfo ? `VEHICLE INTEREST: ${vehicleInfo}` : ''}

LEAD DETAILS:
- Lead ID: ${leadData.id}
- Status: ${leadData.status || 'New'}
- Generated: ${new Date().toLocaleString()}

NEXT STEPS:
1. Contact the customer within 24 hours
2. Follow up on their vehicle interest
3. Schedule a test drive or meeting
4. Update lead status in your CRM

This notification was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).
This lead was automatically generated based on conversation analysis.
      `;

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';

      await this.transporter.sendMail({
        from: fromEmail,
        to: notificationEmail,
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`✅ Lead generation notification sent to ${notificationEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending lead generation notification:', error);
      return false;
    }
  }

  /**
   * Send credit application link email to customer
   */
  async sendCreditApplicationLinkEmail(applicationData, dealerId) {
    if (!this.transporter) {
      console.log('❌ Email transporter not configured, skipping credit application email');
      return false;
    }

    try {
      const { customer_name, customer_email, vehicle_info, application_link, financing_type, credit_score, down_payment, lease_term } = applicationData;
      
      if (!customer_email) {
        console.error('❌ No customer email provided for credit application');
        return false;
      }

      const subject = `🚗 Your ${financing_type === 'lease' ? 'Lease' : 'Finance'} Application for ${vehicle_info || 'Your Vehicle'}`;
      
      const vehicleText = vehicle_info || 'your selected vehicle';
      const financingDetails = financing_type === 'lease'
        ? `<p><strong>Lease Term:</strong> ${lease_term} months</p>`
        : `<p><strong>Down Payment:</strong> $${down_payment?.toLocaleString()}</p>`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Credit Application Link</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .info-box { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 15px 0; }
            .application-box { background: #e8f5e8; border: 1px solid #c3e6c3; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
            .expiry { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 10px; border-radius: 5px; margin: 15px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚗 Your ${financing_type === 'lease' ? 'Lease' : 'Finance'} Application</h1>
              <p>Complete your application to get instant pre-approval</p>
            </div>
            
            <p>Hi ${customer_name || 'there'},</p>
            
            <p>Great news! We've prepared your ${financing_type === 'lease' ? 'lease' : 'finance'} application for <strong>${vehicleText}</strong>. Complete it now to receive instant pre-approval!</p>
            
            <div class="info-box">
              <h3>📋 Application Details</h3>
              <p><strong>Vehicle:</strong> ${vehicleText}</p>
              <p><strong>Financing Type:</strong> ${financing_type === 'lease' ? 'Lease' : 'Finance'}</p>
              <p><strong>Credit Score:</strong> ${credit_score}</p>
              ${financingDetails}
            </div>
            
            <div class="application-box">
              <h3>🔐 Your Secure Application Link</h3>
              <p>Click the button below to complete your application:</p>
              <a href="${application_link}" class="button">Complete Application Now</a>
              <p style="margin-top: 15px; font-size: 12px; color: #666;">Or copy this link: <br><a href="${application_link}">${application_link}</a></p>
            </div>
            
            <div class="expiry">
              <strong>⏰ Important:</strong> This link is valid for 24 hours and is personalized for your security.
            </div>
            
            <div class="info-box">
              <h3>✅ What to Expect</h3>
              <ul>
                <li>Application takes 5-10 minutes to complete</li>
                <li>Instant pre-approval decision in most cases</li>
                <li>Secure and encrypted process</li>
                <li>We'll contact you immediately after submission</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
              <p>This email was sent by D.A.I.V.E. (Dealer AI Vehicle Expert) on behalf of your dealership.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
YOUR ${financing_type === 'lease' ? 'LEASE' : 'FINANCE'} APPLICATION

Hi ${customer_name || 'there'},

Great news! We've prepared your ${financing_type === 'lease' ? 'lease' : 'finance'} application for ${vehicleText}.

APPLICATION DETAILS:
- Vehicle: ${vehicleText}
- Financing Type: ${financing_type === 'lease' ? 'Lease' : 'Finance'}
- Credit Score: ${credit_score}
${financing_type === 'lease' ? `- Lease Term: ${lease_term} months` : `- Down Payment: $${down_payment?.toLocaleString()}`}

COMPLETE YOUR APPLICATION:
${application_link}

⏰ Important: This link is valid for 24 hours and is personalized for your security.

WHAT TO EXPECT:
- Application takes 5-10 minutes to complete
- Instant pre-approval decision in most cases
- Secure and encrypted process
- We'll contact you immediately after submission

If you have any questions, please reach out to us.

This email was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).
      `;

      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';

      await this.transporter.sendMail({
        from: `D.A.I.V.E. <${fromEmail}>`,
        to: customer_email,
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`✅ Credit application link sent to ${customer_email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending credit application email:', error);
      return false;
    }
  }

  // ── Direct salesperson high-intent alert ─────────────────────────────────────
  // Called when a customer who came via a salesperson's QR shows high intent
  // (test drive, appointment, etc.). Sends a direct email to the salesperson.
  async sendStaffHighIntentAlert({ staffEmail, staffName, customerName, triggerMessage, vehicleInfo, conversationId, dealerName }) {
    if (!this.transporter) return false;
    if (!staffEmail) return false;

    try {
      const fromEmail = process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@dealerig.com';
      const subject = `🔔 Your Customer Needs Attention — ${customerName || 'A visitor'}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 24px 30px; }
            .header h1 { margin: 0; font-size: 22px; }
            .header p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
            .body { padding: 28px 30px; }
            .alert-box { background: #fff7ed; border: 2px solid #f97316; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
            .alert-box .icon { font-size: 24px; margin-bottom: 6px; }
            .alert-box p { margin: 0; font-size: 15px; color: #7c2d12; }
            .info-row { display: flex; gap: 10px; margin-bottom: 10px; font-size: 14px; }
            .info-label { color: #6b7280; min-width: 110px; font-weight: 600; }
            .info-value { color: #111827; }
            .cta { margin-top: 24px; text-align: center; }
            .cta a { background: #f97316; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; }
            .footer { padding: 16px 30px; background: #f9fafb; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 Your Customer Is Active</h1>
              <p>${dealerName || 'DealerIQ'} · D.A.I.V.E. Alert</p>
            </div>
            <div class="body">
              <p>Hi <strong>${staffName || 'there'}</strong>,</p>
              <p>A customer you greeted is currently chatting with D.A.I.V.E. and showing strong buying signals. They may need your personal attention soon.</p>

              <div class="alert-box">
                <div class="icon">💬</div>
                <p><strong>What they said:</strong> "${triggerMessage}"</p>
              </div>

              <div class="info-row"><span class="info-label">Customer:</span><span class="info-value">${customerName || 'Anonymous visitor'}</span></div>
              ${vehicleInfo ? `<div class="info-row"><span class="info-label">Vehicle:</span><span class="info-value">${vehicleInfo}</span></div>` : ''}
              <div class="info-row"><span class="info-label">Status:</span><span class="info-value">🟠 High interest — may want a test drive or appointment</span></div>

              <p style="margin-top:20px; color:#374151;">Head to your dashboard to view the full conversation and be ready when they need you.</p>

              <div class="cta">
                <a href="#">View in DealerIQ Dashboard</a>
              </div>
            </div>
            <div class="footer">
              This alert was sent because this customer scanned your personal QR code. Powered by D.A.I.V.E. AI.
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `Hi ${staffName},\n\nYour customer "${customerName || 'Anonymous'}" is chatting with D.A.I.V.E. and showing high interest.\n\nThey said: "${triggerMessage}"\n${vehicleInfo ? `Vehicle: ${vehicleInfo}\n` : ''}\nCheck your DealerIQ dashboard for the full conversation.\n\n— D.A.I.V.E.`;

      await this.transporter.sendMail({
        from: `D.A.I.V.E. <${fromEmail}>`,
        to: staffEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`📧 Staff high-intent alert sent to ${staffEmail} (${staffName})`);
      return true;
    } catch (error) {
      console.error('❌ Error sending staff high-intent alert:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new DAIVEEmailService();
