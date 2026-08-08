import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../database/connection.js';

// Generate customer session token
export const generateCustomerToken = (sessionId, customerData = {}) => {
  return jwt.sign(
    { 
      sessionId, 
      type: 'customer',
      ...customerData 
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '24h' }
  );
};

// Verify customer session token
export const verifyCustomerToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'customer') {
      throw new Error('Invalid token type');
    }

    // Verify session still exists and is valid
    const sessionResult = await query(
      `SELECT cs.*, v.id as vehicle_id, v.make, v.model, v.year, v.price,
              d.id as dealer_id, d.business_name, d.contact_name, d.email as dealer_email, d.phone as dealer_phone
       FROM customer_sessions cs
       LEFT JOIN vehicles v ON cs.vehicle_id = v.id
       LEFT JOIN dealers d ON cs.dealer_id = d.id
       WHERE cs.id = $1 AND cs.expires_at > NOW()`,
      [decoded.sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session expired or not found');
    }

    const row = sessionResult.rows[0];
    return {
      session: row,
      customer: {
        sessionId: decoded.sessionId,
        id: decoded.customer_id || row.customer_id || null,
        name: decoded.customer_name,
        email: decoded.customer_email,
        phone: decoded.customer_phone
      }
    };
  } catch (error) {
    throw new Error('Invalid customer token');
  }
};

// Middleware to authenticate customer sessions
export const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Customer session token required',
        requiresAuth: true 
      });
    }

    const { session, customer } = await verifyCustomerToken(token);
    
    req.customerSession = session;
    req.customer = customer;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid customer session',
      requiresAuth: true 
    });
  }
};

// Middleware to optionally authenticate customer (for public access with enhanced features)
export const optionalCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const { session, customer } = await verifyCustomerToken(token);
        req.customerSession = session;
        req.customer = customer;
      } catch (error) {
        // Token is invalid, but we continue without customer data
        console.log('Invalid customer token, continuing without auth:', error.message);
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Create or update customer session
export const createCustomerSession = async (sessionData) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    ip_address,
    user_agent,
    access_type = 'qr_code',
    vehicle_id,
    dealer_id,
    qr_hash
  } = sessionData;

  try {
    // Check if session already exists for this QR hash
    let sessionResult;
    if (qr_hash) {
      sessionResult = await query(
        'SELECT * FROM customer_sessions WHERE qr_hash = $1 AND expires_at > NOW()',
        [qr_hash]
      );
    }

    let session;
    if (sessionResult && sessionResult.rows.length > 0) {
      // Update existing session
      session = sessionResult.rows[0];
      await query(
        `UPDATE customer_sessions 
         SET customer_name = COALESCE($1, customer_name),
             customer_email = COALESCE($2, customer_email),
             customer_phone = COALESCE($3, customer_phone),
             last_activity = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [customer_name, customer_email, customer_phone, session.id]
      );
    } else {
      // Generate a unique session token
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new session
      const newSessionResult = await query(
        `INSERT INTO customer_sessions (
          session_token, customer_name, customer_email, customer_phone, ip_address, user_agent,
          access_type, vehicle_id, dealer_id, qr_hash, is_authenticated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          sessionToken, customer_name, customer_email, customer_phone, ip_address, user_agent,
          access_type, vehicle_id, dealer_id, qr_hash, false
        ]
      );
      session = newSessionResult.rows[0];
    }

    // Log the interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, vehicle_id, dealer_id, interaction_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.id,
        'qr_scan',
        vehicle_id,
        dealer_id,
        JSON.stringify({ qr_hash, access_type, timestamp: new Date().toISOString() })
      ]
    );

    return session;
  } catch (error) {
    console.error('Error creating customer session:', error);
    throw error;
  }
};

