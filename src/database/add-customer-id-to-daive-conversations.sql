-- =====================================================
-- Add customer_id to daive_conversations table
-- =====================================================
-- This migration adds customer_id reference to daive_conversations table
-- for better customer relationship management and conversation history

-- =====================================================
-- 1. ADD CUSTOMER_ID COLUMN
-- =====================================================

-- Add customer_id column to daive_conversations table
ALTER TABLE daive_conversations 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- =====================================================
-- 2. CREATE DEFAULT CUSTOMER FOR DEVELOPMENT
-- =====================================================

-- Insert a default customer for development purposes
INSERT INTO customers (
    id,
    email,
    first_name,
    last_name,
    phone,
    status,
    email_verified,
    terms_accepted,
    privacy_policy_accepted
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@daive.com',
    'Development',
    'Customer',
    '+1-555-0123',
    'active',
    true,
    true,
    true
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. UPDATE EXISTING CONVERSATIONS (OPTIONAL)
-- =====================================================

-- For existing conversations, try to match by email first, then by name
-- This is optional and can be run separately if needed
UPDATE daive_conversations 
SET customer_id = (
    SELECT c.id 
    FROM customers c 
    WHERE c.email = daive_conversations.customer_email 
    LIMIT 1
)
WHERE customer_email IS NOT NULL 
AND customer_id IS NULL;

-- If no email match, try to match by name (less reliable)
UPDATE daive_conversations 
SET customer_id = (
    SELECT c.id 
    FROM customers c 
    WHERE CONCAT(c.first_name, ' ', c.last_name) = daive_conversations.customer_name 
    LIMIT 1
)
WHERE customer_name IS NOT NULL 
AND customer_id IS NULL;

-- Set default customer_id for remaining conversations
UPDATE daive_conversations 
SET customer_id = '00000000-0000-0000-0000-000000000001'
WHERE customer_id IS NULL;

-- =====================================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Create index on customer_id for faster queries
CREATE INDEX IF NOT EXISTS idx_daive_conversations_customer_id 
ON daive_conversations(customer_id);

-- Create composite index for customer + dealer queries
CREATE INDEX IF NOT EXISTS idx_daive_conversations_customer_dealer 
ON daive_conversations(customer_id, dealer_id);

-- Create composite index for customer + vehicle queries
CREATE INDEX IF NOT EXISTS idx_daive_conversations_customer_vehicle 
ON daive_conversations(customer_id, vehicle_id);

-- =====================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN daive_conversations.customer_id IS 'References customers table for persistent customer relationship';
COMMENT ON COLUMN daive_conversations.customer_name IS 'Customer name (legacy field, prefer customer_id)';
COMMENT ON COLUMN daive_conversations.customer_email IS 'Customer email (legacy field, prefer customer_id)';
COMMENT ON COLUMN daive_conversations.customer_phone IS 'Customer phone (legacy field, prefer customer_id)';

-- =====================================================
-- 6. VERIFICATION QUERIES
-- =====================================================

-- Verify the migration worked
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_conversations,
    COUNT(customer_id) as conversations_with_customer_id,
    COUNT(*) - COUNT(customer_id) as conversations_without_customer_id
FROM daive_conversations;

-- Show sample of updated conversations
SELECT 
    id,
    customer_id,
    customer_name,
    customer_email,
    session_id,
    created_at
FROM daive_conversations 
ORDER BY created_at DESC 
LIMIT 5;
