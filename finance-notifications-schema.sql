-- ===============================================
-- Finance Notifications Schema
-- Tracks email and SMS notifications sent for finance module
-- ===============================================

-- Finance Notifications Log Table
CREATE TABLE IF NOT EXISTS finance_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id),
  notification_type VARCHAR(20) CHECK (notification_type IN ('email', 'sms', 'push')),
  recipient VARCHAR(255) NOT NULL,
  content TEXT,
  status VARCHAR(20) CHECK (status IN ('sent', 'failed', 'pending')) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_dealer FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_finance_notifications_dealer ON finance_notifications_log(dealer_id);
CREATE INDEX IF NOT EXISTS idx_finance_notifications_status ON finance_notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_finance_notifications_type ON finance_notifications_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_finance_notifications_sent_at ON finance_notifications_log(sent_at);

-- Add notification settings to dealers table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dealers' AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE dealers 
    ADD COLUMN notification_settings JSONB DEFAULT '{
      "email_enabled": true,
      "sms_enabled": true,
      "finance_notifications": true,
      "signature_reminders": true,
      "deal_status_updates": true
    }'::jsonb;
    
    RAISE NOTICE 'Added notification_settings column to dealers table';
  ELSE
    RAISE NOTICE 'notification_settings column already exists in dealers table';
  END IF;
END $$;

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT ON finance_notifications_log TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE finance_notifications_log_id_seq TO your_app_user;

-- Add comments for documentation
COMMENT ON TABLE finance_notifications_log IS 'Logs all finance-related notifications (email and SMS) sent to customers and dealers';
COMMENT ON COLUMN finance_notifications_log.notification_type IS 'Type of notification: email, sms, or push';
COMMENT ON COLUMN finance_notifications_log.recipient IS 'Email address or phone number of recipient';
COMMENT ON COLUMN finance_notifications_log.content IS 'Subject line for emails or message content for SMS';
COMMENT ON COLUMN finance_notifications_log.status IS 'Delivery status: sent, failed, or pending';
COMMENT ON COLUMN finance_notifications_log.metadata IS 'Additional data about the notification (e.g., deal_id, application_id)';

-- Sample query to check notification statistics
-- SELECT 
--   notification_type,
--   status,
--   COUNT(*) as total,
--   DATE(sent_at) as date
-- FROM finance_notifications_log
-- WHERE dealer_id = 'your-dealer-uuid'
-- GROUP BY notification_type, status, DATE(sent_at)
-- ORDER BY date DESC;

