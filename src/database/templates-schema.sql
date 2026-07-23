-- =====================================================
-- Deal Sheet Templates & PDF Storage Schema
-- =====================================================
-- This migration creates tables for deal sheet templates and generated PDFs
-- Run this after lenders-schema.sql
--
-- Version: 1.0
-- Purpose: Manage customizable deal sheet templates and PDF generation

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DEAL SHEET TEMPLATES TABLE
-- =====================================================
-- Stores customizable deal sheet templates for dealers

CREATE TABLE IF NOT EXISTS deal_sheet_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,  -- NULL for global templates
  template_name TEXT NOT NULL,
  template_type VARCHAR(20) CHECK (template_type IN ('finance', 'lease', 'both')) DEFAULT 'both',
  
  -- Template Content
  html_template TEXT NOT NULL,  -- HTML template with placeholders
  css_styles TEXT,              -- Custom CSS for styling
  header_html TEXT,             -- Optional custom header
  footer_html TEXT,             -- Optional custom footer
  
  -- Template Configuration
  include_vehicle_photo BOOLEAN DEFAULT TRUE,
  include_dealer_logo BOOLEAN DEFAULT TRUE,
  include_lender_info BOOLEAN DEFAULT TRUE,
  include_payment_schedule BOOLEAN DEFAULT FALSE,
  include_terms_conditions BOOLEAN DEFAULT TRUE,
  
  -- Page Settings
  page_size VARCHAR(10) DEFAULT 'letter' CHECK (page_size IN ('letter', 'a4', 'legal')),
  page_orientation VARCHAR(10) DEFAULT 'portrait' CHECK (page_orientation IN ('portrait', 'landscape')),
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,  -- Mark as default template for dealer
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Constraints
  CONSTRAINT template_name_unique UNIQUE (dealer_id, template_name)
);

-- =====================================================
-- 2. GENERATED DEAL SHEETS TABLE
-- =====================================================
-- Stores generated PDF deal sheets and their metadata

