import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import {
  createCustomerSession,
  updateCustomerAuth,
  generateCustomerToken,
  verifyCustomerToken,
  registerCustomer,
  loginCustomer,
  createOrGetCustomerSession,
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
  generateVerificationToken,
  sendVerificationEmail,
  verifyEmailToken
} from '../middleware/customerAuth.js';

const router = express.Router();

// Prevent double-registration from double-clicks / duplicate requests
const recentRegistrations = new Map();
const REGISTRATION_COOLDOWN = 60000; // 60 seconds

// Register new customer
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').isLength({ min: 2, max: 255 }).withMessage('First name is required'),
  body('last_name').isLength({ min: 2, max: 255 }).withMessage('Last name is required'),
  body('phone').optional().isMobilePhone(),
  body('terms_accepted').isBoolean().withMessage('Terms acceptance is required'),
  body('privacy_policy_accepted').isBoolean().withMessage('Privacy policy acceptance is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, first_name, last_name, phone, terms_accepted, privacy_policy_accepted } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();

    if (recentRegistrations.has(normalizedEmail)) {
      const lastRegistration = recentRegistrations.get(normalizedEmail);
      const timeSince = now - lastRegistration;
      if (timeSince < REGISTRATION_COOLDOWN) {
        console.log(`⚠️ Duplicate registration attempt blocked for: ${normalizedEmail}`);
        return res.status(429).json({
          error: 'Registration already in progress. Please check your email for the verification link.',
          retryAfter: Math.ceil((REGISTRATION_COOLDOWN - timeSince) / 1000)
        });
      }
    }

    recentRegistrations.set(normalizedEmail, now);
    console.log(`📝 Processing registration for: ${normalizedEmail}`);

    // Register customer
    const customer = await registerCustomer({
      email: normalizedEmail,
      password,
      first_name,
      last_name,
      phone,
      terms_accepted,
      privacy_policy_accepted
    });

    setTimeout(() => {
      recentRegistrations.delete(normalizedEmail);
      console.log(`🗑️ Cleared registration lock for: ${normalizedEmail}`);
    }, REGISTRATION_COOLDOWN);

    res.json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      emailSent: true,
      requiresEmailVerification: true,
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        created_at: customer.created_at
      }
    });
  } catch (error) {
    console.error('Error registering customer:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Login customer
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Login customer
    const customer = await loginCustomer(email, password);

    res.json({
      message: 'Login successful',
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone
      }
    });
  } catch (error) {
    console.error('Error logging in customer:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

/**
 * Login customer and create a JWT session (for credit application link, etc.)
 * Same credentials as /login but returns session token for Authorization header.
 */
router.post('/login-session', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('dealer_id').optional().isUUID(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, dealer_id: dealerIdBody } = req.body;
    const ip_address = req.ip || req.connection?.remoteAddress;
    const user_agent = req.get('User-Agent');

    let customer;
    try {
      // Credit application links are sent directly to the customer's inbox, so the
      // email address is already trusted — skip the email-verified gate to avoid a
      // catch-22 where auto-registered customers can never access their application.
      customer = await loginCustomer(email, password, { requireVerifiedEmail: false });
    } catch (loginErr) {
      if (loginErr?.code === 'EMAIL_NOT_VERIFIED') {
        return res.status(403).json({
          error: loginErr.message,
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
      throw loginErr;
    }

    const session = await createOrGetCustomerSession(
      {
        customer_name: `${customer.first_name} ${customer.last_name}`,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        ip_address,
        user_agent,
        access_type: 'credit_application',
        vehicle_id: null,
        dealer_id: dealerIdBody || null,
        qr_hash: null,
      },
      customer.id
    );

    const token = generateCustomerToken(session.id, {
      customer_id: customer.id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email,
      customer_phone: customer.phone || '',
    });

    res.json({
      message: 'Login successful',
      session: {
        id: session.id,
        token,
        is_authenticated: session.is_authenticated,
        expires_at: session.expires_at,
      },
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      },
    });
  } catch (error) {
    console.error('Error in login-session:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// Logout customer
router.post('/logout', async (req, res) => {
  try {
    // For now, logout is handled client-side by clearing the token
    // You could also invalidate the session in the database if needed
    console.log('✅ Customer logged out');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error logging out customer:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Request password reset
    const result = await requestPasswordReset(email);

    res.json(result);
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ error: error.message || 'Failed to request password reset' });
  }
});

// Verify reset token
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    const result = await verifyResetToken(token);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      valid: true,
      customer: result.customer
    });
  } catch (error) {
    console.error('Error verifying reset token:', error);
    res.status(500).json({ error: error.message || 'Failed to verify reset token' });
  }
});

