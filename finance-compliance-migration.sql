-- =====================================================
-- Finance System Compliance Migration
-- =====================================================
-- Adds TTL fees, trade-in handling, and protection products support
-- Based on compliance requirements for finance contracts
--
-- Version: 1.0
-- Purpose: Add government fees, trade-in details, and protection products

-- =====================================================
-- 1. ADD GOVERNMENT FEES (TTL) TO FINANCE_DEALS
-- =====================================================

ALTER TABLE finance_deals 
  ADD COLUMN IF NOT EXISTS sales_tax DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS license_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_government_fees DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN finance_deals.sales_tax IS 'Sales tax (goes to State Comptroller)';
COMMENT ON COLUMN finance_deals.title_fee IS 'Title fee (goes to DMV)';
COMMENT ON COLUMN finance_deals.license_fee IS 'License fee (goes to DMV)';
COMMENT ON COLUMN finance_deals.registration_fee IS 'Registration fee (goes to DMV)';
COMMENT ON COLUMN finance_deals.inspection_fee IS 'Inspection/processing fee (if required)';
COMMENT ON COLUMN finance_deals.processing_fee IS 'Document processing fee';
COMMENT ON COLUMN finance_deals.total_government_fees IS 'Total of all government fees (calculated)';

-- =====================================================
-- 2. ADD TRADE-IN FIELDS TO FINANCE_DEALS
-- =====================================================

ALTER TABLE finance_deals 
  ADD COLUMN IF NOT EXISTS trade_in_acv DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS trade_in_payoff DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_in_net_credit DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS trade_in_negative_equity DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_in_equity DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_in_vehicle_id UUID;

COMMENT ON COLUMN finance_deals.trade_in_acv IS 'Actual Cash Value - what dealer gives for trade-in';
COMMENT ON COLUMN finance_deals.trade_in_payoff IS 'Amount customer still owes on trade-in';
COMMENT ON COLUMN finance_deals.trade_in_net_credit IS 'Net trade-in credit: ACV - Payoff';
COMMENT ON COLUMN finance_deals.trade_in_negative_equity IS 'Negative equity if Payoff > ACV (added to amount financed)';
COMMENT ON COLUMN finance_deals.trade_in_equity IS 'Positive equity if ACV > Payoff (reduces amount financed)';

-- =====================================================
-- 3. ADD AMOUNT FINANCED CALCULATION
-- =====================================================

ALTER TABLE finance_deals 
  ADD COLUMN IF NOT EXISTS amount_financed DECIMAL(10,2);

COMMENT ON COLUMN finance_deals.amount_financed IS 'Total amount financed: Vehicle Price + Add-Ons + Gov Fees + Products + Negative Equity - Down Payment - Trade Equity';

-- =====================================================
-- 4. CREATE PROTECTION PRODUCTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_deal_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES finance_deals(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('GAP', 'VSC', 'Appearance', 'TireWheel', 'ServiceContract', 'InteriorExterior', 'Other')),
  product_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  is_financed BOOLEAN DEFAULT TRUE,
  provider_name TEXT,
  dealer_profit DECIMAL(10,2) DEFAULT 0,
  provider_payment DECIMAL(10,2) DEFAULT 0,
  monthly_payment_impact DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for protection products
CREATE INDEX IF NOT EXISTS idx_finance_deal_products_deal ON finance_deal_products(deal_id);
CREATE INDEX IF NOT EXISTS idx_finance_deal_products_type ON finance_deal_products(product_type);

COMMENT ON TABLE finance_deal_products IS 'Optional protection products added to finance deals (GAP, VSC, etc.)';
COMMENT ON COLUMN finance_deal_products.is_required IS 'Must be FALSE for compliance - products cannot be required';
COMMENT ON COLUMN finance_deal_products.is_financed IS 'Whether product is financed into the deal';
COMMENT ON COLUMN finance_deal_products.dealer_profit IS 'Dealer profit portion of product price';
COMMENT ON COLUMN finance_deal_products.provider_payment IS 'Amount paid to product provider';

-- =====================================================
-- 5. ADD TOTAL PROTECTION PRODUCTS TO FINANCE_DEALS
-- =====================================================

ALTER TABLE finance_deals 
  ADD COLUMN IF NOT EXISTS total_protection_products DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS protection_products_monthly DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN finance_deals.total_protection_products IS 'Total cost of all protection products';
COMMENT ON COLUMN finance_deals.protection_products_monthly IS 'Monthly payment impact of protection products';

-- =====================================================
-- END OF FINANCE COMPLIANCE MIGRATION
-- =====================================================