CREATE TABLE IF NOT EXISTS generated_deal_sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES finance_deals(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES deal_sheet_templates(id) ON DELETE SET NULL,
  
  -- PDF Information
  pdf_filename TEXT NOT NULL,
  pdf_url TEXT NOT NULL,  -- URL or path to PDF file
  pdf_size_bytes INT,     -- File size in bytes
  
  -- Generation Details
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by UUID REFERENCES users(id),
  generation_method VARCHAR(20) DEFAULT 'manual' CHECK (generation_method IN ('manual', 'auto', 'api')),
  
  -- Version Control
  version INT DEFAULT 1,  -- Track versions of same deal sheet
  is_latest BOOLEAN DEFAULT TRUE,
  
  -- Content Snapshot (JSON)
  deal_data JSONB,        -- Snapshot of deal data at generation time
  vehicle_data JSONB,     -- Snapshot of vehicle data
  customer_data JSONB,    -- Snapshot of customer data
  
  -- Status
  status VARCHAR(20) DEFAULT 'generated' CHECK (
    status IN ('generated', 'sent', 'viewed', 'signed', 'archived')
  ),
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. DEAL SHEET FIELDS TABLE
-- =====================================================
-- Defines available template fields and their data types

CREATE TABLE IF NOT EXISTS deal_sheet_fields (
  id SERIAL PRIMARY KEY,
  field_category VARCHAR(50) NOT NULL,  -- 'vehicle', 'customer', 'deal', 'dealer', 'lender'
  field_name TEXT NOT NULL,             -- e.g., 'vehicle.make', 'customer.name'
  field_label TEXT NOT NULL,            -- Display label: 'Vehicle Make', 'Customer Name'
  field_type VARCHAR(20) DEFAULT 'text' CHECK (
    field_type IN ('text', 'number', 'currency', 'date', 'boolean', 'image', 'table')
  ),
  data_source TEXT,                     -- SQL query or function to get data
  format_pattern TEXT,                  -- Format pattern (e.g., '$0,0.00' for currency)
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT field_name_unique UNIQUE (field_category, field_name)
);

-- =====================================================
-- 4. UPDATE FINANCE_DEALS TO TRACK DEAL SHEETS
-- =====================================================
-- Add column to track if deal sheet has been generated

ALTER TABLE finance_deals
ADD COLUMN IF NOT EXISTS latest_deal_sheet_id UUID REFERENCES generated_deal_sheets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deal_sheet_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for deal sheet lookup
CREATE INDEX IF NOT EXISTS idx_finance_deals_deal_sheet ON finance_deals(latest_deal_sheet_id);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

-- Templates Indexes
CREATE INDEX IF NOT EXISTS idx_templates_dealer ON deal_sheet_templates(dealer_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON deal_sheet_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON deal_sheet_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_default ON deal_sheet_templates(dealer_id, is_default) WHERE is_default = TRUE;

-- Generated Deal Sheets Indexes
CREATE INDEX IF NOT EXISTS idx_deal_sheets_deal ON generated_deal_sheets(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_sheets_dealer ON generated_deal_sheets(dealer_id);
CREATE INDEX IF NOT EXISTS idx_deal_sheets_template ON generated_deal_sheets(template_id);
CREATE INDEX IF NOT EXISTS idx_deal_sheets_generated ON generated_deal_sheets(generated_at);
CREATE INDEX IF NOT EXISTS idx_deal_sheets_status ON generated_deal_sheets(status);
CREATE INDEX IF NOT EXISTS idx_deal_sheets_latest ON generated_deal_sheets(deal_id, is_latest) WHERE is_latest = TRUE;

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE deal_sheet_templates IS 'Customizable deal sheet templates for dealers';
COMMENT ON TABLE generated_deal_sheets IS 'Generated PDF deal sheets with version history';
COMMENT ON TABLE deal_sheet_fields IS 'Available template fields and their metadata';
COMMENT ON COLUMN deal_sheet_templates.html_template IS 'HTML template with placeholders like {{vehicle.make}}, {{deal.monthly_payment}}';
COMMENT ON COLUMN generated_deal_sheets.deal_data IS 'JSON snapshot of deal data at PDF generation time';
COMMENT ON COLUMN generated_deal_sheets.version IS 'Version number for tracking multiple generations of same deal';

-- =====================================================
-- 7. INSERT DEFAULT TEMPLATE FIELDS
-- =====================================================

INSERT INTO deal_sheet_fields (field_category, field_name, field_label, field_type, format_pattern, description) VALUES
  -- Vehicle Fields
  ('vehicle', 'year', 'Year', 'number', NULL, 'Vehicle year'),
  ('vehicle', 'make', 'Make', 'text', NULL, 'Vehicle make'),
  ('vehicle', 'model', 'Model', 'text', NULL, 'Vehicle model'),
  ('vehicle', 'trim', 'Trim', 'text', NULL, 'Vehicle trim'),
  ('vehicle', 'vin', 'VIN', 'text', NULL, 'Vehicle identification number'),
  ('vehicle', 'stock_number', 'Stock #', 'text', NULL, 'Stock number'),
  ('vehicle', 'price', 'Price', 'currency', '$0,0.00', 'Vehicle price'),
  ('vehicle', 'mileage', 'Mileage', 'number', '0,0', 'Vehicle mileage'),
  ('vehicle', 'color', 'Color', 'text', NULL, 'Vehicle color'),
  
  -- Customer Fields
  ('customer', 'name', 'Name', 'text', NULL, 'Customer full name'),
  ('customer', 'email', 'Email', 'text', NULL, 'Customer email address'),
  ('customer', 'phone', 'Phone', 'text', NULL, 'Customer phone number'),
  ('customer', 'credit_score', 'Credit Score', 'number', NULL, 'Customer credit score'),
  
  -- Deal Fields
  ('deal', 'deal_type', 'Deal Type', 'text', NULL, 'Finance or Lease'),
  ('deal', 'monthly_payment', 'Monthly Payment', 'currency', '$0,0.00', 'Monthly payment amount'),
  ('deal', 'down_payment', 'Down Payment', 'currency', '$0,0.00', 'Down payment amount'),
  ('deal', 'term_months', 'Term', 'number', '0', 'Loan/lease term in months'),
  ('deal', 'apr', 'APR', 'number', '0.00%', 'Annual percentage rate'),
  ('deal', 'total_amount', 'Total Amount', 'currency', '$0,0.00', 'Total amount to be paid'),
  ('deal', 'total_interest', 'Total Interest', 'currency', '$0,0.00', 'Total interest over term'),
  ('deal', 'money_factor', 'Money Factor', 'number', '0.00000', 'Lease money factor'),
  ('deal', 'residual_value_pct', 'Residual %', 'number', '0.00%', 'Lease residual percentage'),
  
  -- Dealer Fields
  ('dealer', 'business_name', 'Dealership Name', 'text', NULL, 'Dealer business name'),
  ('dealer', 'address', 'Address', 'text', NULL, 'Dealer address'),
  ('dealer', 'phone', 'Phone', 'text', NULL, 'Dealer phone number'),
  ('dealer', 'email', 'Email', 'text', NULL, 'Dealer email address'),
  ('dealer', 'website', 'Website', 'text', NULL, 'Dealer website'),
  ('dealer', 'license_number', 'License #', 'text', NULL, 'Dealer license number'),
  
  -- Lender Fields
  ('lender', 'name', 'Lender Name', 'text', NULL, 'Lender name'),
  ('lender', 'contact_phone', 'Contact Phone', 'text', NULL, 'Lender contact phone'),
  ('lender', 'reference_number', 'Reference #', 'text', NULL, 'Lender reference number')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. INSERT DEFAULT GLOBAL TEMPLATE
-- =====================================================

INSERT INTO deal_sheet_templates (
  dealer_id, template_name, template_type, is_default, is_active, html_template, css_styles
) VALUES (
  NULL,
  'Standard Deal Sheet',
  'both',
  TRUE,
  TRUE,
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deal Sheet</title>
</head>
<body>
  <div class="deal-sheet">
    <div class="header">
      <h1>{{dealer.business_name}}</h1>
      <p>{{dealer.address}} | {{dealer.phone}} | {{dealer.email}}</p>
    </div>
    
    <div class="section">
      <h2>Vehicle Information</h2>
      <table>
        <tr><td><strong>Year:</strong></td><td>{{vehicle.year}}</td></tr>
        <tr><td><strong>Make:</strong></td><td>{{vehicle.make}}</td></tr>
        <tr><td><strong>Model:</strong></td><td>{{vehicle.model}}</td></tr>
        <tr><td><strong>VIN:</strong></td><td>{{vehicle.vin}}</td></tr>
        <tr><td><strong>Stock #:</strong></td><td>{{vehicle.stock_number}}</td></tr>
        <tr><td><strong>Price:</strong></td><td>{{vehicle.price}}</td></tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Customer Information</h2>
      <table>
        <tr><td><strong>Name:</strong></td><td>{{customer.name}}</td></tr>
        <tr><td><strong>Email:</strong></td><td>{{customer.email}}</td></tr>
        <tr><td><strong>Phone:</strong></td><td>{{customer.phone}}</td></tr>
      </table>
    </div>
    
    <div class="section">
      <h2>{{deal.deal_type}} Terms</h2>
      <table>
        <tr><td><strong>Monthly Payment:</strong></td><td>{{deal.monthly_payment}}</td></tr>
        <tr><td><strong>Down Payment:</strong></td><td>{{deal.down_payment}}</td></tr>
        <tr><td><strong>Term:</strong></td><td>{{deal.term_months}} months</td></tr>
        <tr><td><strong>APR:</strong></td><td>{{deal.apr}}%</td></tr>
        <tr><td><strong>Total Amount:</strong></td><td>{{deal.total_amount}}</td></tr>
      </table>
    </div>
    
    <div class="footer">
      <p><small>This is not a contract. Final terms subject to lender approval.</small></p>
      <p><small>Generated on {{generated_date}}</small></p>
    </div>
  </div>
</body>
</html>',
  'body { font-family: Arial, sans-serif; margin: 20px; }
.deal-sheet { max-width: 800px; margin: 0 auto; }
.header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
.header h1 { margin: 0; color: #333; }
.section { margin-bottom: 30px; }
.section h2 { color: #555; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
table { width: 100%; }
table tr td { padding: 8px; border-bottom: 1px solid #eee; }
.footer { margin-top: 50px; text-align: center; color: #666; }'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- END OF TEMPLATES SCHEMA MIGRATION
-- =====================================================

