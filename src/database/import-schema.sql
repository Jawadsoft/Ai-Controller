-- Data Import Configuration Schema
-- This schema handles FTP/SFTP import configurations for dealers

-- Import Configurations
CREATE TABLE IF NOT EXISTS import_configs (
    id SERIAL PRIMARY KEY,
    dealer_id VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dealer_id, config_name)
);

-- Import Connection Settings
CREATE TABLE IF NOT EXISTS import_connection_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('ftp', 'sftp')),
    host_url VARCHAR(500) NOT NULL,
    port INTEGER DEFAULT 21,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    remote_directory VARCHAR(500) DEFAULT '/',
    file_pattern VARCHAR(255) NOT NULL, -- e.g., "*.csv", "inventory_*.xml"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import File Settings
CREATE TABLE IF NOT EXISTS import_file_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'xml', 'json')),
    delimiter VARCHAR(10) DEFAULT ',', -- For CSV
    has_header BOOLEAN DEFAULT true,
    encoding VARCHAR(20) DEFAULT 'UTF-8',
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import Schedule Settings
CREATE TABLE IF NOT EXISTS import_schedule_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('manual', 'hourly', 'daily', 'weekly', 'monthly')),
    time_hour INTEGER DEFAULT 0,
    time_minute INTEGER DEFAULT 0,
    day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import Field Mappings
CREATE TABLE IF NOT EXISTS import_field_mappings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    source_field VARCHAR(255) NOT NULL, -- Field name in the import file
    target_field VARCHAR(255) NOT NULL, -- Database column name
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('string', 'number', 'date', 'boolean', 'json')),
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    transformation_rule TEXT, -- JSON string for data transformations
    field_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import Processing Settings
CREATE TABLE IF NOT EXISTS import_processing_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    duplicate_handling VARCHAR(20) NOT NULL CHECK (duplicate_handling IN ('skip', 'update', 'replace')),
    batch_size INTEGER DEFAULT 1000,
    max_errors INTEGER DEFAULT 100,
    validate_data BOOLEAN DEFAULT true,
    archive_processed_files BOOLEAN DEFAULT true,
    archive_directory VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import History
CREATE TABLE IF NOT EXISTS import_history (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    import_status VARCHAR(50) NOT NULL CHECK (import_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    file_name VARCHAR(500),
    file_size BIGINT,
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import Errors
CREATE TABLE IF NOT EXISTS import_errors (
    id SERIAL PRIMARY KEY,
    import_history_id INTEGER REFERENCES import_history(id) ON DELETE CASCADE,
    row_number INTEGER,
    field_name VARCHAR(255),
    error_message TEXT,
    raw_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_import_configs_dealer_id ON import_configs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_import_connection_settings_import_config_id ON import_connection_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_file_settings_import_config_id ON import_file_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_schedule_settings_import_config_id ON import_schedule_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_field_mappings_import_config_id ON import_field_mappings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_history_import_config_id ON import_history(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history(import_status);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON import_history(created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_import_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all import tables
CREATE TRIGGER update_import_configs_updated_at BEFORE UPDATE ON import_configs FOR EACH ROW EXECUTE FUNCTION update_import_updated_at_column();
CREATE TRIGGER update_import_connection_settings_updated_at BEFORE UPDATE ON import_connection_settings FOR EACH ROW EXECUTE FUNCTION update_import_updated_at_column();
CREATE TRIGGER update_import_file_settings_updated_at BEFORE UPDATE ON import_file_settings FOR EACH ROW EXECUTE FUNCTION update_import_updated_at_column();
CREATE TRIGGER update_import_schedule_settings_updated_at BEFORE UPDATE ON import_schedule_settings FOR EACH ROW EXECUTE FUNCTION update_import_updated_at_column();
CREATE TRIGGER update_import_field_mappings_updated_at BEFORE UPDATE ON import_field_mappings FOR EACH ROW EXECUTE FUNCTION update_import_updated_at_column();
CREATE TRIGGER update_import_processing_settings_updated_at BEFORE UPDATE ON import_processing_settings FOR EACH ROW EXECUTE FUNCTION update_import_updated_at_column(); 