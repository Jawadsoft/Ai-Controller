import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import ETLService from '../lib/etlService.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const etlService = new ETLService();

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

// GET /api/etl/configs - Get all ETL configurations for a dealer
router.get('/configs', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.id;
    
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
    const dealerId = req.user.id;
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
    const dealerId = req.user.id;
    const configData = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Validate required fields
    if (!configData.configName) {
      return res.status(400).json({ error: 'Configuration name is required' });
    }

    if (!configData.connection || !configData.connection.hostUrl || !configData.connection.username || !configData.connection.password) {
      return res.status(400).json({ error: 'Connection settings are required' });
    }

    const result = await etlService.createExportConfig(dealerId, configData);
    
    res.json({
      success: true,
      data: { exportConfigId: result.exportConfigId },
      message: 'ETL configuration created successfully'
    });

  } catch (error) {
    console.error('Error creating ETL config:', error);
    res.status(500).json({ error: 'Failed to create ETL configuration' });
  }
});

// PUT /api/etl/configs/:id - Update ETL configuration
router.put('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.id;
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
    const dealerId = req.user.id;
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
    const dealerId = req.user.id;
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
    const dealerId = req.user.id;
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
  try {
    const dealerId = req.user.id;
    console.log('Test connection request body:', req.body);
    const { connectionType, hostUrl, port, username, password, remoteDirectory } = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('Extracted values:', { connectionType, hostUrl, port, username, password: password ? '[HIDDEN]' : 'undefined', remoteDirectory });
    
    if (!hostUrl || !username || !password) {
      return res.status(400).json({ 
        error: 'Connection details are required',
        missing: {
          hostUrl: !hostUrl,
          username: !username,
          password: !password
        }
      });
    }

    // Test connection
    const testConfig = {
      connection: {
        type: connectionType || 'ftp',
        host_url: hostUrl,
        port: port || (connectionType === 'sftp' ? 22 : 21),
        username,
        password,
        remote_directory: remoteDirectory || '/'
      }
    };

    try {
      // Create a temporary test file
      const testFileName = `test-connection-${Date.now()}.txt`;
      const testFilePath = path.join(process.cwd(), 'uploads', 'etl-exports', testFileName);
      
      // Ensure directory exists
      const uploadDir = path.dirname(testFilePath);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Write test file
      fs.writeFileSync(testFilePath, 'Test connection file');
      
      // Try to upload
      await etlService.uploadFile(testFilePath, testFileName, testConfig);
      
      // Clean up
      fs.unlinkSync(testFilePath);
      
      res.json({
        success: true,
        message: 'Connection test successful'
      });
      
    } catch (uploadError) {
      res.status(400).json({
        success: false,
        error: 'Connection test failed',
        details: uploadError.message
      });
    }

  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// POST /api/etl/upload-document - Upload authorization document
router.post('/upload-document', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    const dealerId = req.user.id;
    
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
    const dealerId = req.user.id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get available fields from vehicles table
    const client = await etlService.pool.connect();
    try {
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        ORDER BY ordinal_position
      `);
      
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
      
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error getting field mappings:', error);
    res.status(500).json({ error: 'Failed to get field mappings' });
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