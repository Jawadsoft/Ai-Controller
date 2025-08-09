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
import { authenticateToken } from './middleware/auth.js';
import { initializeWebSocket } from './lib/websocket.js';

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
      connectSrc: ["'self'", "http://localhost:3000"],
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
      'http://localhost:8080',
      'http://localhost:8081',
     
      process.env.FRONTEND_URL
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

// Static files for uploads with CORS headers for audio files
app.use('/uploads', (req, res, next) => {
  // Add CORS headers for audio files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  // Set proper headers for audio files
  if (req.path.endsWith('.mp3') || req.path.endsWith('.wav') || req.path.endsWith('.webm')) {
    res.header('Accept-Ranges', 'bytes');
    res.header('Content-Type', req.path.endsWith('.mp3') ? 'audio/mpeg' : 
                              req.path.endsWith('.wav') ? 'audio/wav' : 'audio/webm');
  }
  
  next();
}, express.static('uploads'));

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

// Routes
app.use('/api/auth', authLimiter, authRoutes);

// Public vehicle routes (no authentication required)
app.use('/api/vehicles/public', publicVehicleRoutes);

// D.A.I.V.E. routes (public for customer interactions, protected for dealer access)
app.use('/api/daive', daiveRoutes);

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

// Initialize WebSocket server
const wsServer = initializeWebSocket(app);

// Start server with WebSocket support
wsServer.httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with WebSocket support`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});

// Export WebSocket functions for use in routes
export const { sendNotification, sendNotificationToDealers, sendNotificationToSuperAdmin } = wsServer || {};

export default app;