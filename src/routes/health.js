import express from 'express';

const router = express.Router();

// Health check endpoint for Render.com
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check with database connectivity
router.get('/health/detailed', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown',
        openai: 'unknown',
        deepgram: 'unknown'
      }
    };

    // Check database connectivity if DATABASE_URL is available
    if (process.env.DATABASE_URL) {
      try {
        // Import pg dynamically to avoid issues during build
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        
        healthStatus.services.database = 'connected';
      } catch (error) {
        healthStatus.services.database = 'error';
        healthStatus.databaseError = error.message;
      }
    }

    // Check OpenAI API key availability
    if (process.env.OPENAI_API_KEY) {
      healthStatus.services.openai = 'configured';
    } else {
      healthStatus.services.openai = 'not_configured';
    }

    // Check Deepgram API key availability
    if (process.env.DEEPGRAM_API_KEY) {
      healthStatus.services.deepgram = 'configured';
    } else {
      healthStatus.services.deepgram = 'not_configured';
    }

    res.status(200).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;
