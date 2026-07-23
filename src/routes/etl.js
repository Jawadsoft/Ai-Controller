import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import ETLService from '../lib/etlService.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const etlService = new ETLService();

// Enhanced CORS middleware specifically for ETL routes
router.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Define allowed origins for ETL operations
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
  
  console.log('🌐 ETL Route CORS - Origin:', origin);
  
  // Set CORS headers for ETL routes
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log('✅ ETL CORS - Origin allowed:', origin);
  } else if (!origin) {
    // Allow requests with no origin (same-origin, Postman, curl, etc.)
    res.header('Access-Control-Allow-Origin', '*');
    console.log('✅ ETL CORS - No origin, allowing all');
  } else if (process.env.NODE_ENV === 'development') {
    // In development, be more permissive for localhost variations
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0')) {
      res.header('Access-Control-Allow-Origin', origin);
      console.log('🔧 ETL CORS - Development localhost allowed:', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
      console.log('🔧 ETL CORS - Development wildcard for:', origin);
    }
  } else {
    console.log('❌ ETL CORS - Origin blocked:', origin);
    // In production, still allow for debugging purposes but log it
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  // Set comprehensive CORS headers for ETL operations
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
    console.log('🔄 ETL Preflight OPTIONS for:', req.path);
    console.log('🔄 Requested method:', req.headers['access-control-request-method']);
    console.log('🔄 Requested headers:', req.headers['access-control-request-headers']);
    return res.status(200).send();
  }
  
  next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/etl-documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Health check route (no auth required for testing)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', route: 'etl', timestamp: new Date().toISOString() });
});

// GET /api/etl/scheduler/status - Get ETL scheduler status
router.get('/scheduler/status', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Import scheduler to get status
    const etlScheduler = (await import('../lib/etlScheduler.js')).default;
    const status = etlScheduler.getStatus();
    
    // Get scheduled exports info
    const client = await etlService.pool.connect();
    try {
      const schedulesResult = await client.query(`
        SELECT 
          COUNT(*) as total_schedules,
          COUNT(CASE WHEN ss.next_run <= NOW() THEN 1 END) as due_now,
          COUNT(CASE WHEN ss.is_active = true THEN 1 END) as active_schedules
        FROM etl_export_configs ec
        INNER JOIN etl_schedule_settings ss ON ec.id = ss.export_config_id
        WHERE ec.dealer_id = $1 AND ec.is_active = true
      `, [dealerId]);
      
      const nextRunResult = await client.query(`
        SELECT MIN(ss.next_run) as next_run
        FROM etl_export_configs ec
        INNER JOIN etl_schedule_settings ss ON ec.id = ss.export_config_id
        WHERE ec.dealer_id = $1 AND ec.is_active = true AND ss.is_active = true
      `, [dealerId]);
      
      res.json({
        success: true,
        data: {
          ...status,
          schedules: {
            total: parseInt(schedulesResult.rows[0]?.total_schedules || 0),
            active: parseInt(schedulesResult.rows[0]?.active_schedules || 0),
            dueNow: parseInt(schedulesResult.rows[0]?.due_now || 0),
            nextRun: nextRunResult.rows[0]?.next_run || null
          }
        }
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error getting ETL scheduler status:', error);
    res.status(500).json({ 
      error: 'Failed to get scheduler status',
      details: error.message 
    });
  }
});

// GET /api/etl/configs - Get all ETL configurations for a dealer
router.get('/configs', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const configs = await etlService.getExportConfigs(dealerId);
    
    res.json({
      success: true,
      data: configs
    });

  } catch (error) {
    console.error('Error getting ETL configs:', error);
    res.status(500).json({ error: 'Failed to get ETL configurations' });
  }
});

// GET /api/etl/configs/:id - Get specific ETL configuration
router.get('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const config = await etlService.getExportConfig(configId);
    
    if (!config) {
      return res.status(404).json({ error: 'ETL configuration not found' });
    }

    // Verify dealer owns this config
    if (config.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('Error getting ETL config:', error);
    res.status(500).json({ error: 'Failed to get ETL configuration' });
  }
});

