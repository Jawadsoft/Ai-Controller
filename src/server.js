import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
// import session from 'express-session'; // Disabled - only needed for OAuth
// import passport from './lib/passport.js'; // Disabled - only needed for OAuth

import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import publicVehicleRoutes from './routes/publicVehicles.js';
import dealerRoutes from './routes/dealers.js';
import publicDealerRoutes from './routes/publicDealers.js';
import publicStaffRoutes from './routes/publicStaff.js';
import leadRoutes from './routes/leads.js';
import followUpRoutes from './routes/followUps.js';
import adminRoutes from './routes/admin.js';
import superAdminRoutes from './routes/super-admin.js';
import daiveRoutes from './routes/daive.js';
import etlRoutes from './routes/etl.js';
import importRoutes from './routes/import.js';
import healthRoutes from './routes/health.js';
import databaseAdminRoutes from './routes/database-admin.js';
import customerAuthRoutes from './routes/customerAuth.js';
import customerFinanceRoutes from './routes/customerFinance.js';
import staffRoutes from './routes/staff.js';
import crewaiAgentRoutes from './routes/crewai-agents.js';
import carfaxRoutes from './routes/carfax.js';
import financeRoutes from './routes/finance.js';
import lendersRoutes from './routes/lenders.js';
import signaturesRoutes from './routes/signatures.js';
import notificationRoutes from './routes/notifications.js';
import customersRoutes from './routes/customers.js';
import rebatesRoutes from './routes/rebates.js';
import followupSettingsRoutes from './routes/followupSettings.js';
import websiteScrapingRoutes from './routes/websiteScraping.js';

import optimizedAIBotRoutes from './routes/optimizedAIBot.js';
import marbalismRoutes from './routes/marbalism.js';
import { authenticateToken } from './middleware/auth.js';
import { authenticateFlexible } from './middleware/flexibleAuth.js';
import { initializeWebSocket } from './lib/websocket.js';
import marketingScheduler from './lib/marketingScheduler.js';
import followupAutomation from './lib/followupAutomation.js';
import importScheduler from './lib/importScheduler.js';
import auditLogger from './lib/auditLogger.js';
import { attachTenantContext } from './middleware/tenantIsolation.js';
import { pool } from './database/connection.js';

import path from 'path';
import fs from 'fs';

dotenv.config();

// Auto-ensure the notifications table exists (creates it if the migration was never run)
async function ensureNotificationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        dealer_id UUID,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_dealer_id ON notifications(dealer_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`);
    console.log('✅ Notifications table ready');
  } catch (error) {
    console.error('⚠️ Could not ensure notifications table:', error.message);
  }
}

// Auto-ensure last_login_at column exists on the users table
async function ensureLastLoginColumn() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at)`);
    console.log('✅ users.last_login_at column ready');
  } catch (error) {
    console.error('⚠️ Could not ensure last_login_at column:', error.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Ensure required directories exist on server startup
const requiredDirs = [
  'uploads/daive-audio',
  'uploads/daive-audio/greeting',
  'uploads/daive-audio/response',
  'uploads/vehicle-photos',
  'uploads/vehicle-images',
  'uploads/etl-documents',
  'uploads/deal-sheets',          // ✅ Add this
  'uploads/credit-applications',  // ✅ Add this
  'uploads/qr-codes', 
  'uploads/carfax',           // ✅ Add this
  'uploads/staff-photos',
  'uploads/temp'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        process.env.BACKEND_URL || "http://localhost:3000",
        "http://192.168.0.103:3000",
        "ws://192.168.0.103:3000"
      ],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'", "http://localhost:8080", "http://localhost:5173", "https://app.dealeriq.co"],
    },
  },
}));
// CORS configuration moved to after body parsing middleware for better compatibility

// Session configuration for OAuth - DISABLED
// Uncomment to re-enable social authentication
/*
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
*/

