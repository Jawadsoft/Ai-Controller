-- =====================================================
-- Dealer Finance Settings Migration
-- =====================================================
-- Adds a dealer_finance_settings table to store default
-- tax rates, fees, and add-ons used for out-the-door
-- price calculations quoted by DAIVE during conversations.

CREATE TABLE IF NOT EXISTS dealer_finance_settings (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id             UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE UNIQUE,

    -- Government fees / TTL (Tax Title License)
    sales_tax_rate        DECIMAL(6,5) DEFAULT 0,          -- e.g. 0.06250 = 6.25%
    title_fee             DECIMAL(10,2) DEFAULT 0,         -- e.g. 28.00
    license_fee           DECIMAL(10,2) DEFAULT 0,         -- e.g. 65.00
    registration_fee      DECIMAL(10,2) DEFAULT 0,         -- e.g. 150.00
    inspection_fee        DECIMAL(10,2) DEFAULT 0,         -- e.g. 25.00

    -- Dealer charges
    doc_fee               DECIMAL(10,2) DEFAULT 0,         -- documentation / processing fee
    acquisition_fee       DECIMAL(10,2) DEFAULT 0,         -- lease bank/acquisition fee

    -- Standard add-ons bundled by default
    dealer_addons_total   DECIMAL(10,2) DEFAULT 0,         -- accessories, tint, protection, etc.
    addon_description     TEXT DEFAULT '',                 -- human-readable list shown to customer

    -- Metadata
    state_code            VARCHAR(2) DEFAULT '',           -- e.g. 'TX', 'CA' – for display
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast dealer lookups
CREATE INDEX IF NOT EXISTS idx_dealer_finance_settings_dealer_id
    ON dealer_finance_settings(dealer_id);

COMMENT ON TABLE dealer_finance_settings IS
  'Dealer-level default tax rates and fees used by DAIVE to quote out-the-door prices';
COMMENT ON COLUMN dealer_finance_settings.sales_tax_rate IS
  'State/local sales tax rate, e.g. 0.0625 for 6.25%';
COMMENT ON COLUMN dealer_finance_settings.doc_fee IS
  'Dealer documentation / admin fee added to every deal';
COMMENT ON COLUMN dealer_finance_settings.acquisition_fee IS
  'Lease acquisition (bank) fee capitalized into the lease';
COMMENT ON COLUMN dealer_finance_settings.dealer_addons_total IS
  'Total of standard add-ons bundled by this dealer (tint, protection pkg, etc.)';
COMMENT ON COLUMN dealer_finance_settings.addon_description IS
  'Human-readable description of add-ons shown to the customer during DAIVE quote';
