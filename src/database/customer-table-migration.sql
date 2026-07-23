-- =====================================================
-- Customer Table Migration
-- =====================================================
-- This migration creates a separate customer table for persistent customer data
-- Run this after the customer schema migration

-- =====================================================
-- 1. CUSTOMER TABLE
-- =====================================================

-- Customers Table (for persistent customer data)
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for social login customers
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    preferred_contact_method VARCHAR(20) DEFAULT 'email', -- 'email', 'phone', 'sms'
    marketing_consent BOOLEAN DEFAULT false,
    terms_accepted BOOLEAN DEFAULT false,
    privacy_policy_accepted BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. UPDATE CUSTOMER SESSIONS TABLE
-- =====================================================

-- Add customer_id reference to customer_sessions
ALTER TABLE customer_sessions 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- =====================================================
-- 3. UPDATE CUSTOMER LEADS TABLE
-- =====================================================

-- Add customer_id reference to customer_leads
ALTER TABLE customer_leads 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Customer table indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_verification_token ON customers(verification_token);
CREATE INDEX IF NOT EXISTS idx_customers_password_reset_token ON customers(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_customers_last_login ON customers(last_login);

-- Updated customer_sessions indexes
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);

-- Updated customer_leads indexes
CREATE INDEX IF NOT EXISTS idx_customer_leads_customer_id ON customer_leads(customer_id);

-- =====================================================
-- 5. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update customer login info
CREATE OR REPLACE FUNCTION update_customer_login_info()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers 
    SET last_login = NOW(), 
        login_count = login_count + 1,
        updated_at = NOW()
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer login info when session is created with customer_id
CREATE TRIGGER trigger_update_customer_login_info
    AFTER INSERT ON customer_sessions
    FOR EACH ROW
    WHEN (NEW.customer_id IS NOT NULL)
    EXECUTE FUNCTION update_customer_login_info();

-- Function to get customer full name
CREATE OR REPLACE FUNCTION get_customer_full_name(customer_id UUID)
RETURNS TEXT AS $$
DECLARE
    full_name TEXT;
BEGIN
    SELECT CONCAT(first_name, ' ', last_name) INTO full_name
    FROM customers 
    WHERE id = customer_id;
    
    RETURN COALESCE(full_name, 'Unknown Customer');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample customer (uncomment for testing)
/*
INSERT INTO customers (
    email, 
    first_name, 
    last_name, 
    phone,
    email_verified,
    terms_accepted,
    privacy_policy_accepted
) VALUES (
    'john.doe@example.com',
    'John',
    'Doe',
    '+1234567890',
    true,
    true,
    true
);
*/