// Rate limiting - more lenient for development
const isDevelopment = process.env.NODE_ENV === 'development';

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 1000, // Very high limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60 / 1000) // 15 minutes in seconds
  }
});

// More lenient rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 50, // Higher limit for development
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: Math.ceil(15 * 60 / 1000) // 15 minutes in seconds
  }
});

// Apply general rate limiting to all routes (skip in development if needed)
if (!isDevelopment) {
  app.use(generalLimiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced Global CORS configuration for comprehensive cross-origin support
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, or same-origin)
    if (!origin) {
      console.log('🌐 CORS - Request with no origin (same-origin or direct) - allowing');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      // Production URLs
      'https://app.dealeriq.co',
      'https://vehicle-management-backend-ypsa.onrender.com',
      // Development URLs
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server default
      'http://localhost:4173', // Vite preview server
      'https://localhost:8080',
      'https://localhost:3000',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      // Environment variables
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL_ALT,
      process.env.BACKEND_URL,
      process.env.CORS_ORIGIN,
      process.env.RENDER_EXTERNAL_URL,
      process.env.LOCAL_NETWORK_URL,  // e.g. https://192.168.1.20:8080 for HTTPS device testing
    ].filter(Boolean);
    
    console.log('🌐 CORS Request - Origin:', origin);
    console.log('🌐 CORS Allowed Origins:', allowedOrigins.slice(0, 5), '...'); // Log first 5 to avoid clutter
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS Origin blocked:', origin);
      
      // In development mode, be more permissive for localhost and local network IPs
      if (process.env.NODE_ENV === 'development') {
        if (
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.includes('0.0.0.0') ||
          origin.match(/^https?:\/\/192\.168\.\d+\.\d+/) ||
          origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/) ||
          origin.match(/^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/)
        ) {
          console.log('🔧 Development mode - allowing local network origin:', origin);
          return callback(null, true);
        }
      }
      
      // Log detailed info for debugging
      console.log('🔍 Blocked origin details:', {
        origin,
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV
      });
      callback(new Error(`CORS policy blocked origin: ${origin}`));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: [
    'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE'
  ],
  allowedHeaders: [
    // Standard headers
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Origin', 
    'Accept',
    'Accept-Language',
    'Accept-Encoding',
    // Range requests for audio/video
    'Range',
    'If-Range',
    // Cache control
    'Cache-Control',
    'Pragma',
    'Expires',
    // Custom headers
    'X-API-Key',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'X-Real-IP',
    'X-Forwarded-Proto',
    // CORS preflight headers
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Total-Count',
    'Content-Length',
    'Accept-Ranges',
    'Content-Disposition',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials'
  ],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Enhanced global OPTIONS handler for preflight requests
app.options('*', (req, res) => {
  console.log('🔄 Preflight OPTIONS request for:', req.path);
  console.log('🔄 Request origin:', req.headers.origin);
  console.log('🔄 Request method:', req.headers['access-control-request-method']);
  console.log('🔄 Request headers:', req.headers['access-control-request-headers']);
  
  // Set comprehensive CORS headers for preflight
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.CORS_ORIGIN
  ].filter(Boolean);
  
  const isLocalNetwork = origin && (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.match(/^https?:\/\/192\.168\.\d+\.\d+/) ||
    origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/) ||
    origin.match(/^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/)
  );

  if (origin && (allowedOrigins.includes(origin) || isLocalNetwork)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH, TRACE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, Range, Cache-Control, X-API-Key, X-CSRF-Token');
  res.header('Access-Control-Max-Age', '86400');
  
  console.log('✅ Preflight response sent for:', req.path);
  res.status(200).send();
});

