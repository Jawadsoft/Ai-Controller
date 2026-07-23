-- =====================================================
-- Customers Table Schema
-- =====================================================
-- This migration creates the customers table for customer authentication
-- and credit application system

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Verification & Status
  email_verified BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expires TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'active',
  
  -- Terms & Privacy
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  privacy_policy_accepted BOOLEAN DEFAULT FALSE,
  privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Password Reset
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  
  -- Login tracking
  last_login TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_dealer ON customers(dealer_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_verification ON customers(verification_token);
CREATE INDEX IF NOT EXISTS idx_customers_reset_token ON customers(reset_password_token);

-- Add comments
COMMENT ON TABLE customers IS 'Customer accounts for credit applications and dealer portals';
COMMENT ON COLUMN customers.dealer_id IS 'Dealer that this customer is associated with (for multi-tenancy)';
COMMENT ON COLUMN customers.email_verified IS 'Whether the customer has verified their email address';
COMMENT ON COLUMN customers.status IS 'Customer account status: active, suspended, deleted';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ Customers table created successfully!';
  RAISE NOTICE '📋 Table: customers';
  RAISE NOTICE '📊 Indexes created for optimal performance';
END $$;

