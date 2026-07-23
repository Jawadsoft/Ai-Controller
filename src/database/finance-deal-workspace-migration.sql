-- =====================================================
-- Finance Deal Workspace Migration
-- =====================================================
-- Adds fields required for the deal workspace UI:
-- dealer fee, itemised products, vehicle snapshot fields,
-- trade-in vehicle details, deal stage, AI notes,
-- credit bureau breakdown, gross profit tracking.
--
-- Version: 1.0
-- Run after: finance-compliance-migration.sql

-- =====================================================
-- 1. DEALER FEE & PRODUCT LINE ITEMS ON FINANCE_DEALS
-- =====================================================

ALTER TABLE finance_deals
  ADD COLUMN IF NOT EXISTS dealer_fee          DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warranty_amount     DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gap_amount          DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accessories_amount  DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS include_warranty    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS include_gap         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS include_accessories BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN finance_deals.dealer_fee         IS 'Dealer document/admin fee added to deal (e.g. $499)';
COMMENT ON COLUMN finance_deals.warranty_amount    IS 'Extended warranty / VSC amount';
COMMENT ON COLUMN finance_deals.gap_amount         IS 'GAP insurance amount';
COMMENT ON COLUMN finance_deals.accessories_amount IS 'Dealer-installed accessories amount';

-- =====================================================
-- 2. VEHICLE SNAPSHOT FIELDS ON FINANCE_DEALS
-- =====================================================
-- Snapshot the vehicle details at deal creation so the
-- workspace stays accurate even if the vehicle record changes.

ALTER TABLE finance_deals
  ADD COLUMN IF NOT EXISTS vehicle_msrp         DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS vehicle_internet_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS dealer_discount       DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconditioning_cost   DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS vehicle_stock_number  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_trim          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vehicle_mileage       INT,
  ADD COLUMN IF NOT EXISTS vehicle_image_url     TEXT;

COMMENT ON COLUMN finance_deals.vehicle_msrp          IS 'Manufacturer Suggested Retail Price at time of deal';
COMMENT ON COLUMN finance_deals.vehicle_internet_price IS 'Internet/advertised price at time of deal';
COMMENT ON COLUMN finance_deals.dealer_discount        IS 'Dealer discount off internet price';
COMMENT ON COLUMN finance_deals.reconditioning_cost    IS 'Reconditioning/prep cost added to deal';
COMMENT ON COLUMN finance_deals.gross_profit           IS 'Dealer gross profit on vehicle sale';
COMMENT ON COLUMN finance_deals.vehicle_stock_number   IS 'Stock number snapshot';
COMMENT ON COLUMN finance_deals.vehicle_trim           IS 'Trim level snapshot';
COMMENT ON COLUMN finance_deals.vehicle_mileage        IS 'Odometer reading at deal creation';
COMMENT ON COLUMN finance_deals.vehicle_image_url      IS 'Primary vehicle photo URL snapshot';

-- =====================================================
-- 3. TRADE-IN VEHICLE DETAILS ON FINANCE_DEALS
-- =====================================================

ALTER TABLE finance_deals
  ADD COLUMN IF NOT EXISTS trade_in_year       INT,
  ADD COLUMN IF NOT EXISTS trade_in_make       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS trade_in_model      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS trade_in_trim       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS trade_in_vin        VARCHAR(17),
  ADD COLUMN IF NOT EXISTS trade_in_mileage    INT,
  ADD COLUMN IF NOT EXISTS trade_in_condition  VARCHAR(20) DEFAULT 'good'
    CHECK (trade_in_condition IN ('excellent','good','fair','poor')),
  ADD COLUMN IF NOT EXISTS trade_in_color      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS trade_in_image_url  TEXT;

COMMENT ON COLUMN finance_deals.trade_in_year      IS 'Model year of trade-in vehicle';
COMMENT ON COLUMN finance_deals.trade_in_make      IS 'Make of trade-in vehicle';
COMMENT ON COLUMN finance_deals.trade_in_model     IS 'Model of trade-in vehicle';
COMMENT ON COLUMN finance_deals.trade_in_vin       IS 'VIN of trade-in vehicle (17 chars)';
COMMENT ON COLUMN finance_deals.trade_in_mileage   IS 'Odometer reading of trade-in';
COMMENT ON COLUMN finance_deals.trade_in_condition IS 'Condition rating of trade-in';

-- =====================================================
-- 4. DEAL STAGE (granular pipeline tracking)
-- =====================================================

ALTER TABLE finance_deals
  ADD COLUMN IF NOT EXISTS deal_stage VARCHAR(30) DEFAULT 'lead'
    CHECK (deal_stage IN (
      'lead', 'test_drive', 'credit_app',
      'lender_approval', 'menu', 'contract', 'delivery'
    )),
  ADD COLUMN IF NOT EXISTS deal_number VARCHAR(20);

COMMENT ON COLUMN finance_deals.deal_stage  IS 'Current pipeline stage for the deal workspace';
COMMENT ON COLUMN finance_deals.deal_number IS 'Human-readable deal number e.g. D-2025-0514';

-- Back-fill deal_number for existing rows (format: D-YYYY-NNNN)
UPDATE finance_deals
SET deal_number = 'D-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' || LPAD((ROW_NUMBER() OVER (PARTITION BY dealer_id ORDER BY created_at))::TEXT, 4, '0')
WHERE deal_number IS NULL;

-- =====================================================
-- 5. AI NOTES ON FINANCE_DEALS
-- =====================================================

ALTER TABLE finance_deals
  ADD COLUMN IF NOT EXISTS ai_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_notes_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN finance_deals.ai_notes IS 'AI-generated deal notes (from DAIVE analysis)';

-- =====================================================
-- 6. CREDIT BUREAU BREAKDOWN ON CREDIT_APPLICATIONS
-- =====================================================

ALTER TABLE credit_applications
  ADD COLUMN IF NOT EXISTS experian_score   INT CHECK (experian_score  >= 300 AND experian_score  <= 850),
  ADD COLUMN IF NOT EXISTS equifax_score    INT CHECK (equifax_score   >= 300 AND equifax_score   <= 850),
  ADD COLUMN IF NOT EXISTS transunion_score INT CHECK (transunion_score >= 300 AND transunion_score <= 850),
  ADD COLUMN IF NOT EXISTS credit_tier      VARCHAR(20) CHECK (credit_tier IN (
    'super_prime','prime','near_prime','subprime','deep_subprime'
  ));

COMMENT ON COLUMN credit_applications.experian_score   IS 'Experian bureau score';
COMMENT ON COLUMN credit_applications.equifax_score    IS 'Equifax bureau score';
COMMENT ON COLUMN credit_applications.transunion_score IS 'TransUnion bureau score';
COMMENT ON COLUMN credit_applications.credit_tier      IS 'Derived credit tier for lender matching';

-- =====================================================
-- 7. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_finance_deals_stage      ON finance_deals(deal_stage);
CREATE INDEX IF NOT EXISTS idx_finance_deals_deal_number ON finance_deals(deal_number);
CREATE INDEX IF NOT EXISTS idx_finance_deals_trade_vin  ON finance_deals(trade_in_vin);

-- =====================================================
-- END OF FINANCE DEAL WORKSPACE MIGRATION
-- =====================================================
