-- Application Links Schema
-- Shareable links for customer credit applications generated from CRM
-- Run this migration to enable link generation feature

-- Create application_links table
CREATE TABLE IF NOT EXISTS application_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_application_links_token ON application_links(token);
CREATE INDEX IF NOT EXISTS idx_application_links_dealer ON application_links(dealer_id);
CREATE INDEX IF NOT EXISTS idx_application_links_customer ON application_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_application_links_expires ON application_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_application_links_active ON application_links(dealer_id, expires_at) 
  WHERE used_at IS NULL;

-- Add comments
COMMENT ON TABLE application_links IS 'Shareable links for credit applications generated from CRM';
COMMENT ON COLUMN application_links.token IS 'Unique token for the shareable link';
COMMENT ON COLUMN application_links.used_at IS 'Timestamp when link was used to submit application';
COMMENT ON COLUMN application_links.expires_at IS 'Link expiration timestamp';
COMMENT ON COLUMN application_links.created_by IS 'User who generated the link';

-- Function to clean up expired links (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_application_links()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM application_links
  WHERE expires_at < NOW() - INTERVAL '30 days'
  AND (used_at IS NOT NULL OR expires_at < NOW());
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_application_links() IS 'Cleanup expired/used links older than 30 days';

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ Application links schema created successfully!';
  RAISE NOTICE '📋 Created table: application_links';
  RAISE NOTICE '📊 Created indexes for optimal performance';
  RAISE NOTICE '🔧 Created cleanup function: cleanup_expired_application_links()';
END $$;