// POST /api/etl/configs - Create new ETL configuration
router.post('/configs', authenticateToken, async (req, res) => {
  try {
    console.log('📝 POST /api/etl/configs - Request received');
    console.log('📝 Request body:', JSON.stringify(req.body).substring(0, 200));
    console.log('📝 User:', req.user ? { id: req.user.id, dealer_id: req.user.dealer_id } : 'No user');
    
    const dealerId = req.user?.dealer_id;
    const configData = req.body;
    
    if (!dealerId) {
      console.log('❌ No dealer_id found in request');
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log(`✅ Processing config creation for dealer: ${dealerId}`);

    // Validate required fields
    if (!configData.configName) {
      return res.status(400).json({ error: 'Configuration name is required' });
    }

    if (!configData.connection || !configData.connection.hostUrl || !configData.connection.username || !configData.connection.password) {
      return res.status(400).json({ error: 'Connection settings are required' });
    }

    const result = await etlService.createExportConfig(dealerId, configData);
    
    console.log(`✅ Config created successfully with ID: ${result.exportConfigId}`);
    
    res.json({
      success: true,
      data: { exportConfigId: result.exportConfigId },
      message: 'ETL configuration created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating ETL config:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create ETL configuration',
      details: error.message 
    });
  }
});

// PUT /api/etl/configs/:id - Update ETL configuration
router.put('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    const updateData = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify dealer owns this config
    const existingConfig = await etlService.getExportConfig(configId);
    if (!existingConfig || existingConfig.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!updateData.configName) {
      return res.status(400).json({ error: 'Configuration name is required' });
    }

    if (!updateData.connection || !updateData.connection.hostUrl || !updateData.connection.username) {
      return res.status(400).json({ error: 'Connection settings are required' });
    }

    // Update the configuration
    const result = await etlService.updateExportConfig(configId, updateData);
    
    res.json({
      success: true,
      data: result,
      message: 'ETL configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating ETL config:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update ETL configuration',
      details: error.message 
    });
  }
});

// DELETE /api/etl/configs/:id - Delete ETL configuration
router.delete('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify dealer owns this config
    const existingConfig = await etlService.getExportConfig(configId);
    if (!existingConfig || existingConfig.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete configuration
    const client = await etlService.pool.connect();
    try {
      await client.query('DELETE FROM etl_export_configs WHERE id = $1', [configId]);
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: 'ETL configuration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting ETL config:', error);
    res.status(500).json({ error: 'Failed to delete ETL configuration' });
  }
});

// POST /api/etl/configs/:id/execute - Execute ETL export manually
router.post('/configs/:id/execute', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify dealer owns this config
    const existingConfig = await etlService.getExportConfig(configId);
    if (!existingConfig || existingConfig.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Execute export
    const result = await etlService.executeExport(configId);
    
    res.json({
      success: true,
      data: result,
      message: 'ETL export executed successfully'
    });

  } catch (error) {
    console.error('Error executing ETL export:', error);
    res.status(500).json({ error: 'Failed to execute ETL export' });
  }
});

// GET /api/etl/history - Get export history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const limit = parseInt(req.query.limit) || 50;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const history = await etlService.getExportHistory(dealerId, limit);
    
    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error getting ETL history:', error);
    res.status(500).json({ error: 'Failed to get ETL history' });
  }
});

