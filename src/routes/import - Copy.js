import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import ImportService from '../lib/importService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const importService = new ImportService();

// GET /api/import/configs - Get all import configurations for a dealer
router.get('/configs', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const configs = await importService.getImportConfigs(dealerId);
    
    res.json({
      success: true,
      data: configs
    });

  } catch (error) {
    console.error('Error getting import configs:', error);
    res.status(500).json({ error: 'Failed to get import configurations' });
  }
});

// GET /api/import/configs/check-name - Check if configuration name exists
router.get('/configs/check-name', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configName = req.query.name;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!configName) {
      return res.status(400).json({ error: 'Configuration name is required' });
    }

    const existingConfig = await importService.getImportConfigByName(dealerId, configName);
    
    res.json({
      success: true,
      exists: !!existingConfig,
      configId: existingConfig ? existingConfig.id : null
    });

  } catch (error) {
    console.error('Error checking config name:', error);
    res.status(500).json({ error: 'Failed to check configuration name' });
  }
});

// GET /api/import/configs/:id - Get specific import configuration
router.get('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const config = await importService.getImportConfig(configId);
    
    if (!config) {
      return res.status(404).json({ error: 'Import configuration not found' });
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
    console.error('Error getting import config:', error);
    res.status(500).json({ error: 'Failed to get import configuration' });
  }
});

// POST /api/import/configs - Create new import configuration
router.post('/configs', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
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

    const result = await importService.createImportConfig(dealerId, configData);
    
    res.json({
      success: true,
      data: result,
      message: 'Import configuration created successfully'
    });

  } catch (error) {
    console.error('Error creating import config:', error);
    res.status(500).json({ error: 'Failed to create import configuration' });
  }
});

// PUT /api/import/configs/:id - Update import configuration
router.put('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    const updateData = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify dealer owns this config
    const existingConfig = await importService.getImportConfig(configId);
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
    const result = await importService.updateImportConfig(configId, updateData);
    
    res.json({
      success: true,
      data: result,
      message: 'Import configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating import config:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update import configuration',
      details: error.message 
    });
  }
});

// DELETE /api/import/configs/:id - Delete import configuration
router.delete('/configs/:id', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = req.params.id;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify dealer owns this config
    const existingConfig = await importService.getImportConfig(configId);
    if (!existingConfig || existingConfig.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete configuration
    const client = await importService.pool.connect();
    try {
      await client.query('DELETE FROM import_configs WHERE id = $1', [configId]);
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: 'Import configuration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting import config:', error);
    res.status(500).json({ error: 'Failed to delete import configuration' });
  }
});

// POST /api/import/configs/:id/execute - Execute import
router.post('/configs/:id/execute', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const configId = parseInt(req.params.id);
    const { selectedRows, fieldMappings } = req.body;
    
    console.log('=== EXECUTE IMPORT DEBUG ===');
    console.log('User ID:', req.user.id);
    console.log('Dealer ID:', dealerId);
    console.log('Config ID:', configId);
    console.log('Selected rows:', selectedRows);
    console.log('Field mappings:', fieldMappings);
    console.log('=== END EXECUTE IMPORT DEBUG ===');
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify dealer owns this config
    const existingConfig = await importService.getImportConfig(configId);
    if (!existingConfig || existingConfig.dealer_id !== dealerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Execute import with selected rows and field mappings
    const result = await importService.executeImport(configId, {
      selectedRows: selectedRows || [],
      fieldMappings: fieldMappings || []
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Import executed successfully'
    });

  } catch (error) {
    console.error('Error executing import:', error);
    res.status(500).json({ error: 'Failed to execute import' });
  }
});

