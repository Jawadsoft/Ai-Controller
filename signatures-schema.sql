-- =====================================================
-- E-Signature Integration Schema
-- =====================================================
-- This migration creates tables for e-signature workflow
-- Compatible with DocuSign, HelloSign, Adobe Sign, etc.
-- Run this after templates-schema.sql
--
-- Version: 1.0
-- Purpose: Track document signature status and workflow

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SIGNATURE REQUESTS TABLE
-- =====================================================
-- Tracks signature requests sent to customers

CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES finance_deals(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  deal_sheet_id UUID REFERENCES generated_deal_sheets(id) ON DELETE SET NULL,
  
  -- E-Signature Provider Info
  provider VARCHAR(20) DEFAULT 'docusign' CHECK (provider IN ('docusign', 'hellosign', 'adobesign', 'manual')),
  envelope_id TEXT,  -- Provider's envelope/document ID
  envelope_status VARCHAR(30) DEFAULT 'created',
  
  -- Signer Information
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_phone TEXT,
  
  -- Document Information
  document_name TEXT NOT NULL,
  document_url TEXT,
  signed_document_url TEXT,  -- URL to fully signed document
  
  -- Status Tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'viewed', 'signed', 'declined', 'cancelled', 'expired', 'completed')
  ),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Request Details
  request_message TEXT,
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  provider_response JSONB,  -- Full response from provider API
  signature_metadata JSONB, -- Signature details (IP, timestamp, etc.)
  
  -- Audit
  created_by UUID REFERENCES users(id),
  notes TEXT,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. SIGNATURE EVENTS TABLE
-- =====================================================
-- Tracks all events in the signature lifecycle (webhook events)

CREATE TABLE IF NOT EXISTS signature_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signature_request_id UUID REFERENCES signature_requests(id) ON DELETE CASCADE,
  
  -- Event Information
  event_type VARCHAR(50) NOT NULL,  -- 'sent', 'delivered', 'viewed', 'signed', 'declined', etc.
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Event Details
  event_data JSONB,  -- Full webhook payload
  ip_address TEXT,   -- Signer's IP address
  user_agent TEXT,   -- Signer's browser/device info
  
  -- Provider Info
  provider_event_id TEXT,  -- Provider's event ID
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. SIGNATURE_TEMPLATES TABLE
-- =====================================================
-- Stores signature field templates (where to sign, initial, date, etc.)

CREATE TABLE IF NOT EXISTS signature_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,  -- NULL for global templates
  template_name TEXT NOT NULL,
  document_type VARCHAR(20) DEFAULT 'deal_sheet' CHECK (
    document_type IN ('deal_sheet', 'credit_app', 'trade_in', 'delivery', 'other')
  ),
  
  -- Signature Fields Configuration (JSON array)
  signature_fields JSONB NOT NULL,  -- [{type: 'signature', x: 100, y: 500, page: 1}, ...]
  
  -- Settings
  require_all_fields BOOLEAN DEFAULT TRUE,
  signing_order INT DEFAULT 1,  -- Order if multiple signers
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- =====================================================
-- 4. UPDATE FINANCE_DEALS TO TRACK SIGNATURES
-- =====================================================
-- Add columns to track signature status

ALTER TABLE finance_deals
ADD COLUMN IF NOT EXISTS signature_request_id UUID REFERENCES signature_requests(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS signature_status VARCHAR(20) DEFAULT NULL CHECK (
  signature_status IS NULL OR signature_status IN ('pending', 'sent', 'signed', 'declined', 'expired')
),
ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for signature lookup
CREATE INDEX IF NOT EXISTS idx_finance_deals_signature ON finance_deals(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_finance_deals_signature_status ON finance_deals(signature_status);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

-- Signature Requests Indexes
CREATE INDEX IF NOT EXISTS idx_signature_requests_deal ON signature_requests(deal_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_dealer ON signature_requests(dealer_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_requests_envelope ON signature_requests(envelope_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_email ON signature_requests(signer_email);
CREATE INDEX IF NOT EXISTS idx_signature_requests_sent ON signature_requests(sent_at);
CREATE INDEX IF NOT EXISTS idx_signature_requests_expires ON signature_requests(expires_at) WHERE status NOT IN ('signed', 'completed', 'cancelled');

-- Signature Events Indexes
CREATE INDEX IF NOT EXISTS idx_signature_events_request ON signature_events(signature_request_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_type ON signature_events(event_type);
CREATE INDEX IF NOT EXISTS idx_signature_events_timestamp ON signature_events(event_timestamp);

-- Signature Templates Indexes
CREATE INDEX IF NOT EXISTS idx_signature_templates_dealer ON signature_templates(dealer_id);
CREATE INDEX IF NOT EXISTS idx_signature_templates_type ON signature_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_signature_templates_default ON signature_templates(dealer_id, is_default) WHERE is_default = TRUE;

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE signature_requests IS 'Tracks e-signature requests sent to customers for deal documents';
COMMENT ON TABLE signature_events IS 'Audit log of all signature lifecycle events from webhooks';
COMMENT ON TABLE signature_templates IS 'Defines where signature fields should appear in documents';
COMMENT ON COLUMN signature_requests.envelope_id IS 'Provider-specific envelope/document identifier (e.g., DocuSign envelope ID)';
COMMENT ON COLUMN signature_requests.provider_response IS 'Full JSON response from e-signature provider API';
COMMENT ON COLUMN signature_events.event_data IS 'Full webhook payload from e-signature provider';
COMMENT ON COLUMN signature_templates.signature_fields IS 'JSON array defining signature field positions: [{type, x, y, page, required}]';

-- =====================================================
-- 7. INSERT DEFAULT SIGNATURE TEMPLATE
-- =====================================================

INSERT INTO signature_templates (
  dealer_id, template_name, document_type, is_default, is_active, signature_fields
) VALUES (
  NULL,
  'Standard Deal Sheet Signature',
  'deal_sheet',
  TRUE,
  TRUE,
  '[
    {
      "type": "signature",
      "label": "Customer Signature",
      "x": 100,
      "y": 650,
      "page": 1,
      "width": 200,
      "height": 50,
      "required": true
    },
    {
      "type": "date",
      "label": "Date Signed",
      "x": 320,
      "y": 650,
      "page": 1,
      "width": 100,
      "height": 30,
      "required": true
    },
    {
      "type": "text",
      "label": "Printed Name",
      "x": 100,
      "y": 600,
      "page": 1,
      "width": 200,
      "height": 30,
      "required": true
    }
  ]'::jsonb
) ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. FUNCTION TO AUTO-EXPIRE OLD REQUESTS
-- =====================================================
-- Function to automatically mark expired signature requests

CREATE OR REPLACE FUNCTION expire_old_signature_requests()
RETURNS void AS $$
BEGIN
  UPDATE signature_requests
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    status IN ('pending', 'sent', 'delivered', 'viewed')
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a helper function that can be called periodically
COMMENT ON FUNCTION expire_old_signature_requests() IS 'Marks signature requests as expired if past expiration date. Run periodically via cron or scheduler.';

-- =====================================================
-- END OF SIGNATURES SCHEMA MIGRATION
-- =====================================================