// Additional CORS middleware for edge cases
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Ensure CORS headers are set on all responses
  if (origin) {
    const allowedOrigins = [
      'https://app.dealeriq.co',
      'https://vehicle-management-backend-ypsa.onrender.com',
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      process.env.FRONTEND_URL,
      process.env.BACKEND_URL,
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    const isLocalNetwork = (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.match(/^https?:\/\/192\.168\.\d+\.\d+/) ||
      origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/) ||
      origin.match(/^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/)
    );

    if (allowedOrigins.includes(origin) || isLocalNetwork || process.env.NODE_ENV === 'development') {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  // Set Vary header for proper caching
  res.header('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  
  next();
});

// Static files for uploads with dynamic CORS
app.use('/uploads', (req, res, next) => {
  // Dynamic CORS origin based on request
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000'
  ];
  
  const isLocalNetwork = origin && (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.match(/^https?:\/\/192\.168\.\d+\.\d+/) ||
    origin.match(/^https?:\/\/10\.\d+\.\d+\.\d+/) ||
    origin.match(/^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/)
  );

  if (origin && (allowedOrigins.includes(origin) || isLocalNetwork)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', 'https://app.dealeriq.co');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Accept-Ranges', 'bytes');
  // Allow frontend (different port/origin) to embed uploaded images
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Set proper headers for audio files
  if (req.path.endsWith('.mp3')) {
    res.header('Content-Type', 'audio/mpeg');
  } else if (req.path.endsWith('.wav')) {
    res.header('Content-Type', 'audio/wav');
  }
  
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Handle preflight OPTIONS requests for audio files
app.options('/uploads/daive-audio/:filename', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.status(200).send();
});

// Enhanced CORS middleware specifically for audio file routes
app.use('/uploads/daive-audio', (req, res, next) => {
  const origin = req.headers.origin;
  
  // Define allowed origins for audio file operations (same as import.js)
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
    'http://localhost:4173', // Vite preview
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.CORS_ORIGIN,
    process.env.RENDER_EXTERNAL_URL
  ].filter(Boolean);
  
  console.log('🌐 Audio Route CORS - Origin:', origin);
  
  // Set CORS headers for audio routes (same logic as import.js)
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log('✅ Audio CORS - Origin allowed:', origin);
  } else if (!origin) {
    // Allow requests with no origin (same-origin, Postman, curl, etc.)
    res.header('Access-Control-Allow-Origin', '*');
    console.log('✅ Audio CORS - No origin, allowing all');
  } else if (process.env.NODE_ENV === 'development') {
    // In development, be more permissive for localhost variations
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0')) {
      res.header('Access-Control-Allow-Origin', origin);
      console.log('🔧 Audio CORS - Development localhost allowed:', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
      console.log('🔧 Audio CORS - Development wildcard for:', origin);
    }
  } else {
    console.log('❌ Audio CORS - Origin blocked:', origin);
    // In production, still allow for debugging purposes but log it
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  // Set comprehensive CORS headers for audio operations (same as import.js)
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
  res.header('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization', 
    'X-Requested-With',
    'Origin',
    'Accept',
    'Range',
    'Cache-Control',
    'X-API-Key',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'X-Real-IP',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ].join(', '));
  res.header('Access-Control-Expose-Headers', [
    'Content-Range',
    'X-Total-Count',
    'Content-Length',
    'Content-Disposition',
    'Accept-Ranges'
  ].join(', '));
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Audio CORS - Preflight request handled');
    return res.status(200).end();
  }
  
  next();
});