// Reset password with token
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // Reset password
    const result = await resetPassword(token, password);

    res.json(result);
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(400).json({ error: error.message || 'Failed to reset password' });
  }
});

// Debug endpoint - Check token status without consuming it
router.get('/check-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenCheck = await query(
      `SELECT 
        id, email, first_name, email_verified, 
        verification_token_expires, 
        NOW() as current_time,
        verification_token_expires > NOW() as is_valid,
        EXTRACT(EPOCH FROM (verification_token_expires - NOW())) / 3600 as hours_until_expiry
       FROM customers 
       WHERE verification_token = $1`,
      [token]
    );
    
    if (tokenCheck.rows.length === 0) {
      return res.json({
        found: false,
        message: 'Token not found in database'
      });
    }
    
    const info = tokenCheck.rows[0];
    res.json({
      found: true,
      email: info.email,
      email_verified: info.email_verified,
      token_expires: info.verification_token_expires,
      current_time: info.current_time,
      is_valid: info.is_valid,
      hours_until_expiry: parseFloat(info.hours_until_expiry).toFixed(2),
      status: info.email_verified ? 'Already verified' : 
              info.is_valid ? 'Valid - ready to verify' : 
              'Expired'
    });
  } catch (error) {
    console.error('Error checking token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify email address
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required',
        code: 'INVALID_TOKEN'
      });
    }
    
    const result = await verifyEmailToken(token);
    
    res.json({
      success: true,
      message: result.alreadyVerified
        ? 'Email is already verified. You can log in.'
        : 'Email verified successfully! You can now log in.',
      alreadyVerified: !!result.alreadyVerified,
      customer: {
        email: result.customer.email,
        first_name: result.customer.first_name
      }
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    const code = error.code || (
      String(error.message || '').toLowerCase().includes('expired')
        ? 'TOKEN_EXPIRED'
        : 'INVALID_TOKEN'
    );
    res.status(400).json({ 
      error: error.message || 'Failed to verify email',
      code,
      message: 'The verification link may be invalid or expired. Please request a new one.'
    });
  }
});

