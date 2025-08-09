import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import csv from 'csv-parser';
import xml2js from 'xml2js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ImportService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
    });
  }

  // Encryption/Decryption utilities (same as ETL service)
  encryptPassword(password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptPassword(encryptedPassword) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Import Configuration Management
  async createImportConfig(dealerId, configData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create main import config
      const configResult = await client.query(`
        INSERT INTO import_configs (dealer_id, config_name, is_active)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [dealerId, configData.configName, true]);

      const importConfigId = configResult.rows[0].id;

      // Create connection settings
      if (configData.connection) {
        await client.query(`
          INSERT INTO import_connection_settings (
            import_config_id, connection_type, host_url, port, username, 
            password_encrypted, remote_directory, file_pattern
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          importConfigId,
          configData.connection.type,
          configData.connection.hostUrl,
          configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
          configData.connection.username,
          this.encryptPassword(configData.connection.password),
          configData.connection.remoteDirectory || '/',
          configData.connection.filePattern || '*'
        ]);
      }

      // Create file settings
      if (configData.fileSettings) {
        await client.query(`
          INSERT INTO import_file_settings (
            import_config_id, file_type, delimiter, has_header, encoding, date_format
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          importConfigId,
          configData.fileSettings.fileType,
          configData.fileSettings.delimiter || ',',
          configData.fileSettings.hasHeader !== false,
          configData.fileSettings.encoding || 'UTF-8',
          configData.fileSettings.dateFormat || 'YYYY-MM-DD'
        ]);
      }

      // Create schedule settings
      if (configData.schedule) {
        await client.query(`
          INSERT INTO import_schedule_settings (
            import_config_id, frequency, time_hour, time_minute, 
            day_of_week, day_of_month, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          importConfigId,
          configData.schedule.frequency,
          configData.schedule.timeHour || 0,
          configData.schedule.timeMinute || 0,
          configData.schedule.dayOfWeek,
          configData.schedule.dayOfMonth,
          true
        ]);
      }

      // Create field mappings
      if (configData.fieldMappings && configData.fieldMappings.length > 0) {
        for (let i = 0; i < configData.fieldMappings.length; i++) {
          const mapping = configData.fieldMappings[i];
          await client.query(`
            INSERT INTO import_field_mappings (
              import_config_id, source_field, target_field, field_type, 
              is_required, default_value, transformation_rule, field_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            importConfigId,
            mapping.sourceField,
            mapping.targetField,
            mapping.fieldType,
            mapping.isRequired || false,
            mapping.defaultValue,
            mapping.transformationRule,
            mapping.fieldOrder || i + 1
          ]);
        }
      }

      // Create processing settings
      if (configData.processing) {
        await client.query(`
          INSERT INTO import_processing_settings (
            import_config_id, duplicate_handling, batch_size, max_errors, 
            validate_data, archive_processed_files, archive_directory
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          importConfigId,
          configData.processing.duplicateHandling || 'skip',
          configData.processing.batchSize || 1000,
          configData.processing.maxErrors || 100,
          configData.processing.validateData !== false,
          configData.processing.archiveProcessedFiles !== false,
          configData.processing.archiveDirectory || '/processed'
        ]);
      }

      await client.query('COMMIT');
      return { success: true, importConfigId };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getImportConfigs(dealerId) {
    const client = await this.pool.connect();
    try {
      // First get the basic configs
      const result = await client.query(`
        SELECT 
          ic.*,
          ics.connection_type, ics.host_url, ics.port, ics.username, ics.remote_directory, ics.file_pattern,
          ifs.file_type, ifs.delimiter, ifs.has_header, ifs.encoding, ifs.date_format,
          iss.frequency, iss.time_hour, iss.time_minute, iss.day_of_week, iss.day_of_month,
          ips.duplicate_handling, ips.batch_size, ips.max_errors, ips.validate_data
        FROM import_configs ic
        LEFT JOIN import_connection_settings ics ON ic.id = ics.import_config_id
        LEFT JOIN import_file_settings ifs ON ic.id = ifs.import_config_id
        LEFT JOIN import_schedule_settings iss ON ic.id = iss.import_config_id
        LEFT JOIN import_processing_settings ips ON ic.id = ips.import_config_id
        WHERE ic.dealer_id = $1
        ORDER BY ic.created_at DESC
      `, [dealerId]);

      // For each config, get the field mappings
      const configsWithMappings = await Promise.all(result.rows.map(async (config) => {
        const mappingsResult = await client.query(`
          SELECT * FROM import_field_mappings 
          WHERE import_config_id = $1 
          ORDER BY field_order
        `, [config.id]);
        
        return {
          ...config,
          fieldMappings: mappingsResult.rows
        };
      }));

      return configsWithMappings;
    } finally {
      client.release();
    }
  }

  async getImportConfigByName(dealerId, configName) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM import_configs WHERE dealer_id = $1 AND config_name = $2
      `, [dealerId, configName]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getImportConfig(importConfigId) {
    const client = await this.pool.connect();
    try {
      // Get main config
      const configResult = await client.query(`
        SELECT * FROM import_configs WHERE id = $1
      `, [importConfigId]);

      if (configResult.rows.length === 0) {
        return null;
      }

      const config = configResult.rows[0];

      // Get connection settings
      const connectionResult = await client.query(`
        SELECT *, password_encrypted FROM import_connection_settings 
        WHERE import_config_id = $1
      `, [importConfigId]);

      // Get file settings
      const fileSettingsResult = await client.query(`
        SELECT * FROM import_file_settings 
        WHERE import_config_id = $1
      `, [importConfigId]);

      // Get field mappings
      const mappingsResult = await client.query(`
        SELECT * FROM import_field_mappings 
        WHERE import_config_id = $1 
        ORDER BY field_order
      `, [importConfigId]);

      // Get processing settings
      const processingResult = await client.query(`
        SELECT * FROM import_processing_settings 
        WHERE import_config_id = $1
      `, [importConfigId]);

      // Get schedule settings
      const scheduleResult = await client.query(`
        SELECT * FROM import_schedule_settings 
        WHERE import_config_id = $1
      `, [importConfigId]);

      // Combine all settings
      const fullConfig = {
        ...config,
        connection_type: connectionResult.rows[0]?.connection_type,
        host_url: connectionResult.rows[0]?.host_url,
        port: connectionResult.rows[0]?.port,
        username: connectionResult.rows[0]?.username,
        // password: '', // Don't return password for security when editing
        password: connectionResult.rows[0]?.password_encrypted ? 
        remote_directory: connectionResult.rows[0]?.remote_directory,
        file_pattern: connectionResult.rows[0]?.file_pattern,
        file_type: fileSettingsResult.rows[0]?.file_type,
        delimiter: fileSettingsResult.rows[0]?.delimiter,
        has_header: fileSettingsResult.rows[0]?.has_header,
        encoding: fileSettingsResult.rows[0]?.encoding,
        date_format: fileSettingsResult.rows[0]?.date_format,
        frequency: scheduleResult.rows[0]?.frequency,
        time_hour: scheduleResult.rows[0]?.time_hour,
        time_minute: scheduleResult.rows[0]?.time_minute,
        day_of_week: scheduleResult.rows[0]?.day_of_week,
        day_of_month: scheduleResult.rows[0]?.day_of_month,
        duplicate_handling: processingResult.rows[0]?.duplicate_handling,
        batch_size: processingResult.rows[0]?.batch_size,
        max_errors: processingResult.rows[0]?.max_errors,
        validate_data: processingResult.rows[0]?.validate_data,
        archive_processed_files: processingResult.rows[0]?.archive_processed_files,
        archive_directory: processingResult.rows[0]?.archive_directory,
        fieldMappings: mappingsResult.rows,
        processing: processingResult.rows[0] || {},
        schedule: scheduleResult.rows[0] || {}
      };

      return fullConfig;
    } finally {
      client.release();
    }
  }

  async updateImportConfig(importConfigId, configData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update main import config
      await client.query(`
        UPDATE import_configs 
        SET config_name = $1, updated_at = NOW()
        WHERE id = $2
      `, [configData.configName, importConfigId]);

      // Update or create connection settings
      if (configData.connection) {
        const connectionCheck = await client.query(
          'SELECT id FROM import_connection_settings WHERE import_config_id = $1',
          [importConfigId]
        );

        if (connectionCheck.rows.length > 0) {
          if (configData.connection.password) {
            // Update with password
            await client.query(`
              UPDATE import_connection_settings 
              SET connection_type = $1, host_url = $2, port = $3, username = $4, 
                  password_encrypted = $5, remote_directory = $6, file_pattern = $7
              WHERE import_config_id = $8
            `, [
              configData.connection.type,
              configData.connection.hostUrl,
              configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
              configData.connection.username,
              this.encryptPassword(configData.connection.password),
              configData.connection.remoteDirectory || '/',
              configData.connection.filePattern || '*',
              importConfigId
            ]);
          } else {
            // Update without password
            await client.query(`
              UPDATE import_connection_settings 
              SET connection_type = $1, host_url = $2, port = $3, username = $4, 
                  remote_directory = $5, file_pattern = $6
              WHERE import_config_id = $7
            `, [
              configData.connection.type,
              configData.connection.hostUrl,
              configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
              configData.connection.username,
              configData.connection.remoteDirectory || '/',
              configData.connection.filePattern || '*',
              importConfigId
            ]);
          }
        } else {
          // Create new connection settings
          await client.query(`
            INSERT INTO import_connection_settings (
              import_config_id, connection_type, host_url, port, username, 
              password_encrypted, remote_directory, file_pattern
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            importConfigId,
            configData.connection.type,
            configData.connection.hostUrl,
            configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
            configData.connection.username,
            this.encryptPassword(configData.connection.password || ''),
            configData.connection.remoteDirectory || '/',
            configData.connection.filePattern || '*'
          ]);
        }
      }

      // Update or create file settings
      if (configData.fileSettings) {
        const fileSettingsCheck = await client.query(
          'SELECT id FROM import_file_settings WHERE import_config_id = $1',
          [importConfigId]
        );

        if (fileSettingsCheck.rows.length > 0) {
          await client.query(`
            UPDATE import_file_settings 
            SET file_type = $1, delimiter = $2, has_header = $3, encoding = $4, date_format = $5
            WHERE import_config_id = $6
          `, [
            configData.fileSettings.fileType,
            configData.fileSettings.delimiter,
            configData.fileSettings.hasHeader,
            configData.fileSettings.encoding,
            configData.fileSettings.dateFormat,
            importConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO import_file_settings (
              import_config_id, file_type, delimiter, has_header, encoding, date_format
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            importConfigId,
            configData.fileSettings.fileType,
            configData.fileSettings.delimiter,
            configData.fileSettings.hasHeader,
            configData.fileSettings.encoding,
            configData.fileSettings.dateFormat
          ]);
        }
      }

      // Update or create schedule settings
      if (configData.schedule) {
        const scheduleCheck = await client.query(
          'SELECT id FROM import_schedule_settings WHERE import_config_id = $1',
          [importConfigId]
        );

        if (scheduleCheck.rows.length > 0) {
          await client.query(`
            UPDATE import_schedule_settings 
            SET frequency = $1, time_hour = $2, time_minute = $3, day_of_week = $4, day_of_month = $5
            WHERE import_config_id = $6
          `, [
            configData.schedule.frequency,
            configData.schedule.timeHour || 0,
            configData.schedule.timeMinute || 0,
            configData.schedule.dayOfWeek,
            configData.schedule.dayOfMonth,
            importConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO import_schedule_settings (
              import_config_id, frequency, time_hour, time_minute, day_of_week, day_of_month
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            importConfigId,
            configData.schedule.frequency,
            configData.schedule.timeHour || 0,
            configData.schedule.timeMinute || 0,
            configData.schedule.dayOfWeek,
            configData.schedule.dayOfMonth
          ]);
        }
      }

      // Update field mappings - delete existing and insert new ones
      if (configData.fieldMappings && configData.fieldMappings.length > 0) {
        // Delete existing field mappings
        await client.query('DELETE FROM import_field_mappings WHERE import_config_id = $1', [importConfigId]);
        
        // Insert new field mappings
        for (let i = 0; i < configData.fieldMappings.length; i++) {
          const mapping = configData.fieldMappings[i];
          await client.query(`
            INSERT INTO import_field_mappings (
              import_config_id, source_field, target_field, field_type, 
              is_required, default_value, transformation_rule, field_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            importConfigId,
            mapping.sourceField,
            mapping.targetField,
            mapping.fieldType,
            mapping.isRequired || false,
            mapping.defaultValue,
            mapping.transformationRule,
            mapping.fieldOrder || i + 1
          ]);
        }
      }

      // Update or create processing settings
      if (configData.processing) {
        const processingCheck = await client.query(
          'SELECT id FROM import_processing_settings WHERE import_config_id = $1',
          [importConfigId]
        );

        if (processingCheck.rows.length > 0) {
          await client.query(`
            UPDATE import_processing_settings 
            SET duplicate_handling = $1, batch_size = $2, max_errors = $3, 
                validate_data = $4, archive_processed_files = $5, archive_directory = $6
            WHERE import_config_id = $7
          `, [
            configData.processing.duplicateHandling,
            configData.processing.batchSize,
            configData.processing.maxErrors,
            configData.processing.validateData,
            configData.processing.archiveProcessedFiles,
            configData.processing.archiveDirectory,
            importConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO import_processing_settings (
              import_config_id, duplicate_handling, batch_size, max_errors, 
              validate_data, archive_processed_files, archive_directory
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            importConfigId,
            configData.processing.duplicateHandling,
            configData.processing.batchSize,
            configData.processing.maxErrors,
            configData.processing.validateData,
            configData.processing.archiveProcessedFiles,
            configData.processing.archiveDirectory
          ]);
        }
      }

      await client.query('COMMIT');

      // Return updated config
      return await this.getImportConfig(importConfigId);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // File Download and Processing
  async downloadFile(config) {
    return new Promise(async (resolve, reject) => {
      const connectionType = config.connection_type || 'sftp';
      
      if (connectionType === 'sftp') {
        const { Client } = await import('ssh2');
        const conn = new Client();
        
        conn.on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              reject(new Error(`SFTP connection failed: ${err.message}`));
              return;
            }
            
            // List files in remote directory
            console.log('Listing files in directory:', config.remote_directory || '/');
            sftp.readdir(config.remote_directory || '/', (err, files) => {
              if (err) {
                console.error('Error listing files:', err);
                conn.end();
                reject(new Error(`Failed to list files: ${err.message}`));
                return;
              }
              
              console.log('Found files:', files.map(f => f.filename));
              
              // Find files matching pattern
              const pattern = config.file_pattern || '*.csv';
              const matchingFiles = files.filter(file => {
                if (pattern.includes('*')) {
                  const regex = new RegExp(pattern.replace('*', '.*'));
                  return regex.test(file.filename);
                }
                return file.filename === pattern;
              });
              
              console.log('Matching files:', matchingFiles.map(f => f.filename));
              
              if (matchingFiles.length === 0) {
                conn.end();
                reject(new Error(`No files found matching pattern: ${pattern}`));
                return;
              }
              
              // Use the first matching file
              const fileName = matchingFiles[0].filename;
              const remotePath = `${config.remote_directory}/${fileName}`;
              const localPath = path.join(__dirname, '../../uploads/imports/temp', fileName);
              
              // Ensure local directory exists
              const localDir = path.dirname(localPath);
              if (!fs.existsSync(localDir)) {
                fs.mkdirSync(localDir, { recursive: true });
              }
              
              // Download file
              console.log('Downloading file:', remotePath, 'to:', localPath);
              sftp.fastGet(remotePath, localPath, (err) => {
                conn.end();
                if (err) {
                  console.error('Error downloading file:', err);
                  reject(new Error(`Failed to download file: ${err.message}`));
                } else {
                  console.log('File downloaded successfully:', fileName);
                  resolve({ localPath, fileName });
                }
              });
            });
          });
        });
        
        conn.on('error', (err) => {
          console.error('SSH connection error:', err);
          reject(new Error(`SSH connection failed: ${err.message}`));
        });
        
        console.log('Connecting to SFTP server:', {
          host: config.host_url,
          port: config.port,
          username: config.username,
          remoteDirectory: config.remote_directory,
          filePattern: config.file_pattern
        });
        
        conn.connect({
          host: config.host_url,
          port: config.port,
          username: config.username,
          password: config.password
        });
      } else {
        // FTP implementation would go here
        reject(new Error('FTP not implemented yet'));
      }
    });
  }

  // File Parsing
  async parseFile(filePath, config) {
    const fileType = config.file_type || 'csv';
    
    switch (fileType) {
      case 'csv':
        return await this.parseCSV(filePath, config);
      case 'xml':
        return await this.parseXML(filePath, config);
      case 'json':
        return await this.parseJSON(filePath, config);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  async parseCSV(filePath, config) {
    return new Promise((resolve, reject) => {
      const results = [];
      const hasHeader = config.has_header !== false;
      let headers = null;
      
      fs.createReadStream(filePath)
        .pipe(csv({
          separator: config.delimiter || ',',
          headers: hasHeader
        }))
        .on('data', (data) => {
          if (!hasHeader && !headers) {
            headers = Object.keys(data);
          }
          results.push(data);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async parseXML(filePath, config) {
    const xmlData = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser();
    
    return new Promise((resolve, reject) => {
      parser.parseString(xmlData, (err, result) => {
        if (err) {
          reject(err);
        } else {
          // Extract records from XML (this would need to be customized based on XML structure)
          const records = this.extractRecordsFromXML(result);
          resolve(records);
        }
      });
    });
  }

  async parseJSON(filePath, config) {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonData);
    
    // Handle different JSON structures
    if (Array.isArray(data)) {
      return data;
    } else if (data.records || data.items) {
      return data.records || data.items;
    } else {
      return [data];
    }
  }

  extractRecordsFromXML(xmlData) {
    // This is a simplified example - you'd need to customize based on your XML structure
    const records = [];
    
    // Example: extract from <records><record>...</record></records>
    if (xmlData.records && xmlData.records.record) {
      const recordArray = Array.isArray(xmlData.records.record) 
        ? xmlData.records.record 
        : [xmlData.records.record];
      
      recordArray.forEach(record => {
        const flatRecord = {};
        this.flattenXMLObject(record, flatRecord);
        records.push(flatRecord);
      });
    }
    
    return records;
  }

  flattenXMLObject(obj, result, prefix = '') {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.flattenXMLObject(obj[key], result, prefix + key + '_');
      } else {
        result[prefix + key] = obj[key];
      }
    }
  }

  // Database Operations
  async processRecords(records, config, importHistoryId) {
    const client = await this.pool.connect();
    try {
      let processed = 0;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const errors = [];

      console.log('Processing', records.length, 'records with', config.fieldMappings?.length || 0, 'field mappings');
      console.log('Config dealer_id:', config.dealer_id);
      console.log('Field mappings:', config.fieldMappings?.map(fm => `${fm.source_field || fm.sourceField} -> ${fm.target_field || fm.targetField}`));

      for (const record of records) {
        try {
          processed++;
          
          if (processed % 100 === 0) {
            console.log(`Processed ${processed}/${records.length} records`);
          }
          
          console.log(`\n--- Processing record ${processed} ---`);
          console.log('Original record:', JSON.stringify(record, null, 2));
          
          // Transform record based on field mappings
          const transformedRecord = this.transformRecordWithValidation(record, config.fieldMappings);
          
          console.log('Transformed record:', JSON.stringify(transformedRecord, null, 2));
          
          // Validate record
          if (config.processing.validate_data) {
            const validationResult = this.validateRecord(transformedRecord, config.fieldMappings);
            if (!validationResult.isValid) {
              console.log('Validation failed:', validationResult.errors);
              failed++;
              errors.push({
                row_number: processed,
                error_message: validationResult.errors.join(', '),
                raw_data: JSON.stringify(record)
              });
              continue;
            }
          }
          
          // Insert or update record using the database function
          const result = await this.insertOrUpdateVehicleRecord(client, transformedRecord, config);
          
          console.log('Insert/Update result:', result);
          
          if (result.action === 'inserted') {
            inserted++;
            console.log(`✅ Record ${processed} inserted successfully`);
          } else if (result.action === 'updated') {
            updated++;
            console.log(`🔄 Record ${processed} updated successfully`);
          } else {
            skipped++;
            console.log(`⏭️ Record ${processed} skipped`);
          }
          
        } catch (error) {
          console.error('❌ Error processing record:', error.message, 'Record:', JSON.stringify(record));
          failed++;
          errors.push({
            row_number: processed,
            error_message: error.message,
            raw_data: JSON.stringify(record)
          });
        }
      }
      
      console.log(`\n=== Import Summary ===`);
      console.log(`Total processed: ${processed}`);
      console.log(`Inserted: ${inserted}`);
      console.log(`Updated: ${updated}`);
      console.log(`Skipped: ${skipped}`);
      console.log(`Failed: ${failed}`);
      
      // Update import history
      await client.query(`
        UPDATE import_history 
        SET records_processed = $1, records_inserted = $2, records_updated = $3, 
            records_skipped = $4, records_failed = $5, completed_at = NOW()
        WHERE id = $6
      `, [processed, inserted, updated, skipped, failed, importHistoryId]);
      
      // Insert errors
      if (errors.length > 0) {
        for (const error of errors) {
          await client.query(`
            INSERT INTO import_errors (import_history_id, row_number, error_message, raw_data)
            VALUES ($1, $2, $3, $4)
          `, [importHistoryId, error.row_number, error.error_message, error.raw_data]);
        }
      }
      
      return { processed, inserted, updated, skipped, failed, errors };
      
    } finally {
      client.release();
    }
  }

  async insertOrUpdateVehicleRecord(client, record, config) {
    // Use the database function for vehicle import
    const dealerId = config.dealer_id;
    
    console.log('=== INSERT/UPDATE VEHICLE DEBUG ===');
    console.log('Config dealer_id:', dealerId);
    console.log('Record VIN:', record.vin);
    console.log('Record make:', record.make);
    console.log('Record model:', record.model);
    console.log('=== END INSERT/UPDATE VEHICLE DEBUG ===');
    
    // Ensure dealer ID is properly formatted
    if (!dealerId) {
      throw new Error('Dealer ID is required for vehicle import');
    }
    
    // Extract reference dealer ID from CSV data (if available)
    const referenceDealerId = record.dealerid || record.dealer_id || record.reference_dealer_id || null;
    
    // Transform boolean fields properly
    const certified = this.transformBooleanField(record.certified);
    
    // Debug: Log the record being processed
    console.log('Processing vehicle record:', {
      vin: record.vin,
      make: record.make,
      model: record.model,
      dealerId: dealerId,
      referenceDealerId: referenceDealerId,
      certified: certified
    });
    
    // Log the full record for debugging
    console.log('Full record data:', JSON.stringify(record, null, 2));
    
    // Map the record fields to the function parameters (updated for new function signature)
    const queryParams = [
      dealerId,                                    // p_dealer_id (session dealer ID)
      record.vin || null,                          // p_vin
      record.make || null,                         // p_make
      record.model || null,                        // p_model
      record.series || null,                       // p_series
      record.stock_number || null,                 // p_stock_number
      record.new_used || 'used',                   // p_new_used - MISSING PARAMETER ADDED
      record.body_style || null,                   // p_body_style
      certified,                                   // p_certified (transformed boolean)
      record.color || null,                        // p_color
      record.interior_color || null,               // p_interior_color
      record.engine_type || null,                  // p_engine_type
      record.displacement || null,                 // p_displacement
      record.features || null,                     // p_features
      this.convertToNumberOrNull(record.odometer), // p_odometer (ensure it's a number or null)
      this.convertToNumberOrNull(record.price),    // p_price (ensure it's a number or null)
      this.convertToNumberOrNull(record.other_price), // p_other_price (ensure it's a number or null)
      record.transmission || null,                 // p_transmission
      this.convertToNumberOrNull(record.msrp),     // p_msrp (ensure it's a number or null)
      this.convertToNumberOrNull(record.dealer_discount), // p_dealer_discount (ensure it's a number or null)
      this.convertToNumberOrNull(record.consumer_rebate), // p_consumer_rebate (ensure it's a number or null)
      this.convertToNumberOrNull(record.dealer_accessories), // p_dealer_accessories (ensure it's a number or null)
      this.convertToNumberOrNull(record.total_customer_savings), // p_total_customer_savings (ensure it's a number or null)
      this.convertToNumberOrNull(record.total_dealer_rebate), // p_total_dealer_rebate (ensure it's a number or null)
      record.photo_url_list || null,               // p_photo_url_list
      this.convertToNumberOrNull(record.year),     // p_year (ensure it's a number or null)
      referenceDealerId                            // p_reference_dealer_id (from CSV)
    ];
    
    // Log the query parameters with data types
    console.log(queryParams);
    console.log('Insert query parameters with types:');
    const paramNames = [
      'p_dealer_id', 'p_vin', 'p_make', 'p_model', 'p_series', 'p_stock_number', 'p_new_used', 'p_body_style', 'p_certified',
      'p_color', 'p_interior_color', 'p_engine_type', 'p_displacement', 'p_features', 'p_odometer', 'p_price',
      'p_other_price', 'p_transmission', 'p_msrp', 'p_dealer_discount', 'p_consumer_rebate', 'p_dealer_accessories',
      'p_total_customer_savings', 'p_total_dealer_rebate', 'p_photo_url_list', 'p_year', 'p_reference_dealer_id'
    ];
    queryParams.forEach((param, index) => {
      const paramType = param === null ? 'null' : typeof param;
      const paramValue = param === null ? 'null' : 
                        typeof param === 'string' ? `'${param}'` : 
                        typeof param === 'boolean' ? param.toString() : param;
      console.log(`  ${paramNames[index]}: ${paramValue} (${paramType})`);
    });
    
    // Log the exact SQL query for debugging
    const sqlQuery = `
      SELECT import_vehicle_from_csv(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) as vehicle_id
    `;
    console.log('SQL Query:jawad ', sqlQuery);
    
    // Log the exact query with parameter values for debugging
    console.log('Parameter mapping:');
    queryParams.forEach((param, index) => {
      console.log(`  ${paramNames[index]}: ${param} (${typeof param})`);
    });
    
    // Show the actual SQL with values for debugging
    console.log('Actual SQL with values:');
    const sqlWithValues = `
      SELECT import_vehicle_from_csv(
        '${queryParams[0]}', '${queryParams[1]}', '${queryParams[2]}', '${queryParams[3]}', 
        '${queryParams[4]}', '${queryParams[5]}', '${queryParams[6]}', ${queryParams[7]}, 
        '${queryParams[8]}', '${queryParams[9]}', '${queryParams[10]}', '${queryParams[11]}', 
        '${queryParams[12]}', ${queryParams[13]}, ${queryParams[14]}, ${queryParams[15]}, 
        '${queryParams[16]}', ${queryParams[17]}, ${queryParams[18]}, ${queryParams[19]}, 
        ${queryParams[20]}, ${queryParams[21]}, ${queryParams[22]}, '${queryParams[23]}', 
        ${queryParams[24]}, '${queryParams[25]}', '${queryParams[26]}'
      ) as vehicle_id
    `;
    console.log(sqlWithValues);
    
    // Log the data array being sent to the database function in the requested format
    console.log('// The data array being sent to the database function:');
    console.log('[');
    const fieldComments = [
      'dealer_id (from session)',
      'vin',
      'make',
      'model',
      'series',
      'stock_number',
      'body_style',
      'certified',
      'color',
      'interior_color',
      'engine_type',
      'displacement',
      'features (long string)',
      'odometer',
      'mileage',
      'price',
      'other_price',
      'transmission',
      'msrp',
      'dealer_discount',
      'consumer_rebate',
      'dealer_accessories',
      'total_customer_savings',
      'total_dealer_rebate',
      'photo_url_list',
      'year',
      'reference_dealer_id'
    ];
    queryParams.forEach((param, index) => {
      const paramValue = param === null ? 'null' : 
                        typeof param === 'string' ? `'${param}'` : 
                        typeof param === 'boolean' ? param.toString() : param;
      const comment = fieldComments[index];
      console.log(`  ${paramValue},                                     // ${comment}`);
    });
    console.log(']');
    
    try {
      const result = await client.query(sqlQuery, queryParams);
      console.log('Database function result:', result.rows[0]);
      
      // Check if this was an insert or update by checking if the vehicle existed before
      const existingCheck = await client.query(
        'SELECT id FROM vehicles WHERE vin = $1 AND dealer_id = $2',
        [record.vin, dealerId]
      );
      
      if (existingCheck.rows.length > 0) {
        return { action: 'updated', vehicleId: result.rows[0]?.vehicle_id };
      } else {
        return { action: 'inserted', vehicleId: result.rows[0]?.vehicle_id };
      }
    } catch (error) {
      console.error('Database error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        where: error.where
      });
      throw error;
    }
  }

  // Helper method to transform boolean fields
  transformBooleanField(value) {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    
    const stringValue = value.toString().toLowerCase().trim();
    
    // Check for common boolean patterns
    if (stringValue === 'true' || stringValue === '1' || stringValue === 'yes' || stringValue === 'y') {
      return true;
    }
    
    if (stringValue === 'false' || stringValue === '0' || stringValue === 'no' || stringValue === 'n') {
      return false;
    }
    
    // If it's a long text string (like features), treat as false
    if (stringValue.length > 10) {
      console.log(`Converting long text to false for boolean field: "${stringValue}"`);
      return false;
    }
    
    // Default to false for unknown values
    console.log(`Unknown boolean value: "${stringValue}", defaulting to false`);
    return false;
  }

  // Helper method to clean special characters
  cleanSpecialCharacters(value) {
    if (!value) return value;
    
    let cleaned = value.toString();
    
    // Remove asterisks and other special characters
    cleaned = cleaned.replace(/\*\*/g, ''); // Remove **
    cleaned = cleaned.replace(/\*/g, '');   // Remove single *
    cleaned = cleaned.replace(/[^\w\s\-.,$]/g, ''); // Keep only alphanumeric, spaces, hyphens, commas, dots, and dollar signs
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  // Helper method to detect field type based on field name and content
  detectFieldType(fieldName, fieldValue) {
    const fieldNameLower = fieldName.toLowerCase();
    const valueStr = fieldValue ? fieldValue.toString().toLowerCase() : '';
    
    // Check if the value contains numbers
    const hasNumbers = /\d/.test(valueStr);
    const hasOnlyNumbers = /^\d+$/.test(valueStr);
    const hasDecimalNumbers = /^\d+\.\d+$/.test(valueStr);
    
    // Numeric fields - check both name and content
    if (fieldNameLower.includes('price') || fieldNameLower.includes('cost') || 
        fieldNameLower.includes('msrp') || fieldNameLower.includes('discount') || 
        fieldNameLower.includes('rebate') || fieldNameLower.includes('savings') ||
        fieldNameLower.includes('accessories')) {
      return 'decimal';
    }
    
    // Integer fields - check both name and content
    if (fieldNameLower.includes('year') || fieldNameLower.includes('odometer') || 
        fieldNameLower.includes('mileage') || fieldNameLower.includes('miles')) {
      return 'integer';
    }
    
    // Boolean fields
    if (fieldNameLower.includes('certified') || fieldNameLower.includes('certification')) {
      return 'boolean';
    }
    
    // Date fields
    if (fieldNameLower.includes('date') || fieldNameLower.includes('created') || 
        fieldNameLower.includes('updated')) {
      return 'date';
    }
    
    // Auto-detect based on content
    if (hasOnlyNumbers) {
      return 'integer';
    }
    
    if (hasDecimalNumbers || (hasNumbers && (valueStr.includes('$') || valueStr.includes(',')))) {
      return 'decimal';
    }
    
    // Default to string
    return 'string';
  }

  // Comprehensive data type validation and conversion
  validateAndConvertDataType(value, fieldType, fieldName) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    let stringValue = value.toString().trim();
    
    // Remove special characters and clean the string
    stringValue = this.cleanSpecialCharacters(stringValue);
    
    try {
      switch (fieldType) {
        case 'string':
          return stringValue;
          
        case 'number':
        case 'decimal':
          // Remove common currency symbols and commas
          const cleanNumber = stringValue.replace(/[$,€£¥]/g, '').replace(/,/g, '');
          const numValue = parseFloat(cleanNumber);
          if (isNaN(numValue)) {
            console.log(`Invalid number value for ${fieldName}: "${stringValue}", defaulting to null`);
            return null;
          }
          return numValue;
          
        case 'integer':
          // Remove common currency symbols and commas
          const cleanInt = stringValue.replace(/[$,€£¥]/g, '').replace(/,/g, '');
          const intValue = parseInt(cleanInt);
          if (isNaN(intValue)) {
            console.log(`Invalid integer value for ${fieldName}: "${stringValue}", defaulting to null`);
            return null;
          }
          return intValue;
          
        case 'boolean':
          return this.transformBooleanField(value);
          
        case 'date':
          const dateValue = new Date(stringValue);
          if (isNaN(dateValue.getTime())) {
            console.log(`Invalid date value for ${fieldName}: "${stringValue}", defaulting to null`);
            return null;
          }
          return dateValue.toISOString();
          
        default:
          return stringValue;
      }
    } catch (error) {
      console.log(`Error converting ${fieldName} (${fieldType}): "${stringValue}"`, error.message);
      return null;
    }
  }

  // Enhanced transformRecord with data type validation
  transformRecordWithValidation(record, fieldMappings) {
    const transformed = {};
    
    console.log('Starting record transformation with validation...');
    console.log('Original record keys:', Object.keys(record));
    console.log('Field mappings count:', fieldMappings.length);
    
    for (const mapping of fieldMappings) {
      // Handle both camelCase and snake_case field names
      const sourceField = mapping.source_field || mapping.sourceField;
      const targetField = mapping.target_field || mapping.targetField;
      let fieldType = mapping.field_type || mapping.fieldType;
      
      // Skip mappings with undefined or empty target fields
      if (!targetField || targetField === '') {
        console.log(`Skipping mapping for ${sourceField}: no target field specified`);
        continue;
      }
      
      const fieldNameLower = targetField.toLowerCase();
      
      const sourceValue = record[sourceField];
      
      console.log(`Mapping field: ${sourceField} -> ${targetField}, Original Value: "${sourceValue}"`);
      
      if (sourceValue !== undefined) {
        // Clean the value first
        const cleanedValue = this.cleanSpecialCharacters(sourceValue);
        console.log(`Cleaned value for ${targetField}: "${sourceValue}" -> "${cleanedValue}"`);
        
        // Auto-detect field type if not specified
        if (!fieldType) {
          fieldType = this.detectFieldType(targetField, cleanedValue);
          console.log(`Auto-detected field type for ${targetField}: ${fieldType}`);
        }
        
        // Try to extract meaningful data first
        let transformedValue = this.extractMeaningfulData(sourceValue, fieldType, targetField);
        
        // If extraction failed, try standard validation
        if (transformedValue === null) {
          transformedValue = this.validateAndConvertDataType(cleanedValue, fieldType, targetField);
        }
        
        // Special handling for numeric fields that contain text
        if (transformedValue === null && (fieldType === 'number' || fieldType === 'integer' || fieldType === 'decimal')) {
          // Check if the text contains any numeric patterns
          const numericPattern = /\d+/;
          if (numericPattern.test(cleanedValue)) {
            // Extract the first number found
            const numbers = cleanedValue.match(/\d+/g);
            if (numbers && numbers.length > 0) {
              const extractedNumber = fieldType === 'integer' ? parseInt(numbers[0]) : parseFloat(numbers[0]);
              console.log(`Extracted number from text for ${targetField}: "${cleanedValue}" -> ${extractedNumber}`);
              transformedValue = extractedNumber;
            }
          }
        }
        
        // Apply transformation rules if any
        const transformationRule = mapping.transformation_rule || mapping.transformationRule;
        if (transformationRule && transformedValue !== null) {
          try {
            const rules = JSON.parse(transformationRule);
            transformedValue = this.applyTransformationRules(transformedValue, rules);
            console.log(`Applied transformation rules to ${sourceField}: "${cleanedValue}" -> "${transformedValue}"`);
          } catch (error) {
            console.error('Error applying transformation rules:', error);
          }
        }
        
        // Apply pipe-separated data transformation for string fields that might contain pipes
        if (transformedValue !== null && typeof transformedValue === 'string' && 
            (fieldNameLower.includes('feature') || fieldNameLower.includes('option') || 
             fieldNameLower.includes('accessory') || fieldNameLower.includes('package') ||
             targetField === 'features')) {
          transformedValue = this.transformPipeSeparatedData(transformedValue);
        }
        
        // Apply image URL list transformation for image-related fields
        if (transformedValue !== null && typeof transformedValue === 'string' && 
            (fieldNameLower.includes('image') || fieldNameLower.includes('photo') || 
             fieldNameLower.includes('picture') || fieldNameLower.includes('img') ||
             targetField === 'photo_url_list' || targetField === 'images')) {
          transformedValue = this.transformImageUrlList(transformedValue);
        }
        
        transformed[targetField] = transformedValue;
        console.log(`Final value for ${targetField}: ${transformedValue} (${typeof transformedValue})`);
      } else if (mapping.default_value || mapping.defaultValue) {
        const defaultValue = mapping.default_value || mapping.defaultValue;
        transformed[targetField] = this.validateAndConvertDataType(defaultValue, fieldType, targetField);
        console.log(`Using default value for ${targetField}: "${defaultValue}" -> ${transformed[targetField]}`);
      } else {
        console.log(`No value found for ${sourceField}, skipping ${targetField}`);
      }
    }
    
    // Debug: Log first few transformations
    if (Object.keys(transformed).length > 0) {
      const sampleKeys = Object.keys(transformed).slice(0, 3);
      console.log('Sample transformations:', sampleKeys.map(key => `${key}: ${transformed[key]} (${typeof transformed[key]})`));
    }
    
    console.log('Final transformed record keys:', Object.keys(transformed));
    return transformed;
  }

  transformRecord(record, fieldMappings) {
    const transformed = {};
    
    console.log('Starting record transformation...');
    console.log('Original record keys:', Object.keys(record));
    console.log('Field mappings count:', fieldMappings.length);
    
    for (const mapping of fieldMappings) {
      // Handle both camelCase and snake_case field names
      const sourceField = mapping.source_field || mapping.sourceField;
      const targetField = mapping.target_field || mapping.targetField;
      
      const sourceValue = record[sourceField];
      
      console.log(`Mapping field: ${sourceField} -> ${targetField}, Value: "${sourceValue}"`);
      
      if (sourceValue !== undefined) {
        // Apply transformation rules if any
        let transformedValue = sourceValue;
        
        const transformationRule = mapping.transformation_rule || mapping.transformationRule;
        if (transformationRule) {
          try {
            const rules = JSON.parse(transformationRule);
            transformedValue = this.applyTransformationRules(sourceValue, rules);
            console.log(`Applied transformation rules to ${sourceField}: "${sourceValue}" -> "${transformedValue}"`);
          } catch (error) {
            console.error('Error applying transformation rules:', error);
          }
        }
        
        transformed[targetField] = transformedValue;
      } else if (mapping.default_value || mapping.defaultValue) {
        const defaultValue = mapping.default_value || mapping.defaultValue;
        transformed[targetField] = defaultValue;
        console.log(`Using default value for ${targetField}: "${defaultValue}"`);
      } else {
        console.log(`No value found for ${sourceField}, skipping ${targetField}`);
      }
    }
    
    // Debug: Log first few transformations
    if (Object.keys(transformed).length > 0) {
      const sampleKeys = Object.keys(transformed).slice(0, 3);
      console.log('Sample transformations:', sampleKeys.map(key => `${key}: ${transformed[key]}`));
    }
    
    console.log('Final transformed record keys:', Object.keys(transformed));
    return transformed;
  }

  applyTransformationRules(value, rules) {
    let result = value;
    
    for (const rule of rules) {
      switch (rule.type) {
        case 'trim':
          result = result.toString().trim();
          break;
        case 'uppercase':
          result = result.toString().toUpperCase();
          break;
        case 'lowercase':
          result = result.toString().toLowerCase();
          break;
        case 'replace':
          result = result.toString().replace(new RegExp(rule.find, 'g'), rule.replace);
          break;
        case 'parse_date':
          result = this.parseDate(value, rule.format);
          break;
        case 'parse_number':
          result = parseFloat(value) || 0;
          break;
      }
    }
    
    return result;
  }

  parseDate(dateString, format) {
    // Simple date parsing - you might want to use a library like moment.js
    try {
      return new Date(dateString).toISOString();
    } catch (error) {
      return null;
    }
  }

  validateRecord(record, fieldMappings) {
    const errors = [];
    
    for (const mapping of fieldMappings) {
      // Handle both camelCase and snake_case field names
      const targetField = mapping.target_field || mapping.targetField;
      const isRequired = mapping.is_required || mapping.isRequired;
      const fieldType = mapping.field_type || mapping.fieldType;
      
      if (isRequired && !record[targetField]) {
        errors.push(`Required field ${targetField} is missing`);
      }
      
      if (record[targetField]) {
        // Type validation
        switch (fieldType) {
          case 'number':
            if (isNaN(record[targetField])) {
              errors.push(`Field ${targetField} must be a number`);
            }
            break;
          case 'date':
            if (isNaN(new Date(record[targetField]).getTime())) {
              errors.push(`Field ${targetField} must be a valid date`);
            }
            break;
          case 'boolean':
            const boolValue = record[targetField].toString().toLowerCase();
            if (!['true', 'false', '1', '0', 'yes', 'no'].includes(boolValue)) {
              errors.push(`Field ${targetField} must be a boolean`);
            }
            break;
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async insertOrUpdateRecord(client, record, config) {
    // This is a simplified example - you'd customize based on your table structure
    const tableName = 'vehicles'; // or whatever table you're importing to
    const keyField = 'vin'; // or whatever unique identifier you use
    
    if (config.processing.duplicate_handling === 'skip') {
      // Check if record exists
      const existing = await client.query(
        `SELECT id FROM ${tableName} WHERE ${keyField} = $1`,
        [record[keyField]]
      );
      
      if (existing.rows.length > 0) {
        return { action: 'skipped' };
      }
    }
    
    const fields = Object.keys(record);
    const values = Object.values(record);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    
    if (config.processing.duplicate_handling === 'update') {
      // Try update first, then insert
      const updateFields = fields.filter(f => f !== keyField);
      const updateValues = updateFields.map(f => record[f]);
      const updatePlaceholders = updateFields.map((_, index) => `${updateFields[index]} = $${index + 1}`).join(', ');
      
      const updateResult = await client.query(
        `UPDATE ${tableName} SET ${updatePlaceholders} WHERE ${keyField} = $${updateFields.length + 1}`,
        [...updateValues, record[keyField]]
      );
      
      if (updateResult.rowCount > 0) {
        return { action: 'updated' };
      }
    }
    
    // Insert new record
    await client.query(
      `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return { action: 'inserted' };
  }

  // Main Import Execution
  async executeImport(importConfigId, options = {}) {
    const { selectedRows = [], fieldMappings = [] } = options;
    const config = await this.getImportConfig(importConfigId);
    if (!config) {
      throw new Error('Import configuration not found');
    }
    
    console.log(`Executing import - Config ID: ${importConfigId}, Dealer ID: ${config.dealer_id}`);
    console.log('Config details:', {
      connection_type: config.connection_type,
      host_url: config.host_url,
      remote_directory: config.remote_directory,
      file_pattern: config.file_pattern,
      fieldMappings: config.fieldMappings?.length || 0
    });
    
    if (!config.dealer_id) {
      throw new Error('Dealer ID not found in import configuration');
    }

    const client = await this.pool.connect();
    try {
      // Create import history record
      const historyResult = await client.query(`
        INSERT INTO import_history (import_config_id, import_status, started_at)
        VALUES ($1, 'running', NOW())
        RETURNING id
      `, [importConfigId]);

      const historyId = historyResult.rows[0].id;

      try {
        // Download file
        const { localPath, fileName } = await this.downloadFile(config);
        
        // Get file stats
        const fileStats = fs.statSync(localPath);
        
        // Parse file
        console.log('Parsing file:', localPath);
        const records = await this.parseFile(localPath, config);
        console.log('Parsed records:', records.length);
        
        // Filter records based on selected rows if provided
        let recordsToProcess = records;
        if (selectedRows.length > 0) {
          recordsToProcess = selectedRows.map(index => records[index]).filter(Boolean);
          console.log('Processing selected rows:', selectedRows.length);
        }
        
        // Use custom field mappings if provided
        if (fieldMappings.length > 0) {
          config.fieldMappings = fieldMappings;
          console.log('Using custom field mappings:', fieldMappings.length);
        } else {
          console.log('Using default field mappings:', config.fieldMappings?.length || 0);
        }
        
        // Process records
        console.log('Starting to process records...');
        const result = await this.processRecords(recordsToProcess, config, historyId);
        
        // Update history with success
        await client.query(`
          UPDATE import_history 
          SET import_status = 'completed', file_name = $1, file_size = $2, completed_at = NOW()
          WHERE id = $3
        `, [fileName, fileStats.size, historyId]);
        
        // Archive file if configured
        if (config.processing.archive_processed_files) {
          const archivePath = path.join(__dirname, '../../uploads/imports/processed', fileName);
          const archiveDir = path.dirname(archivePath);
          if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
          }
          fs.renameSync(localPath, archivePath);
        } else {
          // Clean up local file
          fs.unlinkSync(localPath);
        }
        
        return { 
          success: true, 
          fileName, 
          recordsProcessed: result.processed,
          recordsInserted: result.inserted,
          recordsUpdated: result.updated,
          recordsSkipped: result.skipped,
          recordsFailed: result.failed,
          selectedRowsCount: selectedRows.length
        };

      } catch (error) {
        // Update history with error
        await client.query(`
          UPDATE import_history 
          SET import_status = 'failed', error_message = $1, completed_at = NOW()
          WHERE id = $2
        `, [error.message, historyId]);

        throw error;
      }
    } finally {
      client.release();
    }
  }

  // Execute Import from Preview Data
  async executeImportFromPreview(config, csvData, selectedRows = []) {
    console.log(`Executing preview import - Dealer ID: ${config.dealer_id}`);
    console.log('Preview config details:', {
      connection_type: config.connection_type,
      host_url: config.host_url,
      remote_directory: config.remote_directory,
      file_pattern: config.file_pattern,
      fieldMappings: config.fieldMappings?.length || 0,
      csvData: { headers: csvData.headers?.length || 0, totalRows: csvData.totalRows }
    });
    
    if (!config.dealer_id) {
      throw new Error('Dealer ID not found in preview configuration');
    }

    const client = await this.pool.connect();
    try {
              // Check if field mappings are provided in the config
    let fieldMappings = config.fieldMappings || [];
    
    if (fieldMappings.length === 0) {
      // Load field mappings from the database for this dealer
      console.log('Loading field mappings from database for dealer:', config.dealer_id);
      console.log('Config object:', JSON.stringify(config, null, 2));
      
      const mappingsResult = await client.query(`
        SELECT source_field, target_field, field_type, field_order, is_required, default_value, transformation_rule
        FROM import_field_mappings 
        WHERE import_config_id IN (
          SELECT id FROM import_configs WHERE dealer_id = $1
        )
        ORDER BY field_order
      `, [config.dealer_id]);
      
      console.log(`Loaded ${mappingsResult.rows.length} field mappings from database`);
      fieldMappings = mappingsResult.rows;
    } else {
      console.log(`Using ${fieldMappings.length} field mappings from request`);
      
      // Convert frontend field mappings format to backend format
      fieldMappings = fieldMappings.map(fm => ({
        source_field: fm.sourceField || fm.source_field,
        target_field: fm.targetField || fm.target_field,
        field_type: fm.fieldType || fm.field_type,
        field_order: fm.fieldOrder || fm.field_order || 0,
        is_required: fm.isRequired || fm.is_required || false,
        default_value: fm.defaultValue || fm.default_value,
        transformation_rule: fm.transformationRule || fm.transformation_rule
      }));
    }
    
    // Add field mappings to the config
    const fullConfig = {
      ...config,
      fieldMappings: fieldMappings
    };
      
      console.log('Full config with field mappings:', {
        dealer_id: fullConfig.dealer_id,
        fieldMappingsCount: fullConfig.fieldMappings?.length || 0,
        fieldMappings: fullConfig.fieldMappings?.map(fm => `${fm.source_field} -> ${fm.target_field}`)
      });

      // Create a temporary import history record
      const historyResult = await client.query(`
        INSERT INTO import_history (import_config_id, import_status, started_at)
        VALUES (NULL, 'running', NOW())
        RETURNING id
      `);

      const historyId = historyResult.rows[0].id;

      try {
        // Convert CSV data to records
        const records = this.convertCSVDataToRecords(csvData, selectedRows);
        console.log('Converted records:', records.length);
        
        // Process records with the full config including field mappings
        console.log('Starting to process preview records...');
        const result = await this.processRecords(records, fullConfig, historyId);
        
        // Update history with success
        await client.query(`
          UPDATE import_history 
          SET import_status = 'completed', file_name = $1, completed_at = NOW()
          WHERE id = $2
        `, [csvData.fileName || 'preview-import.csv', historyId]);
        
        return { 
          success: true, 
          fileName: csvData.fileName || 'preview-import.csv', 
          recordsProcessed: result.processed,
          recordsInserted: result.inserted,
          recordsUpdated: result.updated,
          recordsSkipped: result.skipped,
          recordsFailed: result.failed,
          selectedRowsCount: selectedRows.length
        };

      } catch (error) {
        // Update history with error
        await client.query(`
          UPDATE import_history 
          SET import_status = 'failed', error_message = $1, completed_at = NOW()
          WHERE id = $2
        `, [error.message, historyId]);
        throw error;
      }
    } finally {
      client.release();
    }
  }

  // Convert CSV data to records
  convertCSVDataToRecords(csvData, selectedRows = []) {
    const records = [];
    const headers = csvData.headers || [];
    const sampleData = csvData.sampleData || [];
    
    // If selectedRows is provided, use those indices
    const dataToProcess = selectedRows.length > 0 
      ? selectedRows.map(index => sampleData[index]).filter(Boolean)
      : sampleData;
    
    for (const row of dataToProcess) {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[header] || '';
      });
      records.push(record);
    }
    
    console.log(`Converted ${records.length} records from CSV data`);
    return records;
  }

  // Get import history
  async getImportHistory(dealerId, limit = 50) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ih.*,
          ic.config_name
        FROM import_history ih
        JOIN import_configs ic ON ih.import_config_id = ic.id
        WHERE ic.dealer_id = $1
        ORDER BY ih.created_at DESC
        LIMIT $2
      `, [dealerId, limit]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  // Helper method to extract meaningful data from text
  extractMeaningfulData(value, fieldType, fieldName) {
    if (!value) return null;
    
    const cleanedValue = this.cleanSpecialCharacters(value);
    const fieldNameLower = fieldName.toLowerCase();
    
    // Special handling for features field
    if (fieldNameLower.includes('feature') || fieldNameLower.includes('features')) {
      if (cleanedValue.includes('|')) {
        // Split by pipe and format as comma-separated with quotes
        const features = cleanedValue.split('|')
          .map(feature => feature.trim())
          .filter(feature => feature.length > 0)
          .map(feature => `"${feature}"`)
          .join(',');
        
        console.log(`Transformed features from pipe-separated to comma-separated: "${cleanedValue}" -> "${features}"`);
        return features;
      }
    }
    
    // For numeric fields, try to extract numbers
    if (fieldType === 'integer' || fieldType === 'decimal' || fieldType === 'number') {
      // Look for patterns like "1595" in text
      const numberMatches = cleanedValue.match(/\d+/g);
      if (numberMatches && numberMatches.length > 0) {
        // For odometer, take the largest number (likely the mileage)
        if (fieldNameLower.includes('odometer') || fieldNameLower.includes('mileage')) {
          const numbers = numberMatches.map(n => parseInt(n)).filter(n => n > 0);
          if (numbers.length > 0) {
            const maxNumber = Math.max(...numbers);
            console.log(`Extracted odometer/mileage from "${cleanedValue}": ${maxNumber}`);
            return maxNumber;
          }
        }
        
        // For prices, take the first number that looks like a price
        if (fieldNameLower.includes('price') || fieldNameLower.includes('msrp') || 
            fieldNameLower.includes('cost') || fieldNameLower.includes('discount') ||
            fieldNameLower.includes('rebate') || fieldNameLower.includes('savings') ||
            fieldNameLower.includes('accessories')) {
          const numbers = numberMatches.map(n => parseInt(n)).filter(n => n > 0);
          if (numbers.length > 0) {
            // Look for numbers that could be prices (reasonable range)
            const priceNumbers = numbers.filter(n => n >= 100 && n <= 1000000);
            if (priceNumbers.length > 0) {
              const price = priceNumbers[0];
              console.log(`Extracted price from "${cleanedValue}": ${price}`);
              return price;
            }
          }
        }
        
        // For year, take the first 4-digit number
        if (fieldNameLower.includes('year')) {
          const yearNumbers = numberMatches.filter(n => n.length === 4 && parseInt(n) >= 1900 && parseInt(n) <= 2030);
          if (yearNumbers.length > 0) {
            const year = parseInt(yearNumbers[0]);
            console.log(`Extracted year from "${cleanedValue}": ${year}`);
            return year;
          }
        }
        
        // For other numeric fields, take the first number
        const firstNumber = parseInt(numberMatches[0]);
        console.log(`Extracted number from "${cleanedValue}": ${firstNumber}`);
        return firstNumber;
      }
      
      // If no numbers found, return null for numeric fields
      console.log(`No numbers found in "${cleanedValue}" for numeric field ${fieldName}, returning null`);
      return null;
    }
    
    // For boolean fields, check if the cleaned text contains certain keywords
    if (fieldType === 'boolean') {
      const lowerValue = cleanedValue.toLowerCase();
      if (lowerValue.includes('yes') || lowerValue.includes('true') || lowerValue.includes('certified')) {
        return true;
      }
      if (lowerValue.includes('no') || lowerValue.includes('false') || lowerValue.includes('not')) {
        return false;
      }
      // If it's a long text, treat as false
      if (cleanedValue.length > 20) {
        return false;
      }
    }
    
    // For string fields, return the cleaned value
    return cleanedValue;
  }

  // Helper method to convert values to numbers or null
  convertToNumberOrNull(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    // If it's already a number, return it
    if (typeof value === 'number') {
      return value;
    }
    
    // Try to convert string to number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      console.log(`Converting non-numeric value to null: "${value}"`);
      return null;
    }
    
    console.log(`Converted "${value}" to number: ${numValue}`);
    return numValue;
  }

  // Helper method to transform pipe-separated data to comma-separated with quotes
  transformPipeSeparatedData(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    // If it contains pipe separators, split by pipe
    if (value.includes('|')) {
      const items = value.split('|')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map(item => `"${item}"`)
        .join(',');
      
      console.log(`Transformed pipe-separated data: "${value}" -> "${items}"`);
      return items;
    }
    
    // If it's a long string without separators, try to split by common patterns
    if (value.length > 100 && !value.includes('|') && !value.includes(',')) {
      // For features that are concatenated without separators, use a simple approach
      
      // Split by common patterns that indicate feature boundaries
      const patterns = [
        'Package', 'Equipment', 'Group', 'Feature', 'System', 'Control', 'Brake', 'Airbag',
        'Wheel', 'Seat', 'Mirror', 'Light', 'Radio', 'Audio', 'Climate', 'Power', 'Remote',
        'Steering', 'Suspension', 'Traction', 'Stability', 'Security', 'Alarm', 'Speed',
        'Bumper', 'Exhaust', 'Convertible', 'Roof', 'Transmitter', 'Entry', 'Start',
        'Leather', 'Alloy', 'Glass', 'Rain', 'Wiper', 'Camera', 'Sensor', 'Bluetooth',
        'Cruise', 'Keyless', 'Premium', 'Satellite', 'USB', 'Port', 'Apple', 'Android',
        'Backup', 'Parking', 'Hands-Free', 'Assist', 'Heated', 'Upholstery', 'Silver',
        'Dark', 'Rain', 'Sensing', 'Variably', 'Intermittent', 'Connect', 'HardTop',
        'Speakers', 'SiriusXM', 'Player', 'Temperature', 'Defroster', 'Advanced',
        'Independent', 'Disc', 'Brakes', 'Impact', 'Communication', 'Anti-roll',
        'Warning', 'Occupant', 'High-beam', 'Headlights', 'Panic', 'Auto-dimming',
        'Body-color', 'Wind', 'Blocker', 'Rear-View', 'Lining', 'Vanity', 'Garage',
        'HomeLink', 'Illuminated', 'Shift', 'Knob', 'Temperature', 'Convertible',
        'Sport', 'Tachometer', 'Tilt', 'Trip', 'Computer', 'Bucket', 'Center',
        'Armrest', 'Upholstery', 'Silver', 'Rear', 'Sensing', 'Wipers', 'Premium',
        'CarPlay', 'Auto', 'Camera', 'Sensors', 'Hands-Free', 'Assist', 'Seats',
        'Start', 'Sound', 'Audio', 'Capable', 'Controls', 'Ratio', 'Wheels'
      ];
      
      let features = [];
      let currentText = value;
      
      // Try to split by each pattern
      for (const pattern of patterns) {
        if (currentText.includes(pattern)) {
          const parts = currentText.split(pattern);
          for (let i = 0; i < parts.length - 1; i++) {
            const feature = (parts[i] + pattern).trim();
            if (feature.length > 0) {
              features.push(feature);
            }
          }
          currentText = parts[parts.length - 1];
        }
      }
      
      // Add any remaining text as a feature
      if (currentText.trim()) {
        features.push(currentText.trim());
      }
      
      // If we found features, format them
      if (features.length > 0) {
        const formattedFeatures = features
          .map(feature => feature.trim())
          .filter(feature => feature.length > 0)
          .map(feature => `"${feature}"`)
          .join(',');
        
        console.log(`Transformed concatenated features: "${value}" -> "${formattedFeatures}"`);
        return formattedFeatures;
      }
    }
    
    return value;
  }

  // Helper method to transform image URL lists to curly brace format
  transformImageUrlList(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    // If it's already in the correct format, return as is
    if (value.startsWith('{') && value.endsWith('}')) {
      return value;
    }
    
    // If it contains pipe separators, split by pipe
    if (value.includes('|')) {
      const items = value.split('|')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join(',');
      
      const formattedUrls = `{${items}}`;
      console.log(`Transformed pipe-separated image URLs: "${value}" -> "${formattedUrls}"`);
      return formattedUrls;
    }
    
    // If it contains comma separators, format with curly braces
    if (value.includes(',')) {
      const items = value.split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join(',');
      
      const formattedUrls = `{${items}}`;
      console.log(`Transformed comma-separated image URLs: "${value}" -> "${formattedUrls}"`);
      return formattedUrls;
    }
    
    // If it's a single URL, wrap it in curly braces
    if (value.trim()) {
      const formattedUrl = `{${value.trim()}}`;
      console.log(`Transformed single image URL: "${value}" -> "${formattedUrl}"`);
      return formattedUrl;
    }
    
    return value;
  }

  // Import CSV data directly (for direct upload)
  async importCSVData(data, fieldMappings, dealerId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let recordsInserted = 0;
      let recordsUpdated = 0;
      let recordsSkipped = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each record
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        
        try {
          // Transform record using field mappings
          const transformedRecord = this.transformRecordWithValidation(record, fieldMappings);
          
          if (!transformedRecord) {
            recordsSkipped++;
            errors.push(`Row ${i + 1}: Invalid record data`);
            continue;
          }

          // Validate required fields
          const requiredFields = ['vin', 'make', 'model', 'year'];
          const missingFields = requiredFields.filter(field => 
            !transformedRecord[field] || transformedRecord[field] === ''
          );

          if (missingFields.length > 0) {
            recordsSkipped++;
            errors.push(`Row ${i + 1}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          // Set dealer ID
          transformedRecord.dealer_id = dealerId;

          // Try to insert or update the record
          const result = await this.insertOrUpdateVehicleRecord(client, transformedRecord, {
            duplicateHandling: 'update',
            validateData: true
          });

          if (result.inserted) {
            recordsInserted++;
          } else if (result.updated) {
            recordsUpdated++;
          } else {
            recordsSkipped++;
          }

        } catch (error) {
          recordsFailed++;
          errors.push(`Row ${i + 1}: ${error.message}`);
        }
      }

      await client.query('COMMIT');

      return {
        recordsProcessed: data.length,
        recordsInserted,
        recordsUpdated,
        recordsSkipped,
        recordsFailed,
        errors: errors.slice(0, 100) // Limit errors to first 100
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default ImportService; 