// Specific route for audio files with enhanced CORS
app.get('/uploads/daive-audio/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(process.cwd(), 'uploads', 'daive-audio', filename);
  
  console.log('🎵 Serving audio file:', filename);
  console.log('🔍 Full file path:', filePath);
  console.log('🔍 Working directory:', process.cwd());
  console.log('🔍 Request origin:', req.headers.origin);
  console.log('🔍 __dirname:', __dirname);
  
  // Try alternative path resolution if needed
  const alternativePath = path.join(__dirname, '../uploads/daive-audio', filename);
  console.log('🔍 Alternative path:', alternativePath);
  
  // Set additional headers for file serving
  res.header('Accept-Ranges', 'bytes');
  res.header('Cache-Control', 'public, max-age=3600'); // Allow caching for 1 hour
  res.header('Vary', 'Origin');
  
  if (filename.endsWith('.mp3')) {
    res.header('Content-Type', 'audio/mpeg');
  } else if (filename.endsWith('.wav')) {
    res.header('Content-Type', 'audio/wav');
  }
  
  // Check if file exists with detailed logging
  const fs = require('fs');
  let actualFilePath = filePath;
  
  if (!fs.existsSync(filePath)) {
    console.log('⚠️ Primary path not found, trying alternative path...');
    
    if (fs.existsSync(alternativePath)) {
      console.log('✅ Found file at alternative path');
      actualFilePath = alternativePath;
    } else {
      console.error('❌ Audio file not found at either path:');
      console.error('  Primary:', filePath);
      console.error('  Alternative:', alternativePath);
      
      // Try to list directory contents for debugging
      try {
        const primaryDir = path.dirname(filePath);
        const altDir = path.dirname(alternativePath);
        
        console.error('🔍 Primary directory exists:', fs.existsSync(primaryDir));
        if (fs.existsSync(primaryDir)) {
          console.error('🔍 Primary directory contents:', fs.readdirSync(primaryDir).slice(0, 10));
        }
        
        console.error('🔍 Alternative directory exists:', fs.existsSync(altDir));
        if (fs.existsSync(altDir)) {
          console.error('🔍 Alternative directory contents:', fs.readdirSync(altDir).slice(0, 10));
        }
      } catch (dirError) {
        console.error('❌ Error reading directories:', dirError);
      }
      
      return res.status(404).json({ error: 'Audio file not found' });
    }
  }
  
  // Get file stats for debugging
  try {
    const stats = fs.statSync(actualFilePath);
    console.log('✅ Audio file found, serving with CORS headers');
    console.log('📊 File stats:', {
      path: actualFilePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile()
    });
  } catch (statError) {
    console.error('❌ Error getting file stats:', statError);
    return res.status(500).json({ error: 'File access error' });
  }
  
  // Serve the file with better error handling
  res.sendFile(actualFilePath, (err) => {
    if (err) {
      console.error('❌ Error serving audio file:', err);
      console.error('🔍 SendFile error details:', {
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
        path: err.path,
        message: err.message
      });
      
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve audio file', details: err.message });
      }
    } else {
      console.log('✅ Audio file served successfully:', filename);
    }
  });
});

// Specific route for QR code files with enhanced CORS


//const path = require('path');
//const fs = require('fs');

