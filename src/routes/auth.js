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
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
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

// Login user
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

    // Get user with role and dealer profile
    const userResult = await query(
      `SELECT u.id, u.email, u.password_hash, ur.role, d.id as dealer_id, d.business_name, d.contact_name 
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       LEFT JOIN dealers d ON u.id = d.user_id 
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        dealerProfile: user.dealer_id ? {
          id: user.dealer_id,
          businessName: user.business_name,
          contactName: user.contact_name
        } : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await query(
      `SELECT u.id, u.email, ur.role, d.id as dealer_id, d.business_name, d.contact_name 
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       LEFT JOIN dealers d ON u.id = d.user_id 
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
        role: user.role,
        dealerProfile: user.dealer_id ? {
          id: user.dealer_id,
          businessName: user.business_name,
          contactName: user.contact_name
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

export default router;