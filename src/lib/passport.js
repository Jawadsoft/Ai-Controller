import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import FacebookStrategy from 'passport-facebook';
import GitHubStrategy from 'passport-github2';
import { query } from '../database/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy - DISABLED
// Uncomment and configure environment variables to re-enable
/*
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await query(
        'SELECT * FROM users WHERE google_id = $1 OR email = $2',
        [profile.id, profile.emails[0].value]
      );

      if (user.rows.length > 0) {
        // User exists, update google_id if not set
        if (!user.rows[0].google_id) {
          await query(
            'UPDATE users SET google_id = $1 WHERE id = $2',
            [profile.id, user.rows[0].id]
          );
        }
        return done(null, user.rows[0]);
      }

      // Create new user
      const newUser = await query(
        `INSERT INTO users (email, name, google_id, role, email_verified, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING *`,
        [
          profile.emails[0].value,
          profile.displayName,
          profile.id,
          'dealer', // Default role for social signup
          true // Email verified by Google
        ]
      );

      // Create default dealer profile
      await query(
        `INSERT INTO dealers (user_id, business_name, contact_email, status) 
         VALUES ($1, $2, $3, $4)`,
        [
          newUser.rows[0].id,
          profile.displayName + "'s Dealership",
          profile.emails[0].value,
          'active'
        ]
      );

      return done(null, newUser.rows[0]);
    } catch (error) {
      return done(error, null);
    }
  }));
  console.log('✅ Google OAuth strategy initialized');
} else {
  console.log('⚠️ Google OAuth not configured - skipping Google strategy');
}
*/
console.log('🚫 Google OAuth strategy disabled');

// Facebook OAuth Strategy - DISABLED
// Uncomment and configure environment variables to re-enable
/*
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'emails']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await query(
        'SELECT * FROM users WHERE facebook_id = $1 OR email = $2',
        [profile.id, profile.emails[0].value]
      );

      if (user.rows.length > 0) {
        // User exists, update facebook_id if not set
        if (!user.rows[0].facebook_id) {
          await query(
            'UPDATE users SET facebook_id = $1 WHERE id = $2',
            [profile.id, user.rows[0].id]
          );
        }
        return done(null, user.rows[0]);
      }

      // Create new user
      const newUser = await query(
        `INSERT INTO users (email, name, facebook_id, role, email_verified, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING *`,
        [
          profile.emails[0].value,
          profile.displayName,
          profile.id,
          'dealer', // Default role for social signup
          true // Email verified by Facebook
        ]
      );

      // Create default dealer profile
      await query(
        `INSERT INTO dealers (user_id, business_name, contact_email, status) 
         VALUES ($1, $2, $3, $4)`,
        [
          newUser.rows[0].id,
          profile.displayName + "'s Dealership",
          profile.emails[0].value,
          'active'
        ]
      );

      return done(null, newUser.rows[0]);
    } catch (error) {
      return done(error, null);
    }
  }));
  console.log('✅ Facebook OAuth strategy initialized');
} else {
  console.log('⚠️ Facebook OAuth not configured - skipping Facebook strategy');
}
*/
console.log('🚫 Facebook OAuth strategy disabled');

// GitHub OAuth Strategy - DISABLED
// Uncomment and configure environment variables to re-enable
/*
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/github/callback`,
    scope: ['user:email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await query(
        'SELECT * FROM users WHERE github_id = $1 OR email = $2',
        [profile.id, profile.emails[0].value]
      );

      if (user.rows.length > 0) {
        // User exists, update github_id if not set
        if (!user.rows[0].github_id) {
          await query(
            'UPDATE users SET github_id = $1 WHERE id = $2',
            [profile.id, user.rows[0].id]
          );
        }
        return done(null, user.rows[0]);
      }

      // Create new user
      const newUser = await query(
        `INSERT INTO users (email, name, github_id, role, email_verified, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING *`,
        [
          profile.emails[0].value,
          profile.displayName,
          profile.id,
          'dealer', // Default role for social signup
          true // Email verified by GitHub
        ]
      );

      // Create default dealer profile
      await query(
        `INSERT INTO dealers (user_id, business_name, contact_email, status) 
         VALUES ($1, $2, $3, $4)`,
        [
          newUser.rows[0].id,
          profile.displayName + "'s Dealership",
          profile.emails[0].value,
          'active'
        ]
      );

      return done(null, newUser.rows[0]);
    } catch (error) {
      return done(error, null);
    }
  }));
  console.log('✅ GitHub OAuth strategy initialized');
} else {
  console.log('⚠️ GitHub OAuth not configured - skipping GitHub strategy');
}
*/
console.log('🚫 GitHub OAuth strategy disabled');

export default passport; 