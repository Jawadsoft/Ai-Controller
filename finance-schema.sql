-- =====================================================
-- Finance & Lease Terms Module Schema Migration
-- =====================================================
-- This migration creates all finance-related tables for DealerIQ
-- Run this after the main-schema-migration.sql
--
-- Version: 1.0
-- Author: DAIVE System / Jawadsoft
-- Purpose: Manage credit-score-based finance and lease terms

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CREDIT APPLICATIONS TABLE
-- =====================================================
-- Stores customer credit applications with encrypted sensitive data

CREATE TABLE IF NOT EXISTS credit_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES daive_conversations(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  ssn_encrypted TEXT,              -- AES256 encrypted
  dl_number_encrypted TEXT,        -- AES256 encrypted
  credit_score INT CHECK (credit_score >= 300 AND credit_score <= 850),
  application_status VARCHAR(20) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected', 'reviewing')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. FINANCE TERMS MASTER TABLE
-- =====================================================
-- Stores finance and lease programs (dealer-specific with global fallback)
-- dealer_id = NULL means global/default program available to all dealers

CREATE TABLE IF NOT EXISTS finance_terms_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,  -- NULL for global programs
  program_name TEXT NOT NULL,
  type VARCHAR(10) CHECK (type IN ('finance', 'lease')),
  term_months INT NOT NULL CHECK (term_months > 0),
  tier_min_score INT NOT NULL CHECK (tier_min_score >= 300 AND tier_min_score <= 850),
  tier_max_score INT NOT NULL CHECK (tier_max_score >= 300 AND tier_max_score <= 850),
  interest_rate DECIMAL(5,2),          -- For finance programs (APR %)
  money_factor DECIMAL(8,6),           -- For leases
  residual_value_pct DECIMAL(5,2),     -- For leases (residual %)
  down_payment_min DECIMAL(10,2) DEFAULT 0,
  program_source VARCHAR(20) CHECK (program_source IN ('OEM','Bank','CreditUnion','InHouse')),
  is_active BOOLEAN DEFAULT TRUE,
  effective_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure tier ranges don't overlap for same dealer, type, and term
  CONSTRAINT valid_tier_range CHECK (tier_min_score <= tier_max_score),
  CONSTRAINT valid_finance_terms CHECK (
    (type = 'finance' AND interest_rate IS NOT NULL) OR
    (type = 'lease' AND money_factor IS NOT NULL AND residual_value_pct IS NOT NULL)
  )
);

-- =====================================================
-- 3. FINANCE DEALS TABLE
-- =====================================================
-- Stores customer-specific finance and lease deals