app.get('/uploads/qr-codes/:filename', (req, res) => {
  const { filename } = req.params;
  const sanitizedFilename = path.basename(filename); // prevent path traversal
  const filePath = path.join(process.cwd(), 'uploads', 'qr-codes', sanitizedFilename);

  console.log('🔍 Serving QR code file:', sanitizedFilename);
  console.log('🔍 Full file path:', filePath);
  console.log('🔍 Request origin:', req.headers.origin);

  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.CORS_ORIGIN,
    process.env.RENDER_EXTERNAL_URL
  ].filter(Boolean);

  console.log('🌐 QR Code Route CORS - Origin:', origin);

  // Set CORS headers
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('✅ QR Code CORS - Origin allowed:', origin);
  } else if (!origin) {
    // No origin = same-origin or tools like Postman
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('✅ QR Code CORS - No origin, allowing all');
  } else if (process.env.NODE_ENV === 'development' &&
    (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('🔧 QR Code CORS - Dev localhost allowed:', origin);
  } else {
    // Fallback in production — do NOT reflect origin!
    console.log('❌ QR Code CORS - Origin blocked:', origin);
    res.setHeader('Access-Control-Allow-Origin', 'https://app.dealeriq.co');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization', 
    'X-Requested-With',
    'Origin',
    'Accept',
    'Range',
    'Cache-Control',
    'X-API-Key',
    'X-CSRF-Token',
    'X-Forwarded-For',
    'X-Real-IP',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ].join(', '));
  res.setHeader('Access-Control-Expose-Headers', [
    'Content-Range',
    'X-Total-Count',
    'Content-Length',
    'Content-Disposition',
    'Accept-Ranges'
  ].join(', '));
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // 🔥 critical for avoiding NotSameOrigin error

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('✅ QR Code CORS - Preflight request handled');
    return res.sendStatus(200);
  }

  // File-specific headers
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.setHeader('Vary', 'Origin');
  res.setHeader('Content-Type', 'image/png'); // You can use mime-types module for dynamic types

  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error('❌ QR code file not found:', filePath);
    return res.status(404).json({ error: 'QR code file not found' });
  }

  // Log file stats
  try {
    const stats = fs.statSync(filePath);
    console.log('✅ QR code file found, serving with CORS headers');
    console.log('📊 File stats:', {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile()
    });
  } catch (statError) {
    console.error('❌ Error getting QR code file stats:', statError);
    return res.status(500).json({ error: 'File access error' });
  }

  // Serve the file
  try {
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error('❌ Error reading QR code file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

    fileStream.on('open', () => {
      console.log('✅ QR code file stream opened successfully');
    });

    fileStream.on('end', () => {
      console.log('✅ QR code file served successfully:', sanitizedFilename);
    });

    fileStream.pipe(res);

  } catch (streamError) {
    console.error('❌ Error creating file stream:', streamError);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creating file stream' });
    }
  }
});

// Specific route for PDF deal sheets with enhanced CORS and headers
app.get('/uploads/deal-sheets/:filename', (req, res) => {
  const { filename } = req.params;
  const sanitizedFilename = path.basename(filename); // prevent path traversal
  const filePath = path.join(process.cwd(), 'uploads', 'deal-sheets', sanitizedFilename);

  console.log('📄 Serving PDF deal sheet:', sanitizedFilename);
  console.log('🔍 Full file path:', filePath);
  console.log('🔍 Request origin:', req.headers.origin);

  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.CORS_ORIGIN,
    process.env.RENDER_EXTERNAL_URL
  ].filter(Boolean);

  // Set CORS headers
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('✅ PDF CORS - Allowed origin:', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all for PDFs
    console.log('⚠️ PDF CORS - Origin not in whitelist, using wildcard');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('✅ PDF CORS - Preflight request handled');
    return res.sendStatus(200);
  }

  // PDF-specific headers
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.setHeader('Vary', 'Origin');
  res.setHeader('Content-Type', 'application/pdf');
  
  // Use inline to view in browser, or attachment to force download
  // Default to inline so PDFs open in browser
  const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${sanitizedFilename}"`);

  // Check file exists
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    console.error('❌ PDF file not found:', filePath);
    return res.status(404).json({ error: 'PDF file not found' });
  }

  // Log file stats
  try {
    const stats = fs.statSync(filePath);
    console.log('✅ PDF file found, serving with proper headers');
    console.log('📊 File stats:', {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile()
    });
  } catch (statError) {
    console.error('❌ Error getting PDF file stats:', statError);
    return res.status(500).json({ error: 'File access error' });
  }

  // Serve the file
  try {
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error('❌ Error reading PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

    fileStream.on('open', () => {
      console.log('✅ PDF file stream opened successfully');
    });

    fileStream.on('end', () => {
      console.log('✅ PDF file served successfully:', sanitizedFilename);
    });

    fileStream.pipe(res);

  } catch (streamError) {
    console.error('❌ Error creating PDF file stream:', streamError);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creating file stream' });
    }
  }
});

