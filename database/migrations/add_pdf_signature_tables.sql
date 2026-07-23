-- =====================================================
-- PDF Generation and E-Signature Tables Migration
-- =====================================================
-- This migration adds tables for PDF deal sheet generation
-- and e-signature workflow functionality
-- =====================================================

-- Deal Sheet Templates Table
CREATE TABLE IF NOT EXISTS deal_sheet_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE, -- NULL for global templates
  template_name VARCHAR(200) NOT NULL,
  template_type VARCHAR(20) NOT NULL CHECK (template_type IN ('finance', 'lease', 'both')),
  html_template TEXT NOT NULL,
  css_styles TEXT,
  page_size VARCHAR(20) DEFAULT 'letter',
  page_orientation VARCHAR(20) DEFAULT 'portrait' CHECK (page_orientation IN ('portrait', 'landscape')),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for templates
CREATE INDEX idx_deal_sheet_templates_dealer ON deal_sheet_templates(dealer_id);
CREATE INDEX idx_deal_sheet_templates_active ON deal_sheet_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_deal_sheet_templates_default ON deal_sheet_templates(is_default) WHERE is_default = TRUE;

-- Generated Deal Sheets Table
CREATE TABLE IF NOT EXISTS generated_deal_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES finance_deals(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES deal_sheet_templates(id) ON DELETE SET NULL,
  pdf_filename VARCHAR(255) NOT NULL,
  pdf_url VARCHAR(500) NOT NULL,
  pdf_size_bytes INTEGER,
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deal_data JSONB, -- Snapshot of deal data at generation time
  vehicle_data JSONB, -- Snapshot of vehicle data
  customer_data JSONB, -- Snapshot of customer data
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for generated deal sheets
CREATE INDEX idx_generated_deal_sheets_deal ON generated_deal_sheets(deal_id);
CREATE INDEX idx_generated_deal_sheets_dealer ON generated_deal_sheets(dealer_id);
CREATE INDEX idx_generated_deal_sheets_latest ON generated_deal_sheets(is_latest) WHERE is_latest = TRUE;
CREATE INDEX idx_generated_deal_sheets_created ON generated_deal_sheets(created_at DESC);

-- Signature Requests Table
CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES finance_deals(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  deal_sheet_id UUID REFERENCES generated_deal_sheets(id) ON DELETE SET NULL,
  
  -- Provider info
  provider VARCHAR(50) DEFAULT 'manual', -- 'docusign', 'hellosign', 'manual'
  envelope_id VARCHAR(255), -- External provider envelope/request ID
  envelope_status VARCHAR(50), -- Provider-specific status
  
  -- Signer information
  signer_name VARCHAR(255) NOT NULL,
  signer_email VARCHAR(255) NOT NULL,
  signer_phone VARCHAR(50),
  
  -- Document information
  document_name VARCHAR(255) NOT NULL,
  document_url VARCHAR(500) NOT NULL,
  
  -- Status and timestamps
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'viewed', 'signed', 'completed', 'declined', 'cancelled', 'expired')),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  viewed_at TIMESTAMP,
  signed_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Additional fields
  request_message TEXT,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  provider_response JSONB, -- Store full provider response
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for signature requests
CREATE INDEX idx_signature_requests_deal ON signature_requests(deal_id);
CREATE INDEX idx_signature_requests_dealer ON signature_requests(dealer_id);
CREATE INDEX idx_signature_requests_status ON signature_requests(status);
CREATE INDEX idx_signature_requests_envelope ON signature_requests(envelope_id) WHERE envelope_id IS NOT NULL;
CREATE INDEX idx_signature_requests_expires ON signature_requests(expires_at) WHERE status IN ('pending', 'sent', 'delivered', 'viewed');

-- Signature Events Table (audit trail)
CREATE TABLE IF NOT EXISTS signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id UUID NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'sent', 'delivered', 'viewed', 'signed', 'completed', 'declined', 'cancelled', 'reminder_sent'
  event_data JSONB, -- Additional event metadata
  ip_address VARCHAR(50),
  event_timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for signature events
CREATE INDEX idx_signature_events_request ON signature_events(signature_request_id);
CREATE INDEX idx_signature_events_type ON signature_events(event_type);
CREATE INDEX idx_signature_events_timestamp ON signature_events(event_timestamp DESC);