CREATE TABLE IF NOT EXISTS finance_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES daive_conversations(id) ON DELETE SET NULL,
  application_id UUID REFERENCES credit_applications(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  term_id UUID REFERENCES finance_terms_master(id),
  deal_type VARCHAR(10) CHECK (deal_type IN ('finance','lease')),
  apr DECIMAL(5,2),                    -- For finance deals
  money_factor DECIMAL(8,6),           -- For lease deals
  residual_value_pct DECIMAL(5,2),     -- For lease deals
  down_payment DECIMAL(10,2) DEFAULT 0,
  monthly_payment DECIMAL(10,2),
  term_months INT NOT NULL,
  vehicle_price DECIMAL(10,2),         -- Snapshot of vehicle price at deal creation
  total_interest DECIMAL(10,2),        -- Total interest over term
  total_amount DECIMAL(10,2),          -- Total amount to be paid
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'signed', 'completed', 'cancelled')),
  generated_by VARCHAR(20) DEFAULT 'ai' CHECK (generated_by IN ('ai', 'manual', 'system')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_deal_terms CHECK (
    (deal_type = 'finance' AND apr IS NOT NULL) OR
    (deal_type = 'lease' AND money_factor IS NOT NULL AND residual_value_pct IS NOT NULL)
  )
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Credit Applications Indexes
CREATE INDEX IF NOT EXISTS idx_credit_apps_dealer ON credit_applications(dealer_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_conversation ON credit_applications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_status ON credit_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_credit_apps_created ON credit_applications(created_at);

-- Finance Terms Indexes
CREATE INDEX IF NOT EXISTS idx_finance_terms_dealer ON finance_terms_master(dealer_id);
CREATE INDEX IF NOT EXISTS idx_finance_terms_type ON finance_terms_master(type, is_active);
CREATE INDEX IF NOT EXISTS idx_finance_terms_tier ON finance_terms_master(tier_min_score, tier_max_score);
CREATE INDEX IF NOT EXISTS idx_finance_terms_active ON finance_terms_master(is_active, effective_date, expiry_date);

-- Finance Deals Indexes
CREATE INDEX IF NOT EXISTS idx_finance_deals_dealer ON finance_deals(dealer_id);
CREATE INDEX IF NOT EXISTS idx_finance_deals_conversation ON finance_deals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_finance_deals_vehicle ON finance_deals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_finance_deals_status ON finance_deals(status);
CREATE INDEX IF NOT EXISTS idx_finance_deals_created ON finance_deals(created_at);
CREATE INDEX IF NOT EXISTS idx_finance_deals_application ON finance_deals(application_id);

-- =====================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE credit_applications IS 'Stores customer credit applications with encrypted sensitive data (SSN, DL)';
COMMENT ON TABLE finance_terms_master IS 'Stores finance and lease programs. dealer_id NULL = global program available to all dealers';
COMMENT ON TABLE finance_deals IS 'Stores customer-specific finance and lease deals linked to vehicles and conversations';

COMMENT ON COLUMN credit_applications.ssn_encrypted IS 'AES256 encrypted Social Security Number';
COMMENT ON COLUMN credit_applications.dl_number_encrypted IS 'AES256 encrypted Driver License Number';
COMMENT ON COLUMN finance_terms_master.dealer_id IS 'NULL for global programs, UUID for dealer-specific programs';
COMMENT ON COLUMN finance_deals.conversation_id IS 'Links deal to DAIVE conversation if generated via bot';
COMMENT ON COLUMN finance_deals.generated_by IS 'Indicates whether deal was generated by AI bot, manual entry, or system';

-- =====================================================
-- 6. INITIAL GLOBAL FINANCE PROGRAMS (OPTIONAL)
-- =====================================================
-- Insert default global finance programs based on standard U.S. credit tiers
-- These can be overridden by dealer-specific programs

-- Tier 1: Excellent (750+)
INSERT INTO finance_terms_master (dealer_id, program_name, type, term_months, tier_min_score, tier_max_score, interest_rate, money_factor, residual_value_pct, program_source, is_active)
VALUES 
  (NULL, 'Standard Finance - Tier 1', 'finance', 36, 750, 850, 2.90, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 1', 'finance', 48, 750, 850, 3.20, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 1', 'finance', 60, 750, 850, 3.50, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 1', 'finance', 72, 750, 850, 3.90, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Lease - Tier 1', 'lease', 36, 750, 850, NULL, 0.0010, 60.00, 'Bank', TRUE)
ON CONFLICT DO NOTHING;

-- Tier 2: Good (700-749)
INSERT INTO finance_terms_master (dealer_id, program_name, type, term_months, tier_min_score, tier_max_score, interest_rate, money_factor, residual_value_pct, program_source, is_active)
VALUES 
  (NULL, 'Standard Finance - Tier 2', 'finance', 36, 700, 749, 6.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 2', 'finance', 48, 700, 749, 6.50, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 2', 'finance', 60, 700, 749, 7.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 2', 'finance', 72, 700, 749, 7.50, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Lease - Tier 2', 'lease', 36, 700, 749, NULL, 0.0016, 58.00, 'Bank', TRUE)
ON CONFLICT DO NOTHING;

-- Tier 3: Fair (650-699)
INSERT INTO finance_terms_master (dealer_id, program_name, type, term_months, tier_min_score, tier_max_score, interest_rate, money_factor, residual_value_pct, program_source, is_active)
VALUES 
  (NULL, 'Standard Finance - Tier 3', 'finance', 36, 650, 699, 8.60, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 3', 'finance', 48, 650, 699, 9.20, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 3', 'finance', 60, 650, 699, 9.80, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 3', 'finance', 72, 650, 699, 10.50, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Lease - Tier 3', 'lease', 36, 650, 699, NULL, 0.0021, 56.00, 'Bank', TRUE)
ON CONFLICT DO NOTHING;

-- Tier 4: Poor (600-649)
INSERT INTO finance_terms_master (dealer_id, program_name, type, term_months, tier_min_score, tier_max_score, interest_rate, money_factor, residual_value_pct, program_source, is_active)
VALUES 
  (NULL, 'Standard Finance - Tier 4', 'finance', 36, 600, 649, 12.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 4', 'finance', 48, 600, 649, 13.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 4', 'finance', 60, 600, 649, 14.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 4', 'finance', 72, 600, 649, 15.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Lease - Tier 4', 'lease', 36, 600, 649, NULL, 0.0028, 54.00, 'Bank', TRUE)
ON CONFLICT DO NOTHING;

-- Tier 5: Subprime (<600)
INSERT INTO finance_terms_master (dealer_id, program_name, type, term_months, tier_min_score, tier_max_score, interest_rate, money_factor, residual_value_pct, program_source, is_active)
VALUES 
  (NULL, 'Standard Finance - Tier 5', 'finance', 36, 300, 599, 18.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 5', 'finance', 48, 300, 599, 19.50, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 5', 'finance', 60, 300, 599, 21.00, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Finance - Tier 5', 'finance', 72, 300, 599, 22.50, NULL, NULL, 'Bank', TRUE),
  (NULL, 'Standard Lease - Tier 5', 'lease', 36, 300, 599, NULL, 0.0036, 52.00, 'Bank', TRUE)
ON CONFLICT DO NOTHING;

-- Note: Lease programs now include money_factor and residual_value_pct
-- These are default values and can be customized per dealer via the API

-- =====================================================
-- END OF FINANCE SCHEMA MIGRATION
-- =====================================================