// Generate email verification token
export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
export const sendVerificationEmail = async (customer, verificationToken) => {
  try {
    console.log('📧 Preparing to send verification email...');
    console.log('   To:', customer.email);
    console.log('   Token:', verificationToken);
    
    // Import email service
    const daiveEmailService = await import('../lib/daiveEmailService.js');
    
    if (!daiveEmailService.default.transporter) {
      console.error('❌ Email transporter not initialized!');
      throw new Error('Email service not configured');
    }
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    // Use HashRouter format: /#/verify-email?token=...
    const verificationLink = `${frontendUrl}/#/verify-email?token=${verificationToken}`;
    
    console.log('🔗 Verification link:', verificationLink);
    
    const subject = '✅ Verify Your Email Address';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
          .header h1 { margin: 0; font-size: 24px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; font-weight: bold; }
          .link-text { color: #666; font-size: 12px; word-break: break-all; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Verify Your Email Address</h1>
            <p>Welcome to D.A.I.V.E.</p>
          </div>
          
          <p>Hi ${customer.first_name},</p>
          
          <p>Thank you for registering! To access vehicle information and start using our services, please verify your email address.</p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </div>
          
          <p class="link-text">Or copy and paste this link in your browser:<br>${verificationLink}</p>
          
          <div class="warning">
            <strong>⏰ Important:</strong> This verification link will expire in 24 hours.
          </div>
          
          <p style="color: #666; font-size: 14px;">If you didn't create this account, you can safely ignore this email.</p>
          
          <div class="footer">
            <p>This email was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).</p>
            <p>Need help? Contact us at ${process.env.SMTP_USER || 'support@mitiesoft.com'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
VERIFY YOUR EMAIL ADDRESS

Hi ${customer.first_name},

Thank you for registering! To access vehicle information and start using our services, please verify your email address by clicking the link below:

${verificationLink}

⏰ Important: This verification link will expire in 24 hours.

If you didn't create this account, you can safely ignore this email.

This email was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).
Need help? Contact us at ${process.env.SMTP_USER || 'support@mitiesoft.com'}
    `;
    
    const mailOptions = {
      from: `D.A.I.V.E. <${process.env.SMTP_USER || process.env.GMAIL_USER}>`,
      to: customer.email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };
    
    console.log('📬 Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    const result = await daiveEmailService.default.transporter.sendMail(mailOptions);
    
    console.log(`✅ Verification email sent successfully to ${customer.email}`);
    console.log('   Message ID:', result.messageId);
    console.log('   Response:', result.response);
    console.log('   Accepted:', result.accepted);
    console.log('   Rejected:', result.rejected);
    
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    console.error('   Error details:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error command:', error.command);
    
    if (error.code === 'EAUTH') {
      console.error('   🔑 Authentication failed - email credentials are invalid');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('   🌐 Connection failed - check network/firewall settings');
    } else if (error.code === 'EENVELOPE') {
      console.error('   📧 Invalid email address format');
    }
    
    throw error; // Re-throw to let caller know it failed
  }
};

// Verify email with token
export const verifyEmailToken = async (token) => {
  try {
    console.log('🔍 Verifying email token:', token);
    
    // First, check if token exists at all
    const tokenCheck = await query(
      `SELECT id, email, first_name, last_name, email_verified, 
              verification_token_expires, 
              NOW() as current_time,
              verification_token_expires > NOW() as is_valid
       FROM customers 
       WHERE verification_token = $1`,
      [token]
    );
    
    console.log('📊 Token check result:', tokenCheck.rows[0]);
    
    // Find customer with valid token
    const customerResult = await query(
      `SELECT id, email, first_name, last_name FROM customers 
       WHERE verification_token = $1 
       AND verification_token_expires > NOW() 
       AND email_verified = FALSE`,
      [token]
    );
    
    if (customerResult.rows.length === 0) {
      if (tokenCheck.rows.length > 0) {
        const tokenInfo = tokenCheck.rows[0];
        if (tokenInfo.email_verified) {
          throw new Error('Email is already verified');
        } else if (!tokenInfo.is_valid) {
          throw new Error('Verification token has expired');
        }
      }
      throw new Error('Invalid or expired verification token');
    }
    
    const customer = customerResult.rows[0];
    
    // Mark email as verified
    await query(
      `UPDATE customers 
       SET email_verified = TRUE, 
           verification_token = NULL, 
           verification_token_expires = NULL,
           updated_at = NOW() 
       WHERE id = $1`,
      [customer.id]
    );
    
    console.log(`✅ Email verified for customer: ${customer.email}`);
    return { success: true, customer };
  } catch (error) {
    console.error('Error verifying email:', error);
    throw error;
  }
};

// Register a new customer
export const registerCustomer = async (customerData) => {
  try {
    const { email, password, first_name, last_name, phone, terms_accepted, privacy_policy_accepted } = customerData;
    
    // Check if customer already exists
    const existingCustomer = await query(
      'SELECT id FROM customers WHERE email = $1',
      [email]
    );

    if (existingCustomer.rows.length > 0) {
      throw new Error('Customer with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = generateVerificationToken();
    
    console.log('🔐 Generated verification token:', verificationToken);

    // Create customer with token expiry set via PostgreSQL NOW() + interval to avoid timezone issues
    const customerResult = await query(
      `INSERT INTO customers (
        email, password_hash, first_name, last_name, phone,
        terms_accepted, privacy_policy_accepted, email_verified,
        verification_token, verification_token_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '24 hours')
      RETURNING id, email, first_name, last_name, phone, created_at, verification_token_expires`,
      [email, passwordHash, first_name, last_name, phone, 
       terms_accepted, privacy_policy_accepted, false,
       verificationToken]
    );

    const customer = customerResult.rows[0];
    
    console.log(`📧 Token expires at: ${customer.verification_token_expires}`);
    console.log(`🕐 Current time (NOW): ${new Date().toISOString()}`);
    
    // Send verification email
    try {
      await sendVerificationEmail(customer, verificationToken);
      console.log(`✅ Customer registered: ${customer.email} - Verification email sent`);
    } catch (emailError) {
      console.error(`❌ Customer registered but email failed: ${customer.email}`);
      console.error('   Email error:', emailError.message);
      // Customer is still created, but email failed
      customer.emailSendFailed = true;
    }
    
    return customer;
  } catch (error) {
    console.error('Error registering customer:', error);
    throw error;
  }
};

// Login customer
export const loginCustomer = async (email, password, options = {}) => {
  try {
    const { requireVerifiedEmail = true } = options;

    // Get customer with password hash and email verification status
    const customerResult = await query(
      'SELECT id, email, password_hash, first_name, last_name, phone, status, email_verified FROM customers WHERE email = $1',
      [email]
    );

    if (customerResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const customer = customerResult.rows[0];

    if (customer.status !== 'active') {
      throw new Error('Account is not active');
    }

    // ✅ Check if email is verified
    if (requireVerifiedEmail && !customer.email_verified) {
      const err = new Error('Please verify your email address before logging in. Check your inbox for the verification email.');
      err.code = 'EMAIL_NOT_VERIFIED';
      throw err;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, customer.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await query(
      'UPDATE customers SET last_login = NOW(), login_count = login_count + 1, updated_at = NOW() WHERE id = $1',
      [customer.id]
    );

    console.log(`✅ Customer logged in: ${customer.email}`);

    // Return customer data without password hash
    const { password_hash, ...customerData } = customer;
    return customerData;
  } catch (error) {
    console.error('Error logging in customer:', error);
    throw error;
  }
};

// Create or get customer session
export const createOrGetCustomerSession = async (sessionData, customerId = null) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    ip_address,
    user_agent,
    access_type = 'qr_code',
    vehicle_id,
    dealer_id,
    qr_hash
  } = sessionData;

  try {
    let session;
    
    if (customerId) {
      // Customer is logged in, create session with customer_id
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newSessionResult = await query(
        `INSERT INTO customer_sessions (
          session_token, customer_id, customer_name, customer_email, customer_phone, 
          ip_address, user_agent, access_type, vehicle_id, dealer_id, qr_hash, is_authenticated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          sessionToken, customerId, customer_name, customer_email, customer_phone,
          ip_address, user_agent, access_type, vehicle_id, dealer_id, qr_hash, true
        ]
      );
      session = newSessionResult.rows[0];
    } else {
      // Check if session already exists for this QR hash
      let sessionResult;
      if (qr_hash) {
        sessionResult = await query(
          'SELECT * FROM customer_sessions WHERE qr_hash = $1 AND expires_at > NOW()',
          [qr_hash]
        );
      }

      if (sessionResult && sessionResult.rows.length > 0) {
        // Update existing session
        session = sessionResult.rows[0];
        await query(
          `UPDATE customer_sessions 
           SET customer_name = COALESCE($1, customer_name),
               customer_email = COALESCE($2, customer_email),
               customer_phone = COALESCE($3, customer_phone),
               last_activity = NOW(),
               updated_at = NOW()
           WHERE id = $4`,
          [customer_name, customer_email, customer_phone, session.id]
        );
      } else {
        // Create new session
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newSessionResult = await query(
          `INSERT INTO customer_sessions (
            session_token, customer_name, customer_email, customer_phone, ip_address, user_agent,
            access_type, vehicle_id, dealer_id, qr_hash, is_authenticated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            sessionToken, customer_name, customer_email, customer_phone, ip_address, user_agent,
            access_type, vehicle_id, dealer_id, qr_hash, false
          ]
        );
        session = newSessionResult.rows[0];
      }
    }

    // Log the interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, vehicle_id, dealer_id, interaction_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.id,
        customerId ? 'customer_login' : 'qr_scan',
        vehicle_id,
        dealer_id,
        JSON.stringify({ 
          qr_hash, 
          access_type, 
          customer_id: customerId,
          timestamp: new Date().toISOString() 
        })
      ]
    );

    return session;
  } catch (error) {
    console.error('Error creating customer session:', error);
    throw error;
  }
};

// Request password reset
export const requestPasswordReset = async (email) => {
  try {
    // Check if customer exists
    const customerResult = await query(
      'SELECT id, email, first_name, last_name FROM customers WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (customerResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    const customer = customerResult.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await query(
      `UPDATE customers 
       SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
       WHERE id = $3`,
      [resetToken, resetTokenExpires, customer.id]
    );

    // Send password reset email
    try {
      const daiveEmailService = await import('../lib/daiveEmailService.js');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const resetLink = `${frontendUrl}/#/reset-password?token=${resetToken}`;
      
      const subject = '🔐 Reset Your Password';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; font-weight: bold; }
            .link-text { color: #666; font-size: 12px; word-break: break-all; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Reset Your Password</h1>
              <p>Password reset request</p>
            </div>
            
            <p>Hi ${customer.first_name},</p>
            
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <p class="link-text">Or copy and paste this link in your browser:<br>${resetLink}</p>
            
            <div class="warning">
              <strong>⏰ Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            
            <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <div class="footer">
              <p>This email was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).</p>
              <p>Need help? Contact us at ${process.env.SMTP_USER || 'support@mitiesoft.com'}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const textContent = `
RESET YOUR PASSWORD

Hi ${customer.first_name},

We received a request to reset your password. Click the link below to create a new password:

${resetLink}

⏰ Important: This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

This email was sent by D.A.I.V.E. (Dealer AI Vehicle Expert).
Need help? Contact us at ${process.env.SMTP_USER || 'support@mitiesoft.com'}
      `;
      
      await daiveEmailService.default.transporter.sendMail({
        from: `D.A.I.V.E. <${process.env.SMTP_USER}>`,
        to: customer.email,
        subject: subject,
        text: textContent,
        html: htmlContent
      });
      
      console.log(`✅ Password reset email sent to ${customer.email}`);
    } catch (emailError) {
      console.error('❌ Error sending password reset email:', emailError);
      // Don't fail the request if email fails
    }

    return {
      message: 'If an account with that email exists, a password reset link has been sent.'
    };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
};

