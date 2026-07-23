-- Credit Application Tokens Table
-- Stores secure tokens for credit application links sent via email
-- Each token is single-use and expires after 7 days

CREATE TABLE IF NOT EXISTS credit_application_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) UNIQUE NOT NULL,
  conversation_id UUID, -- Made optional for flexibility
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  vehicle_id UUID, -- Made optional for flexibility
  prefill_data JSONB, -- Store prefill data like down_payment, financing_type, etc.
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_tokens_token ON credit_application_tokens(token);
CREATE INDEX IF NOT EXISTS idx_credit_tokens_conversation ON credit_application_tokens(conversation_id);
CREATE INDEX IF NOT EXISTS idx_credit_tokens_dealer ON credit_application_tokens(dealer_id);
CREATE INDEX IF NOT EXISTS idx_credit_tokens_email ON credit_application_tokens(customer_email);
CREATE INDEX IF NOT EXISTS idx_credit_tokens_expires ON credit_application_tokens(expires_at);

-- Add comment
COMMENT ON TABLE credit_application_tokens IS 'Stores secure tokens for credit application links sent to customers via email';

