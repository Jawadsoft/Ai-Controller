-- ETL Configuration Schema
-- This schema handles FTP/SFTP export configurations for dealers

-- ETL Export Configurations
CREATE TABLE IF NOT EXISTS etl_export_configs (
    id SERIAL PRIMARY KEY,
    dealer_id VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Connection Settings
CREATE TABLE IF NOT EXISTS etl_connection_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('ftp', 'sftp')),
    host_url VARCHAR(500) NOT NULL,
    port INTEGER DEFAULT 21,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    remote_directory VARCHAR(500) DEFAULT '/',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Schedule Settings
CREATE TABLE IF NOT EXISTS etl_schedule_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
    time_hour INTEGER NOT NULL CHECK (time_hour >= 0 AND time_hour <= 23),
    time_minute INTEGER NOT NULL CHECK (time_minute >= 0 AND time_minute <= 59),
    day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Sunday, 7=Saturday
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL File Format Settings
CREATE TABLE IF NOT EXISTS etl_file_format_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'txt', 'xml', 'json')),
    delimiter VARCHAR(10) DEFAULT ',',
    multi_value_delimiter VARCHAR(10) DEFAULT '|',
    include_header BOOLEAN DEFAULT true,
    encoding VARCHAR(20) DEFAULT 'UTF-8',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL File Naming Settings
CREATE TABLE IF NOT EXISTS etl_file_naming_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    naming_pattern VARCHAR(255) NOT NULL, -- e.g., "{dealer_id}_{date}_{timestamp}"
    include_timestamp BOOLEAN DEFAULT true,
    timestamp_format VARCHAR(50) DEFAULT 'YYYYMMDD_HHMMSS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Field Mappings
CREATE TABLE IF NOT EXISTS etl_field_mappings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    source_field VARCHAR(255) NOT NULL, -- e.g., 'make', 'model', 'year'
    target_field VARCHAR(255) NOT NULL, -- e.g., 'vehicle_make', 'vehicle_model', 'vehicle_year'
    field_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    transformation_rule TEXT, -- JSON string for complex transformations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Export Filters
CREATE TABLE IF NOT EXISTS etl_export_filters (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    filter_field VARCHAR(255) NOT NULL,
    filter_operator VARCHAR(20) NOT NULL CHECK (filter_operator IN ('equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'between', 'in', 'not_in')),
    filter_value TEXT NOT NULL,
    filter_value2 TEXT, -- For 'between' operations
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Export History
CREATE TABLE IF NOT EXISTS etl_export_history (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    export_status VARCHAR(50) NOT NULL CHECK (export_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    file_name VARCHAR(500),
    file_size BIGINT,
    records_exported INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Company Settings
CREATE TABLE IF NOT EXISTS etl_company_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_id VARCHAR(255),
    authorization_document_url VARCHAR(500),
    dealer_authorization_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETL Dealer Authorization
CREATE TABLE IF NOT EXISTS etl_dealer_authorizations (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    dealer_id VARCHAR(255) NOT NULL,
    authorized_by VARCHAR(255),
    authorization_date DATE,
    authorization_document_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_etl_export_configs_dealer_id ON etl_export_configs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_etl_connection_settings_export_config_id ON etl_connection_settings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_schedule_settings_export_config_id ON etl_schedule_settings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_field_mappings_export_config_id ON etl_field_mappings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_export_history_export_config_id ON etl_export_history(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_export_history_status ON etl_export_history(export_status);
CREATE INDEX IF NOT EXISTS idx_etl_export_history_created_at ON etl_export_history(created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_etl_export_configs_updated_at BEFORE UPDATE ON etl_export_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_connection_settings_updated_at BEFORE UPDATE ON etl_connection_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_schedule_settings_updated_at BEFORE UPDATE ON etl_schedule_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_file_format_settings_updated_at BEFORE UPDATE ON etl_file_format_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_file_naming_settings_updated_at BEFORE UPDATE ON etl_file_naming_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_field_mappings_updated_at BEFORE UPDATE ON etl_field_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_export_filters_updated_at BEFORE UPDATE ON etl_export_filters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_company_settings_updated_at BEFORE UPDATE ON etl_company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_etl_dealer_authorizations_updated_at BEFORE UPDATE ON etl_dealer_authorizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 