// POST /api/etl/test-connection - Test FTP/SFTP connection
router.post('/test-connection', authenticateToken, async (req, res) => {
  // Set timeout for connection testing
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000);
  
  try {
    const dealerId = req.user.dealer_id;
    console.log('🔄 ETL Test connection request started');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    
    const { connectionType, hostUrl, port, username, password, remoteDirectory, configId } = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('Extracted values:', { 
      connectionType, 
      hostUrl, 
      port, 
      username, 
      password: password ? '[HIDDEN]' : 'undefined', 
      remoteDirectory, 
      configId 
    });
    
    // If configId is provided and password is empty, try to fetch stored password
    let actualPassword = password;
    if (configId && !password) {
      try {
        const existingConfig = await etlService.getExportConfig(configId);
        if (existingConfig && existingConfig.dealer_id === dealerId && existingConfig.connection) {
          actualPassword = existingConfig.connection.password;
          console.log('✅ Using stored password from config');
        }
      } catch (configError) {
        console.log('⚠️ Could not fetch stored password:', configError.message);
      }
    }
    
    if (!hostUrl || !username || !actualPassword) {
      return res.status(400).json({ 
        error: 'Connection details are required',
        missing: {
          hostUrl: !hostUrl,
          username: !username,
          password: !actualPassword
        },
        message: configId && !password ? 'Password is required. Please enter the password or it will be retrieved from saved configuration.' : 'All connection details are required'
      });
    }

    // Test connection
    const testConfig = {
      connection: {
        type: connectionType || 'ftp',
        host_url: hostUrl,
        port: port || (connectionType === 'sftp' ? 22 : 21),
        username,
        password: actualPassword,
        remote_directory: remoteDirectory || '/'
      }
    };

    console.log('🔧 Test config created:', {
      type: testConfig.connection.type,
      host: testConfig.connection.host_url,
      port: testConfig.connection.port,
      directory: testConfig.connection.remote_directory
    });

    try {
      if (testConfig.connection.type === 'sftp') {
        // SFTP Connection Test
        console.log('📦 Loading SSH2 client for SFTP...');
        const { Client } = await import('ssh2');
        
        const connectionPromise = new Promise((resolve, reject) => {
          const conn = new Client();
          let isResolved = false;
          
          // Set connection timeout
          const connectionTimeout = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              console.log('⏰ SFTP Connection timeout after 2 minutes');
              conn.end();
              reject(new Error('Connection timeout after 2 minutes'));
            }
          }, 120000); // 2 minutes
          
          // Error handler
          conn.on('error', (err) => {
            console.log('❌ SFTP connection error:', err.message);
            clearTimeout(connectionTimeout);
            if (!isResolved) {
              isResolved = true;
              reject(new Error(`SFTP connection failed: ${err.message}`));
            }
          });
          
          conn.on('ready', () => {
            console.log('✅ SFTP connection established');
            conn.sftp((err, sftp) => {
              if (err) {
                clearTimeout(connectionTimeout);
                if (!isResolved) {
                  isResolved = true;
                  conn.end();
                  reject(new Error(`SFTP session failed: ${err.message}`));
                }
                return;
              }
              
              console.log('✅ SFTP session established');
              
              // List directory to verify connection
              console.log('📁 Listing directory:', testConfig.connection.remote_directory);
              sftp.readdir(testConfig.connection.remote_directory, (err, list) => {
                clearTimeout(connectionTimeout);
                conn.end();
                
                if (err) {
                  if (!isResolved) {
                    isResolved = true;
                    // Try to list root directory to provide helpful error
                    const rootConn = new Client();
                    rootConn.on('ready', () => {
                      rootConn.sftp((sftpErr, rootSftp) => {
                        if (!sftpErr) {
                          rootSftp.readdir('/', (rootErr, rootList) => {
                            rootConn.end();
                            if (!rootErr) {
                              const availableDirs = rootList.filter(f => f.attrs.isDirectory()).map(f => f.filename);
                              reject(new Error(`Directory '${testConfig.connection.remote_directory}' does not exist. Available directories: ${availableDirs.join(', ')}`));
                            } else {
                              reject(new Error(`Cannot access directory '${testConfig.connection.remote_directory}': ${err.message}`));
                            }
                          });
                        } else {
                          rootConn.end();
                          reject(new Error(`Cannot access directory '${testConfig.connection.remote_directory}': ${err.message}`));
                        }
                      });
                    });
                    rootConn.on('error', () => rootConn.end());
                    rootConn.connect({
                      host: testConfig.connection.host_url,
                      port: testConfig.connection.port,
                      username: testConfig.connection.username,
                      password: testConfig.connection.password
                    });
                  }
                } else {
                  if (!isResolved) {
                    isResolved = true;
                    console.log(`✅ Successfully listed ${list.length} items in directory`);
                    resolve({
                      success: true,
                      message: `Connection test successful. Found ${list.length} items in directory.`,
                      directory: testConfig.connection.remote_directory,
                      itemCount: list.length
                    });
                  }
                }
              });
            });
          });
          
          console.log('🔌 Attempting SFTP connection to:', {
            host: testConfig.connection.host_url,
            port: testConfig.connection.port,
            username: testConfig.connection.username
          });
          
          conn.connect({
            host: testConfig.connection.host_url,
            port: testConfig.connection.port,
            username: testConfig.connection.username,
            password: testConfig.connection.password,
            readyTimeout: 20000, // 20 second connection timeout
            keepaliveInterval: 10000
          });
        });
        
        const result = await connectionPromise;
        res.json(result);
        
      } else {
        // FTP Connection Test using basic-ftp
        console.log('📦 Loading basic-ftp client for FTP...');
        const ftp = await import('basic-ftp');
        
        const client = new ftp.default.Client();
        client.ftp.verbose = false;
        
        // Set connection timeout
        let connectionTimeout;
        const timeoutPromise = new Promise((_, reject) => {
          connectionTimeout = setTimeout(() => {
            console.log('⏰ FTP Connection timeout after 2 minutes');
            try {
              client.close();
            } catch (e) {
              // Ignore close errors
            }
            reject(new Error('Connection timeout after 2 minutes'));
          }, 120000); // 2 minutes
        });
        
        try {
          console.log('🔌 Attempting FTP connection to:', {
            host: testConfig.connection.host_url,
            port: testConfig.connection.port,
            username: testConfig.connection.username
          });
          
          // Race between connection and timeout
          await Promise.race([
            client.access({
              host: testConfig.connection.host_url,
              port: testConfig.connection.port,
              user: testConfig.connection.username,
              password: testConfig.connection.password,
              secure: false, // Use plain FTP, not FTPS
              secureOptions: {},
              timeout: 20000 // 20 second connection timeout
            }),
            timeoutPromise
          ]);
          
          clearTimeout(connectionTimeout);
          
          console.log('✅ FTP connection established');
          
          // List directory to verify connection
          console.log('📁 Listing directory:', testConfig.connection.remote_directory);
          
          // Ensure directory exists or try to access it
          try {
            await client.ensureDir(testConfig.connection.remote_directory);
            const list = await client.list(testConfig.connection.remote_directory);
            
            client.close();
            
            console.log(`✅ Successfully listed ${list.length} items in directory`);
            res.json({
              success: true,
              message: `Connection test successful. Found ${list.length} items in directory.`,
              directory: testConfig.connection.remote_directory,
              itemCount: list.length
            });
          } catch (dirError) {
            client.close();
            // Try to list root directory
            try {
              const rootClient = new ftp.default.Client();
              rootClient.ftp.verbose = false;
              await rootClient.access({
                host: testConfig.connection.host_url,
                port: testConfig.connection.port,
                user: testConfig.connection.username,
                password: testConfig.connection.password,
                secure: false,
                timeout: 20000
              });
              const rootList = await rootClient.list('/');
              rootClient.close();
              const availableDirs = rootList.filter(f => f.isDirectory).map(f => f.name);
              throw new Error(`Directory '${testConfig.connection.remote_directory}' does not exist. Available directories: ${availableDirs.join(', ')}`);
            } catch (rootError) {
              throw new Error(`Cannot access directory '${testConfig.connection.remote_directory}': ${dirError.message}`);
            }
          }
        } catch (error) {
          clearTimeout(connectionTimeout);
          try {
            client.close();
          } catch (e) {
            // Ignore close errors
          }
          throw error;
        }
      }
      
    } catch (connectionError) {
      console.error('❌ Connection test error:', connectionError);
      res.status(400).json({
        success: false,
        error: 'Connection test failed',
        details: connectionError.message
      });
    }

  } catch (error) {
    console.error('❌ Error testing connection:', error);
    res.status(500).json({ 
      error: 'Failed to test connection',
      details: error.message 
    });
  }
});

