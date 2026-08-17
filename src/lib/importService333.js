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
      connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:Dealeriq@localhost:5432/vehicle_management'
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
        // Prepare selected files and available files
        const selectedFiles = configData.selectedFiles || [];
        const availableFiles = configData.availableFiles || [];
        const lastFileScan = configData.lastFileScan || null;
        const fileMatchKeyword = configData.fileMatchKeyword || null;

        await client.query(`
          INSERT INTO import_connection_settings (
            import_config_id, connection_type, host_url, port, username, 
            password_encrypted, remote_directory, file_pattern,
            selected_files, available_files, last_file_scan, file_match_keyword
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          importConfigId,
          configData.connection.type,
          configData.connection.hostUrl,
          configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
          configData.connection.username,
          this.encryptPassword(configData.connection.password),
          configData.connection.remoteDirectory || '/',
          configData.connection.filePattern || '*',
          selectedFiles.length > 0 ? selectedFiles : null,
          availableFiles.length > 0 ? availableFiles : null,
          lastFileScan,
          fileMatchKeyword
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
        // Calculate initial next_run
        let nextRun = null;
        if (configData.schedule.frequency !== 'manual') {
          const now = new Date();
          nextRun = new Date();
          
          if (configData.schedule.frequency === 'test') {
            // Test mode: set to 2 minutes from now
            nextRun.setMinutes(nextRun.getMinutes() + 2);
          } else {
            nextRun.setHours(configData.schedule.timeHour || 0, configData.schedule.timeMinute || 0, 0, 0);
            
            // If time has passed today, move to next occurrence
            if (nextRun <= now) {
              switch (configData.schedule.frequency) {
                case 'hourly':
                  nextRun.setHours(nextRun.getHours() + 1);
                  break;
                case 'daily':
                  nextRun.setDate(nextRun.getDate() + 1);
                  break;
                case 'weekly':
                  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
                  const targetDay = configData.schedule.dayOfWeek || 1; // 1 = Sunday, 7 = Saturday
                  // Convert targetDay (1-7) to JavaScript day (0-6)
                  const jsTargetDay = targetDay === 7 ? 0 : targetDay;
                  let daysToAdd = (jsTargetDay - currentDay + 7) % 7;
                  if (daysToAdd === 0) daysToAdd = 7; // If same day, move to next week
                  nextRun.setDate(nextRun.getDate() + daysToAdd);
                  break;
                case 'monthly':
                  nextRun.setMonth(nextRun.getMonth() + 1);
                  if (configData.schedule.dayOfMonth) {
                    const targetDay = configData.schedule.dayOfMonth;
                    const lastDayOfMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
                    nextRun.setDate(Math.min(targetDay, lastDayOfMonth));
                  }
                  break;
              }
            }
          }
        }
        
        await client.query(`
          INSERT INTO import_schedule_settings (
            import_config_id, frequency, time_hour, time_minute, 
            day_of_week, day_of_month, is_active, next_run
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          importConfigId,
          configData.schedule.frequency,
          configData.schedule.timeHour || 0,
          configData.schedule.timeMinute || 0,
          configData.schedule.dayOfWeek,
          configData.schedule.dayOfMonth,
          true,
          nextRun
        ]);
      }

      // Create field mappings
      if (configData.fieldMappings && configData.fieldMappings.length > 0) {
        console.log('=== FIELD MAPPINGS DEBUG ===');
        console.log('Field mappings being inserted:', JSON.stringify(configData.fieldMappings, null, 2));
        
        for (let i = 0; i < configData.fieldMappings.length; i++) {
          const mapping = configData.fieldMappings[i];
          
          // Validate and normalize field type
          const fieldType = this.normalizeFieldType(mapping.fieldType || mapping.field_type);
          console.log(`Field mapping ${i + 1}: ${mapping.sourceField} -> ${mapping.targetField}, fieldType: "${mapping.fieldType || mapping.field_type}" -> "${fieldType}"`);
          
          await client.query(`
            INSERT INTO import_field_mappings (
              import_config_id, source_field, target_field, field_type, 
              is_required, default_value, transformation_rule, field_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            importConfigId,
            mapping.sourceField,
            mapping.targetField,
            fieldType,
            mapping.is_required || false,
            mapping.defaultValue,
            mapping.transformationRule,
            mapping.fieldOrder || i + 1
          ]);
        }
        console.log('=== END FIELD MAPPINGS DEBUG ===');
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
    console.log('🔍 ImportService.getImportConfigs called for dealer:', dealerId);
    const client = await this.pool.connect();
    try {
      // First get the basic configs
      console.log('📊 Querying import_configs table...');
      const result = await client.query(`
        SELECT
          ic.*,
          ics.connection_type, ics.host_url, ics.port, ics.username, ics.remote_directory, ics.file_pattern,
          ics.selected_files, ics.available_files, ics.last_file_scan, ics.file_match_keyword,
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

      console.log(`✅ Found ${result.rows.length} configs`);

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

      console.log('✅ Configs with mappings prepared');
      return configsWithMappings;
    } catch (error) {
      console.error('❌ Error in getImportConfigs:', error);
      throw error;
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

      // Decrypt password if it exists (needed for execution)
      let decryptedPassword = null;
      if (connectionResult.rows[0]?.password_encrypted) {
        try {
          decryptedPassword = this.decryptPassword(connectionResult.rows[0].password_encrypted);
        } catch (error) {
          console.error('Error decrypting password:', error);
          // Keep as null if decryption fails
        }
      }

      // Combine all settings
      const fullConfig = {
        ...config,
        connection_type: connectionResult.rows[0]?.connection_type,
        host_url: connectionResult.rows[0]?.host_url,
        port: connectionResult.rows[0]?.port,
        username: connectionResult.rows[0]?.username,
        password: decryptedPassword, // Decrypted password for execution
        remote_directory: connectionResult.rows[0]?.remote_directory,
        file_pattern: connectionResult.rows[0]?.file_pattern,
        file_match_keyword: connectionResult.rows[0]?.file_match_keyword,
        selected_files: connectionResult.rows[0]?.selected_files || [],
        available_files: connectionResult.rows[0]?.available_files || [],
        last_file_scan: connectionResult.rows[0]?.last_file_scan,
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
          // Prepare selected files and available files
          const selectedFiles = configData.selectedFiles || [];
          const availableFiles = configData.availableFiles || [];
          const lastFileScan = configData.lastFileScan || null;

          if (configData.connection.password) {
            // Update with password
            await client.query(`
              UPDATE import_connection_settings 
              SET connection_type = $1, host_url = $2, port = $3, username = $4, 
                  password_encrypted = $5, remote_directory = $6, file_pattern = $7,
                  selected_files = $8, available_files = $9, last_file_scan = $10
              WHERE import_config_id = $11
            `, [
              configData.connection.type,
              configData.connection.hostUrl,
              configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
              configData.connection.username,
              this.encryptPassword(configData.connection.password),
              configData.connection.remoteDirectory || '/',
              configData.connection.filePattern || '*',
              selectedFiles.length > 0 ? selectedFiles : null,
              availableFiles.length > 0 ? availableFiles : null,
              lastFileScan,
              importConfigId
            ]);
          } else {
            // Update without password
            await client.query(`
              UPDATE import_connection_settings 
              SET connection_type = $1, host_url = $2, port = $3, username = $4, 
                  remote_directory = $5, file_pattern = $6,
                  selected_files = $7, available_files = $8, last_file_scan = $9
              WHERE import_config_id = $10
            `, [
              configData.connection.type,
              configData.connection.hostUrl,
              configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
              configData.connection.username,
              configData.connection.remoteDirectory || '/',
              configData.connection.filePattern || '*',
              selectedFiles.length > 0 ? selectedFiles : null,
              availableFiles.length > 0 ? availableFiles : null,
              lastFileScan,
              importConfigId
            ]);
          }
        } else {
          // Create new connection settings
          const selectedFiles = configData.selectedFiles || [];
          const availableFiles = configData.availableFiles || [];
          const lastFileScan = configData.lastFileScan || null;
          const fileMatchKeyword = configData.fileMatchKeyword || null;

          await client.query(`
            INSERT INTO import_connection_settings (
              import_config_id, connection_type, host_url, port, username, 
              password_encrypted, remote_directory, file_pattern,
              selected_files, available_files, last_file_scan, file_match_keyword
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            importConfigId,
            configData.connection.type,
            configData.connection.hostUrl,
            configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
            configData.connection.username,
            this.encryptPassword(configData.connection.password || ''),
            configData.connection.remoteDirectory || '/',
            configData.connection.filePattern || '*',
            selectedFiles.length > 0 ? selectedFiles : null,
            availableFiles.length > 0 ? availableFiles : null,
            lastFileScan,
            fileMatchKeyword
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

        // Calculate next_run time
        let nextRun = null;
        if (configData.schedule.frequency !== 'manual') {
          const now = new Date();
          nextRun = new Date();
          
          if (configData.schedule.frequency === 'test') {
            // Test mode: set to 2 minutes from now
            nextRun.setMinutes(nextRun.getMinutes() + 2);
          } else {
            nextRun.setHours(configData.schedule.timeHour || 0, configData.schedule.timeMinute || 0, 0, 0);
            
            // If time has passed today, move to next occurrence
            if (nextRun <= now) {
              switch (configData.schedule.frequency) {
                case 'hourly':
                  nextRun.setHours(nextRun.getHours() + 1);
                  break;
                case 'daily':
                  nextRun.setDate(nextRun.getDate() + 1);
                  break;
                case 'weekly':
                  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
                  const targetDay = configData.schedule.dayOfWeek || 1; // 1 = Sunday, 7 = Saturday
                  // Convert targetDay (1-7) to JavaScript day (0-6)
                  const jsTargetDay = targetDay === 7 ? 0 : targetDay;
                  let daysToAdd = (jsTargetDay - currentDay + 7) % 7;
                  if (daysToAdd === 0) daysToAdd = 7; // If same day, move to next week
                  nextRun.setDate(nextRun.getDate() + daysToAdd);
                  break;
                case 'monthly':
                  nextRun.setMonth(nextRun.getMonth() + 1);
                  if (configData.schedule.dayOfMonth) {
                    const targetDay = configData.schedule.dayOfMonth;
                    const lastDayOfMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
                    nextRun.setDate(Math.min(targetDay, lastDayOfMonth));
                  }
                  break;
              }
            }
          }
        }

        if (scheduleCheck.rows.length > 0) {
          await client.query(`
            UPDATE import_schedule_settings 
            SET frequency = $1, time_hour = $2, time_minute = $3, day_of_week = $4, day_of_month = $5, next_run = $6
            WHERE import_config_id = $7
          `, [
            configData.schedule.frequency,
            configData.schedule.timeHour || 0,
            configData.schedule.timeMinute || 0,
            configData.schedule.dayOfWeek,
            configData.schedule.dayOfMonth,
            nextRun,
            importConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO import_schedule_settings (
              import_config_id, frequency, time_hour, time_minute, day_of_week, day_of_month, next_run
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            importConfigId,
            configData.schedule.frequency,
            configData.schedule.timeHour || 0,
            configData.schedule.timeMinute || 0,
            configData.schedule.dayOfWeek,
            configData.schedule.dayOfMonth,
            nextRun
          ]);
        }
      }

      // Update field mappings - delete existing and insert new ones
      if (configData.fieldMappings && configData.fieldMappings.length > 0) {
        console.log('=== UPDATE FIELD MAPPINGS DEBUG ===');
        console.log('Field mappings being updated:', JSON.stringify(configData.fieldMappings, null, 2));
        
        // Delete existing field mappings
        await client.query('DELETE FROM import_field_mappings WHERE import_config_id = $1', [importConfigId]);
        
        // Insert new field mappings
        for (let i = 0; i < configData.fieldMappings.length; i++) {
          const mapping = configData.fieldMappings[i];
          
          // Validate and normalize field type
          const fieldType = this.normalizeFieldType(mapping.fieldType || mapping.field_type);
          console.log(`Update field mapping ${i + 1}: ${mapping.sourceField} -> ${mapping.targetField}, fieldType: "${mapping.fieldType || mapping.field_type}" -> "${fieldType}"`);
          
          await client.query(`
            INSERT INTO import_field_mappings (
              import_config_id, source_field, target_field, field_type, 
              is_required, default_value, transformation_rule, field_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            importConfigId,
            mapping.sourceField,
            mapping.targetField,
            fieldType,
            mapping.is_required || false,
            mapping.defaultValue,
            mapping.transformationRule,
            mapping.fieldOrder || i + 1
          ]);
        }
        console.log('=== END UPDATE FIELD MAPPINGS DEBUG ===');
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

  // List remote filenames matching the config pattern (SFTP only; null = skip pre-check / non-SFTP)
  async getMatchingRemoteFilenames(config) {
    const connectionType = config.connection_type || 'sftp';
    if (connectionType !== 'sftp') {
      return null;
    }
    return new Promise(async (resolve, reject) => {
      try {
        const { Client } = await import('ssh2');
        const conn = new Client();
        conn.on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              reject(new Error(`SFTP connection failed: ${err.message}`));
              return;
            }
            const remoteDir = config.remote_directory || '/';
            console.log('getMatchingRemoteFilenames listing:', remoteDir);
            sftp.readdir(remoteDir, (readErr, files) => {
              conn.end();
              if (readErr) {
                reject(new Error(`Failed to list files: ${readErr.message}`));
                return;
              }
              const pattern = config.file_pattern || '*.csv';
              const matchingFiles = files.filter((file) => {
                if (file.attrs.isDirectory()) return false;
                if (pattern.includes('*')) {
                  const regex = new RegExp(pattern.replace('*', '.*'));
                  return regex.test(file.filename);
                }
                return file.filename === pattern;
              });
              resolve(matchingFiles.map((f) => f.filename));
            });
          });
        });
        conn.on('error', (e) => reject(new Error(`SSH connection failed: ${e.message}`)));
        if (!config.host_url) {
          reject(new Error('Host URL is required'));
          return;
        }
        if (!config.username) {
          reject(new Error('Username is required'));
          return;
        }
        if (!config.password) {
          reject(new Error('Password is required. Please update the import configuration with a valid password.'));
          return;
        }
        conn.connect({
          host: config.host_url,
          port: config.port || 22,
          username: config.username,
          password: config.password
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // File Download and Processing
  async downloadFile(config, options = {}) {
    const { remoteFileName } = options;
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
                if (file.attrs.isDirectory()) return false;
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

              let chosen;
              if (remoteFileName) {
                chosen = matchingFiles.find((f) => f.filename === remoteFileName);
                if (!chosen) {
                  conn.end();
                  reject(new Error(`Remote file not found: ${remoteFileName}`));
                  return;
                }
              } else if (matchingFiles.length > 1) {
                conn.end();
                const multi = new Error('Multiple files match the pattern; select a file to import.');
                multi.code = 'MULTIPLE_FILES';
                multi.matchingFiles = matchingFiles.map((f) => f.filename);
                reject(multi);
                return;
              } else {
                chosen = matchingFiles[0];
              }

              const fileName = chosen.filename;
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
        
        // Validate connection parameters
        if (!config.host_url) {
          reject(new Error('Host URL is required'));
          return;
        }
        if (!config.username) {
          reject(new Error('Username is required'));
          return;
        }
        if (!config.password) {
          reject(new Error('Password is required. Please update the import configuration with a valid password.'));
          return;
        }
        
        console.log('Connecting to SFTP server:', {
          host: config.host_url,
          port: config.port,
          username: config.username,
          remoteDirectory: config.remote_directory,
          filePattern: config.file_pattern,
          hasPassword: !!config.password
        });
        
        conn.connect({
          host: config.host_url,
          port: config.port || 22,
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
      
      // When CSV has headers, DON'T pass headers option to csv-parser
      // This lets csv-parser automatically detect and use the first row as headers
      const csvOptions = {
        separator: config.delimiter || ','
      };
      
      // Only specify headers if we need custom column names (no header row)
      if (!hasHeader && config.fieldMappings && config.fieldMappings.length > 0) {
        csvOptions.headers = config.fieldMappings.map(m => m.source_field);
        console.log(`📋 Using custom headers from field mappings (${csvOptions.headers.length} columns):`, csvOptions.headers);
      }
      
      fs.createReadStream(filePath)
        .pipe(csv(csvOptions))
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          console.log(`✅ CSV parsing complete: ${results.length} records`);
          if (results.length > 0) {
            console.log('📝 First record keys:', Object.keys(results[0]).slice(0, 10));
            console.log('📝 Sample values:', {
              key1: Object.keys(results[0])[0] + ' = ' + results[0][Object.keys(results[0])[0]],
              key2: Object.keys(results[0])[1] + ' = ' + results[0][Object.keys(results[0])[1]]
            });
          }
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
          
          // ⚡ Reduced logging for better console readability
          // console.log(`\n--- Processing record ${processed} ---`);
          // console.log('Original record:', JSON.stringify(record, null, 2));
          
          // Transform record based on field mappings
          let transformedRecord = this.transformRecordWithValidation(record, config.fieldMappings);
          
          // Add dealer_id from config (required field not in CSV)
          transformedRecord.dealer_id = config.dealer_id;
          
          // Set default values for nullable/optional fields if missing
          if (!transformedRecord.certified) {
            transformedRecord.certified = '';
          }
          if (!transformedRecord.other_price && transformedRecord.other_price !== 0) {
            transformedRecord.other_price = 0;
          }
          
          // console.log('Transformed record:', JSON.stringify(transformedRecord, null, 2));
          
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
            // Use the validated record which includes properly formatted photo_url_list
            transformedRecord = validationResult.validatedRecord;
          }
          
          // Insert or update record using the database function
          const result = await this.insertOrUpdateVehicleRecord(client, transformedRecord, config);
          
          // console.log('Insert/Update result:', result);
          
          if (result.action === 'inserted') {
            inserted++;
            // console.log(`✅ Record ${processed} inserted successfully`);
          } else if (result.action === 'updated') {
            updated++;
            // console.log(`🔄 Record ${processed} updated successfully`);
          } else {
            skipped++;
            // console.log(`⏭️ Record ${processed} skipped`);
          }
          
        } catch (error) {
          // Only log error summary, not full record data
          console.error(`❌ Error processing record ${processed}:`, error.message);
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

  // async insertOrUpdateVehicleRecord(client, record, config) {
  //   // Use the database function for vehicle import
  //   const dealerId = config.dealer_id;
    
  //   console.log('=== INSERT/UPDATE VEHICLE DEBUG ===');
  //   console.log('Config dealer_id:', dealerId);
  //   console.log('Record VIN:', record.vin);
  //   console.log('Record make:', record.make);
  //   console.log('Record model:', record.model);
  //   console.log('=== END INSERT/UPDATE VEHICLE DEBUG ===');
    
  //   // Ensure dealer ID is properly formatted
  //   if (!dealerId) {
  //     throw new Error('Dealer ID is required for vehicle import');
  //   }
    
  //   // Extract reference dealer ID from CSV data (if available)
  //   const referenceDealerId = record.dealerid || record.dealer_id || record.reference_dealer_id || null;
    
  //   // Transform boolean fields properly
  //   const certified = this.transformBooleanField(record.certified);
    
  //   // Debug: Log the record being processed
  //   console.log('Processing vehicle record:', {
  //     vin: record.vin,
  //     make: record.make,
  //     model: record.model,
  //     dealerId: dealerId,
  //     referenceDealerId: referenceDealerId,
  //     certified: certified
  //   });
    
  //   // Log the full record for debugging
  //   console.log('Full record data:', JSON.stringify(record, null, 2));
    
  //   // Map the record fields to the function parameters (updated for new function signature)
  //   const queryParams = [
  //     dealerId,                                    // p_dealer_id (session dealer ID)
  //     record.vin || null,                          // p_vin
  //     record.make || null,                         // p_make
  //     record.model || null,                        // p_model
  //     record.series || null,                       // p_series
  //     record.stock_number || null,                 // p_stock_number
  //     record.body_style || null,                   // p_body_style
  //     certified,                                   // p_certified (transformed boolean)
  //     record.color || null,                        // p_color
  //     record.interior_color || null,               // p_interior_color
  //     record.engine_type || null,                  // p_engine_type
  //     record.displacement || null,                 // p_displacement
  //     record.features || null,                     // p_features
  //     this.convertToNumberOrNull(record.odometer), // p_odometer (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.price),    // p_price (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.other_price), // p_other_price (ensure it's a number or null)
  //     record.transmission || null,                 // p_transmission
  //     this.convertToNumberOrNull(record.msrp),     // p_msrp (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.dealer_discount), // p_dealer_discount (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.consumer_rebate), // p_consumer_rebate (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.dealer_accessories), // p_dealer_accessories (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.total_customer_savings), // p_total_customer_savings (ensure it's a number or null)
  //     this.convertToNumberOrNull(record.total_dealer_rebate), // p_total_dealer_rebate (ensure it's a number or null)
  //     record.photo_url_list || null,               // p_photo_url_list
  //     this.convertToNumberOrNull(record.year),     // p_year (ensure it's a number or null)
  //     referenceDealerId                            // p_reference_dealer_id (from CSV)
  //   ];
    
  //   // Log the query parameters with data types
  //   console.log(queryParams);
  //   console.log('Insert query parameters with types:');
  //   const paramNames = [
  //     'p_dealer_id', 'p_vin', 'p_make', 'p_model', 'p_series', 'p_stock_number', 'p_body_style', 'p_certified',
  //     'p_color', 'p_interior_color', 'p_engine_type', 'p_displacement', 'p_features', 'p_odometer', 'p_price',
  //     'p_other_price', 'p_transmission', 'p_msrp', 'p_dealer_discount', 'p_consumer_rebate', 'p_dealer_accessories',
  //     'p_total_customer_savings', 'p_total_dealer_rebate', 'p_photo_url_list', 'p_year', 'p_reference_dealer_id'
  //   ];
  //   queryParams.forEach((param, index) => {
  //     const paramType = param === null ? 'null' : typeof param;
  //     const paramValue = param === null ? 'null' : 
  //                       typeof param === 'string' ? `'${param}'` : 
  //                       typeof param === 'boolean' ? param.toString() : param;
  //     console.log(`  ${paramNames[index]}: ${paramValue} (${paramType})`);
  //   });
    
  //   // Log the exact SQL query for debugging
  //   const sqlQuery = `
  //     SELECT import_vehicle_from_csv(
  //       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
  //     ) as vehicle_id
  //   `;
  //   console.log('SQL Query:jawad ', sqlQuery);
    
  //   // Log the exact query with parameter values for debugging
  //   console.log('Parameter mapping:');
  //   queryParams.forEach((param, index) => {
  //     console.log(`  ${paramNames[index]}: ${param} (${typeof param})`);
  //   });
    
  //   // Show the actual SQL with values for debugging
  //   console.log('Actual SQL with values:');
  //   const sqlWithValues = `
  //     SELECT import_vehicle_from_csv(
  //       '${queryParams[0]}', '${queryParams[1]}', '${queryParams[2]}', '${queryParams[3]}', 
  //       '${queryParams[4]}', '${queryParams[5]}', '${queryParams[6]}', ${queryParams[7]}, 
  //       '${queryParams[8]}', '${queryParams[9]}', '${queryParams[10]}', '${queryParams[11]}', 
  //       '${queryParams[12]}', ${queryParams[13]}, ${queryParams[14]}, ${queryParams[15]}, 
  //       '${queryParams[16]}', ${queryParams[17]}, ${queryParams[18]}, ${queryParams[19]}, 
  //       ${queryParams[20]}, ${queryParams[21]}, ${queryParams[22]}, '${queryParams[23]}', 
  //       ${queryParams[24]}, '${queryParams[25]}', '${queryParams[26]}'
  //     ) as vehicle_id
  //   `;
  //   console.log(sqlWithValues);
    
  //   // Log the data array being sent to the database function in the requested format
  //   console.log('// The data array being sent to the database function:');
  //   console.log('[');
  //   const fieldComments = [
  //     'dealer_id (from session)',
  //     'vin',
  //     'make',
  //     'model',
  //     'series',
  //     'stock_number',
  //     'body_style',
  //     'certified',
  //     'color',
  //     'interior_color',
  //     'engine_type',
  //     'displacement',
  //     'features (long string)',
  //     'odometer',
  //     'mileage',
  //     'price',
  //     'other_price',
  //     'transmission',
  //     'msrp',
  //     'dealer_discount',
  //     'consumer_rebate',
  //     'dealer_accessories',
  //     'total_customer_savings',
  //     'total_dealer_rebate',
  //     'photo_url_list',
  //     'year',
  //     'reference_dealer_id'
  //   ];
  //   queryParams.forEach((param, index) => {
  //     const paramValue = param === null ? 'null' : 
  //                       typeof param === 'string' ? `'${param}'` : 
  //                       typeof param === 'boolean' ? param.toString() : param;
  //     const comment = fieldComments[index];
  //     console.log(`  ${paramValue},                                     // ${comment}`);
  //   });
  //   console.log(']');
    
  //   try {
  //     const result = await client.query(sqlQuery, queryParams);
  //     console.log('Database function result:', result.rows[0]);
      
  //     // Check if this was an insert or update by checking if the vehicle existed before
  //     const existingCheck = await client.query(
  //       'SELECT id FROM vehicles WHERE vin = $1 AND dealer_id = $2',
  //       [record.vin, dealerId]
  //     );
      
  //     if (existingCheck.rows.length > 0) {
  //       return { action: 'updated', vehicleId: result.rows[0]?.vehicle_id };
  //     } else {
  //       return { action: 'inserted', vehicleId: result.rows[0]?.vehicle_id };
  //     }
  //   } catch (error) {
  //     console.error('Database error details:', {
  //       message: error.message,
  //       code: error.code,
  //       detail: error.detail,
  //       hint: error.hint,
  //       where: error.where
  //     });
  //     throw error;
  //   }
  // }

  // Helper method to transform boolean fields
 
  async insertOrUpdateVehicleRecord(client, record, config) {
    // CRITICAL: Always use dealer_id from config (session), never from CSV data
    let dealerId = config.dealer_id;
    
    // CRITICAL: Remove any dealer_id field from the record to prevent confusion
    if (record.dealer_id) {
      console.log('⚠️ REMOVING dealer_id from record to prevent override:', record.dealer_id);
      delete record.dealer_id;
    }
  
    // ⚡ Reduced logging for better console readability
    // console.log('=== INSERT/UPDATE VEHICLE DEBUG ===');
    // console.log('Config dealer_id (from session):', dealerId);
    // console.log('CSV Record Keys:', Object.keys(record));
    // console.log('CSV DealerId field:', record.DealerId);
    // console.log('CSV dealer_id field (should be undefined):', record.dealer_id);
    // console.log('Record VIN:', record.vin);
    // console.log('Record make:', record.make);
    // console.log('Record model:', record.model);
    // console.log('Record photo_url_list:', record.photo_url_list);
    // console.log('Record photo_url_list type:', typeof record.photo_url_list);
    // console.log('Record photo_url_list length:', record.photo_url_list ? record.photo_url_list.length : 'null');
    // console.log('=== END INSERT/UPDATE VEHICLE DEBUG ===');
  
    // Handle case where dealer_id is not a valid UUID
    if (!dealerId) {
      throw new Error('Dealer ID is required for vehicle import');
    }
    
    // Check if dealer_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(dealerId)) {
      console.log('⚠️ Dealer ID is not a valid UUID format:', dealerId);
      console.log('Attempting to find valid dealer UUID from database...');
      
      // Try to find a valid dealer UUID from the database
      // Extract potential dealer name parts for better matching
      const dealerNameParts = dealerId.replace(/[^a-zA-Z]/g, ' ').split(' ').filter(part => part.length > 2);
      
      // Prioritize Hyundai if the dealer ID contains it (handle both Hyundai and Hyandai)
      const isHyundai = dealerId.toLowerCase().includes('hyundai') || dealerId.toLowerCase().includes('hyandai');
      
      const dealerResult = await client.query(`
        SELECT id FROM dealers 
        WHERE business_name ILIKE ANY($1) OR id::text = $2
        ORDER BY 
          CASE WHEN business_name ILIKE $3 THEN 1 
               WHEN business_name ILIKE $4 THEN 2
               WHEN business_name ILIKE $5 THEN 3
               ELSE 4 END,
          business_name
        LIMIT 1
      `, [
        [`%${dealerId}%`, `%${dealerNameParts.join('%')}%`, `%Clay%Cooley%`, `%Hyundai%`, `%Hyandai%`, `%Rockwall%`], 
        dealerId, 
        `%${dealerId}%`,
        isHyundai ? `%Hyandai%` : `%Clay%Cooley%`,
        `%Hyundai%`
      ]);
      
      if (dealerResult.rows.length > 0) {
        dealerId = dealerResult.rows[0].id;
        console.log('✅ Found valid dealer UUID:', dealerId);
      } else {
        // If no dealer found, try to use a default dealer or create one
        console.log('❌ No valid dealer found, using default dealer');
        // For now, throw an error - in production you might want to create a default dealer
        throw new Error(`Invalid dealer ID format: ${dealerId}. Please ensure you have a valid dealer configuration.`);
      }
    }
  
    // Extract reference dealer ID from CSV data (this should be the original dealer from CSV)
    const referenceDealerId =
      record.DealerId || record.dealerid || record.dealer_id || record.reference_dealer_id || null;
    
    // console.log('Reference dealer ID from CSV:', referenceDealerId);
    
    // ⚡ Reduced logging for better console readability
    // console.log('=== ORIGINAL RECORD DATA ===');
    // console.log('Original record keys:', Object.keys(record));
    // console.log('Original record values:', JSON.stringify(record, null, 2));
    // console.log('=== END ORIGINAL RECORD DATA ===');
  
    const certified = this.transformBooleanField(record.certified);
    // console.log('Transformed certified field:', certified, typeof certified);
    
    // Clean and format the Features field
    let features = record.features || null;
    if (features && typeof features === 'string') {
      // If it's a string that looks like malformed JSON, try to clean it
      if (features.includes('\\"') && features.includes('{')) {
        try {
          // Remove the outer quotes and fix the JSON structure
          const cleanedFeatures = features.replace(/^"|"$/g, '').replace(/\\"/g, '"');
          console.log('Cleaned features:', cleanedFeatures);
          features = cleanedFeatures;
        } catch (error) {
          console.log('Could not clean features, using as-is:', features);
        }
      }
    }
  
    // Build query parameters with proper validation
    const queryParams = [
      dealerId, // 1 - p_dealer_id (UUID) - REQUIRED
      record.vin || null, // 2 - p_vin (text) - REQUIRED
      record.make || null, // 3 - p_make (text) - REQUIRED
      record.model || null, // 4 - p_model (text) - REQUIRED
      record.series || null, // 5 - p_series (text) - DEFAULT NULL
      record.stock_number || null, // 6 - p_stock_number (text) - DEFAULT NULL
      this.transformNewUsedField(record.new_used), // 7 - p_new_used (text) - DEFAULT 'used'
      record.body_style || null, // 8 - p_body_style (text) - DEFAULT NULL
      record.vehicle_type || null, // 9 - p_vehicle_type (text) - DEFAULT NULL
      certified, // 10 - p_certified (boolean) - DEFAULT false
      record.color || null, // 11 - p_color (text) - DEFAULT NULL
      record.interior_color || null, // 12 - p_interior_color (text) - DEFAULT NULL
      record.engine_type || null, // 13 - p_engine_type (text) - DEFAULT NULL
      record.displacement || null, // 14 - p_displacement (text) - DEFAULT NULL
      features, // 15 - p_features (text) - DEFAULT NULL
      this.convertToNumberOrNull(record.mileage || record.odometer), // 16 - p_odometer (integer) - DEFAULT NULL
      this.convertToNumberOrNull(record.price), // 17 - p_price (numeric) - DEFAULT NULL
      this.convertToNumberOrNull(record.other_price), // 18 - p_other_price (numeric) - DEFAULT NULL
      record.transmission || null, // 19 - p_transmission (text) - DEFAULT NULL
      this.convertToNumberOrNull(record.msrp), // 20 - p_msrp (numeric) - DEFAULT NULL
      this.convertToNumberOrNull(record.dealer_discount), // 21 - p_dealer_discount (numeric) - DEFAULT NULL
      this.convertToNumberOrNull(record.consumer_rebate), // 22 - p_consumer_rebate (numeric) - DEFAULT NULL
      this.convertToNumberOrNull(record.dealer_accessories), // 23 - p_dealer_accessories (numeric) - DEFAULT NULL
      this.convertToNumberOrNull(record.total_customer_savings), // 24 - p_total_customer_savings (numeric) - DEFAULT NULL
      this.convertToNumberOrNull(record.total_dealer_rebate), // 25 - p_total_dealer_rebate (numeric) - DEFAULT NULL
      record.images || record.photo_url_list || null, // 26 - p_photo_url_list (text) - DEFAULT NULL
      this.convertToNumberOrNull(record.year), // 27 - p_year (integer) - DEFAULT NULL
      referenceDealerId, // 28 - p_reference_dealer_id (text) - DEFAULT NULL
      'available', // 29 - p_inventory_status (text) - DEFAULT 'available'
      config.id || null, // 30 - p_import_config_id (integer) - scopes multi-FTP inventory
      config.config_name || config.configName || 'csv' // 31 - p_import_source (text)
    ];
    
    // Validate required fields
    const requiredFields = [
      { index: 0, name: 'dealer_id', value: dealerId },
      { index: 1, name: 'vin', value: record.vin },
      { index: 2, name: 'make', value: record.make },
      { index: 3, name: 'model', value: record.model }
    ];
    
    for (const field of requiredFields) {
      if (!field.value) {
        throw new Error(`Required field ${field.name} is missing or empty`);
      }
    }
    
    // Validate field mappings and data types
    console.log('=== FIELD MAPPING VALIDATION ===');
    console.log('Record fields:', Object.keys(record));
    console.log('Checking for problematic mappings...');
    
    // Check for common problematic mappings
    const problematicMappings = [
      { source: 'Autowriter Description', target: 'dealer_accessories', issue: 'Text mapped to numeric field' },
      { source: 'Certification', target: 'unmapped_certification', issue: 'Mapped to unmapped field' },
      { source: 'Disp', target: 'unmapped_disp', issue: 'Mapped to unmapped field' },
      { source: 'Vehicle Detail Link', target: 'unmapped_vehicle_detail_link', issue: 'Mapped to unmapped field' },
      { source: 'Consumer Cash', target: 'unmapped_consumer_cash', issue: 'Mapped to unmapped field' },
      { source: 'Dlr Accessories', target: 'unmapped_dlr_accessories', issue: 'Mapped to unmapped field' },
      { source: 'Total Customer Incentives', target: 'unmapped_total_customer_incentives', issue: 'Mapped to unmapped field' }
    ];
    
    for (const mapping of problematicMappings) {
      if (record[mapping.source]) {
        console.log(`⚠️ PROBLEMATIC MAPPING: ${mapping.source} -> ${mapping.target}: ${mapping.issue}`);
        console.log(`   Value: "${record[mapping.source]}"`);
      }
    }
    console.log('=== END FIELD MAPPING VALIDATION ===');
  //   const sqlQuery = `
  //   SELECT import_vehicle_from_csv(
  //     dealer_id, vin, make, model, series, stock_number, new_used, body_style
  //     ,vehicle_type, certified,color, interior_color, engine_type, displacement, features,
  //      odometer, price, $18, $19, $20,$21, $22, $23, $24, $25, $26, $27, $28
  //   ) as vehicle_id
  // `;
    const sqlQuery = `
      SELECT import_vehicle_from_csv(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
      ) as vehicle_id
    `;
  
    // Log parameters with types and values
    // ⚡ Reduced logging for better console readability
    // const paramNames = [
    //   'p_dealer_id', 'p_vin', 'p_make', 'p_model', 'p_series', 'p_stock_number', 'p_new_used', 'p_body_style',
    //   'p_vehicle_type', 'p_certified', 'p_color', 'p_interior_color', 'p_engine_type', 'p_displacement', 'p_features',
    //   'p_odometer', 'p_price', 'p_other_price', 'p_transmission', 'p_msrp', 'p_dealer_discount',
    //   'p_consumer_rebate', 'p_dealer_accessories', 'p_total_customer_savings', 'p_total_dealer_rebate',
    //   'p_photo_url_list', 'p_year', 'p_reference_dealer_id', 'p_inventory_status',
    //   'p_import_config_id', 'p_import_source'
    // ];
    // console.log('=== DETAILED PARAMETER LOGGING ===');
    // console.log('Parameters being sent to database function:');
    // queryParams.forEach((param, i) => {
    //   const type = param === null ? 'null' : typeof param;
    //   const value = param === null ? 'null' : 
    //                typeof param === 'string' ? `"${param}"` : 
    //                typeof param === 'boolean' ? param.toString() : 
    //                typeof param === 'number' ? param.toString() : 
    //                JSON.stringify(param);
    //   console.log(`  ${i+1}. ${paramNames[i]}: ${value} (${type})`);
    // });
    // console.log('Raw queryParams array:', queryParams);
    // console.log('=== END DETAILED PARAMETER LOGGING ===');
  
    try {
      const existingBefore = await client.query(
        'SELECT id FROM vehicles WHERE vin = $1 AND dealer_id = $2',
        [record.vin, dealerId]
      );
      const alreadyExisted = existingBefore.rows.length > 0;

      const result = await client.query(sqlQuery, queryParams);
      // console.log('Database function result:', result.rows[0]);

      const vehicleId = result.rows[0]?.vehicle_id;
      return {
        action: alreadyExisted ? 'updated' : 'inserted',
        vehicleId
      };
    } catch (error) {
      console.error('Database error:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        where: error.where
      });
      throw error;
    }
  }
  
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

  transformNewUsedField(value) {
    if (value === null || value === undefined || value === '') {
      return 'used'; // Default to used
    }
    
    const stringValue = value.toString().toUpperCase().trim();
    
    // Handle common new/used patterns
    if (stringValue === 'N' || stringValue === 'NEW') {
      return 'new';
    }
    
    if (stringValue === 'U' || stringValue === 'USED') {
      return 'used';
    }
    
    // Check for other common patterns
    if (stringValue === '1' || stringValue === 'TRUE' || stringValue === 'YES') {
      return 'new';
    }
    
    if (stringValue === '0' || stringValue === 'FALSE' || stringValue === 'NO') {
      return 'used';
    }
    
    // Default to used for unknown values
    console.log(`Unknown new/used value: "${value}", defaulting to used`);
    return 'used';
  }

  normalizeFieldType(fieldType) {
    if (!fieldType || fieldType === null || fieldType === undefined) {
      console.log('Field type is null/undefined, defaulting to "string"');
      return 'string';
    }
    
    const normalizedType = fieldType.toString().toLowerCase().trim();
    
    // Map common field types to database constraint-compatible values
    // Database constraint allows: ('string', 'number', 'date', 'boolean', 'json')
    const fieldTypeMap = {
      // String types -> 'string'
      'string': 'string',
      'str': 'string',
      'varchar': 'string',
      'char': 'string',
      'text': 'string',
      
      // Number types -> 'number'
      'number': 'number',
      'numeric': 'number',
      'decimal': 'number',
      'float': 'number',
      'double': 'number',
      'money': 'number',
      'currency': 'number',
      'integer': 'number',
      'int': 'number',
      'bigint': 'number',
      'smallint': 'number',
      
      // Boolean types -> 'boolean'
      'boolean': 'boolean',
      'bool': 'boolean',
      'bit': 'boolean',
      
      // Date types -> 'date'
      'date': 'date',
      'datetime': 'date',
      'timestamp': 'date',
      'time': 'date',
      
      // JSON types -> 'json'
      'json': 'json',
      'jsonb': 'json'
    };
    
    const mappedType = fieldTypeMap[normalizedType];
    if (mappedType) {
      console.log(`Mapped field type: "${fieldType}" -> "${mappedType}"`);
      return mappedType;
    }
    
    // If no mapping found, check if it's already a valid type for the constraint
    const validTypes = ['string', 'number', 'date', 'boolean', 'json'];
    if (validTypes.includes(normalizedType)) {
      console.log(`Field type already valid: "${fieldType}"`);
      return normalizedType;
    }
    
    // Default to string for unknown types
    console.log(`Unknown field type: "${fieldType}", defaulting to "string"`);
    return 'string';
  }

  // Helper method to clean special characters
  cleanSpecialCharacters(value, fieldName = '') {
    if (!value) return value;
    
    const fieldNameLower = fieldName.toLowerCase();
    
    // Skip cleaning for features and image/photo/url fields - return as-is
    if (fieldNameLower.includes('feature') || 
        fieldNameLower.includes('image') || 
        fieldNameLower.includes('photo') || 
        fieldNameLower.includes('url')) {
      return value.toString();
    }
    
    let cleaned = value.toString();
    
    // Remove asterisks and other special characters
    cleaned = cleaned.replace(/\*\*/g, ''); // Remove **
    cleaned = cleaned.replace(/\*/g, '');   // Remove single *
    
    // For URL fields (like photo_url_list), preserve more characters including commas
    if (cleaned.includes('http://') || cleaned.includes('https://') || cleaned.includes('www.') || cleaned.includes(',') ) {
      // For URLs, be very conservative - only remove truly problematic characters
      // Keep commas, periods, slashes, colons, etc. that are valid in URLs
      cleaned = cleaned.replace(/[^\w\s\-.$%()/&:?=#,]/g, ''); // Keep URL-safe characters including commas
    } else {
      // For numeric fields, be more conservative with cleaning
      // Only remove problematic characters, keep more useful ones
      cleaned = cleaned.replace(/[^\w\s\-.,$%()/&:]/g, ''); // Keep more characters including %, (), /, &, :
    }
    
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
      return 'numeric';
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
      return 'numeric';
    }
    
    // Default to text (database-compatible)
    return 'text';
  }

  // Comprehensive data type validation and conversion
  validateAndConvertDataType(value, fieldType, fieldName) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    let stringValue = value.toString().trim();
    
    // Remove special characters and clean the string
          stringValue = this.cleanSpecialCharacters(stringValue, fieldName);
    
    try {
      switch (fieldType) {
        case 'string':
        case 'text':
          return stringValue;
          
        case 'number':
        case 'decimal':
        case 'numeric':
          // Remove common currency symbols and commas
          const cleanNumber = stringValue.replace(/[$,€£¥]/g, '').replace(/,/g, '');
          const numValue = parseFloat(cleanNumber);
          if (isNaN(numValue)) {
            console.log(`Invalid number value for ${fieldName}: "${stringValue}", defaulting to null`);
            return null;
          }
          return numValue;
          
        case 'integer':
        case 'int':
          // Remove common currency symbols and commas
          const cleanInt = stringValue.replace(/[$,€£¥]/g, '').replace(/,/g, '');
          const intValue = parseInt(cleanInt);
          if (isNaN(intValue)) {
            console.log(`Invalid integer value for ${fieldName}: "${stringValue}", defaulting to null`);
            return null;
          }
          return intValue;
          
        case 'boolean':
        case 'bool':
          return this.transformBooleanField(value);
          
        case 'date':
        case 'datetime':
        case 'timestamp':
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
      let targetField = mapping.target_field || mapping.targetField;
      let fieldType = mapping.field_type || mapping.fieldType;
      
      // Auto-map common field variations
      const sourceFieldLower = sourceField ? sourceField.toLowerCase() : '';
      if (sourceField && !targetField) {
        // Photo/Image field mapping
        if (sourceFieldLower.includes('photourlimage') || 
            sourceFieldLower.includes('photo_url') || 
            sourceFieldLower.includes('photourl') ||
            sourceFieldLower.includes('imageurl') ||
            sourceFieldLower.includes('image_url')) {
          targetField = 'images';
          console.log(`Auto-mapped photo field: ${sourceField} → ${targetField}`);
        }
        // Odometer/Mileage field mapping
        else if (sourceFieldLower.includes('odometer') || 
                 sourceFieldLower.includes('miles') ||
                 sourceFieldLower.includes('mileage')) {
          targetField = 'mileage';
          console.log(`Auto-mapped mileage field: ${sourceField} → ${targetField}`);
        }
      }
      
      // Skip mappings with undefined or empty target fields
      if (!targetField || targetField === '') {
        console.log(`Skipping mapping for ${sourceField}: no target field specified`);
        continue;
      }
      
      // CRITICAL: Prevent CSV dealer fields from overriding session dealer_id
      const fieldNameLower = targetField.toLowerCase();
      if (fieldNameLower === 'dealer_id' || fieldNameLower === 'dealerid') {
        console.log(`⚠️ BLOCKED: Preventing CSV field ${sourceField} from mapping to dealer_id. Use reference_dealer_id instead.`);
        // Map to reference_dealer_id instead
        targetField = 'reference_dealer_id';
        console.log(`Redirected ${sourceField} -> ${targetField}`);
      }
      
      const sourceValue = record[sourceField];
      
      console.log(`Mapping field: ${sourceField} -> ${targetField}, Original Value: "${sourceValue}"`);
      
      if (sourceValue !== undefined) {
        // Clean the value first
        const cleanedValue = this.cleanSpecialCharacters(sourceValue, sourceField);
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
          // transformedValue = this.transformPipeSeparatedData(transformedValue);
          transformedValue = transformedValue;
        }
        
        // Apply image URL list transformation for image-related fields
        if (transformedValue !== null && typeof transformedValue === 'string' && 
            (fieldNameLower.includes('image') || fieldNameLower.includes('photo') || 
             fieldNameLower.includes('picture') || fieldNameLower.includes('img') ||
             targetField === 'photo_url_list' || targetField === 'images')) {
          console.log('ALi transformedValue before', transformedValue);
          transformedValue = this.transformImageUrlList(transformedValue);
          console.log('ALi transformedValue after', transformedValue);
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
      let targetField = mapping.target_field || mapping.targetField;
      
      // Auto-map common field variations
      const sourceFieldLower = sourceField ? sourceField.toLowerCase() : '';
      if (sourceField && !targetField) {
        // Photo/Image field mapping
        if (sourceFieldLower.includes('photourlimage') || 
            sourceFieldLower.includes('photo_url') || 
            sourceFieldLower.includes('photourl') ||
            sourceFieldLower.includes('imageurl') ||
            sourceFieldLower.includes('image_url')) {
          targetField = 'images';
          console.log(`Auto-mapped photo field: ${sourceField} → ${targetField}`);
        }
        // Odometer/Mileage field mapping
        else if (sourceFieldLower.includes('odometer') || 
                 sourceFieldLower.includes('miles') ||
                 sourceFieldLower.includes('mileage')) {
          targetField = 'mileage';
          console.log(`Auto-mapped mileage field: ${sourceField} → ${targetField}`);
        }
      }
      
      // CRITICAL: Prevent CSV dealer fields from overriding session dealer_id
      const fieldNameLower = targetField.toLowerCase();
      if (fieldNameLower === 'dealer_id' || fieldNameLower === 'dealerid') {
        console.log(`⚠️ BLOCKED: Preventing CSV field ${sourceField} from mapping to dealer_id. Use reference_dealer_id instead.`);
        // Map to reference_dealer_id instead
        targetField = 'reference_dealer_id';
        console.log(`Redirected ${sourceField} -> ${targetField}`);
      }
      
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
    const validatedRecord = { ...record };

    // ✅ FIX: Only enforce truly required fields (VIN, Make, Model)
    // All other fields (price, msrp, colors, features, etc.) are optional
    const TRULY_REQUIRED_FIELDS = ['vin', 'make', 'model'];

    for (const mapping of fieldMappings) {
      // Handle both camelCase and snake_case field names
      const targetField = mapping.target_field || mapping.targetField;
      const isRequired = mapping.is_required || mapping.isRequired;
      const fieldType = mapping.field_type || mapping.fieldType;

      // Only validate if field is in the TRULY_REQUIRED_FIELDS list
      if (isRequired && TRULY_REQUIRED_FIELDS.includes(targetField) && !record[targetField]) {
        errors.push(`Required field ${targetField} is missing`);
      }
      
      if (record[targetField]) {
        // Special validation for photo_url_list field - use original value, not cleaned
        if (targetField === 'photo_url_list') {
          console.log(`=== VALIDATING ${targetField} WITH ORIGINAL VALUE ===`);
          console.log('Original value:', record[targetField]);
          const validation = this.validatePhotoUrlList(record[targetField], targetField);
          if (!validation.isValid) {
            errors.push(validation.error);
          } else {
            validatedRecord[targetField] = validation.value;
          }
          continue;
        }
        
        // Type validation for other fields
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
      errors,
      validatedRecord
    };
  }

  validatePhotoUrlList(value, fieldName) {
    console.log(`=== VALIDATING ${fieldName} ===`);
    console.log('Input value:', value);
    console.log('Input type:', typeof value);
    
    if (!value || typeof value !== 'string') {
      console.log('Returning original value (null/undefined/not string)');
      return { isValid: true, value: value };
    }
    
    // If it's already in the correct format (curly brackets), validate it
    if (value.startsWith('{') && value.endsWith('}')) {
      const content = value.slice(1, -1); // Remove curly brackets
      console.log('Already formatted, content:', content);
      if (content.trim()) {
        console.log('Returning as-is (valid formatted)');
        return { isValid: true, value: value };
      } else {
        console.log('Error: empty curly brackets');
        return { isValid: false, error: `${fieldName} contains empty curly brackets` };
      }
    }
    
    // If it contains pipe separators, transform them to comma format
    if (value.includes('|')) {
      console.log('Processing pipe-separated values');
      const items = value.split('|')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      console.log('Items after pipe split:', items);
      
      if (items.length === 0) {
        console.log('Error: no valid URLs after pipe separation');
        return { isValid: false, error: `${fieldName} contains no valid URLs after pipe separation` };
      }
      
      const formattedUrls = `{${items.join(',')}}`;
      console.log(`Transformed pipe-separated ${fieldName}: "${value}" -> "${formattedUrls}"`);
      return { isValid: true, value: formattedUrls };
    }
    
    // If it contains comma separators, format with curly braces
    if (value.includes(',')) {
      console.log('Processing comma-separated values');
      const items = value.split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      console.log('Items after comma split:', items);
      
      if (items.length === 0) {
        console.log('Error: no valid URLs after comma separation');
        return { isValid: false, error: `${fieldName} contains no valid URLs after comma separation` };
      }
      
      const formattedUrls = `{${items.join(',')}}`;
      console.log(`Transformed comma-separated ${fieldName}: "${value}" -> "${formattedUrls}"`);
      return { isValid: true, value: formattedUrls };
    }
    
    // Handle concatenated URLs without separators (like your example)
    // Look for patterns like "http://...jpghttp://...jpg" or "https://...jpghttps://...jpg"
    if (value.includes('http://') || value.includes('https://')) {
      console.log('Processing concatenated URLs without separators');
      
      // Split by "http" and reconstruct URLs
      const httpParts = value.split(/(?=https?:\/\/)/);
      const items = httpParts
        .map(part => part.trim())
        .filter(part => part.startsWith('http') && part.length > 0);
      
      console.log('Items after URL splitting:', items);
      
      if (items.length === 0) {
        console.log('Error: could not parse URLs from concatenated string');
        return { isValid: false, error: `${fieldName} contains concatenated URLs that could not be parsed` };
      }
      
      const formattedUrls = `{${items.join(',')}}`;
      console.log(`Transformed concatenated URLs ${fieldName}: "${value}" -> "${formattedUrls}"`);
      return { isValid: true, value: formattedUrls };
    }
    
    // If it's a single URL, wrap it in curly braces
    if (value.trim()) {
      const formattedUrl = `{${value.trim()}}`;
      console.log(`Transformed single ${fieldName}: "${value}" -> "${formattedUrl}"`);
      return { isValid: true, value: formattedUrl };
    }
    
    console.log('Error: empty or no valid URLs');
    return { isValid: false, error: `${fieldName} is empty or contains no valid URLs` };
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
    const { selectedRows = [], fieldMappings = [], transformedData = null, remoteFileName: providedFileName } = options;
    let selectedFileName = providedFileName; // Use mutable variable
    
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

    // ⚡ NEW: Use preview-style import flow for sync (more reliable, same as manual import)
    if (!transformedData || transformedData.length === 0) {
      console.log('⚡ Using preview-style import for sync (same method as manual import)');
      
      // Step 1: File selection logic
      const names = await this.getMatchingRemoteFilenames(config);
      if (names !== null) {
        if (names.length === 0) {
          throw new Error(`No files found matching pattern: ${config.file_pattern || '*.csv'}`);
        }
        
        // Auto-select file if keyword pattern is configured
        if (names.length > 1 && !selectedFileName && config.file_match_keyword) {
          console.log(`🔍 Multiple files found, using keyword pattern: ${config.file_match_keyword}`);
          const keyword = config.file_match_keyword.toLowerCase();
          const matchingFiles = names.filter(name => name.toLowerCase().includes(keyword));
          
          if (matchingFiles.length === 0) {
            throw new Error(`No files matching keyword "${config.file_match_keyword}" found among: ${names.join(', ')}`);
          }
          
          if (matchingFiles.length === 1) {
            selectedFileName = matchingFiles[0];
            console.log(`✅ Auto-selected file: ${selectedFileName}`);
          } else {
            // Multiple matches - sort and pick the latest (assuming timestamp in filename)
            matchingFiles.sort();
            selectedFileName = matchingFiles[matchingFiles.length - 1];
            console.log(`✅ Auto-selected latest file: ${selectedFileName} from ${matchingFiles.length} matches`);
          }
        } else if (names.length > 1 && !selectedFileName) {
          return { needsFileSelection: true, matchingFiles: names };
        }
      }
      
      // Step 2: Download file
      console.log('📥 Downloading file from remote server...');
      const downloadResult = await this.downloadFile(config, { remoteFileName: selectedFileName });
      const fileName = downloadResult.fileName;
      const localPath = downloadResult.localPath;
      
      // Step 3: Parse file
      console.log('📄 Parsing file:', localPath);
      const records = await this.parseFile(localPath, config);
      console.log(`✅ Parsed ${records.length} records from file`);
      
      // Step 4: Apply data transformations (same as manual import does)
      console.log('🔄 Applying data transformations (same as manual import)...');
      const headers = records.length > 0 ? Object.keys(records[0]) : [];
      const transformedRecords = records.map(row => this.applyDataTransformations(row, headers));
      console.log(`✅ Transformed ${transformedRecords.length} records`);
      
      // Step 5: Prepare CSV data format for preview method
      const csvData = {
        headers: headers,
        totalRows: records.length,
        fileName: fileName,
        sampleData: transformedRecords.slice(0, 10) // First 10 for logging
      };
      
      // Step 6: Clean up local file
      if (localPath && fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
          console.log('🗑️ Temporary file deleted:', localPath);
        } catch (error) {
          console.warn('⚠️ Could not delete temporary file:', error.message);
        }
      }
      
      // Step 7: Use the preview import method (same as manual import)
      console.log('✨ Delegating to preview import method (proven reliable flow)...');
      return await this.executeImportFromPreview(
        config,
        csvData,
        selectedRows,
        transformedRecords  // ← Pass transformed data (same as manual import)
      );
    }

    // Original flow: If transformedData was already provided (manual import path)
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
        let recordsToProcess = [];
        let fileName = 'transformed-data';
        let fileStats = { size: 0 };
        let localPath = null; // Declare at higher scope for cleanup
        
        // Use transformed data if provided, otherwise download and parse file
        if (transformedData && transformedData.length > 0) {
          console.log('Using pre-transformed data:', transformedData.length, 'records');
          recordsToProcess = selectedRows.length > 0 
            ? selectedRows.map(index => transformedData[index]).filter(Boolean)
            : transformedData;
          fileName = 'transformed-data.csv';
          fileStats = { size: JSON.stringify(transformedData).length };
        } else {
          // Download file
          const downloadResult = await this.downloadFile(config, { remoteFileName: selectedFileName });
          fileName = downloadResult.fileName;
          localPath = downloadResult.localPath;
          
          // Get file stats
          fileStats = fs.statSync(localPath);
          
          // Parse file
          console.log('Parsing file:', localPath);
          const records = await this.parseFile(localPath, config);
          console.log('Parsed records:', records.length);
          
          // Apply transform function before processing (same as transform-data endpoint)
          console.log('Applying data transformations...');
          const headers = records.length > 0 ? Object.keys(records[0]) : [];
          const transformedRecords = records.map(row => this.applyDataTransformations(row, headers));
          console.log('Transformed records:', transformedRecords.length);
          
          // Filter records based on selected rows if provided
          recordsToProcess = transformedRecords;
          if (selectedRows.length > 0) {
            recordsToProcess = selectedRows.map(index => transformedRecords[index]).filter(Boolean);
            console.log('Processing selected rows:', selectedRows.length);
          }
          
          // Don't delete file here - we'll handle cleanup after processing
        }
        
        // Use custom field mappings if provided
        if (fieldMappings.length > 0) {
          config.fieldMappings = fieldMappings;
          console.log('Using custom field mappings:', fieldMappings.length);
        } else {
          console.log('Using default field mappings:', config.fieldMappings?.length || 0);
        }
        
        // Transform records with field mappings BEFORE checking for sold vehicles
        // This ensures VINs are in the correct field names for comparison
        console.log('=== TRANSFORMING RECORDS WITH FIELD MAPPINGS ===');
        const transformedRecordsForComparison = [];
        for (const record of recordsToProcess) {
          try {
            const transformed = this.transformRecordWithValidation(record, config.fieldMappings || []);
            transformedRecordsForComparison.push(transformed);
          } catch (error) {
            console.error('Error transforming record for comparison:', error);
            // Continue with other records even if one fails
          }
        }
        console.log(`Transformed ${transformedRecordsForComparison.length} records for inventory comparison`);
        
        // STEP 1: Mark vehicles not in new inventory as sold (scoped to this import config only)
        console.log('=== INVENTORY COMPARISON PROCESS ===');
        await this.markVehiclesAsSoldIfNotInNewInventory(
          client,
          config.dealer_id,
          transformedRecordsForComparison,
          config.fieldMappings || [],
          config.id
        );
        
        // STEP 2: Process new records (insert/update and mark as available)
        // Note: processRecords will transform records again, but that's okay
        console.log('Starting to process records...');
        const result = await this.processRecords(recordsToProcess, config, historyId);
        
        // Update history with success
        await client.query(`
          UPDATE import_history 
          SET import_status = 'completed', file_name = $1, file_size = $2, completed_at = NOW()
          WHERE id = $3
        `, [fileName, fileStats.size, historyId]);
        
        // Clean up local file
        if (localPath && fs.existsSync(localPath)) {
          if (config.processing?.archive_processed_files) {
            const archivePath = path.join(__dirname, '../../uploads/imports/processed', fileName);
            const archiveDir = path.dirname(archivePath);
            if (!fs.existsSync(archiveDir)) {
              fs.mkdirSync(archiveDir, { recursive: true });
            }
            try {
              fs.renameSync(localPath, archivePath);
              console.log('File archived to:', archivePath);
            } catch (error) {
              console.error('Error archiving file:', error);
              // Fallback to delete if archive fails
              fs.unlinkSync(localPath);
            }
          } else {
            // Clean up local file
            fs.unlinkSync(localPath);
            console.log('Temporary file deleted:', localPath);
          }
        }
        
        // Post-import processing: Update trims and generate QR codes
        console.log('\n=== POST-IMPORT PROCESSING ===');
        try {
          await this.postImportProcessing(config.dealer_id, config.id, client);
        } catch (error) {
          console.error('⚠️ Post-import processing failed (non-critical):', error.message);
          // Don't throw - this is non-critical and shouldn't fail the import
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
  async executeImportFromPreview(config, csvData, selectedRows = [], transformedData = null) {
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
        // Use transformed data if provided, otherwise convert CSV data to records
        let records = [];
        if (transformedData && transformedData.length > 0) {
          console.log('Using pre-transformed data for preview import:', transformedData.length, 'records');
          records = selectedRows.length > 0 
            ? selectedRows.map(index => transformedData[index]).filter(Boolean)
            : transformedData;
        } else {
          // Convert CSV data to records
          records = this.convertCSVDataToRecords(csvData, selectedRows);
        }
        console.log('Records to process:', records.length);
        
        // STEP 1: Mark vehicles not in new inventory as sold (scoped to this import config only)
        console.log('=== INVENTORY COMPARISON PROCESS (PREVIEW) ===');
        await this.markVehiclesAsSoldIfNotInNewInventory(
          client,
          fullConfig.dealer_id,
          records,
          fullConfig.fieldMappings || [],
          fullConfig.id
        );
        
        // STEP 2: Process records with the full config including field mappings
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
          ic.config_name,
          ic.dealer_id as config_dealer_id
        FROM import_history ih
        LEFT JOIN import_configs ic ON ih.import_config_id = ic.id
        WHERE (ic.dealer_id = $1 OR (ih.import_config_id IS NULL AND $1 IS NOT NULL))
        ORDER BY ih.created_at DESC
        LIMIT $2
      `, [dealerId, limit]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  // Get import errors for a specific import history
  async getImportErrors(historyId, dealerId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ie.*,
          ih.import_status,
          ih.file_name,
          ih.created_at as import_date,
          ic.dealer_id as config_dealer_id
        FROM import_errors ie
        JOIN import_history ih ON ie.import_history_id = ih.id
        LEFT JOIN import_configs ic ON ih.import_config_id = ic.id
        WHERE ie.import_history_id = $1 
        AND (ic.dealer_id = $2 OR (ih.import_config_id IS NULL AND $2 IS NOT NULL))
        ORDER BY ie.row_number ASC
      `, [historyId, dealerId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  // Helper method to extract meaningful data from text
  extractMeaningfulData(value, fieldType, fieldName) {
    if (!value) return null;
    
    const cleanedValue = this.cleanSpecialCharacters(value, fieldName);
    const fieldNameLower = fieldName.toLowerCase();
    
    // Features are handled by the main transformation logic, skip processing here
    if (fieldNameLower.includes('feature') || fieldNameLower.includes('features')) {
      return cleanedValue; // Return as-is since transformation already applied
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

  // Post-import processing: Update trims and generate QR codes
  async postImportProcessing(dealerId, importConfigId, client) {
    try {
      console.log(`🔄 Starting post-import processing for dealer ${dealerId}, import config ${importConfigId}`);
      
      // Step 1: Find vehicles from this import that need QR codes
      const vehiclesNeedingQR = await client.query(`
        SELECT id, vin, dealer_id, make, model, year
        FROM vehicles
        WHERE dealer_id = $1
          AND import_config_id = $2
          AND (qr_code_url IS NULL OR qr_code_url = '')
          AND inventory_status = 'available'
        LIMIT 100
      `, [dealerId, importConfigId]);
      
      console.log(`📊 Found ${vehiclesNeedingQR.rows.length} vehicles needing QR codes`);
      
      // Step 2: Generate QR codes
      if (vehiclesNeedingQR.rows.length > 0) {
        const { generateVehicleQRCodeWithURL } = await import('./qrCodeGenerator.js');
        const frontendBaseURL = process.env.FRONTEND_URL || 'https://app.dealeriq.co';
        
        let qrGenerated = 0;
        for (const vehicle of vehiclesNeedingQR.rows) {
          try {
            const qrCodeUrl = await generateVehicleQRCodeWithURL(
              vehicle.id,
              frontendBaseURL,
              vehicle
            );
            
            await client.query(`
              UPDATE vehicles
              SET qr_code_url = $1, 
                  sticker_generation_status = 'generated',
                  updated_at = NOW()
              WHERE id = $2
            `, [qrCodeUrl, vehicle.id]);
            
            qrGenerated++;
            if (qrGenerated <= 5) {
              console.log(`✅ Generated QR code for ${vehicle.make} ${vehicle.model} (${vehicle.vin})`);
            }
          } catch (error) {
            console.error(`❌ Failed to generate QR for vehicle ${vehicle.id}:`, error.message);
          }
        }
        
        if (qrGenerated > 5) {
          console.log(`✅ Generated ${qrGenerated} QR codes total`);
        }
      }
      
      // Step 3: Update trim information (you can implement trim API calls here)
      // For now, we'll just log that this step would happen
      console.log('📝 Trim update check complete (implement trim API if needed)');
      
      console.log('✅ Post-import processing completed');
      
    } catch (error) {
      console.error('❌ Post-import processing error:', error);
      throw error;
    }
  }

  // Method to mark vehicles as sold if they're not in the new inventory
  // Scoped to import_config_id so one FTP feed cannot wipe another supplier's inventory.
  async markVehiclesAsSoldIfNotInNewInventory(client, dealerId, newInventoryRecords, fieldMappings = [], importConfigId = null) {
    console.log('=== MARKING VEHICLES AS SOLD IF NOT IN NEW INVENTORY ===');
    console.log('Import config scope:', importConfigId);
    
    try {
      if (!importConfigId) {
        console.warn('⚠️ No import_config_id provided — skipping sold vehicle check to protect other suppliers\' inventory.');
        return {
          totalCurrentVehicles: 0,
          vehiclesMarkedAsSold: 0,
          vehiclesMarkedAsSoldDetails: [],
          warning: 'Skipped sold check: missing import_config_id'
        };
      }

      // Only reconcile vehicles previously imported by THIS config
      const currentVehiclesResult = await client.query(`
        SELECT id, vin, make, model, year, stock_number, inventory_status, import_config_id
        FROM vehicles 
        WHERE dealer_id = $1
          AND inventory_status = 'available'
          AND import_config_id = $2
        ORDER BY vin
      `, [dealerId, importConfigId]);
      
      const currentVehicles = currentVehiclesResult.rows;
      console.log(`Found ${currentVehicles.length} available vehicles for import_config_id=${importConfigId}`);
      
      if (currentVehicles.length === 0) {
        console.log('✅ No current vehicles for this import config - skipping sold vehicle check');
        return {
          totalCurrentVehicles: 0,
          vehiclesMarkedAsSold: 0,
          vehiclesMarkedAsSoldDetails: []
        };
      }
      
      // Extract VINs from new inventory records
      // After transformation, VIN should be in the 'vin' field (target field)
      const newInventoryVins = new Set();
      let recordsWithoutVin = 0;
      
      console.log(`Processing ${newInventoryRecords.length} records to extract VINs...`);
      
      for (let i = 0; i < newInventoryRecords.length; i++) {
        const record = newInventoryRecords[i];
        let vinValue = null;
        
        // After transformation, VIN should be in the 'vin' field (lowercase)
        // Try the target field first (after transformation)
        if (record.vin && record.vin.toString().trim()) {
          vinValue = record.vin;
        } else {
          // Fallback: try common VIN field names (case-insensitive) in case transformation didn't work
          const vinFields = ['vin', 'VIN', 'vehicle_vin', 'VehicleVIN', 'vehiclevin', 'VINNumber', 'vin_number'];
          for (const field of vinFields) {
            if (record[field] && record[field].toString().trim()) {
              vinValue = record[field];
              break;
            }
          }
        }
        
        // Also check all keys case-insensitively
        if (!vinValue) {
          const recordKeys = Object.keys(record);
          for (const key of recordKeys) {
            if (key.toLowerCase() === 'vin' || key.toLowerCase().includes('vin')) {
              vinValue = record[key];
              break;
            }
          }
        }
        
        if (vinValue && vinValue.toString().trim()) {
          const vinUpper = vinValue.toString().trim().toUpperCase();
          newInventoryVins.add(vinUpper);
          if (newInventoryVins.size <= 10) {
            console.log(`  [${i + 1}] Found VIN: ${vinUpper}`);
          }
        } else {
          recordsWithoutVin++;
          if (recordsWithoutVin <= 5) {
            console.warn(`  ⚠️ [${i + 1}] No VIN found in record. Keys:`, Object.keys(record));
            // Log first few values to help debug
            const sampleValues = Object.entries(record).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(', ');
            console.warn(`    Sample values: ${sampleValues}`);
          }
        }
      }
      
      console.log(`New inventory contains ${newInventoryVins.size} unique VINs`);
      console.log(`Records without VIN: ${recordsWithoutVin} out of ${newInventoryRecords.length}`);
      
      // CRITICAL: If no VINs were found in new inventory, don't mark anything as sold
      if (newInventoryVins.size === 0) {
        console.warn('⚠️ WARNING: No VINs found in new inventory records! Skipping sold vehicle check to prevent marking all vehicles as sold.');
        console.warn('This usually means the VIN field mapping is incorrect or the records were not transformed properly.');
        return {
          totalCurrentVehicles: currentVehicles.length,
          vehiclesMarkedAsSold: 0,
          vehiclesMarkedAsSoldDetails: [],
          warning: 'No VINs found in new inventory - skipped sold vehicle check'
        };
      }
      
      // Find vehicles that are not in the new inventory
      const vehiclesToMarkAsSold = [];
      for (const vehicle of currentVehicles) {
        const vinUpper = vehicle.vin.toUpperCase();
        if (!newInventoryVins.has(vinUpper)) {
          vehiclesToMarkAsSold.push(vehicle);
        }
      }
      
      console.log(`Found ${vehiclesToMarkAsSold.length} vehicles to mark as sold out of ${currentVehicles.length} current vehicles (config ${importConfigId})`);
      
      // Log some sample VINs for debugging
      if (newInventoryVins.size > 0) {
        const sampleVins = Array.from(newInventoryVins).slice(0, 5);
        console.log(`Sample VINs from new inventory: ${sampleVins.join(', ')}`);
      }
      if (currentVehicles.length > 0) {
        const sampleCurrentVins = currentVehicles.slice(0, 5).map(v => v.vin.toUpperCase());
        console.log(`Sample VINs from current inventory: ${sampleCurrentVins.join(', ')}`);
      }
      
      if (vehiclesToMarkAsSold.length > 0) {
        // Mark vehicles as sold — still scoped to this import config
        const vehicleIds = vehiclesToMarkAsSold.map(v => v.id);
        
        const updateResult = await client.query(`
          UPDATE vehicles 
          SET inventory_status = 'sold', 
              status = 'sold',
              updated_at = NOW()
          WHERE id = ANY($1)
            AND dealer_id = $2
            AND import_config_id = $3
        `, [vehicleIds, dealerId, importConfigId]);
        
        console.log(`✅ Marked ${updateResult.rowCount} vehicles as sold (import_config_id=${importConfigId})`);
        
        // Log details of vehicles marked as sold (limit to first 10)
        console.log('Vehicles marked as sold (first 10):');
        vehiclesToMarkAsSold.slice(0, 10).forEach(vehicle => {
          console.log(`  - VIN: ${vehicle.vin}, Make: ${vehicle.make}, Model: ${vehicle.model}, Year: ${vehicle.year}`);
        });
        if (vehiclesToMarkAsSold.length > 10) {
          console.log(`  ... and ${vehiclesToMarkAsSold.length - 10} more`);
        }
      } else {
        console.log('✅ No vehicles need to be marked as sold - all current inventory for this config is in the new import');
      }
      
      return {
        totalCurrentVehicles: currentVehicles.length,
        vehiclesMarkedAsSold: vehiclesToMarkAsSold.length,
        vehiclesMarkedAsSoldDetails: vehiclesToMarkAsSold
      };
      
    } catch (error) {
      console.error('Error marking vehicles as sold:', error);
      throw error;
    }
  }

  // Helper method to transform pipe-separated data to comma-separated with quotes
  transformPipeSeparatedData(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }
    
    // If data is already in the correct format (starts with { and contains quotes), skip processing
    if (value.startsWith('{') && value.includes('"')) {
      console.log(`Data already in correct format, skipping transformation: "${value}"`);
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
    console.log('ALi transformImageUrlList 2', value);
    if (!value || typeof value !== 'string') {
      return value;
    }
  
    // Already in correct format
    if (value.startsWith('{') && value.endsWith('}')) {
      return value;
    }
  
    let separator = null;
  
    if (value.includes('|')) {
      separator = '|';
    } else if (value.includes(',')) {
      separator = ',';
    }
  
    if (separator) {
      const items = value
        .split(separator)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .join(',');
        
      const formattedUrls = `{${items}}`;
      console.log(`Transformed ${separator === '|' ? 'pipe' : 'comma'}-separated image URLs: "${value}" -> "${formattedUrls}"`);
      return formattedUrls;
    }
  
    // Single URL
    const formattedUrl = `{${value.trim()}}`;
    console.log(`Transformed single image URL: "${value}" -> "${formattedUrl}"`);


    console.log('ALi formattedUrl', formattedUrl);
    return formattedUrl;
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
          // Same pre-transform as FTP executeImport (Features, Photo Url List, prices, etc.)
          const headers = Object.keys(record || {});
          const preTransformed = this.applyDataTransformations(record, headers);

          // Map CSV source fields → database target fields
          let transformedRecord = this.transformRecordWithValidation(preTransformed, fieldMappings);
          
          if (!transformedRecord) {
            recordsSkipped++;
            errors.push(`Row ${i + 1}: Invalid record data`);
            continue;
          }

          // Validate record including photo_url_list formatting
          const validationResult = this.validateRecord(transformedRecord, fieldMappings);
          if (!validationResult.isValid) {
            recordsSkipped++;
            errors.push(`Row ${i + 1}: ${validationResult.errors.join(', ')}`);
            continue;
          }
          // Use the validated record which includes properly formatted photo_url_list
          transformedRecord = validationResult.validatedRecord;

          // ✅ FIX: Validate only truly required fields (VIN, Make, Model)
          // Year is optional as some vehicles might not have it yet
          const requiredFields = ['vin', 'make', 'model'];
          const missingFields = requiredFields.filter(field =>
            !transformedRecord[field] || transformedRecord[field] === ''
          );

          if (missingFields.length > 0) {
            recordsSkipped++;
            errors.push(`Row ${i + 1}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }

          // Set dealer ID from session (never from CSV DealerId)
          transformedRecord.dealer_id = dealerId;

          // Try to insert or update the record
          const result = await this.insertOrUpdateVehicleRecord(client, transformedRecord, {
            dealer_id: dealerId,
            processing: {
              duplicate_handling: 'update',
              validate_data: true
            }
          });

          if (result.action === 'inserted') {
            recordsInserted++;
          } else if (result.action === 'updated') {
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

  // Schedule Management
  async updateNextRunTime(importConfigId) {
    const client = await this.pool.connect();
    try {
      const scheduleResult = await client.query(`
        SELECT * FROM import_schedule_settings WHERE import_config_id = $1
      `, [importConfigId]);
      
      if (scheduleResult.rows.length === 0) return;
      
      const schedule = scheduleResult.rows[0];
      const now = new Date();
      let nextRun = new Date();
      
      // Handle test frequency (2 minutes)
      if (schedule.frequency === 'test') {
        nextRun.setMinutes(nextRun.getMinutes() + 2);
      } else {
        // Set time
        nextRun.setHours(schedule.time_hour, schedule.time_minute, 0, 0);
        
        // If time has passed today, move to next occurrence
        if (nextRun <= now) {
          switch (schedule.frequency) {
            case 'hourly':
              nextRun.setHours(nextRun.getHours() + 1);
              break;
            case 'daily':
              nextRun.setDate(nextRun.getDate() + 1);
              break;
            case 'weekly':
              // Find next occurrence of the specified day of week
              const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
              const targetDay = schedule.day_of_week || 1; // 1 = Sunday, 7 = Saturday
              // Convert targetDay (1-7) to JavaScript day (0-6)
              const jsTargetDay = targetDay === 7 ? 0 : targetDay;
              let daysToAdd = (jsTargetDay - currentDay + 7) % 7;
              if (daysToAdd === 0) daysToAdd = 7; // If same day, move to next week
              nextRun.setDate(nextRun.getDate() + daysToAdd);
              break;
            case 'monthly':
              nextRun.setMonth(nextRun.getMonth() + 1);
              // Adjust day if needed (e.g., if day 31 doesn't exist in next month)
              if (schedule.day_of_month) {
                const targetDay = schedule.day_of_month;
                const lastDayOfMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
                nextRun.setDate(Math.min(targetDay, lastDayOfMonth));
              }
              break;
          }
        }
      }
      
      await client.query(`
        UPDATE import_schedule_settings 
        SET next_run = $1, last_run = NOW()
        WHERE import_config_id = $2
      `, [nextRun, importConfigId]);
      
    } finally {
      client.release();
    }
  }

  // Transform data functions (same as transform-data endpoint - DO NOT MODIFY)
  applyDataTransformations(row, headers) {
    const transformedRow = {};
    
    headers.forEach(header => {
      let value = row[header] || '';
      
      // Apply various transformations
      if (typeof value === 'string') {
        // Trim whitespace
        value = value.trim();
        
        // Phone number standardization
        if (header.toLowerCase().includes('phone') || header.toLowerCase().includes('tel')) {
          value = this.standardizePhoneNumber(value);
        }
        
        // Email normalization
        if (header.toLowerCase().includes('email')) {
          value = value.toLowerCase().trim();
        }
        
        // Proper case for names
        if (header.toLowerCase().includes('name') || header.toLowerCase().includes('contact')) {
          value = this.toProperCase(value);
        }
        
        // Convert pipe-separated photo URLs to comma-separated
        if (header.toLowerCase().includes('photo') || 
            header.toLowerCase().includes('image') || 
            header.toLowerCase().includes('url')) {
          if (value.includes('|')) {
            // Split by pipe, trim each URL, and join with commas (no spaces)
            const urls = value.split('|')
              .map(url => url.trim())
              .filter(url => url.length > 0) // Remove empty URLs
              .join(',');
            value = urls;
          }
        }
        
        // Transform features: wrap each in quotes, replace pipes with commas, surround with curly brackets
        if (header.toLowerCase().includes('feature')) {
          if (value.includes('|')) {
            // Split by pipe, clean and wrap each feature in quotes, join with commas, surround with curly brackets
            const features = value.split('|')
              .map(feature => {
                let cleanFeature = feature.trim();
                // Remove existing quotes if present to avoid double quoting
                if (cleanFeature.startsWith('"') && cleanFeature.endsWith('"')) {
                  cleanFeature = cleanFeature.slice(1, -1);
                }
                return `"${cleanFeature}"`;
              })
              .filter(feature => feature !== '""') // Remove empty features
              .join(',');
            value = `{${features}}`;
          } else if (value.trim() && !value.startsWith('{')) {
            // Single feature or already comma-separated - wrap in quotes and curly brackets
            if (value.includes(',')) {
              // Already comma-separated, clean and add quotes and brackets
              const features = value.split(',')
                .map(feature => {
                  let cleanFeature = feature.trim();
                  // Remove existing quotes if present to avoid double quoting
                  if (cleanFeature.startsWith('"') && cleanFeature.endsWith('"')) {
                    cleanFeature = cleanFeature.slice(1, -1);
                  }
                  return `"${cleanFeature}"`;
                })
                .filter(feature => feature !== '""') // Remove empty features
                .join(',');
              value = `{${features}}`;
            } else {
              // Single feature - remove existing quotes if present
              let cleanFeature = value.trim();
              if (cleanFeature.startsWith('"') && cleanFeature.endsWith('"')) {
                cleanFeature = cleanFeature.slice(1, -1);
              }
              value = `{"${cleanFeature}"}`;
            }
          }
        }
        
        // Convert numeric strings to numbers where appropriate
        if (header.toLowerCase().includes('price') || 
            header.toLowerCase().includes('mileage') || 
            header.toLowerCase().includes('year') ||
            header.toLowerCase().includes('miles')) {
          const numValue = parseFloat(value.replace(/[,$]/g, ''));
          if (!isNaN(numValue)) {
            value = numValue;
          }
        }
      }
      
      transformedRow[header] = value;
    });
    
    return transformedRow;
  }

  // Helper function to standardize phone numbers
  standardizePhoneNumber(phone) {
    if (!phone) return phone;
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX if it's a 10-digit US number
    if (cleaned.length === 10) {
      return `(${cleaned.substr(0, 3)}) ${cleaned.substr(3, 3)}-${cleaned.substr(6, 4)}`;
    }
    
    // Return original if not a standard format
    return phone;
  }

  // Helper function to convert to proper case
  toProperCase(str) {
    if (!str) return str;
    
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }
}

export default ImportService; 