-- Add columns to finance_deals table for PDF and signature tracking
ALTER TABLE finance_deals 
ADD COLUMN IF NOT EXISTS latest_deal_sheet_id UUID REFERENCES generated_deal_sheets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deal_sheet_generated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS signature_request_id UUID REFERENCES signature_requests(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS signature_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMP;

-- Indexes for finance_deals new columns
CREATE INDEX IF NOT EXISTS idx_finance_deals_deal_sheet ON finance_deals(latest_deal_sheet_id);
CREATE INDEX IF NOT EXISTS idx_finance_deals_signature ON finance_deals(signature_request_id);

-- Insert default global finance template
INSERT INTO deal_sheet_templates (
  dealer_id,
  template_name,
  template_type,
  html_template,
  css_styles,
  is_default,
  is_active
) VALUES (
  NULL, -- Global template
  'Default Finance Deal Sheet',
  'both',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Finance Agreement</title>
</head>
<body>
    <div class="container">
        <header>
            <h1>{{dealer.business_name}}</h1>
            <div class="dealer-info">
                <p>{{dealer.address}}</p>
                <p>Phone: {{dealer.phone}} | Email: {{dealer.email}}</p>
                <p>{{dealer.website}}</p>
            </div>
            <h2>Finance Agreement</h2>
            <p class="generated-date">Generated: {{generated_date}}</p>
        </header>

        <section class="vehicle-info">
            <h3>Vehicle Information</h3>
            <table>
                <tr>
                    <td><strong>Year:</strong></td>
                    <td>{{vehicle.year}}</td>
                    <td><strong>Make:</strong></td>
                    <td>{{vehicle.make}}</td>
                </tr>
                <tr>
                    <td><strong>Model:</strong></td>
                    <td>{{vehicle.model}}</td>
                    <td><strong>Trim:</strong></td>
                    <td>{{vehicle.trim}}</td>
                </tr>
                <tr>
                    <td><strong>VIN:</strong></td>
                    <td colspan="3">{{vehicle.vin}}</td>
                </tr>
                <tr>
                    <td><strong>Stock Number:</strong></td>
                    <td>{{vehicle.stock_number}}</td>
                    <td><strong>Mileage:</strong></td>
                    <td>{{vehicle.mileage}}</td>
                </tr>
                <tr>
                    <td><strong>Color:</strong></td>
                    <td>{{vehicle.color}}</td>
                    <td><strong>Vehicle Price:</strong></td>
                    <td><strong>{{vehicle.price}}</strong></td>
                </tr>
            </table>
        </section>

        <section class="customer-info">
            <h3>Customer Information</h3>
            <table>
                <tr>
                    <td><strong>Name:</strong></td>
                    <td>{{customer.name}}</td>
                </tr>
                <tr>
                    <td><strong>Email:</strong></td>
                    <td>{{customer.email}}</td>
                </tr>
                <tr>
                    <td><strong>Phone:</strong></td>
                    <td>{{customer.phone}}</td>
                </tr>
            </table>
        </section>

        <section class="deal-info">
            <h3>{{deal.deal_type}} Details</h3>
            <table>
                <tr>
                    <td><strong>Deal Type:</strong></td>
                    <td>{{deal.deal_type}}</td>
                </tr>
                <tr>
                    <td><strong>Monthly Payment:</strong></td>
                    <td class="highlight">{{deal.monthly_payment}}</td>
                </tr>
                <tr>
                    <td><strong>Down Payment:</strong></td>
                    <td>{{deal.down_payment}}</td>
                </tr>
                <tr>
                    <td><strong>Term:</strong></td>
                    <td>{{deal.term_months}} months</td>
                </tr>
                <tr>
                    <td><strong>APR:</strong></td>
                    <td>{{deal.apr}}%</td>
                </tr>
                <tr>
                    <td><strong>Total Amount:</strong></td>
                    <td><strong>{{deal.total_amount}}</strong></td>
                </tr>
            </table>
        </section>

        <section class="signatures">
            <h3>Signatures</h3>
            <div class="signature-block">
                <div class="signature-line">
                    <p>_________________________________</p>
                    <p>Customer Signature</p>
                    <p>Date: _________________</p>
                </div>
                <div class="signature-line">
                    <p>_________________________________</p>
                    <p>Dealer Representative</p>
                    <p>Date: _________________</p>
                </div>
            </div>
        </section>

        <footer>
            <p class="disclaimer">This document is a finance agreement. By signing, you agree to the terms and conditions outlined herein.</p>
        </footer>
    </div>
</body>
</html>',
  'body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    font-size: 12px;
}
.container {
    max-width: 800px;
    margin: 0 auto;
}
header {
    text-align: center;
    margin-bottom: 30px;
    border-bottom: 2px solid #333;
    padding-bottom: 10px;
}
h1 {
    margin: 0;
    font-size: 24px;
    color: #333;
}
h2 {
    margin: 10px 0 5px 0;
    font-size: 18px;
}
h3 {
    margin-top: 20px;
    font-size: 14px;
    color: #333;
    border-bottom: 1px solid #ccc;
    padding-bottom: 5px;
}
.dealer-info {
    margin-top: 10px;
    font-size: 10px;
    color: #666;
}
.dealer-info p {
    margin: 2px 0;
}
.generated-date {
    font-size: 10px;
    color: #999;
}
section {
    margin-bottom: 20px;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}
table tr {
    border-bottom: 1px solid #eee;
}
table td {
    padding: 8px 5px;
}
table td:first-child {
    width: 30%;
}
.highlight {
    font-size: 16px;
    color: #0066cc;
    font-weight: bold;
}
.signatures {
    margin-top: 40px;
}
.signature-block {
    display: flex;
    justify-content: space-between;
    margin-top: 30px;
}
.signature-line {
    width: 45%;
    text-align: center;
}
.signature-line p {
    margin: 5px 0;
}
footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #ccc;
}
.disclaimer {
    font-size: 9px;
    color: #666;
    text-align: center;
}
@media print {
    body {
        padding: 0;
    }
}',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: PDF generation and e-signature tables created successfully';
END $$;