// Test email service endpoint (development only)
router.get('/test-email', async (req, res) => {
  try {
    console.log('🧪 Testing email service...');
    
    const daiveEmailService = await import('../lib/daiveEmailService.js');
    
    if (!daiveEmailService.default.transporter) {
      return res.json({
        status: 'error',
        message: 'Email transporter not initialized',
        configured: false
      });
    }
    
    // Verify SMTP connection
    await daiveEmailService.default.transporter.verify();
    
    res.json({
      status: 'success',
      message: 'Email service is configured and connection verified',
      configured: true,
      smtpConfig: {
        host: process.env.SMTP_HOST || 'Gmail',
        user: process.env.SMTP_USER || process.env.GMAIL_USER
      }
    });
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    res.json({
      status: 'error',
      message: 'Email service test failed',
      error: error.message,
      configured: false
    });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email } = req.body;
    
    // Find customer
    const customerResult = await query(
      'SELECT id, email, first_name, last_name, email_verified FROM customers WHERE email = $1',
      [email]
    );
    
    if (customerResult.rows.length === 0) {
      // Don't reveal if email exists or not (security)
      return res.json({ 
        success: true,
        message: 'If an account exists with this email, a verification email will be sent.' 
      });
    }
    
    const customer = customerResult.rows[0];
    
    if (customer.email_verified) {
      return res.json({ 
        success: true,
        message: 'Your email is already verified! You can log in now.',
        alreadyVerified: true
      });
    }
    
    // Generate new verification token
    const verificationToken = generateVerificationToken();
    
    console.log('🔐 Resending verification - Generated token:', verificationToken);
    
    // Update token in database with PostgreSQL NOW() + interval to avoid timezone issues
    const updateResult = await query(
      'UPDATE customers SET verification_token = $1, verification_token_expires = NOW() + INTERVAL \'24 hours\', updated_at = NOW() WHERE id = $2 RETURNING verification_token, verification_token_expires',
      [verificationToken, customer.id]
    );
    
    console.log('📧 Token saved to database');
    console.log('   Saved token:', updateResult.rows[0]?.verification_token);
    console.log('   Tokens match:', updateResult.rows[0]?.verification_token === verificationToken);
    console.log('   Expires at:', updateResult.rows[0]?.verification_token_expires);
    
    // Send verification email
    try {
      await sendVerificationEmail(customer, verificationToken);
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
      return res.status(500).json({ 
        error: 'Failed to send verification email',
        details: 'Email service error. Please contact support or try again later.'
      });
    }
    
    res.json({ 
      success: true,
      message: 'Verification email sent! Please check your inbox.' 
    });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ 
      error: 'Failed to resend verification email',
      details: error.message 
    });
  }
});

// Create customer session (for QR code access)
router.post('/session', [
  body('qr_hash').notEmpty().withMessage('QR hash is required'),
  body('customer_name').optional().isLength({ min: 2, max: 255 }),
  body('customer_email').optional().isEmail(),
  body('customer_phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { qr_hash, customer_name, customer_email, customer_phone } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.get('User-Agent');

    console.log('🔍 Creating customer session for QR hash:', qr_hash);

    // Get vehicle and dealer info from QR hash
    // The QR hash is used to find the vehicle by checking all vehicles and generating their hashes
    const allVehiclesResult = await query(
      `SELECT v.*, d.id as dealer_id, d.business_name, d.contact_name, d.email as dealer_email, d.phone as dealer_phone
       FROM vehicles v
       JOIN dealers d ON v.dealer_id = d.id`
    );

    let vehicle = null;
    
    // Find the vehicle that matches the QR hash
    console.log(`🔍 Checking ${allVehiclesResult.rows.length} vehicles for QR hash match`);
    
    for (const v of allVehiclesResult.rows) {
      // Import the hash generation function
      const { generateVehicleHash } = await import('../lib/qrCodeGenerator.js');
      const vehicleHash = generateVehicleHash(v.id, v.dealer_id, v.vin);
      
      console.log(`🔍 Vehicle ${v.id} (${v.make} ${v.model}): generated hash ${vehicleHash}, looking for ${qr_hash}`);
      
      if (vehicleHash === qr_hash) {
        vehicle = v;
        console.log('✅ Found matching vehicle:', v.id);
        break;
      }
    }

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found for this QR code' });
    }

    // Create customer session
    const session = await createOrGetCustomerSession({
      customer_name,
      customer_email,
      customer_phone,
      ip_address,
      user_agent,
      access_type: 'qr_code',
      vehicle_id: vehicle.id,
      dealer_id: vehicle.dealer_id,
      qr_hash
    });

    // Generate customer token
    const token = generateCustomerToken(session.id, {
      customer_name: session.customer_name,
      customer_email: session.customer_email,
      customer_phone: session.customer_phone
    });

    res.json({
      message: 'Customer session created',
      session: {
        id: session.id,
        token,
        is_authenticated: session.is_authenticated,
        expires_at: session.expires_at
      },
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price
      },
      dealer: {
        id: vehicle.dealer_id,
        business_name: vehicle.business_name,
        contact_name: vehicle.contact_name
      }
    });
  } catch (error) {
    console.error('❌ Error creating customer session:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to create customer session' });
  }
});

