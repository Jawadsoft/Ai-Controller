import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// Import these only when needed to avoid startup issues
// import { Client } from 'ssh2';
// import ftp from 'basic-ftp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ETLService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management'
    });
  }

  // Encryption/Decryption utilities
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

  // ETL Configuration Management
  async createExportConfig(dealerId, configData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create main export config
      const configResult = await client.query(`
        INSERT INTO etl_export_configs (dealer_id, config_name, is_active)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [dealerId, configData.configName, true]);

      const exportConfigId = configResult.rows[0].id;

      // Create connection settings
      if (configData.connection) {
        await client.query(`
          INSERT INTO etl_connection_settings (
            export_config_id, connection_type, host_url, port, username, 
            password_encrypted, remote_directory
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          exportConfigId,
          configData.connection.type,
          configData.connection.hostUrl,
          configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
          configData.connection.username,
          this.encryptPassword(configData.connection.password),
          configData.connection.remoteDirectory || '/'
        ]);
      }

      // Create schedule settings
      if (configData.schedule) {
        const now = new Date();
        let nextRun = new Date();
        nextRun.setHours(configData.schedule.timeHour, configData.schedule.timeMinute, 0, 0);
        
        // If time has passed today, move to next occurrence
        if (nextRun <= now) {
          switch (configData.schedule.frequency) {
            case 'daily':
              nextRun.setDate(nextRun.getDate() + 1);
              break;
            case 'weekly':
              nextRun.setDate(nextRun.getDate() + 7);
              break;
            case 'monthly':
              nextRun.setMonth(nextRun.getMonth() + 1);
              break;
          }
        }
        
        await client.query(`
          INSERT INTO etl_schedule_settings (
            export_config_id, frequency, time_hour, time_minute, 
            day_of_week, day_of_month, is_active, next_run
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          exportConfigId,
          configData.schedule.frequency,
          configData.schedule.timeHour,
          configData.schedule.timeMinute,
          configData.schedule.dayOfWeek,
          configData.schedule.dayOfMonth,
          true,
          nextRun
        ]);
      }

      // Create file format settings
      if (configData.fileFormat) {
        await client.query(`
          INSERT INTO etl_file_format_settings (
            export_config_id, file_type, delimiter, multi_value_delimiter, 
            include_header, encoding
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          exportConfigId,
          configData.fileFormat.fileType,
          configData.fileFormat.delimiter || ',',
          configData.fileFormat.multiValueDelimiter || '|',
          configData.fileFormat.includeHeader !== false,
          configData.fileFormat.encoding || 'UTF-8'
        ]);
      }

      // Create file naming settings
      if (configData.fileNaming) {
        await client.query(`
          INSERT INTO etl_file_naming_settings (
            export_config_id, naming_pattern, include_timestamp, timestamp_format
          ) VALUES ($1, $2, $3, $4)
        `, [
          exportConfigId,
          configData.fileNaming.pattern,
          configData.fileNaming.includeTimestamp !== false,
          configData.fileNaming.timestampFormat || 'YYYYMMDD_HHMMSS'
        ]);
      }

      // Create field mappings
      if (configData.fieldMappings && Array.isArray(configData.fieldMappings)) {
        for (let i = 0; i < configData.fieldMappings.length; i++) {
          const mapping = configData.fieldMappings[i];
          await client.query(`
            INSERT INTO etl_field_mappings (
              export_config_id, source_field, target_field, field_order, 
              is_required, default_value, transformation_rule
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            exportConfigId,
            mapping.sourceField,
            mapping.targetField,
            mapping.fieldOrder || i + 1,
            mapping.isRequired || false,
            mapping.defaultValue,
            mapping.transformationRule ? JSON.stringify(mapping.transformationRule) : null
          ]);
        }
      }

      // Create company settings
      if (configData.company) {
        await client.query(`
          INSERT INTO etl_company_settings (
            export_config_id, company_name, company_id, 
            authorization_document_url, dealer_authorization_required
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          exportConfigId,
          configData.company.name,
          configData.company.id,
          configData.company.authorizationDocumentUrl,
          configData.company.dealerAuthorizationRequired !== false
        ]);
      }

      await client.query('COMMIT');
      return { success: true, exportConfigId };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getExportConfigs(dealerId) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ec.*,
          cs.connection_type, cs.host_url, cs.port, cs.username, cs.remote_directory,
          ss.frequency, ss.time_hour, ss.time_minute, ss.day_of_week, ss.day_of_month,
          ffs.file_type, ffs.delimiter, ffs.multi_value_delimiter, ffs.include_header,
          fns.naming_pattern, fns.include_timestamp,
          comp.company_name, comp.company_id
        FROM etl_export_configs ec
        LEFT JOIN etl_connection_settings cs ON ec.id = cs.export_config_id
        LEFT JOIN etl_schedule_settings ss ON ec.id = ss.export_config_id
        LEFT JOIN etl_file_format_settings ffs ON ec.id = ffs.export_config_id
        LEFT JOIN etl_file_naming_settings fns ON ec.id = fns.export_config_id
        LEFT JOIN etl_company_settings comp ON ec.id = comp.export_config_id
        WHERE ec.dealer_id = $1
        ORDER BY ec.created_at DESC
      `, [dealerId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  async getExportConfig(exportConfigId) {
    const client = await this.pool.connect();
    try {
      // Get main config
      const configResult = await client.query(`
        SELECT * FROM etl_export_configs WHERE id = $1
      `, [exportConfigId]);

      if (configResult.rows.length === 0) {
        return null;
      }

      const config = configResult.rows[0];

      // Get all related settings
      const [connection, schedule, fileFormat, fileNaming, fieldMappings, company, filters] = await Promise.all([
        client.query('SELECT * FROM etl_connection_settings WHERE export_config_id = $1', [exportConfigId]),
        client.query('SELECT * FROM etl_schedule_settings WHERE export_config_id = $1', [exportConfigId]),
        client.query('SELECT * FROM etl_file_format_settings WHERE export_config_id = $1', [exportConfigId]),
        client.query('SELECT * FROM etl_file_naming_settings WHERE export_config_id = $1', [exportConfigId]),
        client.query('SELECT * FROM etl_field_mappings WHERE export_config_id = $1 ORDER BY field_order', [exportConfigId]),
        client.query('SELECT * FROM etl_company_settings WHERE export_config_id = $1', [exportConfigId]),
        client.query('SELECT * FROM etl_export_filters WHERE export_config_id = $1 AND is_active = true', [exportConfigId])
      ]);

      return {
        ...config,
        connection: connection.rows[0] ? {
          ...connection.rows[0],
          password: this.decryptPassword(connection.rows[0].password_encrypted)
        } : null,
        schedule: schedule.rows[0] || null,
        fileFormat: fileFormat.rows[0] || null,
        fileNaming: fileNaming.rows[0] || null,
        fieldMappings: fieldMappings.rows,
        company: company.rows[0] || null,
        filters: filters.rows
      };
    } finally {
      client.release();
    }
  }

  async updateExportConfig(exportConfigId, configData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update main export config
      await client.query(`
        UPDATE etl_export_configs 
        SET config_name = $1, updated_at = NOW()
        WHERE id = $2
      `, [configData.configName, exportConfigId]);

      // Update or create connection settings
      if (configData.connection) {
        // Check if connection settings exist
        const connectionCheck = await client.query(
          'SELECT id FROM etl_connection_settings WHERE export_config_id = $1',
          [exportConfigId]
        );

        if (connectionCheck.rows.length > 0) {
          // Update existing connection settings
          if (configData.connection.password) {
            // Update with password
            await client.query(`
              UPDATE etl_connection_settings 
              SET connection_type = $1, host_url = $2, port = $3, username = $4, 
                  password_encrypted = $5, remote_directory = $6
              WHERE export_config_id = $7
            `, [
              configData.connection.type,
              configData.connection.hostUrl,
              configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
              configData.connection.username,
              this.encryptPassword(configData.connection.password),
              configData.connection.remoteDirectory || '/',
              exportConfigId
            ]);
          } else {
            // Update without password
            await client.query(`
              UPDATE etl_connection_settings 
              SET connection_type = $1, host_url = $2, port = $3, username = $4, 
                  remote_directory = $5
              WHERE export_config_id = $6
            `, [
              configData.connection.type,
              configData.connection.hostUrl,
              configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
              configData.connection.username,
              configData.connection.remoteDirectory || '/',
              exportConfigId
            ]);
          }
        } else {
          // Create new connection settings
          await client.query(`
            INSERT INTO etl_connection_settings (
              export_config_id, connection_type, host_url, port, username, 
              password_encrypted, remote_directory
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            exportConfigId,
            configData.connection.type,
            configData.connection.hostUrl,
            configData.connection.port || (configData.connection.type === 'sftp' ? 22 : 21),
            configData.connection.username,
            this.encryptPassword(configData.connection.password || ''),
            configData.connection.remoteDirectory || '/'
          ]);
        }
      }

      // Update or create schedule settings
      if (configData.schedule) {
        const scheduleCheck = await client.query(
          'SELECT id FROM etl_schedule_settings WHERE export_config_id = $1',
          [exportConfigId]
        );

        if (scheduleCheck.rows.length > 0) {
          // Recalculate next_run time when schedule is updated
          const now = new Date();
          let nextRun = new Date();
          nextRun.setHours(configData.schedule.timeHour, configData.schedule.timeMinute, 0, 0);
          
          // If time has passed today, move to next occurrence
          if (nextRun <= now) {
            switch (configData.schedule.frequency) {
              case 'daily':
                nextRun.setDate(nextRun.getDate() + 1);
                break;
              case 'weekly':
                nextRun.setDate(nextRun.getDate() + 7);
                break;
              case 'monthly':
                nextRun.setMonth(nextRun.getMonth() + 1);
                break;
            }
          }
          
          await client.query(`
            UPDATE etl_schedule_settings 
            SET frequency = $1, time_hour = $2, time_minute = $3, 
                day_of_week = $4, day_of_month = $5, next_run = $6
            WHERE export_config_id = $7
          `, [
            configData.schedule.frequency,
            configData.schedule.timeHour,
            configData.schedule.timeMinute,
            configData.schedule.dayOfWeek,
            configData.schedule.dayOfMonth,
            nextRun,
            exportConfigId
          ]);
        } else {
          // Calculate initial next_run time
          const now = new Date();
          let nextRun = new Date();
          nextRun.setHours(configData.schedule.timeHour, configData.schedule.timeMinute, 0, 0);
          
          // If time has passed today, move to next occurrence
          if (nextRun <= now) {
            switch (configData.schedule.frequency) {
              case 'daily':
                nextRun.setDate(nextRun.getDate() + 1);
                break;
              case 'weekly':
                nextRun.setDate(nextRun.getDate() + 7);
                break;
              case 'monthly':
                nextRun.setMonth(nextRun.getMonth() + 1);
                break;
            }
          }
          
          await client.query(`
            INSERT INTO etl_schedule_settings (
              export_config_id, frequency, time_hour, time_minute, 
              day_of_week, day_of_month, is_active, next_run
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            exportConfigId,
            configData.schedule.frequency,
            configData.schedule.timeHour,
            configData.schedule.timeMinute,
            configData.schedule.dayOfWeek,
            configData.schedule.dayOfMonth,
            true,
            nextRun
          ]);
        }
      }

      // Update or create file format settings
      if (configData.fileFormat) {
        const fileFormatCheck = await client.query(
          'SELECT id FROM etl_file_format_settings WHERE export_config_id = $1',
          [exportConfigId]
        );

        if (fileFormatCheck.rows.length > 0) {
          await client.query(`
            UPDATE etl_file_format_settings 
            SET file_type = $1, delimiter = $2, multi_value_delimiter = $3, 
                include_header = $4, encoding = $5
            WHERE export_config_id = $6
          `, [
            configData.fileFormat.fileType,
            configData.fileFormat.delimiter,
            configData.fileFormat.multiValueDelimiter,
            configData.fileFormat.includeHeader,
            configData.fileFormat.encoding,
            exportConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO etl_file_format_settings (
              export_config_id, file_type, delimiter, multi_value_delimiter, 
              include_header, encoding
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            exportConfigId,
            configData.fileFormat.fileType,
            configData.fileFormat.delimiter,
            configData.fileFormat.multiValueDelimiter,
            configData.fileFormat.includeHeader,
            configData.fileFormat.encoding
          ]);
        }
      }

      // Update or create file naming settings
      if (configData.fileNaming) {
        const fileNamingCheck = await client.query(
          'SELECT id FROM etl_file_naming_settings WHERE export_config_id = $1',
          [exportConfigId]
        );

        if (fileNamingCheck.rows.length > 0) {
          await client.query(`
            UPDATE etl_file_naming_settings 
            SET naming_pattern = $1, include_timestamp = $2, timestamp_format = $3
            WHERE export_config_id = $4
          `, [
            configData.fileNaming.pattern,
            configData.fileNaming.includeTimestamp,
            configData.fileNaming.timestampFormat,
            exportConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO etl_file_naming_settings (
              export_config_id, naming_pattern, include_timestamp, timestamp_format
            ) VALUES ($1, $2, $3, $4)
          `, [
            exportConfigId,
            configData.fileNaming.pattern,
            configData.fileNaming.includeTimestamp,
            configData.fileNaming.timestampFormat
          ]);
        }
      }

      // Update or create company settings
      if (configData.company) {
        const companyCheck = await client.query(
          'SELECT id FROM etl_company_settings WHERE export_config_id = $1',
          [exportConfigId]
        );

        if (companyCheck.rows.length > 0) {
          await client.query(`
            UPDATE etl_company_settings 
            SET company_name = $1, company_id = $2, 
                authorization_document_url = $3, dealer_authorization_required = $4
            WHERE export_config_id = $5
          `, [
            configData.company.name,
            configData.company.id,
            configData.company.authorizationDocumentUrl,
            configData.company.dealerAuthorizationRequired !== false,
            exportConfigId
          ]);
        } else {
          await client.query(`
            INSERT INTO etl_company_settings (
              export_config_id, company_name, company_id, 
              authorization_document_url, dealer_authorization_required
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            exportConfigId,
            configData.company.name,
            configData.company.id,
            configData.company.authorizationDocumentUrl,
            configData.company.dealerAuthorizationRequired !== false
          ]);
        }
      }

      await client.query('COMMIT');
      return { success: true, exportConfigId };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ETL Export Execution
  async executeExport(exportConfigId) {
    const config = await this.getExportConfig(exportConfigId);
    if (!config) {
      throw new Error('Export configuration not found');
    }

    const client = await this.pool.connect();
    try {
      // Create export history record
      const historyResult = await client.query(`
        INSERT INTO etl_export_history (export_config_id, export_status, started_at)
        VALUES ($1, 'running', NOW())
        RETURNING id
      `, [exportConfigId]);

      const historyId = historyResult.rows[0].id;

      try {
        // Generate export data
        const exportData = await this.generateExportData(config);
        
        // Create file
        const fileName = this.generateFileName(config);
        const filePath = path.join(__dirname, '../../uploads/etl-exports', fileName);
        
        // Ensure directory exists
        const uploadDir = path.dirname(filePath);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Write file
        await this.writeExportFile(filePath, exportData, config);

        // Upload to FTP/SFTP
        await this.uploadFile(filePath, fileName, config);

        // Update history
        const fileStats = fs.statSync(filePath);
        await client.query(`
          UPDATE etl_export_history 
          SET export_status = 'completed', file_name = $1, file_size = $2, 
              records_exported = $3, completed_at = NOW()
          WHERE id = $4
        `, [fileName, fileStats.size, exportData.length, historyId]);

        // Clean up local file
        fs.unlinkSync(filePath);

        return { success: true, fileName, recordsExported: exportData.length };

      } catch (error) {
        // Update history with error
        await client.query(`
          UPDATE etl_export_history 
          SET export_status = 'failed', error_message = $1, completed_at = NOW()
          WHERE id = $2
        `, [error.message, historyId]);

        throw error;
      }
    } finally {
      client.release();
    }
  }

  async generateExportData(config) {
    const client = await this.pool.connect();
    try {
      // Build query based on field mappings and filters
      let query = 'SELECT ';
      
      // Always include dealer_id in the export
      let fields = [];
      
      // List of columns to exclude from exports
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
      
      // Check if qr_code_url is requested in field mappings (needed to determine if we need VIN)
      const wantsQrCodeUrl = config.fieldMappings && config.fieldMappings.some(m => 
        m.target_field === 'qr_code_url' || m.source_field === 'qr_code_url'
      );
      
      if (config.fieldMappings && config.fieldMappings.length > 0) {
        // Use field mappings if available, but filter out excluded columns
        fields = config.fieldMappings
          .filter(m => !excludedColumns.includes(m.source_field))
          .map(m => `${m.source_field} as "${m.target_field}"`);
        
        // Check if dealer_id is already in mappings
        const hasDealerId = config.fieldMappings.some(m => 
          m.source_field === 'dealer_id' || m.target_field === 'dealer_id'
        );
        
        // Check if vin is already in mappings (needed for qr_code_url generation)
        const hasVin = config.fieldMappings.some(m => 
          m.source_field === 'vin' || m.target_field === 'vin'
        );
        
        // Add dealer_id if not already included
        if (!hasDealerId) {
          fields.unshift('dealer_id as "dealer_id"');
        }
        
        // Add vin if not already included and qr_code_url is requested (needed to generate URL)
        if (!hasVin && wantsQrCodeUrl) {
          fields.push('vin');
        }
      } else {
        // If no field mappings, get all columns except excluded ones
        const allColumnsResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'vehicles' 
            AND column_name NOT IN (${excludedColumns.map((_, i) => `$${i + 1}`).join(', ')})
          ORDER BY ordinal_position
        `, excludedColumns);
        
        fields = allColumnsResult.rows.map(row => row.column_name);
        
        // Ensure dealer_id is included
        if (!fields.includes('dealer_id')) {
          fields.unshift('dealer_id');
        }
        
        // Always include vin (needed for qr_code_url generation if qr_code_url is in export)
        if (!fields.includes('vin')) {
          fields.push('vin');
        }
      }
      
      query += fields.join(', ') + ' FROM vehicles WHERE dealer_id = $1';

      const params = [config.dealer_id];
      let paramIndex = 2;

      // Apply filters
      if (config.filters && config.filters.length > 0) {
        const filterConditions = config.filters.map(filter => {
          let condition = '';
          switch (filter.filter_operator) {
            case 'equals':
              condition = `${filter.filter_field} = $${paramIndex}`;
              break;
            case 'not_equals':
              condition = `${filter.filter_field} != $${paramIndex}`;
              break;
            case 'contains':
              condition = `${filter.filter_field} ILIKE $${paramIndex}`;
              params.push(`%${filter.filter_value}%`);
              break;
            case 'greater_than':
              condition = `${filter.filter_field} > $${paramIndex}`;
              break;
            case 'less_than':
              condition = `${filter.filter_field} < $${paramIndex}`;
              break;
            case 'between':
              condition = `${filter.filter_field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
              params.push(filter.filter_value2);
              paramIndex++;
              break;
          }
          params.push(filter.filter_value);
          paramIndex++;
          return condition;
        });
        query += ' AND ' + filterConditions.join(' AND ');
      }

      const result = await client.query(query, params);
      
      // Get frontend base URL from environment or use default
      const frontendBaseURL = process.env.FRONTEND_URL || process.env.BACKEND_URL?.replace('/api', '') || 'https://app.dealeriq.co';
      
      // Ensure dealer_id is in each row and generate qr_code_url if VIN exists
      const dataWithDealerId = result.rows.map(row => {
        const processedRow = {
          ...row,
          dealer_id: row.dealer_id || config.dealer_id
        };
        
        // Generate qr_code_url using actual VIN if VIN exists
        // This will overwrite any existing qr_code_url with the VIN-based URL
        if (row.vin && row.vin.trim()) {
          // Format: https://app.dealeriq.co/#/vehicle/vin/{VIN}
          const vin = row.vin.trim().toUpperCase();
          processedRow.qr_code_url = `${frontendBaseURL}/#/vehicle/vin/${vin}`;
        }
        
        // If qr_code_url is requested in field mappings but VIN is missing, set to empty string
        if (wantsQrCodeUrl && (!row.vin || !row.vin.trim())) {
          processedRow.qr_code_url = '';
        }
        
        return processedRow;
      });
      
      return dataWithDealerId;
    } finally {
      client.release();
    }
  }

  generateFileName(config) {
    let fileName = config.fileNaming.naming_pattern;
    
    // Replace placeholders
    fileName = fileName.replace('{dealer_id}', config.dealer_id);
    fileName = fileName.replace('{date}', new Date().toISOString().split('T')[0]);
    fileName = fileName.replace('{timestamp}', new Date().toISOString().replace(/[:.]/g, '-'));
    
    if (config.fileNaming.include_timestamp) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      fileName += `_${timestamp}`;
    }
    
    fileName += `.${config.fileFormat.file_type}`;
    return fileName;
  }

  async writeExportFile(filePath, data, config) {
    const fileType = config.fileFormat.file_type;
    
    if (fileType === 'csv') {
      const csvContent = this.convertToCSV(data, config);
      fs.writeFileSync(filePath, csvContent, 'utf8');
    } else if (fileType === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } else if (fileType === 'xml') {
      const xmlContent = this.convertToXML(data, config);
      fs.writeFileSync(filePath, xmlContent, 'utf8');
    } else {
      // Default to CSV
      const csvContent = this.convertToCSV(data, config);
      fs.writeFileSync(filePath, csvContent, 'utf8');
    }
  }

  convertToCSV(data, config) {
    if (data.length === 0) return '';
    
    const delimiter = config.fileFormat.delimiter || ',';
    const includeHeader = config.fileFormat.include_header !== false;
    
    const headers = Object.keys(data[0]);
    let csv = '';
    
    if (includeHeader) {
      csv += headers.join(delimiter) + '\n';
    }
    
    for (const row of data) {
      const values = headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) {
          value = '';
        }
        // Escape quotes and wrap in quotes if contains delimiter
        value = String(value).replace(/"/g, '""');
        if (value.includes(delimiter) || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
        return value;
      });
      csv += values.join(delimiter) + '\n';
    }
    
    return csv;
  }

  convertToXML(data, config) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<vehicles>\n';
    
    for (const row of data) {
      xml += '  <vehicle>\n';
      for (const [key, value] of Object.entries(row)) {
        xml += `    <${key}>${this.escapeXml(value)}</${key}>\n`;
      }
      xml += '  </vehicle>\n';
    }
    
    xml += '</vehicles>';
    return xml;
  }

  escapeXml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async uploadFile(filePath, fileName, config) {
    if (config.connection.connection_type === 'sftp') {
      await this.uploadViaSFTP(filePath, fileName, config);
    } else {
      await this.uploadViaFTP(filePath, fileName, config);
    }
  }

  async uploadViaSFTP(filePath, fileName, config) {
    const { Client } = await import('ssh2');
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      // Handle connection errors
      conn.on('error', (err) => {
        console.error('❌ SFTP connection error:', err.message);
        reject(new Error(`SFTP connection failed: ${err.message}`));
      });
      
      conn.on('ready', () => {
        console.log('✅ SFTP connection established');
        
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          
          // Normalize remote directory path (ensure it ends with /)
          let remoteDir = config.connection.remote_directory || '/';
          if (!remoteDir.endsWith('/')) {
            remoteDir += '/';
          }
          
          // Use posix.join to ensure forward slashes (required for SFTP)
          // Also replace any backslashes that might exist
          const remotePath = path.posix.join(remoteDir, fileName).replace(/\\/g, '/');
          
          console.log(`📤 Uploading file to SFTP: ${remotePath}`);
          console.log(`   Local file: ${filePath}`);
          console.log(`   Remote directory: ${remoteDir}`);
          
          // Ensure remote directory exists before uploading
          sftp.stat(remoteDir, (statErr) => {
            if (statErr) {
              // Directory doesn't exist or no permission, try to create it
              console.log(`⚠️ Remote directory check failed: ${statErr.message}`);
              console.log(`   Attempting to create directory: ${remoteDir}`);
              
              // Try to create the directory (this might also fail with permission denied)
              sftp.mkdir(remoteDir, { mode: 0o755 }, (mkdirErr) => {
                if (mkdirErr && mkdirErr.code !== 4) { // 4 = SSH2_FX_FAILURE (directory might already exist)
                  conn.end();
                  reject(new Error(`Cannot access or create remote directory '${remoteDir}': ${mkdirErr.message}. Please check permissions.`));
                  return;
                }
                
                // Now try to upload
                sftp.fastPut(filePath, remotePath, (uploadErr) => {
                  conn.end();
                  if (uploadErr) {
                    console.error(`❌ SFTP upload failed: ${uploadErr.message}`);
                    console.error(`   Remote path: ${remotePath}`);
                    
                    // Provide more helpful error messages
                    if (uploadErr.message.includes('Permission denied') || uploadErr.code === 3) {
                      reject(new Error(`Permission denied: Cannot write to '${remotePath}'. Please check: 1) Directory permissions, 2) User write access, 3) Disk space, 4) File system permissions.`));
                    } else {
                      reject(new Error(`SFTP upload failed: ${uploadErr.message}`));
                    }
                  } else {
                    console.log(`✅ File uploaded successfully to: ${remotePath}`);
                    resolve();
                  }
                });
              });
            } else {
              // Directory exists, proceed with upload
              sftp.fastPut(filePath, remotePath, (uploadErr) => {
                conn.end();
                if (uploadErr) {
                  console.error(`❌ SFTP upload failed: ${uploadErr.message}`);
                  console.error(`   Remote path: ${remotePath}`);
                  
                  // Provide more helpful error messages
                  if (uploadErr.message.includes('Permission denied') || uploadErr.code === 3) {
                    reject(new Error(`Permission denied: Cannot write to '${remotePath}'. Please check: 1) Directory permissions, 2) User write access, 3) Disk space, 4) File system permissions.`));
                  } else {
                    reject(new Error(`SFTP upload failed: ${uploadErr.message}`));
                  }
                } else {
                  console.log(`✅ File uploaded successfully to: ${remotePath}`);
                  resolve();
                }
              });
            }
          });
        });
      }).connect({
        host: config.connection.host_url,
        port: config.connection.port,
        username: config.connection.username,
        password: config.connection.password
      });
    });
  }

  async uploadViaFTP(filePath, fileName, config) {
    const ftp = await import('basic-ftp');
    const client = new ftp.default.Client();
    client.ftp.verbose = false;
    
    try {
      await client.access({
        host: config.connection.host_url,
        port: config.connection.port,
        user: config.connection.username,
        password: config.connection.password
      });
      
      await client.ensureDir(config.connection.remote_directory);
      await client.uploadFrom(filePath, fileName);
    } finally {
      client.close();
    }
  }

  // Schedule Management
  async updateNextRunTime(exportConfigId) {
    const client = await this.pool.connect();
    try {
      const scheduleResult = await client.query(`
        SELECT * FROM etl_schedule_settings WHERE export_config_id = $1
      `, [exportConfigId]);
      
      if (scheduleResult.rows.length === 0) return;
      
      const schedule = scheduleResult.rows[0];
      const now = new Date();
      let nextRun = new Date();
      
      // Set time
      nextRun.setHours(schedule.time_hour, schedule.time_minute, 0, 0);
      
      // If time has passed today, move to next occurrence
      if (nextRun <= now) {
        switch (schedule.frequency) {
          case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case 'weekly':
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case 'monthly':
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
        }
      }
      
      await client.query(`
        UPDATE etl_schedule_settings 
        SET next_run = $1, last_run = NOW()
        WHERE export_config_id = $2
      `, [nextRun, exportConfigId]);
      
    } finally {
      client.release();
    }
  }

  // Get export history
  async getExportHistory(dealerId, limit = 50) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT eh.*, ec.config_name
        FROM etl_export_history eh
        JOIN etl_export_configs ec ON eh.export_config_id = ec.id
        WHERE ec.dealer_id = $1
        ORDER BY eh.created_at DESC
        LIMIT $2
      `, [dealerId, limit]);
      
      return result.rows;
    } finally {
      client.release();
    }
  }
}

export default ETLService; 