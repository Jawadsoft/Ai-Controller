const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain' || file.originalname.endsWith('.sql')) {
            cb(null, true);
        } else {
            cb(new Error('Only SQL files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Store active database connections
const connections = new Map();

// Helper function to create database connection
function createConnection(config) {
    const connectionKey = `${config.host}:${config.port}:${config.database}:${config.user}`;
    
    if (connections.has(connectionKey)) {
        return connections.get(connectionKey);
    }

    const pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl === 'true' ? true : 
             config.ssl === 'require' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    connections.set(connectionKey, pool);
    return pool;
}

// Test database connection
app.post('/api/test-connection', async (req, res) => {
    try {
        const config = req.body;
        
        if (!config.host || !config.database || !config.user || !config.password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required database configuration' 
            });
        }

        const pool = createConnection(config);
        
        // Test connection with a simple query
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        client.release();

        res.json({
            success: true,
            message: 'Database connection successful',
            data: {
                currentTime: result.rows[0].current_time,
                version: result.rows[0].db_version
            }
        });

    } catch (error) {
        console.error('Connection test error:', error);
        res.status(500).json({
            success: false,
            error: `Connection failed: ${error.message}`
        });
    }
});

// Execute SQL migration
app.post('/api/execute-migration', upload.single('sqlFile'), async (req, res) => {
    try {
        const config = req.body;
        const sqlFile = req.file;

        if (!sqlFile) {
            return res.status(400).json({
                success: false,
                error: 'No SQL file provided'
            });
        }

        if (!config.host || !config.database || !config.user || !config.password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required database configuration'
            });
        }

        // Read SQL file content
        const sqlContent = fs.readFileSync(sqlFile.path, 'utf8');
        
        // Clean up uploaded file
        fs.unlinkSync(sqlFile.path);

        // Parse SQL statements
        const statements = parseSQLStatements(sqlContent);
        
        if (statements.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid SQL statements found in file'
            });
        }

        // Create database connection
        const pool = createConnection(config);
        const client = await pool.connect();

        try {
            // Begin transaction
            await client.query('BEGIN');

            const results = [];
            let executedCount = 0;

            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                
                try {
                    const result = await client.query(statement);
                    results.push({
                        statement: i + 1,
                        sql: statement,
                        success: true,
                        rowCount: result.rowCount,
                        message: `Statement ${i + 1} executed successfully`
                    });
                    executedCount++;
                } catch (error) {
                    // Rollback transaction on error
                    await client.query('ROLLBACK');
                    
                    results.push({
                        statement: i + 1,
                        sql: statement,
                        success: false,
                        error: error.message
                    });

                    return res.status(500).json({
                        success: false,
                        error: `Statement ${i + 1} failed: ${error.message}`,
                        results: results,
                        executedCount: executedCount,
                        totalCount: statements.length
                    });
                }
            }

            // Commit transaction if all statements succeeded
            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Migration completed successfully. ${executedCount} statements executed.`,
                results: results,
                executedCount: executedCount,
                totalCount: statements.length
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Migration execution error:', error);
        res.status(500).json({
            success: false,
            error: `Migration failed: ${error.message}`
        });
    }
});

// Parse SQL statements from content
function parseSQLStatements(sqlContent) {
    // Remove comments
    let cleanSQL = sqlContent
        .replace(/--.*$/gm, '') // Single line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
        .trim();

    // Split by semicolon and filter empty statements
    const statements = cleanSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.toLowerCase().startsWith('set'));

    return statements;
}

// Get migration history (optional feature)
app.get('/api/migration-history', async (req, res) => {
    try {
        const config = req.query;
        
        if (!config.host || !config.database || !config.user || !config.password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required database configuration'
            });
        }

        const pool = createConnection(config);
        const client = await pool.connect();

        try {
            // Check if migration history table exists
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'migration_history'
                );
            `);

            if (!tableExists.rows[0].exists) {
                return res.json({
                    success: true,
                    message: 'No migration history table found',
                    data: []
                });
            }

            // Get migration history
            const result = await client.query(`
                SELECT 
                    id,
                    filename,
                    executed_at,
                    status,
                    statements_count,
                    executed_statements
                FROM migration_history 
                ORDER BY executed_at DESC
            `);

            res.json({
                success: true,
                data: result.rows
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Migration history error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to get migration history: ${error.message}`
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'SQL Migration API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SQL Migration API running on port ${PORT}`);
    console.log(`📁 Frontend available at: http://localhost:${PORT}/sql-migration-tool.html`);
    console.log(`🔧 API endpoints:`);
    console.log(`   POST /api/test-connection - Test database connection`);
    console.log(`   POST /api/execute-migration - Execute SQL migration`);
    console.log(`   GET  /api/migration-history - Get migration history`);
    console.log(`   GET  /api/health - Health check`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    // Close all database connections
    for (const [key, pool] of connections) {
        await pool.end();
        console.log(`Closed connection: ${key}`);
    }
    
    process.exit(0);
});

module.exports = app;
