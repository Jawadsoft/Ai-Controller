import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import passport from 'passport';
import session from 'express-session';

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'SNZQ6TUR3RTK2G72AC';
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return jwt.sign({ userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('businessName').notEmpty().trim(),
  body('contactName').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, businessName, contactName } = req.body;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Start transaction
    await query('BEGIN');

    try {
      // Create user
      const userResult = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash]
      );
      const userId = userResult.rows[0].id;

      // Create user role
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, 'dealer']
      );

      // Create dealer profile with default values
      await query(
        `INSERT INTO dealers (
          user_id, 
          business_name, 
          contact_name, 
          email, 
          subscription_plan, 
          subscription_status,
          phone,
          address,
          city,
          state,
          zip_code,
          description,
          established_year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          userId, 
          businessName, 
          contactName, 
          email, 
          'basic', 
          'active',
          '', // phone - empty by default
          '', // address - empty by default
          '', // city - empty by default
          '', // state - empty by default
          '', // zip_code - empty by default
          'Welcome to ' + businessName + '! Please update your profile with your business details.', // description
          new Date().getFullYear() // established_year - current year
        ]
      );

      await query('COMMIT');

      // Generate token
      const token = generateToken(userId);

      // Get the created dealer profile
      const dealerResult = await query(
        'SELECT id, business_name, contact_name FROM dealers WHERE user_id = $1',
        [userId]
      );

      res.status(201).json({
        message: 'User and dealer profile created successfully',
        token,
        user: { 
          id: userId, 
          email, 
          role: 'dealer',
          dealerProfile: dealerResult.rows[0]
        }
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user - Updated for multi-user support
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Enhanced query to get user with staff and dealer information
    // Fetch actual permissions from staff_permissions table
    const userResult = await query(
      `SELECT 
        u.id, 
        u.email, 
        u.name,
        u.password_hash, 
        ur.role, 
        COALESCE(d_staff.id, d_owner.id) AS dealer_id,
        COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
        COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
        COALESCE(d_staff.marbalism_ai_enabled, d_owner.marbalism_ai_enabled, false) AS marbalism_ai_enabled,
        ds.id as staff_id,
        ds.staff_role,
        ds.is_active as staff_active,
        COALESCE(
          (SELECT ARRAY_AGG(sp.permission_name)
           FROM staff_permissions sp
           WHERE sp.staff_id = ds.id 
           AND sp.permission_value = true),
          ARRAY[]::TEXT[]
        ) as staff_permissions
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       LEFT JOIN dealership_staff ds ON u.id = ds.user_id
       LEFT JOIN dealers d_staff ON ds.dealer_id = d_staff.id
       LEFT JOIN dealers d_owner ON d_owner.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if password_hash exists
    if (!user.password_hash) {
      console.error('Login error: User has no password_hash');
      return res.status(500).json({ error: 'User account configuration error' });
    }

    // Check password
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } catch (bcryptError) {
      console.error('Login error: bcrypt comparison failed', bcryptError);
      return res.status(500).json({ error: 'Password verification failed' });
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if staff member is active
    if (user.staff_id && !user.staff_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    try {
      await query(
        `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
    } catch (loginStampErr) {
      console.warn('Could not update last_login_at (column may be missing until migration runs):', loginStampErr?.message || loginStampErr);
    }

    // Generate token
    let token;
    try {
      token = generateToken(user.id);
    } catch (tokenError) {
      console.error('Login error: Token generation failed', tokenError);
      return res.status(500).json({ error: 'Token generation failed' });
    }

    // Handle permissions array (ensure it's properly formatted)
    let staffPermissions = [];
    if (user.staff_permissions) {
      try {
        // If it's already an array, use it; if it's a string, parse it
        staffPermissions = Array.isArray(user.staff_permissions) 
          ? user.staff_permissions 
          : (typeof user.staff_permissions === 'string' ? JSON.parse(user.staff_permissions) : []);
      } catch (parseError) {
        console.warn('Warning: Could not parse staff_permissions, using empty array', parseError);
        staffPermissions = [];
      }
    }

    try {
      res.json({
        message: 'Login successful',
        token,
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name || null,
          role: user.role || null,
          staffRole: user.staff_role || null,
          staffId: user.staff_id || null,
          staffPermissions: staffPermissions,
          dealerProfile: user.dealer_id ? {
            id: user.dealer_id,
            businessName: user.business_name || null,
            contactName: user.contact_name || null,
            marbalism_ai_enabled: user.marbalism_ai_enabled || false
          } : null
        }
      });
    } catch (responseError) {
      console.error('Login error: Response formatting failed', responseError);
      return res.status(500).json({ error: 'Response formatting failed' });
    }
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user - Updated for multi-user support
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await query(
      `SELECT 
        u.id, 
        u.email, 
        u.name,
        ur.role, 
        COALESCE(d_staff.id, d_owner.id) AS dealer_id,
        COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
        COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
        COALESCE(d_staff.marbalism_ai_enabled, d_owner.marbalism_ai_enabled, false) AS marbalism_ai_enabled,
        ds.id as staff_id,
        ds.staff_role,
        ds.is_active as staff_active,
        COALESCE(
          (SELECT ARRAY_AGG(sp.permission_name)
           FROM staff_permissions sp
           WHERE sp.staff_id = ds.id 
           AND sp.permission_value = true),
          ARRAY[]::TEXT[]
        ) as staff_permissions
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       LEFT JOIN dealership_staff ds ON u.id = ds.user_id
       LEFT JOIN dealers d_staff ON ds.dealer_id = d_staff.id
       LEFT JOIN dealers d_owner ON d_owner.user_id = u.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        role: user.role,
        staffRole: user.staff_role,
        staffId: user.staff_id || null,
        staffPermissions: user.staff_permissions || [],
        dealerProfile: user.dealer_id ? {
          id: user.dealer_id,
          businessName: user.business_name,
          contactName: user.contact_name,
          marbalism_ai_enabled: user.marbalism_ai_enabled || false
        } : null
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Social Authentication Routes - DISABLED
// Uncomment and configure environment variables to re-enable social login

/*
// Google OAuth routes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth?error=google_auth_failed' }),
    (req, res) => {
      // Generate JWT token for the authenticated user
      const token = generateToken(req.user.id);
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth?token=${token}&provider=google`);
    }
  );
}

// Facebook OAuth routes
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

  router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth?error=facebook_auth_failed' }),
    (req, res) => {
      // Generate JWT token for the authenticated user
      const token = generateToken(req.user.id);
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth?token=${token}&provider=facebook`);
    }
  );
}

// GitHub OAuth routes
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

  router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/auth?error=github_auth_failed' }),
    (req, res) => {
      // Generate JWT token for the authenticated user
      const token = generateToken(req.user.id);
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth?token=${token}&provider=github`);
    }
  );
}

// Get available social providers
router.get('/providers', (req, res) => {
  const providers = {
    google: {
      name: 'Google',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      url: '/api/auth/google'
    },
    facebook: {
      name: 'Facebook',
      enabled: !!process.env.FACEBOOK_APP_ID,
      url: '/api/auth/facebook'
    },
    github: {
      name: 'GitHub',
      enabled: !!process.env.GITHUB_CLIENT_ID,
      url: '/api/auth/github'
    }
  };
  
  res.json({ providers });
});
*/

// Verify email address
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with this verification token
    const userResult = await query(
      `SELECT id, email, verification_token_expires, email_verified 
       FROM users 
       WHERE verification_token = $1`,
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid verification token',
        code: 'INVALID_TOKEN'
      });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.status(200).json({ 
        message: 'Email already verified. You can now login.',
        alreadyVerified: true
      });
    }

    // Check if token has expired
    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({ 
        error: 'Verification token has expired. Please request a new verification email.',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Update user as verified
    await query(
      `UPDATE users 
       SET email_verified = true, 
           verification_token = NULL, 
           verification_token_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    console.log(`✅ Email verified successfully for: ${user.email}`);

    res.json({ 
      success: true,
      message: 'Email verified successfully! You can now login with your credentials.',
      email: user.email
    });

  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Find user
    const userResult = await query(
      `SELECT u.id, u.email, u.email_verified, u.name, d.business_name
       FROM users u
       LEFT JOIN dealers d ON u.id = d.user_id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not
      return res.json({ 
        message: 'If an account exists with this email, a verification link has been sent.'
      });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.json({ 
        message: 'Email is already verified. You can login.'
      });
    }

    // Generate new verification token
    const crypto = await import('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update token in database
    await query(
      `UPDATE users 
       SET verification_token = $1, 
           verification_token_expires = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [verificationToken, tokenExpiry, user.id]
    );

    // Import emailService dynamically
    const emailService = (await import('../lib/emailService.js')).default;

    // Send verification email
    await emailService.sendVerificationEmail(
      email,
      verificationToken,
      user.business_name || user.name || 'DealerIQ User'
    );

    console.log(`📧 Verification email resent to: ${email}`);

    res.json({ 
      success: true,
      message: 'Verification email sent. Please check your inbox.'
    });

  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

export default router;