// Create session with customer login
router.post('/session-with-login', [
  body('qr_hash').notEmpty().withMessage('QR hash is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { qr_hash, email, password } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.get('User-Agent');

    console.log('🔍 Creating session with login for QR hash:', qr_hash, 'email:', email);

    // Get vehicle and dealer info from QR hash
    const allVehiclesResult = await query(
      `SELECT v.*, d.id as dealer_id, d.business_name, d.contact_name, d.email as dealer_email, d.phone as dealer_phone
       FROM vehicles v
       JOIN dealers d ON v.dealer_id = d.id`
    );

    let vehicle = null;
    
    // Find the vehicle that matches the QR hash
    console.log(`🔍 Checking ${allVehiclesResult.rows.length} vehicles for QR hash match`);
    
    for (const v of allVehiclesResult.rows) {
      const { generateVehicleHash } = await import('../lib/qrCodeGenerator.js');
      const vehicleHash = generateVehicleHash(v.id, v.dealer_id, v.vin);
      
      if (vehicleHash === qr_hash) {
        vehicle = v;
        console.log('✅ Found matching vehicle:', v.id);
        break;
      }
    }

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found for this QR code' });
    }

    // Login customer
    const customer = await loginCustomer(email, password);

    // Create customer session with customer_id
    const session = await createOrGetCustomerSession({
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email,
      customer_phone: customer.phone,
      ip_address,
      user_agent,
      access_type: 'qr_code',
      vehicle_id: vehicle.id,
      dealer_id: vehicle.dealer_id,
      qr_hash
    }, customer.id);

    // Generate customer token
    const token = generateCustomerToken(session.id, {
      customer_id: customer.id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email,
      customer_phone: customer.phone
    });

    res.json({
      message: 'Customer session created with login',
      session: {
        id: session.id,
        token,
        is_authenticated: session.is_authenticated,
        expires_at: session.expires_at
      },
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone
      },
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price
      },
      dealer: {
        id: vehicle.dealer_id,
        business_name: vehicle.business_name,
        contact_name: vehicle.contact_name
      }
    });
  } catch (error) {
    console.error('❌ Error creating session with login:', error);
    if (error?.code === 'EMAIL_NOT_VERIFIED') {
      // Never rotate the verification token here. Registration already emailed
      // a token; regenerating would invalidate that link and break verification.
      let emailResent = false;
      try {
        const customerResult = await query(
          `SELECT id, email, first_name, last_name, email_verified,
                  verification_token, verification_token_expires,
                  verification_token IS NOT NULL
                    AND verification_token_expires > NOW() AS has_valid_token
           FROM customers WHERE email = $1`,
          [req.body.email]
        );

        if (customerResult.rows.length > 0) {
          const customer = customerResult.rows[0];

          if (!customer.email_verified) {
            if (customer.has_valid_token && customer.verification_token) {
              // Keep the original token so the registration email link still works.
              console.log('♻️ Valid verification token already exists — not rotating, not re-sending');
            } else {
              const verificationToken = generateVerificationToken();
              await query(
                'UPDATE customers SET verification_token = $1, verification_token_expires = NOW() + INTERVAL \'24 hours\', updated_at = NOW() WHERE id = $2',
                [verificationToken, customer.id]
              );
              await sendVerificationEmail(customer, verificationToken);
              emailResent = true;
              console.log('🔐 Issued verification token (previous missing/expired) and sent email');
            }
          }
        }
      } catch (resendError) {
        console.error('❌ Failed to ensure verification email during QR login:', resendError);
      }

      return res.status(403).json({
        error: error.message,
        code: 'EMAIL_NOT_VERIFIED',
        message: emailResent
          ? 'Please verify your email address before logging in. A new verification email has been sent.'
          : 'Please verify your email address before logging in. Check your inbox for the verification link.',
        next: 'verify_email_then_retry_login',
        emailResent
      });
    }

    res.status(500).json({ error: error.message || 'Failed to create session with login' });
  }
});

