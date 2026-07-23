import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check if SMTP settings are configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Use custom SMTP server
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });
      console.log(`✅ SMTP configured: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
    } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      // Fallback to Gmail if no SMTP settings
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      console.log('✅ Gmail fallback configured');
    } else {
      console.log('❌ No email configuration found. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file');
    }
  }

  async sendVerificationEmail(email, verificationToken, businessName) {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/#/verify-email/${verificationToken}`;
      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';
      
      const mailOptions = {
        from: `"DealerIQ" <${fromEmail}>`,
        to: email,
        subject: 'Verify Your DealerIQ Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; margin: 0; font-size: 28px;">DealerIQ</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Vehicle Management System</p>
              </div>
              
              <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 24px;">Welcome to DealerIQ!</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi there! Thank you for signing up with DealerIQ. We're excited to have <strong>${businessName}</strong> on board!
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                To complete your account setup and start managing your vehicle inventory, please verify your email address by clicking the button below:
              </p>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${verificationUrl}" 
                   style="background-color: #2563eb; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                If the button above doesn't work, you can copy and paste this link into your browser:
              </p>
              
              <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin-bottom: 30px;">
                ${verificationUrl}
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  This verification link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} DealerIQ. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
          Welcome to DealerIQ!
          
          Hi there! Thank you for signing up with DealerIQ. We're excited to have ${businessName} on board!
          
          To complete your account setup and start managing your vehicle inventory, please verify your email address by visiting:
          
          ${verificationUrl}
          
          This verification link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
          
          © ${new Date().getFullYear()} DealerIQ. All rights reserved.
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully to:', email);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending verification email:', error);
      throw new Error(`Failed to send verification email: ${error.message}`);
    }
  }

  async sendWelcomeEmail(email, businessName) {
    try {
      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';
      
      const mailOptions = {
        from: `"DealerIQ" <${fromEmail}>`,
        to: email,
        subject: 'Welcome to DealerIQ - Your Account is Verified!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; margin: 0; font-size: 28px;">DealerIQ</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Vehicle Management System</p>
              </div>
              
              <h2 style="color: #10b981; margin-bottom: 20px; font-size: 24px;">🎉 Account Verified Successfully!</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Congratulations! Your DealerIQ account for <strong>${businessName}</strong> has been successfully verified.
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                You can now access all features of DealerIQ and start managing your vehicle inventory with AI-powered tools.
              </p>
              
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">🚀 What's Next?</h3>
                <ul style="color: #0c4a6e; font-size: 16px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Complete your dealership profile</li>
                  <li>Add your vehicle inventory</li>
                  <li>Set up AI chatbot for customer inquiries</li>
                  <li>Configure lead management system</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                   style="background-color: #10b981; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  If you have any questions or need assistance, please don't hesitate to contact our support team.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} DealerIQ. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
          🎉 Account Verified Successfully!
          
          Congratulations! Your DealerIQ account for ${businessName} has been successfully verified.
          
          You can now access all features of DealerIQ and start managing your vehicle inventory with AI-powered tools.
          
          What's Next?
          - Complete your dealership profile
          - Add your vehicle inventory
          - Set up AI chatbot for customer inquiries
          - Configure lead management system
          
          Go to Dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard
          
          If you have any questions or need assistance, please don't hesitate to contact our support team.
          
          © ${new Date().getFullYear()} DealerIQ. All rights reserved.
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent successfully to:', email);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }
  }

  async sendStaffInvitationEmail(email, name, password, role, businessName, verificationToken = null) {
    try {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/#/auth`;
      const verificationUrl = verificationToken 
        ? `${process.env.FRONTEND_URL || 'http://localhost:8080'}/#/verify-email/${verificationToken}`
        : null;
      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';
      
      const mailOptions = {
        from: `"DealerIQ" <${fromEmail}>`,
        to: email,
        subject: `Welcome to ${businessName} - Your DealerIQ Staff Account`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; margin: 0; font-size: 28px;">DealerIQ</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Vehicle Management System</p>
              </div>
              
              <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 24px;">Welcome to the Team! 🎉</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi <strong>${name}</strong>,
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                You've been added as a staff member at <strong>${businessName}</strong> on DealerIQ!
              </p>
              
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">🔐 Your Login Credentials</h3>
                <p style="color: #0c4a6e; font-size: 16px; margin: 5px 0;">
                  <strong>Email (User ID):</strong> ${email}
                </p>
                <p style="color: #0c4a6e; font-size: 16px; margin: 5px 0;">
                  <strong>Password:</strong> <code style="background-color: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace;">${password}</code>
                </p>
                <p style="color: #0c4a6e; font-size: 16px; margin: 5px 0;">
                  <strong>Role:</strong> ${role}
                </p>
              </div>
              
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                  ⚠️ <strong>Important:</strong> Please verify your email and change your password immediately after your first login for security purposes.
                </p>
              </div>
              
              ${verificationUrl ? `
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${verificationUrl}" 
                   style="background-color: #10b981; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin-bottom: 20px;">
                After verification, you can login:
              </p>
              ` : ''}
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" 
                   style="background-color: #2563eb; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                  Login to DealerIQ
                </a>
              </div>
              
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">🚀 Getting Started</h3>
                <ul style="color: #0c4a6e; font-size: 16px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  ${verificationUrl ? '<li style="margin-bottom: 10px;">Click the "Verify Email Address" button above</li>' : ''}
                  <li style="margin-bottom: 10px;">Log in using your credentials above</li>
                  <li style="margin-bottom: 10px;">Update your password in your profile settings</li>
                  <li style="margin-bottom: 10px;">Familiarize yourself with your role permissions</li>
                  <li style="margin-bottom: 10px;">Start collaborating with your team!</li>
                </ul>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                If the button above doesn't work, you can copy and paste this link into your browser:
              </p>
              
              <p style="color: #6b7280; font-size: 14px; word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 5px; margin-bottom: 30px;">
                ${loginUrl}
              </p>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                If you have any questions or need assistance, please contact your administrator.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} DealerIQ. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
          Welcome to DealerIQ!
          
          Hi ${name},
          
          You've been added as a staff member at ${businessName} on DealerIQ!
          
          Your Login Credentials:
          - Email (User ID): ${email}
          - Password: ${password}
          - Role: ${role}
          
          ⚠️ IMPORTANT: Please verify your email and change your password immediately after your first login for security purposes.
          
          ${verificationUrl ? `Verify your email at: ${verificationUrl}\n\n` : ''}Login to DealerIQ at: ${loginUrl}
          
          Getting Started:
          ${verificationUrl ? '1. Click the verification link above to verify your email\n          ' : ''}${verificationUrl ? '2' : '1'}. Log in using your credentials above
          ${verificationUrl ? '3' : '2'}. Update your password in your profile settings
          ${verificationUrl ? '4' : '3'}. Familiarize yourself with your role permissions
          ${verificationUrl ? '5' : '4'}. Start collaborating with your team!
          
          If you have any questions or need assistance, please contact your administrator.
          
          © ${new Date().getFullYear()} DealerIQ. All rights reserved.
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Staff invitation email sent successfully to:', email);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending staff invitation email:', error);
      throw new Error(`Failed to send staff invitation email: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(email, name, newPassword, role, businessName) {
    try {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/#/auth`;
      const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'info@mitiesoft.com';
      
      const mailOptions = {
        from: `"DealerIQ" <${fromEmail}>`,
        to: email,
        subject: `Your DealerIQ Password Has Been Reset`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; margin: 0; font-size: 28px;">DealerIQ</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Vehicle Management System</p>
              </div>
              
              <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 24px;">Password Reset 🔐</h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi <strong>${name}</strong>,
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Your password for your DealerIQ account at <strong>${businessName}</strong> has been reset by an administrator.
              </p>
              
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">🔐 Your New Login Credentials</h3>
                <p style="color: #0c4a6e; font-size: 16px; margin: 5px 0;">
                  <strong>Email (User ID):</strong> ${email}
                </p>
                <p style="color: #0c4a6e; font-size: 16px; margin: 5px 0;">
                  <strong>New Password:</strong> <code style="background-color: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace;">${newPassword}</code>
                </p>
                <p style="color: #0c4a6e; font-size: 16px; margin: 5px 0;">
                  <strong>Role:</strong> ${role}
                </p>
              </div>
              
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                  ⚠️ <strong>Important Security Notice:</strong> Please change this password immediately after logging in. Go to your profile settings to update your password.
                </p>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" 
                   style="background-color: #2563eb; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                  Login to DealerIQ
                </a>
              </div>
              
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">🔒 Security Tips</h3>
                <ul style="color: #0c4a6e; font-size: 16px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 10px;">Change your password immediately after logging in</li>
                  <li style="margin-bottom: 10px;">Use a strong, unique password</li>
                  <li style="margin-bottom: 10px;">Never share your password with anyone</li>
                  <li style="margin-bottom: 10px;">Enable two-factor authentication if available</li>
                </ul>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                If you did not request this password reset, please contact your administrator immediately.
              </p>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} DealerIQ. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
          Password Reset - DealerIQ
          
          Hi ${name},
          
          Your password for your DealerIQ account at ${businessName} has been reset by an administrator.
          
          Your New Login Credentials:
          - Email (User ID): ${email}
          - New Password: ${newPassword}
          - Role: ${role}
          
          ⚠️ IMPORTANT: Please change this password immediately after logging in for security purposes.
          
          Login to DealerIQ at: ${loginUrl}
          
          Security Tips:
          1. Change your password immediately after logging in
          2. Use a strong, unique password
          3. Never share your password with anyone
          4. Enable two-factor authentication if available
          
          If you did not request this password reset, please contact your administrator immediately.
          
          © ${new Date().getFullYear()} DealerIQ. All rights reserved.
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent successfully to:', email);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return false;
    }
  }
}

export default new EmailService();
