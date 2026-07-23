-- =====================================================
-- SMTP Settings Database Insert Script (SQL Version)
-- =====================================================
-- 
-- This SQL script inserts SMTP configuration data into the integration_settings table.
-- Run this script directly in your PostgreSQL database or via psql command.
-- 
-- Usage:
--   psql -d your_database -f scripts/insert-smtp-settings.sql
--   OR
--   Copy and paste this script into your database management tool
-- 
-- =====================================================

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SMTP CONFIGURATION
-- =====================================================
-- Update these values with your actual SMTP server details
-- =====================================================

-- SMTP Host (e.g., smtp.gmail.com, smtp.outlook.com, etc.)
INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
VALUES ('global', 'smtp', 'host', 'smtp.gmail.com', '{"description": "SMTP server hostname"}', true)
ON CONFLICT (tenant_id, provider, key) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE integration_settings.scope = 'global';

-- SMTP Port (587 for TLS, 465 for SSL, 25 for non-encrypted)
INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
VALUES ('global', 'smtp', 'port', '587', '{"description": "SMTP server port"}', true)
ON CONFLICT (tenant_id, provider, key) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE integration_settings.scope = 'global';

-- SMTP Security (true for SSL/465, false for TLS/587)
INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
VALUES ('global', 'smtp', 'secure', 'false', '{"description": "Use SSL/TLS (true for port 465, false for others)"}', true)
ON CONFLICT (tenant_id, provider, key) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE integration_settings.scope = 'global';

-- SMTP Username (your email address)
INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
VALUES ('global', 'smtp', 'user', 'your-email@gmail.com', '{"description": "SMTP username/email"}', true)
ON CONFLICT (tenant_id, provider, key) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE integration_settings.scope = 'global';

-- SMTP Password (your email password or app-specific password)
INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
VALUES ('global', 'smtp', 'pass', 'your-app-password', '{"description": "SMTP password/app password"}', true)
ON CONFLICT (tenant_id, provider, key) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE integration_settings.scope = 'global';

-- Default From Email Address
INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
VALUES ('global', 'smtp', 'from', 'your-email@gmail.com', '{"description": "Default sender email address", "from_name": "Your Company Name"}', true)
ON CONFLICT (tenant_id, provider, key) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  config = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE integration_settings.scope = 'global';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this query to verify the SMTP settings were inserted correctly
-- =====================================================

SELECT 
  provider,
  key,
  CASE 
    WHEN key = 'pass' THEN '***hidden***'
    ELSE secret 
  END as secret_display,
  is_active,
  created_at,
  updated_at
FROM integration_settings 
WHERE scope = 'global' AND provider = 'smtp'
ORDER BY key;

-- =====================================================
-- COMMON SMTP PROVIDER CONFIGURATIONS
-- =====================================================
-- 
-- Gmail:
--   Host: smtp.gmail.com
--   Port: 587
--   Secure: false
--   User: your-email@gmail.com
--   Pass: your-app-password (not your regular password)
-- 
-- Outlook/Hotmail:
--   Host: smtp-mail.outlook.com
--   Port: 587
--   Secure: false
--   User: your-email@outlook.com
--   Pass: your-password
-- 
-- Yahoo:
--   Host: smtp.mail.yahoo.com
--   Port: 587
--   Secure: false
--   User: your-email@yahoo.com
--   Pass: your-app-password
-- 
-- Custom SMTP Server:
--   Host: your-smtp-server.com
--   Port: 587 (or 465 for SSL)
--   Secure: false (or true for SSL)
--   User: your-username
--   Pass: your-password
-- 
-- =====================================================