// POST /api/import/preview-execute - Execute import from preview data
router.post('/preview-execute', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { connectionData, selectedRows, fieldMappings, csvData } = req.body;
    
    console.log('=== PREVIEW EXECUTE DEBUG ===');
    console.log('User ID:', req.user.id);
    console.log('Dealer ID:', dealerId);
    console.log('Selected rows:', selectedRows?.length || 0);
    console.log('Field mappings:', fieldMappings?.length || 0);
    console.log('CSV data rows:', csvData?.sampleData?.length || 0);
    console.log('=== END PREVIEW EXECUTE DEBUG ===');
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!connectionData || !csvData) {
      return res.status(400).json({ error: 'Connection data and CSV data are required' });
    }

    console.log('Preview execute request:', {
      dealerId,
      connectionData: { ...connectionData, password: '[HIDDEN]' },
      selectedRows: selectedRows?.length || 0,
      fieldMappings: fieldMappings?.length || 0,
      csvData: { headers: csvData.headers?.length || 0, totalRows: csvData.totalRows }
    });

    // Create a temporary configuration for import
    console.log('=== DEBUG IMPORT PREVIEW ===');
    console.log('dealerId:', dealerId);
    console.log('req.user.dealer_id:', req.user.dealer_id);
    console.log('req.user:', req.user);
    
    const tempConfig = {
      dealer_id: dealerId,
      connection_type: connectionData.connectionType,
      host_url: connectionData.hostUrl,
      port: connectionData.port,
      username: connectionData.username,
      password: connectionData.password,
      remote_directory: connectionData.remoteDirectory,
      file_pattern: connectionData.filePattern,
      file_type: 'csv',
      delimiter: ',',
      has_header: true,
      encoding: 'utf8',
      date_format: 'YYYY-MM-DD',
      frequency: 'manual',
      time_hour: 0,
      time_minute: 0,
      duplicate_handling: 'update',
      batch_size: 1000,
      max_errors: 100,
      validate_data: true,
      archive_processed_files: false,
      archive_directory: '',
      fieldMappings: fieldMappings || [],
      // Add processing object to match expected structure
      processing: {
        duplicateHandling: 'update',
        batchSize: 1000,
        maxErrors: 100,
        validateData: true,
        archiveProcessedFiles: false,
        archiveDirectory: ''
      },
      // Add other required fields
      fileSettings: {
        fileType: 'csv',
        delimiter: ',',
        hasHeader: true,
        encoding: 'utf8',
        dateFormat: 'YYYY-MM-DD'
      },
      schedule: {
        frequency: 'manual',
        timeHour: 0,
        timeMinute: 0
      }
    };

    // Execute import with temporary configuration
    const result = await importService.executeImportFromPreview(tempConfig, csvData, selectedRows);
    
    res.json({
      success: true,
      data: result,
      message: 'Import executed successfully from preview'
    });

  } catch (error) {
    console.error('Error executing preview import:', error);
    res.status(500).json({ error: 'Failed to execute preview import' });
  }
});

// GET /api/import/history - Get import history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const limit = parseInt(req.query.limit) || 50;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const history = await importService.getImportHistory(dealerId, limit);
    
    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error getting import history:', error);
    res.status(500).json({ error: 'Failed to get import history' });
  }
});

