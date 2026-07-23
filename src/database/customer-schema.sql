-- =====================================================
-- Customer Schema Migration
-- =====================================================
-- This migration creates customer tables for QR code access
-- Run this after the main schema migration

-- =====================================================
-- 1. CUSTOMER TABLES
-- =====================================================

-- Customer Sessions Table (for QR code access)
CREATE TABLE IF NOT EXISTS customer_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    access_type VARCHAR(50) DEFAULT 'qr_code', -- 'qr_code', 'direct', 'referral'
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    qr_hash VARCHAR(255), -- The QR code hash that was scanned
    is_authenticated BOOLEAN DEFAULT false,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Interactions Table (track what customers do)
CREATE TABLE IF NOT EXISTS customer_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES customer_sessions(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- 'page_view', 'chat_start', 'contact_request', 'qr_scan'
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    interaction_data JSONB DEFAULT '{}', -- Store additional data like page viewed, time spent, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Leads Table (when customers become leads)
CREATE TABLE IF NOT EXISTS customer_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES customer_sessions(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    lead_source VARCHAR(50) DEFAULT 'qr_code', -- 'qr_code', 'website', 'referral', 'walk_in'
    interest_level VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'hot'
    message TEXT,
    status VARCHAR(20) DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'converted', 'lost'
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- Customer Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_vehicle ON customer_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_dealer ON customer_sessions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires ON customer_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_qr_hash ON customer_sessions(qr_hash);

-- Customer Interactions Indexes
CREATE INDEX IF NOT EXISTS idx_customer_interactions_session ON customer_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_type ON customer_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_vehicle ON customer_interactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_dealer ON customer_interactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created ON customer_interactions(created_at);

-- Customer Leads Indexes
CREATE INDEX IF NOT EXISTS idx_customer_leads_session ON customer_leads(session_id);
CREATE INDEX IF NOT EXISTS idx_customer_leads_vehicle ON customer_leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_customer_leads_dealer ON customer_leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_customer_leads_status ON customer_leads(status);
CREATE INDEX IF NOT EXISTS idx_customer_leads_email ON customer_leads(customer_email);

-- =====================================================
-- 3. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_customer_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM customer_sessions 
    WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Function to update session activity
CREATE OR REPLACE FUNCTION update_customer_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customer_sessions 
    SET last_activity = NOW(), updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session activity on interactions
CREATE TRIGGER trigger_update_session_activity
    AFTER INSERT ON customer_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_session_activity();

-- =====================================================
-- 4. SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample customer session (uncomment for testing)
/*
INSERT INTO customer_sessions (
    session_token, 
    customer_name, 
    customer_email, 
    access_type, 
    qr_hash,
    is_authenticated
) VALUES (
    'sample_session_token_123',
    'John Doe',
    'john.doe@example.com',
    'qr_code',
    'sample_qr_hash_123',
    true
);
*/
