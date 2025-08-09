# ETL Integration Guide

This guide covers the ETL (Extract, Transform, Load) module for exporting dealer inventory data to external systems via FTP/SFTP.

## Overview

The ETL module allows dealers to configure automated exports of their inventory data to external systems like vAuto, Tekion, AutoTrader, and other DMS platforms. The system supports:

- **FTP/SFTP Connections**: Secure file transfer to external servers
- **Scheduled Exports**: Automated exports at specified times
- **Flexible File Formats**: CSV, TXT, XML, JSON
- **Custom Field Mappings**: Map internal fields to external system requirements
- **Export History**: Track all export activities
- **Connection Testing**: Verify FTP/SFTP connections before saving

## Features

### Connection Management
- **FTP/SFTP Support**: Both standard FTP and secure SFTP protocols
- **Encrypted Credentials**: Passwords are encrypted in the database
- **Connection Testing**: Test connections before saving configurations
- **Multiple Configurations**: Support for multiple export destinations

### Scheduling
- **Daily Exports**: Export every day at specified time
- **Weekly Exports**: Export on specific days of the week
- **Monthly Exports**: Export on specific days of the month
- **Custom Scheduling**: Flexible scheduling options

### File Format Options
- **CSV**: Comma-separated values (most common)
- **TXT**: Tab-delimited text files
- **XML**: Structured XML format
- **JSON**: JavaScript Object Notation
- **Custom Delimiters**: Configurable field separators
- **Multi-value Delimiters**: Handle fields with multiple values

### Field Mapping
- **Source Fields**: All vehicle database fields available
- **Target Fields**: Custom field names for external systems
- **Required Fields**: Mark fields as required
- **Default Values**: Set default values for missing data
- **Field Ordering**: Control the order of fields in exports

## Setup

### 1. Database Setup

Run the ETL database setup script:

```bash
node setup-etl-db.cjs
```

This creates all necessary tables and indexes for the ETL system.

### 2. Dependencies

Install required packages:

```bash
npm install ssh2 basic-ftp multer
```

### 3. Environment Variables

Add these to your `.env` file:

```bash
# Encryption key for ETL passwords
ENCRYPTION_KEY=your-secure-encryption-key

# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/vehicle_management
```

## Configuration

### 1. Access ETL Configuration

Navigate to the ETL Configuration page in your application:
- URL: `/etl` (after adding to your routing)
- Requires dealer authentication

### 2. Create New Configuration

1. **Basic Information**
   - Configuration Name: e.g., "vAuto Export"
   - Connection Type: FTP or SFTP

2. **Connection Settings**
   - Host URL: ftp.vauto.com
   - Port: 21 (FTP) or 22 (SFTP)
   - Username: Your FTP username
   - Password: Your FTP password
   - Remote Directory: /exports

3. **Schedule Settings**
   - Frequency: Daily, Weekly, Monthly, Custom
   - Time: Hour and minute for export execution
   - Day: Day of week/month (for weekly/monthly)

4. **File Format**
   - File Type: CSV, TXT, XML, JSON
   - Delimiter: Field separator (comma, tab, etc.)
   - Multi-value Delimiter: For fields with multiple values
   - Include Header: Whether to include column headers
   - Encoding: UTF-8, ISO-8859-1, etc.

5. **Field Mappings**
   - Source Field: Database field name
   - Target Field: External system field name
   - Required: Whether field is required
   - Default Value: Value if field is empty

6. **Company Settings**
   - Company Name: e.g., "vAuto", "AutoTrader"
   - Company ID: External system identifier
   - Authorization Required: Whether dealer authorization is needed

### 3. Test Connection

Before saving, test your FTP/SFTP connection:
- Click "Test Connection" button
- Verify connection details are correct
- Check for any error messages

## API Endpoints

### Configuration Management

#### GET /api/etl/configs
Get all ETL configurations for the authenticated dealer.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "config_name": "vAuto Export",
      "connection_type": "ftp",
      "host_url": "ftp.vauto.com",
      "frequency": "daily",
      "file_type": "csv"
    }
  ]
}
```

#### POST /api/etl/configs
Create a new ETL configuration.

**Request Body:**
```json
{
  "configName": "vAuto Export",
  "connection": {
    "type": "ftp",
    "hostUrl": "ftp.vauto.com",
    "port": 21,
    "username": "user",
    "password": "pass",
    "remoteDirectory": "/exports"
  },
  "schedule": {
    "frequency": "daily",
    "timeHour": 1,
    "timeMinute": 0
  },
  "fileFormat": {
    "fileType": "csv",
    "delimiter": ",",
    "multiValueDelimiter": "|",
    "includeHeader": true,
    "encoding": "UTF-8"
  },
  "fieldMappings": [
    {
      "sourceField": "make",
      "targetField": "vehicle_make",
      "fieldOrder": 1,
      "isRequired": true
    }
  ],
  "company": {
    "name": "vAuto",
    "dealerAuthorizationRequired": true
  }
}
```

#### POST /api/etl/configs/:id/execute
Manually execute an ETL export.

**Response:**
```json
{
  "success": true,
  "data": {
    "fileName": "dealer_123_20241201_010000.csv",
    "recordsExported": 150
  }
}
```

#### POST /api/etl/test-connection
Test FTP/SFTP connection settings.

**Request Body:**
```json
{
  "connectionType": "ftp",
  "hostUrl": "ftp.vauto.com",
  "port": 21,
  "username": "user",
  "password": "pass",
  "remoteDirectory": "/exports"
}
```

### Field Mappings

#### GET /api/etl/field-mappings
Get available database fields for mapping.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sourceField": "make",
      "targetField": "make",
      "dataType": "character varying",
      "description": "Vehicle make/brand"
    }
  ]
}
```