// POST /api/import/preview-csv - Preview CSV data and field mappings
router.post('/preview-csv', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    console.log('Preview CSV request body:', req.body);
    const { connectionType, hostUrl, port, username, password, remoteDirectory, filePattern } = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('Extracted values:', { connectionType, hostUrl, port, username, password: password ? '[HIDDEN]' : 'undefined', remoteDirectory, filePattern });
    
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

    // Test connection and read CSV data
    const testConfig = {
      connection: {
        type: connectionType || 'ftp',
        host_url: hostUrl,
        port: port || (connectionType === 'sftp' ? 22 : 21),
        username,
        password,
        remote_directory: remoteDirectory || '/',
        file_pattern: filePattern || '*.csv'
      }
    };

    try {
      // Try to connect and read CSV files
      const { Client } = await import('ssh2');
      
      return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', () => {
          if (testConfig.connection.type === 'sftp') {
            conn.sftp((err, sftp) => {
              if (err) {
                conn.end();
                reject(err);
                return;
              }
              
              // List files in the remote directory
              sftp.readdir(testConfig.connection.remote_directory, (err, list) => {
                if (err) {
                  conn.end();
                  reject(new Error(`Cannot access directory '${testConfig.connection.remote_directory}': ${err.message}`));
                  return;
                }
                
                // Filter CSV files
                const csvFiles = list.filter(f => 
                  f.filename.toLowerCase().endsWith('.csv') && 
                  !f.attrs.isDirectory()
                );
                
                if (csvFiles.length === 0) {
                  conn.end();
                  reject(new Error(`No CSV files found in '${testConfig.connection.remote_directory}'. Available files: ${list.slice(0, 10).map(f => f.filename).join(', ')}`));
                  return;
                }
                
                // Read the first CSV file
                const firstCsvFile = csvFiles[0];
                const filePath = `${testConfig.connection.remote_directory}/${firstCsvFile.filename}`;
                
                console.log(`Reading CSV file: ${filePath}`);
                
                let csvData = '';
                const stream = sftp.createReadStream(filePath);
                
                stream.on('data', (chunk) => {
                  csvData += chunk.toString();
                });
                
                stream.on('end', () => {
                  conn.end();
                  
                  try {
                    // Parse CSV data with proper handling of quoted fields
                    const lines = csvData.split('\n').filter(line => line.trim());
                    if (lines.length === 0) {
                      reject(new Error('CSV file is empty'));
                      return;
                    }
                    
                    // Helper function to properly parse CSV line
                    const parseCSVLine = (line) => {
                      const result = [];
                      let current = '';
                      let inQuotes = false;
                      
                      for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        
                        if (char === '"') {
                          inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                          result.push(current.trim());
                          current = '';
                        } else {
                          current += char;
                        }
                      }
                      
                      // Add the last field
                      result.push(current.trim());
                      return result;
                    };
                    
                    // Parse headers (first line)
                    const headers = parseCSVLine(lines[0]);
                    
                    // Parse sample data (next 5 lines)
                    const sampleData = lines.slice(1, 6).map(line => {
                      const values = parseCSVLine(line);
                      const row = {};
                      headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                      });
                      return row;
                    });
                    
                    // Generate field mappings with proper mapping to database fields
                    const fieldMappings = headers.map((header, index) => {
                      // Map CSV headers to database field names
                      const fieldMapping = {
                        sourceField: header,
                        targetField: header.toLowerCase().replace(/\s+/g, '_'),
                        fieldType: 'string',
                        isRequired: false,
                        defaultValue: '',
                        transformationRule: '',
                        fieldOrder: index + 1
                      };
                      
                      // Map specific fields to database columns
                      const fieldMap = {
                        // Core vehicle fields
                        'Dealer ID': 'dealer_id',
                        'DealerId': 'dealer_id',
                        'VIN': 'vin',
                        'Make': 'make',
                        'Model': 'model',
                        'Year': 'year',
                        'Trim': 'trim',
                        'Series': 'series',
                        'Body Style': 'body_style',
                        'Body': 'body_style',
                        'Color': 'color',
                        'Interior Color': 'interior_color',
                        'Mileage': 'odometer',
                        'Odometer': 'odometer',
                        'Price': 'price',
                        'Other Price': 'other_price',
                        'MSRP': 'msrp',
                        'Description': 'description',
                        'Features': 'features',
                        'Images': 'photo_url_list',
                        'Status': 'status',
                        'QR Code': 'qr_code_url',
                        
                        // Additional vehicle details
                        'Stock Number': 'stock_number',
                        'Stock #': 'stock_number',
                        'Certified': 'certified',
                        'Engine Type': 'engine_type',
                        'Engine': 'engine_type',
                        'Displacement': 'displacement',
                        'Disp': 'displacement',
                        'Transmission': 'transmission',
                        'Fuel Type': 'fuel_type',
                        'Drivetrain': 'drivetrain',
                        'Doors': 'doors',
                        'Seats': 'seats',
                        'Exterior Length': 'exterior_length',
                        'Exterior Width': 'exterior_width',
                        'Exterior Height': 'exterior_height',
                        'Wheelbase': 'wheelbase',
                        'Ground Clearance': 'ground_clearance',
                        'Cargo Volume': 'cargo_volume',
                        'Towing Capacity': 'towing_capacity',
                        'Gross Vehicle Weight': 'gross_vehicle_weight',
                        'Curb Weight': 'curb_weight',
                        'Fuel Capacity': 'fuel_capacity',
                        'City MPG': 'city_mpg',
                        'Highway MPG': 'highway_mpg',
                        'Combined MPG': 'combined_mpg',
                        'Horsepower': 'horsepower',
                        'Torque': 'torque',
                        'Cylinders': 'cylinders',
                        'Valves': 'valves',
                        'Compression Ratio': 'compression_ratio',
                        'Redline RPM': 'redline_rpm',
                        'Tire Size': 'tire_size',
                        'Wheel Size': 'wheel_size',
                        'Safety Rating': 'safety_rating',
                        'Warranty': 'warranty',
                        'Maintenance Schedule': 'maintenance_schedule',
                        'Recall Info': 'recall_info',
                        'Vehicle History': 'vehicle_history',
                        'Accident History': 'accident_history',
                        'Service History': 'service_history',
                        'Ownership History': 'ownership_history',
                        'Title Status': 'title_status',
                        'Title Brand': 'title_brand',
                        'Lien Holder': 'lien_holder',
                        'Registration State': 'registration_state',
                        'Registration Expiry': 'registration_expiry',
                        'Emissions Test': 'emissions_test',
                        'Emissions Expiry': 'emissions_expiry',
                        'Inspection Status': 'inspection_status',
                        'Inspection Expiry': 'inspection_expiry',
                        'Insurance Status': 'insurance_status',
                        'Insurance Expiry': 'insurance_expiry',
                        'Lease Terms': 'lease_terms',
                        'Lease Payment': 'lease_payment',
                        'Lease Residual': 'lease_residual',
                        'Finance Terms': 'finance_terms',
                        'Finance Payment': 'finance_payment',
                        'Finance Rate': 'finance_rate',
                        'Down Payment': 'down_payment',
                        'Monthly Payment': 'monthly_payment',
                        'Total Cost': 'total_cost',
                        'Discount Amount': 'discount_amount',
                        'Rebate Amount': 'rebate_amount',
                        'Trade-in Value': 'trade_in_value',
                        'Tax Amount': 'tax_amount',
                        'Fees Amount': 'fees_amount',
                        'Other Price': 'other_price',
                        'Dealer Discount': 'dealer_discount',
                        'Consumer Rebate': 'consumer_rebate',
                        'Dealer Accessories': 'dealer_accessories',
                        'Total Customer Savings': 'total_customer_savings',
                        'Total Dealer Rebate': 'total_dealer_rebate',
                        'Photo URL List': 'photo_url_list',
                        'Reference Dealer ID': 'reference_dealer_id'
                      };
                      
                      if (fieldMap[header]) {
                        fieldMapping.targetField = fieldMap[header];
                      }
                      
                      return fieldMapping;
                    });
                    
                    resolve({
                      success: true,
                      message: 'CSV preview successful',
                      fileName: firstCsvFile.filename,
                      totalRows: lines.length - 1, // Exclude header
                      headers: headers,
                      sampleData: sampleData,
                      fieldMappings: fieldMappings,
                      availableFiles: csvFiles.map(f => f.filename)
                    });
                    
                  } catch (parseError) {
                    reject(new Error(`Failed to parse CSV: ${parseError.message}`));
                  }
                });
                
                stream.on('error', (error) => {
                  conn.end();
                  reject(new Error(`Failed to read CSV file: ${error.message}`));
                });
              });
            });
          } else {
            // FTP implementation would go here
            reject(new Error('FTP not implemented yet'));
          }
        }).connect({
          host: testConfig.connection.host_url,
          port: testConfig.connection.port,
          username: testConfig.connection.username,
          password: testConfig.connection.password
        });
      }).then(result => {
        res.json(result);
      }).catch(error => {
        res.status(400).json({
          success: false,
          error: 'CSV preview failed',
          details: error.message
        });
      });
      
    } catch (uploadError) {
      res.status(400).json({
        success: false,
        error: 'CSV preview failed',
        details: uploadError.message
      });
    }

  } catch (error) {
    console.error('Error previewing CSV:', error);
    res.status(500).json({ error: 'Failed to preview CSV' });
  }
});