// Specific route for Credit Application PDFs with enhanced CORS
app.get('/uploads/credit-applications/:filename', (req, res) => {
  const { filename } = req.params;
  const sanitizedFilename = path.basename(filename); // prevent path traversal
  const filePath = path.join(process.cwd(), 'uploads', 'credit-applications', sanitizedFilename);

  console.log('📄 Serving Credit Application PDF:', sanitizedFilename);
  console.log('🔍 Full file path:', filePath);
  console.log('🔍 Request origin:', req.headers.origin);

  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    process.env.FRONTEND_URL,
    process.env.BACKEND_URL,
    process.env.CORS_ORIGIN,
    process.env.RENDER_EXTERNAL_URL
  ].filter(Boolean);

  // Set CORS headers
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('✅ Credit App PDF CORS - Allowed origin:', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all for PDFs
    console.log('⚠️ Credit App PDF CORS - Origin not in whitelist, using wildcard');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('✅ Credit App PDF CORS - Preflight request handled');
    return res.sendStatus(200);
  }

  // PDF-specific headers
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.setHeader('Vary', 'Origin');
  res.setHeader('Content-Type', 'application/pdf');
  
  // Use inline to view in browser, or attachment to force download
  const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${sanitizedFilename}"`);

  // Check file exists
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    console.error('❌ Credit Application PDF not found:', filePath);
    console.error('🔍 Working directory:', process.cwd());
    console.error('🔍 Expected path:', filePath);
    return res.status(404).json({ 
      error: 'PDF file not found',
      path: `/uploads/credit-applications/${sanitizedFilename}`,
      working_dir: process.cwd()
    });
  }

  // Log file stats
  try {
    const stats = fs.statSync(filePath);
    console.log('✅ Credit Application PDF found, serving with proper headers');
    console.log('📊 File stats:', {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile()
    });
  } catch (statError) {
    console.error('❌ Error getting PDF file stats:', statError);
    return res.status(500).json({ error: 'File access error' });
  }

  // Serve the file
  try {
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error('❌ Error reading Credit Application PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });

    fileStream.on('open', () => {
      console.log('✅ Credit Application PDF stream opened successfully');
    });

    fileStream.on('end', () => {
      console.log('✅ Credit Application PDF served successfully:', sanitizedFilename);
    });

    fileStream.pipe(res);

  } catch (streamError) {
    console.error('❌ Error creating Credit Application PDF stream:', streamError);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creating file stream' });
    }
  }
});

// Health check route (for Render.com monitoring) - MUST BE BEFORE OTHER ROUTES
app.use('/api', healthRoutes);

// Database administration routes
app.use('/api/database-admin', databaseAdminRoutes);

app.use((req, res, next) => {
  try { attachTenantContext(req, res, next); } catch { next(); }
});

// Routes - ALL API ROUTES MUST COME BEFORE STATIC FILE SERVING
app.use('/api/auth', authLimiter, authRoutes);

// Public vehicle routes (no authentication required)
app.use('/api/vehicles/public', publicVehicleRoutes);

// Public dealer routes (no authentication required)
app.use('/api/dealers/public', publicDealerRoutes);
app.use('/api/staff/public', publicStaffRoutes);

// Customer authentication routes (public for QR code access)
app.use('/api/customer-auth', customerAuthRoutes);

// Customer finance routes (requires customer authentication)
app.use('/api/customer', customerFinanceRoutes);

// Staff management routes (protected)
app.use('/api/staff', authenticateToken, staffRoutes);

// CrewAI agent management routes (protected)
app.use('/api/crewai-agents', authenticateToken, crewaiAgentRoutes);

// Finance & lease management routes (protected)
app.use('/api/finance', authenticateToken, attachTenantContext, financeRoutes);

// Customer management routes (protected)
app.use('/api/customers', authenticateToken, attachTenantContext, customersRoutes);

// Rebates management routes (protected)
app.use('/api/rebates', authenticateToken, attachTenantContext, rebatesRoutes);

// Finance notification routes (protected)
app.use('/api/notifications', authenticateToken, attachTenantContext, notificationRoutes);

// Follow-Up Automation routes (protected)
app.use('/api/followup-settings', authenticateToken, attachTenantContext, followupSettingsRoutes);

