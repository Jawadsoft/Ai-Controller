-- Migration: Create system_logs table for scraping and system activity logging
-- Created: 2026-08-07

CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  log_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_dealer_id ON system_logs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE system_logs IS 'System-wide logging for scraping, imports, and other activities';
COMMENT ON COLUMN system_logs.log_type IS 'Type of log: scraping, import, auth, error, etc.';
COMMENT ON COLUMN system_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN system_logs.details IS 'Additional details stored as JSON';