### Export History

#### GET /api/etl/history
Get export history for the dealer.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "export_status": "completed",
      "file_name": "export_20241201.csv",
      "records_exported": 150,
      "started_at": "2024-12-01T01:00:00Z",
      "completed_at": "2024-12-01T01:02:30Z"
    }
  ]
}
```

## Database Schema

### Core Tables

#### etl_export_configs
Main configuration table.

```sql
CREATE TABLE etl_export_configs (
    id SERIAL PRIMARY KEY,
    dealer_id VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### etl_connection_settings
FTP/SFTP connection details.

```sql
CREATE TABLE etl_connection_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id),
    connection_type VARCHAR(50) NOT NULL,
    host_url VARCHAR(500) NOT NULL,
    port INTEGER DEFAULT 21,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    remote_directory VARCHAR(500) DEFAULT '/'
);
```

#### etl_schedule_settings
Export scheduling configuration.

```sql
CREATE TABLE etl_schedule_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id),
    frequency VARCHAR(50) NOT NULL,
    time_hour INTEGER NOT NULL,
    time_minute INTEGER NOT NULL,
    day_of_week INTEGER,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP
);
```

#### etl_field_mappings
Field mapping configuration.

```sql
CREATE TABLE etl_field_mappings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id),
    source_field VARCHAR(255) NOT NULL,
    target_field VARCHAR(255) NOT NULL,
    field_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    transformation_rule TEXT
);
```

## Usage Examples

### vAuto Integration

1. **Create Configuration**
   - Name: "vAuto Daily Export"
   - Connection: FTP to vAuto server
   - Schedule: Daily at 1:00 AM
   - Format: CSV with comma delimiter

2. **Field Mappings**
   ```
   Source Field → Target Field
   make → vehicle_make
   model → vehicle_model
   year → vehicle_year
   vin → vehicle_vin
   price → vehicle_price
   ```

3. **Company Settings**
   - Company Name: "vAuto"
   - Authorization Required: Yes

### AutoTrader Integration

1. **Create Configuration**
   - Name: "AutoTrader Export"
   - Connection: SFTP to AutoTrader server
   - Schedule: Daily at 2:00 AM
   - Format: XML

2. **Field Mappings**
   ```
   Source Field → Target Field
   make → Make
   model → Model
   year → Year
   vin → VIN
   price → Price
   description → Description
   ```

## Security

### Password Encryption
- All FTP/SFTP passwords are encrypted using AES-256-CBC
- Encryption key stored in environment variables
- Passwords are never stored in plain text

### Access Control
- All ETL operations require dealer authentication
- Dealers can only access their own configurations
- Admin users can access all configurations

### File Security
- Export files are temporarily stored locally
- Files are deleted after successful upload
- No sensitive data is logged

## Troubleshooting

### Common Issues

#### Connection Failed
**Symptoms:** "Connection test failed" error
**Solutions:**
1. Verify host URL and port
2. Check username and password
3. Ensure firewall allows FTP/SFTP traffic
4. Test connection manually with FTP client

#### Export Failed
**Symptoms:** Export status shows "failed"
**Solutions:**
1. Check export history for error details
2. Verify field mappings are correct
3. Ensure all required fields are mapped
4. Check database connectivity

#### File Format Issues
**Symptoms:** External system can't read exported file
**Solutions:**
1. Verify delimiter settings
2. Check file encoding
3. Ensure field order matches requirements
4. Test with sample data

### Debug Steps

1. **Check Logs**
   ```bash
   # Server logs
   tail -f logs/server.log
   
   # ETL specific logs
   grep "ETL" logs/server.log
   ```

2. **Test Connection Manually**
   ```bash
   # FTP test
   ftp ftp.vauto.com
   
   # SFTP test
   sftp user@ftp.vauto.com
   ```

3. **Verify Database**
   ```sql
   -- Check configurations
   SELECT * FROM etl_export_configs WHERE dealer_id = 'your-dealer-id';
   
   -- Check export history
   SELECT * FROM etl_export_history ORDER BY created_at DESC LIMIT 10;
   ```

## Best Practices

### Configuration
1. **Use Descriptive Names**: "vAuto Daily Export" vs "Export 1"
2. **Test Connections**: Always test before saving
3. **Document Mappings**: Keep track of field mappings
4. **Regular Monitoring**: Check export history regularly

### Security
1. **Strong Passwords**: Use strong FTP/SFTP passwords
2. **Limited Access**: Only grant necessary FTP access
3. **Regular Updates**: Update credentials regularly
4. **Monitor Access**: Check for unauthorized access

### Performance
1. **Schedule Wisely**: Avoid peak hours for exports
2. **Filter Data**: Use filters to export only needed data
3. **Monitor Size**: Keep export files reasonable size
4. **Clean History**: Archive old export history

## Support

For ETL-specific issues:
- Check the export history for error details
- Verify connection settings
- Test with manual FTP/SFTP client
- Review field mappings and file format

For general application issues:
- Check server logs
- Verify database connectivity
- Ensure all dependencies are installed
- Test with sample configurations

## Future Enhancements

### Planned Features
- **Real-time Exports**: Trigger exports on data changes
- **Advanced Scheduling**: Cron-like scheduling expressions
- **Data Transformation**: Built-in data transformation rules
- **Export Templates**: Pre-configured templates for common systems
- **Webhook Support**: Notify external systems of exports
- **Compression**: Compress large export files
- **Encryption**: Encrypt export files for sensitive data

### Integration Roadmap
- **vAuto API**: Direct API integration
- **Tekion API**: Native Tekion integration
- **AutoTrader API**: Direct AutoTrader integration
- **CarGurus API**: CarGurus integration
- **Cars.com API**: Cars.com integration 