// Lenders management routes (protected)
app.use('/api/lenders', authenticateToken, attachTenantContext, lendersRoutes);

// E-signature routes (protected, webhooks are public)
app.use('/api/signatures', signaturesRoutes);  // Note: Has its own auth handling for webhooks

// D.A.I.V.E. routes (public for customer interactions, protected for dealer access)
app.use('/api/daive', daiveRoutes);

// Website scraping & knowledge base routes (protected)
app.use('/api/scraping', authenticateToken, websiteScrapingRoutes);



// Optimized AIBot routes (API endpoints only, protected)
app.use('/optimized-aibot/api', authenticateToken, optimizedAIBotRoutes);

// Protected routes (authentication required)
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/vehicles', authenticateFlexible, carfaxRoutes); // CARFAX routes for vehicles (accepts both user & customer tokens)
app.use('/api/dealers', authenticateToken, dealerRoutes);
app.use('/api/leads', authenticateToken, leadRoutes);
app.use('/api/leads', authenticateToken, followUpRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/super-admin', superAdminRoutes); // Super admin routes (includes auth middleware)
app.use('/api/marbalism', marbalismRoutes);   // Marbalism AI agent routes
app.use('/api/etl', authenticateToken, etlRoutes);
app.use('/api/import', authenticateToken, importRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WebSocket status check
app.get('/websocket-status', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    websocket: {
      streamingVoice: wsServer ? 'initialized' : 'not_initialized',
      general: wsServer ? 'initialized' : 'not_initialized'
    },
    ports: {
      server: PORT,
      frontend: process.env.FRONTEND_PORT || '8080'
    }
  });
});

// Development endpoint to reset rate limits (only in development)
if (isDevelopment) {
  app.get('/api/reset-rate-limit', (req, res) => {
    // Clear rate limit store for the current IP
    if (generalLimiter.resetKey) {
      generalLimiter.resetKey(req.ip);
    }
    if (authLimiter.resetKey) {
      authLimiter.resetKey(req.ip);
    }
    res.json({ message: 'Rate limits reset for this IP' });
  });
}

// =====================================================
// STATIC FILE SERVING - MUST COME AFTER ALL API ROUTES
// =====================================================

// Serve static files from root directory (for test files)
app.use(express.static('.'));

// Serve test-daive.html
app.get('/test-daive.html', (req, res) => {
  res.sendFile('test-daive.html', { root: '.' });
});

// Serve simple-test.html
app.get('/simple-test.html', (req, res) => {
  res.sendFile('simple-test.html', { root: '.' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler - MUST BE LAST
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize WebSocket server (handles both general notifications and streaming voice)
const wsServer = initializeWebSocket(app);

// Start server with WebSocket support
wsServer.httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT} with WebSocket support`);

  // Ensure notifications table exists (idempotent)
  await ensureNotificationsTable();
  // Ensure last_login_at column exists (idempotent)
  await ensureLastLoginColumn();
  console.log(`General WebSocket endpoint: ws://localhost:${PORT} (development)`);
  console.log(`Streaming Voice WebSocket: ws://localhost:${PORT}/streaming-voice (development)`);
  console.log(`Production WebSocket endpoints will use environment-based URLs`);

   // Start marketing scheduler
  console.log('🚀 Starting marketing journey scheduler...');
  marketingScheduler.start();
  
  // Start follow-up automation scheduler
  console.log('🚀 Starting DAIVE Follow-Up Automation...');
  followupAutomation.start();
  
  // Start import scheduler
  console.log('🚀 Starting Import scheduler...');
  importScheduler.start();
  
  // Initialize audit logger
  console.log('🔍 Initializing audit logger...');
  auditLogger.initialize().catch(error => {
    console.error('❌ Failed to initialize audit logger:', error);
  });
});

// Export WebSocket functions for use in routes
export const { sendNotification, sendNotificationToDealers, sendNotificationToSuperAdmin } = wsServer || {};

export default app;
