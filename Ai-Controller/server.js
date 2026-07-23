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
import leadRoutes from './routes/leads.js';
import adminRoutes from './routes/admin.js';
import daiveRoutes from './routes/daive.js';
import etlRoutes from './routes/etl.js';
import importRoutes from './routes/import.js';
import healthRoutes from './routes/health.js';
import databaseAdminRoutes from './routes/database-admin.js';

import optimizedAIBotRoutes from './routes/optimizedAIBot.js';
import { authenticateToken } from './middleware/auth.js';
import { initializeWebSocket } from './lib/websocket.js';

import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.BACKEND_URL || "http://localhost:3000"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://app.dealeriq.co',
      'https://vehicle-management-backend-ypsa.onrender.com',
      process.env.FRONTEND_URL || 'http://localhost:8080',
      process.env.FRONTEND_URL_ALT || 'http://localhost:8081',
      process.env.BACKEND_URL || 'http://localhost:3000'
    ].filter(Boolean); // Remove undefined values
    
    console.log('Request origin:', origin);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

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

// CORS configuration updated for production and local development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://app.dealeriq.co',
      'https://vehicle-management-backend-ypsa.onrender.com',
      'http://localhost:8080',
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,
      process.env.BACKEND_URL,
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    console.log('Request origin:', origin);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'Range'],
  optionsSuccessStatus: 200
}));

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
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', 'https://app.dealeriq.co');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Accept-Ranges', 'bytes');
  
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

// Specific route for audio files with enhanced CORS
app.get('/uploads/daive-audio/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(process.cwd(), 'uploads/daive-audio', filename);
  
  console.log('🎵 Serving audio file:', filename, 'from path:', filePath);
  console.log('🔍 Request origin:', req.headers.origin);
  console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
  
  // Set CORS headers specifically for audio files with dynamic origin
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://app.dealeriq.co',
    'https://vehicle-management-backend-ypsa.onrender.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000'
  ];
  
  // Always set CORS headers, even if no origin header (for direct browser access)
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log('✅ CORS: Using request origin:', origin);
  } else {
    // Use wildcard for audio files to ensure compatibility
    res.header('Access-Control-Allow-Origin', '*');
    console.log('🔄 CORS: Using wildcard origin, request origin was:', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Accept-Ranges', 'bytes');
  res.header('Cache-Control', 'public, max-age=3600'); // Allow caching for 1 hour
  res.header('Vary', 'Origin');
  
  if (filename.endsWith('.mp3')) {
    res.header('Content-Type', 'audio/mpeg');
  } else if (filename.endsWith('.wav')) {
    res.header('Content-Type', 'audio/wav');
  }
  
  // Check if file exists
  if (!require('fs').existsSync(filePath)) {
    console.error('❌ Audio file not found:', filePath);
    return res.status(404).json({ error: 'Audio file not found' });
  }
  
  console.log('✅ Audio file found, serving with CORS headers');
  
  // Serve the file
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Error serving audio file:', err);
      res.status(500).json({ error: 'Failed to serve audio file' });
    } else {
      console.log('✅ Audio file served successfully:', filename);
    }
  });
});

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

// Health check route (for Render.com monitoring)
app.use('/api', healthRoutes);

// Database administration routes
app.use('/api/database-admin', databaseAdminRoutes);

// Routes
app.use('/api/auth', authLimiter, authRoutes);

// Public vehicle routes (no authentication required)
app.use('/api/vehicles/public', publicVehicleRoutes);

// D.A.I.V.E. routes (public for customer interactions, protected for dealer access)
app.use('/api/daive', daiveRoutes);



// Optimized AIBot routes (API endpoints only, protected)
app.use('/optimized-aibot/api', authenticateToken, optimizedAIBotRoutes);

// Protected routes (authentication required)
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/dealers', authenticateToken, dealerRoutes);
app.use('/api/leads', authenticateToken, leadRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
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

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize WebSocket server (handles both general notifications and streaming voice)
const wsServer = initializeWebSocket(app);

// Start server with WebSocket support
wsServer.httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with WebSocket support`);
  console.log(`General WebSocket endpoint: ws://localhost:${PORT} (development)`);
  console.log(`Streaming Voice WebSocket: ws://localhost:${PORT}/streaming-voice (development)`);
  console.log(`Production WebSocket endpoints will use environment-based URLs`);
});

// Export WebSocket functions for use in routes
export const { sendNotification, sendNotificationToDealers, sendNotificationToSuperAdmin } = wsServer || {};

export default app;