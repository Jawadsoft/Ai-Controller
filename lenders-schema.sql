-- =====================================================
-- Lenders Management Schema Migration
-- =====================================================
-- This migration creates lenders and lender submissions tables
-- Run this after finance-schema.sql
--
-- Version: 1.0
-- Purpose: Manage lender relationships and deal submissions

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. LENDERS TABLE
-- =====================================================
-- Stores lender/bank information that dealers work with

CREATE TABLE IF NOT EXISTS lenders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,  -- NULL for global lenders
  lender_name TEXT NOT NULL,
  lender_type VARCHAR(20) CHECK (lender_type IN ('Bank', 'CreditUnion', 'OEM', 'InHouse')) DEFAULT 'Bank',
  
  -- Contact Information
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  address TEXT,
  
  -- Business Details
  license_number TEXT,
  routing_number TEXT,  -- For ACH/wire transfers
  account_number_encrypted TEXT,  -- Encrypted account number
  
  -- Integration Details
  api_enabled BOOLEAN DEFAULT FALSE,
  api_endpoint TEXT,  -- API URL if they have integration
  api_credentials_encrypted TEXT,  -- Encrypted API credentials (JSON)
  
  -- Terms & Conditions
  min_credit_score INT,
  max_ltv DECIMAL(5,2),  -- Loan-to-Value ratio (e.g., 125.00 for 125%)
  preferred_terms TEXT,  -- JSON array of preferred term lengths [36, 48, 60, 72]
  notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_preferred BOOLEAN DEFAULT FALSE,  -- Mark preferred lenders
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_contact CHECK (
    contact_email IS NULL OR contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

-- =====================================================
-- 2. LENDER SUBMISSIONS TABLE
-- =====================================================
-- Tracks finance deal submissions to lenders

CREATE TABLE IF NOT EXISTS lender_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES finance_deals(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES lenders(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  
  -- Submission Details
  submission_status VARCHAR(20) DEFAULT 'pending' CHECK (
    submission_status IN ('pending', 'submitted', 'approved', 'rejected', 'countered', 'withdrawn')
  ),
  submission_method VARCHAR(20) DEFAULT 'manual' CHECK (
    submission_method IN ('manual', 'api', 'email', 'fax')
  ),
  
  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Response Data
  approved_amount DECIMAL(10,2),
  approved_apr DECIMAL(5,2),
  approved_term_months INT,
  counter_offer JSONB,  -- Counter offer details if applicable
  rejection_reason TEXT,
  lender_reference_number TEXT,  -- Lender's internal reference ID
  
  -- Notes
  notes TEXT,
  response_data JSONB,  -- Full response from lender API if applicable
  
  -- Audit
  submitted_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. UPDATE FINANCE_TERMS_MASTER TO LINK LENDERS
-- =====================================================
-- Add lender_id to finance programs to track which lender offers which program

ALTER TABLE finance_terms_master
ADD COLUMN IF NOT EXISTS lender_id UUID REFERENCES lenders(id) ON DELETE SET NULL;

-- Add index for lender lookup
CREATE INDEX IF NOT EXISTS idx_finance_terms_lender ON finance_terms_master(lender_id);

-- =====================================================
-- 4. UPDATE FINANCE_DEALS TO TRACK APPROVED LENDER
-- =====================================================
-- Add columns to track which lender approved the deal

ALTER TABLE finance_deals
ADD COLUMN IF NOT EXISTS approved_lender_id UUID REFERENCES lenders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lender_reference_number TEXT;

-- Add index for lender lookup
CREATE INDEX IF NOT EXISTS idx_finance_deals_lender ON finance_deals(approved_lender_id);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

-- Lenders Indexes
CREATE INDEX IF NOT EXISTS idx_lenders_dealer ON lenders(dealer_id);
CREATE INDEX IF NOT EXISTS idx_lenders_type ON lenders(lender_type);
CREATE INDEX IF NOT EXISTS idx_lenders_active ON lenders(is_active);
CREATE INDEX IF NOT EXISTS idx_lenders_preferred ON lenders(is_preferred, is_active);

-- Lender Submissions Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_deal ON lender_submissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_submissions_lender ON lender_submissions(lender_id);
CREATE INDEX IF NOT EXISTS idx_submissions_dealer ON lender_submissions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON lender_submissions(submission_status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted ON lender_submissions(submitted_at);

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE lenders IS 'Stores lender/bank information that dealers work with for financing';
COMMENT ON TABLE lender_submissions IS 'Tracks finance deal submissions to lenders and their responses';
COMMENT ON COLUMN lenders.dealer_id IS 'NULL for global lenders available to all dealers, UUID for dealer-specific lenders';
COMMENT ON COLUMN lenders.api_credentials_encrypted IS 'Encrypted JSON containing API keys/tokens for lender integration';
COMMENT ON COLUMN lender_submissions.response_data IS 'Full JSON response from lender API if submitted via API';

-- =====================================================
-- 7. INITIAL SAMPLE LENDERS (OPTIONAL)
-- =====================================================
-- Insert some common U.S. lenders as global options

INSERT INTO lenders (dealer_id, lender_name, lender_type, is_active, is_preferred, min_credit_score, notes)
VALUES 
  (NULL, 'Chase Auto Finance', 'Bank', TRUE, TRUE, 650, 'Major national bank with competitive rates'),
  (NULL, 'Bank of America Auto Loans', 'Bank', TRUE, TRUE, 680, 'Preferred for prime customers'),
  (NULL, 'Wells Fargo Dealer Services', 'Bank', TRUE, FALSE, 620, 'Good for near-prime customers'),
  (NULL, 'Capital One Auto Finance', 'Bank', TRUE, TRUE, 600, 'Accepts lower credit scores'),
  (NULL, 'Ally Financial', 'Bank', TRUE, TRUE, 640, 'Excellent dealer support'),
  (NULL, 'Navy Federal Credit Union', 'CreditUnion', TRUE, FALSE, 650, 'Military members only'),
  (NULL, 'Toyota Financial Services', 'OEM', TRUE, FALSE, 680, 'Toyota/Lexus vehicles only'),
  (NULL, 'Ford Motor Credit', 'OEM', TRUE, FALSE, 680, 'Ford/Lincoln vehicles only'),
  (NULL, 'GM Financial', 'OEM', TRUE, FALSE, 680, 'GM brand vehicles only'),
  (NULL, 'Santander Consumer USA', 'Bank', TRUE, FALSE, 550, 'Subprime specialist')
ON CONFLICT DO NOTHING;

-- =====================================================
-- END OF LENDERS SCHEMA MIGRATION
-- =====================================================