// POST /api/import/test-connection - Test FTP/SFTP connection
router.post('/test-connection', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    console.log('Test connection request body:', req.body);
    const { connectionType, hostUrl, port, username, password, remoteDirectory, filePattern } = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('Extracted values:', { connectionType, hostUrl, port, username, password: password ? '[HIDDEN]' : 'undefined', remoteDirectory, filePattern });
    
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
        remote_directory: remoteDirectory || '/',
        file_pattern: filePattern || '*'
      }
    };

    try {
      // Try to list files in the remote directory
      const { Client } = await import('ssh2');
      
      return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', () => {
          if (testConfig.connection.type === 'sftp') {
            conn.sftp((err, sftp) => {
              if (err) {
                conn.end();
                reject(err);
                return;
              }
              
              // First, try to list the root directory to see what's available
              sftp.readdir('/', (err, rootList) => {
                if (err) {
                  conn.end();
                  reject(new Error(`Cannot access root directory: ${err.message}`));
                  return;
                }
                
                console.log('Root directory contents:', rootList.map(f => f.filename));
                
                // Now try to list the specified remote directory
                sftp.readdir(testConfig.connection.remote_directory, (err, list) => {
                  conn.end();
                  if (err) {
                    // Provide more specific error information
                    let errorMessage = err.message;
                    if (err.message.includes('No such file')) {
                      const availableDirs = rootList.filter(f => f.attrs.isDirectory()).map(f => f.filename);
                      errorMessage = `Directory '${testConfig.connection.remote_directory}' does not exist. Available directories in root: ${availableDirs.join(', ')}`;
                      
                      // Suggest common paths if the requested directory doesn't exist
                      const commonPaths = ['/vauto', '/public', '/data', '/files', '/upload', '/export'];
                      const suggestedPaths = commonPaths.filter(path => availableDirs.includes(path.split('/').pop()));
                      if (suggestedPaths.length > 0) {
                        errorMessage += `. Try these paths: ${suggestedPaths.join(', ')}`;
                      }
                    } else if (err.message.includes('Permission denied')) {
                      errorMessage = `Permission denied accessing '${testConfig.connection.remote_directory}'. Check user permissions.`;
                    }
                    reject(new Error(errorMessage));
                  } else {
                    resolve({
                      success: true,
                      message: 'Connection test successful',
                      filesFound: list.length,
                      files: list.slice(0, 10).map(f => f.filename), // Show first 10 files
                      availableDirectories: rootList.filter(f => f.attrs.isDirectory()).map(f => f.filename)
                    });
                  }
                });
              });
            });
          } else {
            // FTP implementation would go here
            reject(new Error('FTP not implemented yet'));
          }
        }).connect({
          host: testConfig.connection.host_url,
          port: testConfig.connection.port,
          username: testConfig.connection.username,
          password: testConfig.connection.password
        });
      }).then(result => {
        res.json(result);
      }).catch(error => {
        res.status(400).json({
          success: false,
          error: 'Connection test failed',
          details: error.message
        });
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

// POST /api/import/smart-import - Smart import with automatic field mapping
router.post('/smart-import', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { configName, connectionData } = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!configName || !connectionData) {
      return res.status(400).json({ error: 'Configuration name and connection data are required' });
    }

    console.log('Smart import request:', { configName, connectionData });

    // Check if configuration with same name already exists
    let existingConfig;
    try {
      existingConfig = await importService.getImportConfigByName(dealerId, configName);
    } catch (error) {
      console.error('Error checking existing config:', error);
      return res.status(500).json({ error: 'Failed to check existing configuration' });
    }
    if (existingConfig) {
      return res.status(409).json({ 
        error: 'Configuration with this name already exists',
        existingConfigId: existingConfig.id,
        message: 'A configuration with this name already exists. Please use a different name or update the existing configuration.'
      });
    }

    // Step 1: Test connection and find available directories and files
    const { Client } = await import('ssh2');
    
    const connectionTest = await new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        if (connectionData.connectionType === 'sftp') {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }
            
            // First, try to list the root directory to see what's available
            sftp.readdir('/', (err, rootList) => {
              if (err) {
                conn.end();
                reject(new Error(`Cannot access root directory: ${err.message}`));
                return;
              }
              
              console.log('Root directory contents:', rootList.map(f => f.filename));
              
                          // Try the requested directory first (use the same logic as test connection)
            console.log('Trying directory:', connectionData.remoteDirectory);
            sftp.readdir(connectionData.remoteDirectory, (err, list) => {
                if (err) {
                  // If the requested directory doesn't exist, try common directories
                  console.log('Directory not found:', connectionData.remoteDirectory);
                  console.log('Error details:', err.message);
                  const commonDirs = ['/vauto', '/public', '/data', '/files', '/upload', '/export'];
                  const availableDirs = rootList.filter(f => f.attrs.isDirectory()).map(f => f.filename);
                  
                  console.log('Available directories:', availableDirs);
                  console.log('Trying common directories...');
                  
                  // Try each common directory
                  const tryNextDirectory = (index) => {
                    if (index >= commonDirs.length) {
                      conn.end();
                      reject(new Error(`No CSV files found in any common directories. Available directories: ${availableDirs.join(', ')}`));
                      return;
                    }
                    
                    const testDir = commonDirs[index];
                    if (availableDirs.includes(testDir.split('/').pop())) {
                      console.log(`Trying directory: ${testDir}`);
                      sftp.readdir(testDir, (err, list) => {
                        if (err) {
                          tryNextDirectory(index + 1);
                        } else {
                          // Find CSV files in this directory
                          const csvFiles = list.filter(file => {
                            const pattern = connectionData.filePattern.replace('*', '.*');
                            const regex = new RegExp(pattern);
                            return regex.test(file.filename);
                          });
                          
                          if (csvFiles.length > 0) {
                            // Get the latest file
                            const latestFile = csvFiles.sort((a, b) => b.attrs.mtime - a.attrs.mtime)[0];
                            conn.end();
                            resolve({
                              fileName: latestFile.filename,
                              fileSize: latestFile.attrs.size,
                              modifiedTime: latestFile.attrs.mtime,
                              directory: testDir
                            });
                          } else {
                            tryNextDirectory(index + 1);
                          }
                        }
                      });
                    } else {
                      tryNextDirectory(index + 1);
                    }
                  };
                  
                  tryNextDirectory(0);
                } else {
                  // Requested directory exists, find CSV files
                  console.log('Directory found successfully:', connectionData.remoteDirectory);
                  console.log('Directory found, listing files:', list.map(f => f.filename));
                  const csvFiles = list.filter(file => {
                    const pattern = connectionData.filePattern.replace('*', '.*');
                    const regex = new RegExp(pattern);
                    return regex.test(file.filename);
                  });
                  
                  console.log('CSV files found:', csvFiles.map(f => f.filename));
                  
                  if (csvFiles.length === 0) {
                    conn.end();
                    reject(new Error(`No CSV files found in ${connectionData.remoteDirectory}`));
                    return;
                  }
                  
                  // Get the latest file
                  const latestFile = csvFiles.sort((a, b) => b.attrs.mtime - a.attrs.mtime)[0];
                  console.log('Selected file:', latestFile.filename);
                  conn.end();
                  resolve({
                    fileName: latestFile.filename,
                    fileSize: latestFile.attrs.size,
                    modifiedTime: latestFile.attrs.mtime,
                    directory: connectionData.remoteDirectory
                  });
                }
              });
            });
          });
        } else {
          reject(new Error('FTP not implemented yet'));
        }
      }).connect({
        host: connectionData.hostUrl,
        port: connectionData.port,
        username: connectionData.username,
        password: connectionData.password
      });
    });

    // Step 2: Download and analyze the file
    const tempFilePath = path.join(__dirname, '../../uploads/imports/temp', connectionTest.fileName);
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const downloadResult = await new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        if (connectionData.connectionType === 'sftp') {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              reject(err);
              return;
            }
            
            // Use the directory where we found the file (ensure forward slashes for SFTP)
            const remotePath = connectionTest.directory + '/' + connectionTest.fileName;
            console.log('Downloading from:', remotePath);
            
            // Download file
            sftp.fastGet(remotePath, tempFilePath, (err) => {
              conn.end();
              if (err) {
                reject(err);
              } else {
                resolve({ localPath: tempFilePath, fileName: connectionTest.fileName });
              }
            });
          });
        } else {
          reject(new Error('FTP not implemented yet'));
        }
      }).connect({
        host: connectionData.hostUrl,
        port: connectionData.port,
        username: connectionData.username,
        password: connectionData.password
      });
    });

    // Step 3: Analyze CSV structure
    const csv = await import('csv-parser');
    const headers = [];
    const sampleData = [];
    let rowCount = 0;
    const maxSampleRows = 5;

    await new Promise((resolve, reject) => {
      fs.createReadStream(downloadResult.localPath)
        .pipe(csv.default())
        .on('headers', (headerList) => {
          headers.push(...headerList);
        })
        .on('data', (row) => {
          if (rowCount < maxSampleRows) {
            sampleData.push(row);
            rowCount++;
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    // Step 4: Create automatic field mappings
    const fieldMappings = headers.map((header, index) => {
      // Common field name mappings
      const fieldMapping = {
        'vin': 'vin',
        'vehicle_id': 'vin',
        'stock_number': 'stock_number',
        'stock': 'stock_number',
        'stock_#': 'stock_number',
        'make': 'make',
        'model': 'model',
        'year': 'year',
        'trim': 'trim',
        'series': 'series',
        'color': 'color',
        'exterior_color': 'color',
        'interior_color': 'interior_color',
        'mileage': 'mileage',
        'odometer': 'odometer',
        'price': 'price',
        'msrp': 'msrp',
        'body_style': 'body_style',
        'body': 'body_style',
        'engine_type': 'engine_type',
        'engine': 'engine_type',
        'displacement': 'displacement',
        'disp': 'displacement',
        'transmission': 'transmission',
        'certified': 'certified',
        'dealer_discount': 'dealer_discount',
        'discount': 'dealer_discount',
        'consumer_rebate': 'consumer_rebate',
        'rebate': 'consumer_rebate',
        'dealer_accessories': 'dealer_accessories',
        'accessories': 'dealer_accessories',
        'total_customer_savings': 'total_customer_savings',
        'customer_savings': 'total_customer_savings',
        'total_dealer_rebate': 'total_dealer_rebate',
        'dealer_rebate': 'total_dealer_rebate',
        'other_price': 'other_price',
        'photo_url_list': 'photo_url_list',
        'reference_dealer_id': 'reference_dealer_id',
        'dealerid': 'dealer_id'
      };

      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const targetField = fieldMapping[normalizedHeader] || 'custom_' + normalizedHeader;

      // Determine field type based on sample data
      let fieldType = 'string';
      if (sampleData.length > 0) {
        const sampleValue = sampleData[0][header];
        if (sampleValue !== undefined && sampleValue !== null && sampleValue !== '') {
          if (!isNaN(sampleValue) && sampleValue.toString().indexOf('.') === -1) {
            fieldType = 'number';
          } else if (!isNaN(sampleValue) && sampleValue.toString().indexOf('.') !== -1) {
            fieldType = 'number';
          } else if (sampleValue.toLowerCase() === 'true' || sampleValue.toLowerCase() === 'false') {
            fieldType = 'boolean';
          } else if (sampleValue.match(/^\d{4}-\d{2}-\d{2}/) || sampleValue.match(/^\d{2}\/\d{2}\/\d{4}/)) {
            fieldType = 'date';
          }
        }
      }

      return {
        sourceField: header,
        targetField: targetField,
        fieldType: fieldType,
        isRequired: normalizedHeader.includes('vin') || normalizedHeader.includes('stock'),
        defaultValue: '',
        transformationRule: '',
        fieldOrder: index + 1
      };
    });

    // Step 5: Create import configuration
    const configData = {
      configName: configName,
      connection: {
        type: connectionData.connectionType,
        hostUrl: connectionData.hostUrl,
        port: connectionData.port,
        username: connectionData.username,
        password: connectionData.password,
        remoteDirectory: connectionData.remoteDirectory,
        filePattern: connectionData.filePattern
      },
      fileSettings: {
        fileType: 'csv',
        delimiter: ',',
        hasHeader: true,
        encoding: 'UTF-8',
        dateFormat: 'YYYY-MM-DD'
      },
      schedule: {
        frequency: 'manual',
        timeHour: 0,
        timeMinute: 0
      },
      fieldMappings: fieldMappings,
      processing: {
        duplicateHandling: 'update',
        batchSize: 1000,
        maxErrors: 100,
        validateData: true,
        archiveProcessedFiles: true,
        archiveDirectory: '/processed'
      }
    };

    const result = await importService.createImportConfig(dealerId, configData);

    // Clean up temp file
    try {
      fs.unlinkSync(downloadResult.localPath);
    } catch (error) {
      console.log('Could not delete temp file:', error.message);
    }

    res.json({
      success: true,
      message: 'Smart import configuration created successfully',
      data: {
        configId: result.importConfigId,
        fileName: connectionTest.fileName,
        foundDirectory: connectionTest.directory,
        headers: headers,
        fieldMappings: fieldMappings,
        sampleData: sampleData,
        totalRows: rowCount
      }
    });

  } catch (error) {
    console.error('Error in smart import:', error);
    res.status(500).json({ 
      success: false,
      error: 'Smart import failed',
      details: error.message 
    });
  }
});

// POST /api/import/csv-upload - Upload and import CSV data directly
router.post('/csv-upload', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { data, fieldMappings } = req.body;
    
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    if (!fieldMappings || !Array.isArray(fieldMappings) || fieldMappings.length === 0) {
      return res.status(400).json({ error: 'No field mappings provided' });
    }

    // Use the authenticated user's dealer ID
    const targetDealerId = dealerId;

    // Validate required fields are mapped
    const requiredFields = ['vin', 'make', 'model', 'year'];
    const mappedFields = fieldMappings.map(fm => fm.targetField);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingRequired.length > 0) {
      return res.status(400).json({ 
        error: `Missing required field mappings: ${missingRequired.join(', ')}` 
      });
    }

    // Process the import data
    const importResult = await importService.importCSVData(data, fieldMappings, targetDealerId);

    res.json({
      success: true,
      message: 'CSV import completed successfully',
      data: importResult
    });

  } catch (error) {
    console.error('Error in CSV upload import:', error);
    res.status(500).json({ 
      success: false,
      error: 'CSV import failed',
      details: error.message 
    });
  }
});

export default router; 