-- =====================================================
-- Lease Calculation Enhancement Migration
-- =====================================================
-- Adds fields required for proper lease calculations per developer notes
-- Based on: Developer Notes – Lease Calculation for Dealer IQ
--
-- Version: 1.0
-- Purpose: Add MSRP, Adjusted Cap Cost, Tax, and Mileage fields

-- Add new columns to finance_deals table for lease calculations
ALTER TABLE finance_deals 
  ADD COLUMN IF NOT EXISTS msrp DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS cap_cost_reductions DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capitalized_fees DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_cap_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS residual_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS depreciation_fee DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS finance_charge DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS base_payment DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_tax DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS total_monthly_payment DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS annual_mileage INT,
  ADD COLUMN IF NOT EXISTS excess_mileage_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS allowed_miles INT,
  ADD COLUMN IF NOT EXISTS actual_miles INT,
  ADD COLUMN IF NOT EXISTS excess_miles INT,
  ADD COLUMN IF NOT EXISTS excess_mileage_charge DECIMAL(10,2);

-- Add comments for documentation
COMMENT ON COLUMN finance_deals.msrp IS 'Manufacturer Suggested Retail Price - used for residual value calculation';
COMMENT ON COLUMN finance_deals.cap_cost_reductions IS 'Reductions from capitalized cost (down payment, trade-in, rebates)';
COMMENT ON COLUMN finance_deals.capitalized_fees IS 'Fees added to capitalized cost (acquisition fee, etc.)';
COMMENT ON COLUMN finance_deals.adjusted_cap_cost IS 'Calculated: CapCost - CapCostReductions + CapitalizedFees';
COMMENT ON COLUMN finance_deals.residual_value IS 'Calculated: MSRP × ResidualPercent';
COMMENT ON COLUMN finance_deals.depreciation_fee IS 'Monthly depreciation: (AdjustedCapCost - ResidualValue) / TermMonths';
COMMENT ON COLUMN finance_deals.finance_charge IS 'Monthly finance charge: (AdjustedCapCost + ResidualValue) × MoneyFactor';
COMMENT ON COLUMN finance_deals.base_payment IS 'Base monthly payment before tax: DepreciationFee + FinanceCharge';
COMMENT ON COLUMN finance_deals.tax_rate IS 'Tax rate (e.g., 0.065 for 6.5%)';
COMMENT ON COLUMN finance_deals.monthly_tax IS 'Monthly tax: BasePayment × TaxRate';
COMMENT ON COLUMN finance_deals.total_monthly_payment IS 'Total monthly payment: BasePayment + MonthlyTax';
COMMENT ON COLUMN finance_deals.annual_mileage IS 'Annual mileage allowance for lease';
COMMENT ON COLUMN finance_deals.excess_mileage_rate IS 'Charge per mile for excess mileage';
COMMENT ON COLUMN finance_deals.allowed_miles IS 'Total allowed miles: AnnualMileage × TermMonths/12';
COMMENT ON COLUMN finance_deals.actual_miles IS 'Actual miles at lease end';
COMMENT ON COLUMN finance_deals.excess_miles IS 'Excess miles: max(0, ActualMiles - AllowedMiles)';
COMMENT ON COLUMN finance_deals.excess_mileage_charge IS 'Excess mileage charge: ExcessMiles × ExcessMileageRate';

-- Create index for lease-specific queries
CREATE INDEX IF NOT EXISTS idx_finance_deals_lease_fields ON finance_deals(deal_type) WHERE deal_type = 'lease';

-- =====================================================
-- END OF LEASE CALCULATION MIGRATION
-- =====================================================