// POST /api/etl/upload-document - Upload authorization document
router.post('/upload-document', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/etl-documents/${req.file.filename}`;
    
    res.json({
      success: true,
      data: {
        fileName: req.file.filename,
        fileUrl: fileUrl,
        fileSize: req.file.size
      },
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET /api/etl/field-mappings - Get available field mappings
router.get('/field-mappings', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Field mappings request received');
    const dealerId = req.user?.dealer_id;
    
    if (!dealerId) {
      console.log('❌ No dealer_id found in request');
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log(`✅ Processing field mappings for dealer: ${dealerId}`);

    // Get available fields from vehicles table
    const client = await etlService.pool.connect();
    try {
      // List of columns to exclude from field mappings
      const excludedColumns = [
        'import_source',
        'import_date',
        'series',
        'reference_dealer_id',
        'new_used',
        'vehicle_type',
        'inventory_status',
        'carfax_report_url',
        'carfax_report_date',
        'carfax_accident_count',
        'carfax_service_records',
        'carfax_owners',
        'carfax_title_issues',
        'carfax_odometer_rollback',
        'carfax_structural_damage',
        'carfax_airbag_deployment',
        'carfax_flood_damage',
        'carfax_lemon_title',
        'carfax_manufacturer_recall',
        'carfax_previous_rental',
        'carfax_previous_taxi',
        'carfax_previous_police',
        'carfax_previous_fleet',
        'carfax_previous_lease',
        'carfax_previous_corporate',
        'carfax_previous_government',
        'carfax_previous_auction',
        'carfax_previous_repo',
        'carfax_previous_salvage',
        'carfax_previous_fire',
        'carfax_previous_hail',
        'carfax_previous_theft',
        'carfax_previous_vandalism',
        'carfax_previous_water',
        'carfax_previous_other',
        'carfax_summary',
        'latest_carfax_report_id',
        'sticker_generation_status',
        'sticker_generated_at',
        'sticker_printed_at'
      ];
      
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
          AND column_name NOT IN (${excludedColumns.map((_, i) => `$${i + 1}`).join(', ')})
        ORDER BY ordinal_position
      `, excludedColumns);
      
      console.log(`📊 Found ${result.rows.length} vehicle fields (excluding ${excludedColumns.length} internal columns)`);
      
      const fieldMappings = result.rows.map(row => ({
        sourceField: row.column_name,
        targetField: row.column_name,
        dataType: row.data_type,
        description: getFieldDescription(row.column_name)
      }));
      
      res.json({
        success: true,
        data: fieldMappings
      });
      
    } catch (dbError) {
      console.error('❌ Database error in field mappings:', dbError);
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error getting field mappings:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to get field mappings',
      details: error.message 
    });
  }
});

// Helper function to get field descriptions
function getFieldDescription(fieldName) {
  const descriptions = {
    'id': 'Unique vehicle identifier',
    'dealer_id': 'Dealer identifier',
    'make': 'Vehicle make/brand',
    'model': 'Vehicle model',
    'year': 'Vehicle year',
    'vin': 'Vehicle Identification Number',
    'mileage': 'Vehicle mileage',
    'price': 'Vehicle price',
    'condition': 'Vehicle condition',
    'color': 'Vehicle color',
    'fuel_type': 'Fuel type',
    'transmission': 'Transmission type',
    'body_style': 'Body style',
    'engine': 'Engine details',
    'features': 'Vehicle features',
    'description': 'Vehicle description',
    'images': 'Vehicle images',
    'status': 'Vehicle status',
    'created_at': 'Creation timestamp',
    'updated_at': 'Last update timestamp'
  };
  
  return descriptions[fieldName] || fieldName;
}

export default router; 