// Reset password with token
export const resetPassword = async (token, newPassword) => {
  try {
    // Find customer with valid reset token
    const customerResult = await query(
      `SELECT id, email, first_name, last_name 
       FROM customers 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW() 
       AND status = $2`,
      [token, 'active']
    );

    if (customerResult.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    const customer = customerResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await query(
      `UPDATE customers 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, customer.id]
    );

    return {
      message: 'Password has been reset successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name
      }
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

// Verify reset token
export const verifyResetToken = async (token) => {
  try {
    const customerResult = await query(
      `SELECT id, email, first_name, last_name 
       FROM customers 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW() 
       AND status = $2`,
      [token, 'active']
    );

    if (customerResult.rows.length === 0) {
      return { valid: false, message: 'Invalid or expired reset token' };
    }

    return {
      valid: true,
      customer: {
        id: customerResult.rows[0].id,
        email: customerResult.rows[0].email,
        first_name: customerResult.rows[0].first_name,
        last_name: customerResult.rows[0].last_name
      }
    };
  } catch (error) {
    console.error('Error verifying reset token:', error);
    throw error;
  }
};

// Update customer authentication status (legacy function - kept for compatibility)
export const updateCustomerAuth = async (sessionId, customerData) => {
  try {
    const { customer_name, customer_email, customer_phone } = customerData;
    
    await query(
      `UPDATE customer_sessions 
       SET customer_name = $1, customer_email = $2, customer_phone = $3,
           is_authenticated = true, updated_at = NOW()
       WHERE id = $4`,
      [customer_name, customer_email, customer_phone, sessionId]
    );

    // Log the authentication interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, interaction_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'authentication',
        JSON.stringify({ 
          customer_name, 
          customer_email, 
          customer_phone,
          timestamp: new Date().toISOString() 
        })
      ]
    );

    return true;
  } catch (error) {
    console.error('Error updating customer auth:', error);
    throw error;
  }
};
