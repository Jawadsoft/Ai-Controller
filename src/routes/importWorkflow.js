import express from 'express';
import ImportService from '../../lib/importService333.js';

const router = express.Router();
const importService = new ImportService();

// Test connection and download sample file
router.post('/test-connection', async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    // Validate required fields
    const requiredFields = ['host_url', 'username', 'password'];
    for (const field of requiredFields) {
      if (!config[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    console.log('Testing connection with config:', {
      host: config.host_url,
      port: config.port,
      username: config.username,
      remoteDirectory: config.remote_directory,
      filePattern: config.file_pattern
    });

    const result = await importService.testConnectionAndDownloadSample(config);
    
    res.json(result);
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Execute import with user-defined field mappings
router.post('/execute-with-mappings', async (req, res) => {
  try {
    const { config, sampleData, selectedRows = [] } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    if (!sampleData) {
      return res.status(400).json({ error: 'Sample data is required' });
    }

    // Validate required fields
    const requiredFields = ['host_url', 'username', 'password'];
    for (const field of requiredFields) {
      if (!config[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    console.log('Executing import with user mappings:', {
      host: config.host_url,
      port: config.port,
      username: config.username,
      remoteDirectory: config.remote_directory,
      filePattern: config.file_pattern,
      userFieldMappings: config.userFieldMappings?.length || 0,
      sampleDataRows: sampleData.totalRows
    });

    // Create a temporary config for the import
    const tempConfig = {
      ...config,
      dealer_id: req.user?.dealer_id || 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3', // Default dealer ID
      useUserMappings: true,
      userFieldMappings: config.userFieldMappings || []
    };

    const result = await importService.executeImportFromPreview(
      tempConfig, 
      sampleData, 
      selectedRows
    );
    
    res.json(result);
  } catch (error) {
    console.error('Execute import error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get import history
router.get('/history', async (req, res) => {
  try {
    const dealerId = req.user?.dealer_id || 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';
    const limit = parseInt(req.query.limit as string) || 50;
    
    const history = await importService.getImportHistory(dealerId, limit);
    
    res.json(history);
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get import errors for a specific import
router.get('/errors/:historyId', async (req, res) => {
  try {
    const { historyId } = req.params;
    const dealerId = req.user?.dealer_id || 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';
    
    const errors = await importService.getImportErrors(parseInt(historyId), dealerId);
    
    res.json(errors);
  } catch (error) {
    console.error('Get import errors error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Create import configuration
router.post('/config', async (req, res) => {
  try {
    const { configData } = req.body;
    const dealerId = req.user?.dealer_id || 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';
    
    if (!configData) {
      return res.status(400).json({ error: 'Configuration data is required' });
    }

    const result = await importService.createImportConfig(dealerId, configData);
    
    res.json(result);
  } catch (error) {
    console.error('Create import config error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get import configurations
router.get('/config', async (req, res) => {
  try {
    const dealerId = req.user?.dealer_id || 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';
    
    const configs = await importService.getImportConfigs(dealerId);
    
    res.json(configs);
  } catch (error) {
    console.error('Get import configs error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Get specific import configuration
router.get('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await importService.getImportConfig(parseInt(id));
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    res.json(config);
  } catch (error) {
    console.error('Get import config error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Update import configuration
router.put('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { configData } = req.body;
    
    if (!configData) {
      return res.status(400).json({ error: 'Configuration data is required' });
    }

    const result = await importService.updateImportConfig(parseInt(id), configData);
    
    res.json(result);
  } catch (error) {
    console.error('Update import config error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Execute import with existing configuration
router.post('/execute/:configId', async (req, res) => {
  try {
    const { configId } = req.params;
    const { selectedRows = [], fieldMappings = [], transformedData = null } = req.body;
    
    const result = await importService.executeImport(parseInt(configId), {
      selectedRows,
      fieldMappings,
      transformedData
    });
    
    res.json(result);
  } catch (error) {
    console.error('Execute import error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

export default router;