// Quick login/signup for customers
router.post('/quick-auth', [
  body('session_id').isUUID().withMessage('Valid session ID is required'),
  body('customer_name').isLength({ min: 2, max: 255 }).withMessage('Name is required'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { session_id, customer_name, customer_email, customer_phone } = req.body;

    // Verify session exists and is valid
    const sessionResult = await query(
      'SELECT * FROM customer_sessions WHERE id = $1 AND expires_at > NOW()',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const session = sessionResult.rows[0];

    // Update customer authentication
    await updateCustomerAuth(session_id, {
      customer_name,
      customer_email,
      customer_phone
    });

    // Generate new token with customer data
    const token = generateCustomerToken(session_id, {
      customer_name,
      customer_email,
      customer_phone
    });

    res.json({
      message: 'Customer authenticated successfully',
      session: {
        id: session_id,
        token,
        is_authenticated: true,
        expires_at: session.expires_at
      },
      customer: {
        name: customer_name,
        email: customer_email,
        phone: customer_phone
      }
    });
  } catch (error) {
    console.error('Error in quick auth:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Create customer session for dealer QR codes with authentication
router.post('/dealer-session', [
  body('dealer_id').notEmpty().withMessage('Dealer ID is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('first_name').optional().isLength({ min: 2, max: 255 }),
  body('last_name').optional().isLength({ min: 2, max: 255 }),
  body('phone').optional().isMobilePhone(),
  body('is_registration').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dealer_id, email, password, first_name, last_name, phone, is_registration } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.get('User-Agent');

    console.log('🔍 Creating customer session for dealer:', dealer_id, 'email:', email, 'is_registration:', is_registration);

    // Get dealer info
    const dealerResult = await query(
      'SELECT * FROM dealers WHERE id = $1',
      [dealer_id]
    );

    if (dealerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    const dealer = dealerResult.rows[0];

    let customer;
    
    if (is_registration) {
      // Register new customer
      if (!first_name || !last_name) {
        return res.status(400).json({ error: 'First name and last name are required for registration' });
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      const now = Date.now();
      
      // Check for duplicate registration (use same cache as /register)
      if (recentRegistrations.has(normalizedEmail)) {
        const lastRegistration = recentRegistrations.get(normalizedEmail);
        const timeSince = now - lastRegistration;
        
        if (timeSince < REGISTRATION_COOLDOWN) {
          console.log(`⚠️ Duplicate dealer-session registration blocked for: ${normalizedEmail}`);
          return res.status(429).json({ 
            error: 'Registration already in progress. Please wait.',
            retryAfter: Math.ceil((REGISTRATION_COOLDOWN - timeSince) / 1000)
          });
        }
      }
      
      recentRegistrations.set(normalizedEmail, now);
      console.log(`📝 Processing dealer-session registration for: ${normalizedEmail}`);
      
      customer = await registerCustomer({
        email: normalizedEmail,
        password,
        first_name,
        last_name,
        phone,
        terms_accepted: true, // Assume accepted for QR code access
        privacy_policy_accepted: true
      });
      
      // Clear lock after success
      setTimeout(() => {
        recentRegistrations.delete(normalizedEmail);
      }, REGISTRATION_COOLDOWN);
    } else {
      // Login existing customer
      customer = await loginCustomer(email, password);
    }

    // Create customer session
    const session = await createOrGetCustomerSession({
      qr_hash: dealer_id, // Use dealer ID as hash for dealer sessions
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email,
      customer_phone: customer.phone,
      ip_address,
      user_agent,
      vehicle_id: null, // No vehicle for dealer sessions
      dealer_id: dealer.id
    });

    // Generate token
    const token = generateCustomerToken(session.id, {
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_email: customer.email,
      customer_phone: customer.phone
    });

    res.json({
      message: is_registration ? 'Customer registered and session created successfully' : 'Customer logged in and session created successfully',
      session: {
        id: session.id,
        token,
        is_authenticated: true,
        expires_at: session.expires_at
      },
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone
      },
      dealer: {
        id: dealer.id,
        business_name: dealer.business_name,
        contact_name: dealer.contact_name
      }
    });
  } catch (error) {
    console.error('Error creating dealer customer session:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

// Get customer session info
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionResult = await query(
      `SELECT cs.*, v.make, v.model, v.year, v.price, v.images,
              d.business_name, d.contact_name, d.email as dealer_email, d.phone as dealer_phone
       FROM customer_sessions cs
       LEFT JOIN vehicles v ON cs.vehicle_id = v.id
       LEFT JOIN dealers d ON cs.dealer_id = d.id
       WHERE cs.id = $1 AND cs.expires_at > NOW()`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const session = sessionResult.rows[0];

    res.json({
      session: {
        id: session.id,
        is_authenticated: session.is_authenticated,
        expires_at: session.expires_at,
        created_at: session.created_at
      },
      vehicle: session.vehicle_id ? {
        id: session.vehicle_id,
        make: session.make,
        model: session.model,
        year: session.year,
        price: session.price,
        images: session.images
      } : null,
      dealer: session.dealer_id ? {
        id: session.dealer_id,
        business_name: session.business_name,
        contact_name: session.contact_name,
        email: session.dealer_email,
        phone: session.dealer_phone
      } : null
    });
  } catch (error) {
    console.error('Error getting session info:', error);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

// Create customer lead
router.post('/lead', [
  body('session_id').isUUID().withMessage('Valid session ID is required'),
  body('customer_name').isLength({ min: 2, max: 255 }).withMessage('Name is required'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_phone').optional().isMobilePhone(),
  body('message').optional().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { session_id, customer_name, customer_email, customer_phone, message } = req.body;

    // Get session info
    const sessionResult = await query(
      'SELECT * FROM customer_sessions WHERE id = $1 AND expires_at > NOW()',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const session = sessionResult.rows[0];

    // Create customer lead
    const leadResult = await query(
      `INSERT INTO customer_leads (
        session_id, customer_name, customer_email, customer_phone,
        vehicle_id, dealer_id, lead_source, message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        session_id, customer_name, customer_email, customer_phone,
        session.vehicle_id, session.dealer_id, 'qr_code', message
      ]
    );

    const lead = leadResult.rows[0];

    // Log the lead creation interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, vehicle_id, dealer_id, interaction_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session_id,
        'lead_created',
        session.vehicle_id,
        session.dealer_id,
        JSON.stringify({ 
          lead_id: lead.id,
          message,
          timestamp: new Date().toISOString() 
        })
      ]
    );

    res.json({
      message: 'Lead created successfully',
      lead: {
        id: lead.id,
        status: lead.status,
        created_at: lead.created_at
      }
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Log customer interaction
router.post('/interaction', [
  body('session_id').isUUID().withMessage('Valid session ID is required'),
  body('interaction_type').isIn(['page_view', 'chat_start', 'contact_request', 'qr_scan', 'authentication', 'lead_created']),
  body('interaction_data').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { session_id, interaction_type, interaction_data = {} } = req.body;

    // Verify session exists
    const sessionResult = await query(
      'SELECT vehicle_id, dealer_id FROM customer_sessions WHERE id = $1 AND expires_at > NOW()',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const session = sessionResult.rows[0];

    // Log interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, vehicle_id, dealer_id, interaction_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session_id,
        interaction_type,
        session.vehicle_id,
        session.dealer_id,
        JSON.stringify(interaction_data)
      ]
    );

    res.json({ message: 'Interaction logged successfully' });
  } catch (error) {
    console.error('Error logging interaction:', error);
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

export default router;
