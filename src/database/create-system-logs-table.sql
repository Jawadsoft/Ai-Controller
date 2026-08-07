-- Create system_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    log_level VARCHAR(20) DEFAULT 'info',
    log_type VARCHAR(50),
    message TEXT NOT NULL,
    details JSONB,
    user_id VARCHAR(255),
    dealer_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_dealer ON system_logs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);

-- Add comments
COMMENT ON TABLE system_logs IS 'System-wide logging table for tracking errors, activities, and events';
COMMENT ON COLUMN system_logs.log_level IS 'Log severity level: debug, info, warn, error, fatal';
COMMENT ON COLUMN system_logs.log_type IS 'Type of log entry: scrape, import, api, auth, etc.';
COMMENT ON COLUMN system_logs.details IS 'Additional structured data in JSON format';
