-- =====================================================
-- Add Lease-Specific Fields to Credit Applications
-- =====================================================
-- Adds comprehensive lease calculation fields to support
-- residual value calculations and lease payment estimation
-- Version: 1.0
-- Purpose: Enable credit applications to handle both finance and lease deals

-- Add lease-specific columns to credit_applications table
ALTER TABLE credit_applications
  -- Deal Type
  ADD COLUMN IF NOT EXISTS deal_type VARCHAR(10) CHECK (deal_type IN ('finance', 'lease')) DEFAULT 'finance',
  
  -- Lease Calculation Fields
  ADD COLUMN IF NOT EXISTS vehicle_msrp DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS down_payment DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_in_value DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebate_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acquisition_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_fee DECIMAL(10,2) DEFAULT 0,
  
  -- Lease Program Terms
  ADD COLUMN IF NOT EXISTS residual_percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS money_factor DECIMAL(8,6),
  
  -- Calculated Lease Values
  ADD COLUMN IF NOT EXISTS residual_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS cap_cost_reductions DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS capitalized_fees DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS adjusted_cap_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS depreciation_fee DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS finance_charge DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS base_monthly_payment DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS sales_tax_rate DECIMAL(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_tax DECIMAL(10,2),
  
  -- Mileage Terms
  ADD COLUMN IF NOT EXISTS annual_mileage INT DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS excess_mileage_rate DECIMAL(5,2) DEFAULT 0.25,
  
  -- Total Lease Cost
  ADD COLUMN IF NOT EXISTS total_lease_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS lease_end_buyout_price DECIMAL(12,2);

-- Add indexes for lease queries
CREATE INDEX IF NOT EXISTS idx_credit_apps_deal_type ON credit_applications(deal_type);
CREATE INDEX IF NOT EXISTS idx_credit_apps_msrp ON credit_applications(vehicle_msrp) WHERE deal_type = 'lease';

-- Add comments for documentation
COMMENT ON COLUMN credit_applications.deal_type IS 'Type of financing: finance or lease';
COMMENT ON COLUMN credit_applications.vehicle_msrp IS 'Manufacturer Suggested Retail Price - base for residual calculation';
COMMENT ON COLUMN credit_applications.down_payment IS 'Customer down payment (reduces capitalized cost)';
COMMENT ON COLUMN credit_applications.trade_in_value IS 'Trade-in vehicle value (reduces capitalized cost)';
COMMENT ON COLUMN credit_applications.rebate_amount IS 'Manufacturer rebates/incentives (reduces capitalized cost)';
COMMENT ON COLUMN credit_applications.acquisition_fee IS 'Lease acquisition fee (added to capitalized cost)';
COMMENT ON COLUMN credit_applications.doc_fee IS 'Documentation fee (added to capitalized cost)';
COMMENT ON COLUMN credit_applications.residual_percentage IS 'Percentage of MSRP that vehicle will be worth at lease end (e.g., 60.00 for 60%)';
COMMENT ON COLUMN credit_applications.money_factor IS 'Lease interest rate factor (e.g., 0.0010 equals ~2.4% APR)';
COMMENT ON COLUMN credit_applications.residual_value IS 'Calculated: MSRP × (residual_percentage/100)';
COMMENT ON COLUMN credit_applications.cap_cost_reductions IS 'Calculated: down_payment + trade_in_value + rebate_amount';
COMMENT ON COLUMN credit_applications.capitalized_fees IS 'Calculated: acquisition_fee + doc_fee';
COMMENT ON COLUMN credit_applications.adjusted_cap_cost IS 'Calculated: vehicle_purchase_price - cap_cost_reductions + capitalized_fees';
COMMENT ON COLUMN credit_applications.depreciation_fee IS 'Monthly depreciation: (adjusted_cap_cost - residual_value) / term_months';
COMMENT ON COLUMN credit_applications.finance_charge IS 'Monthly finance charge: (adjusted_cap_cost + residual_value) × money_factor';
COMMENT ON COLUMN credit_applications.base_monthly_payment IS 'Base payment before tax: depreciation_fee + finance_charge';
COMMENT ON COLUMN credit_applications.sales_tax_rate IS 'Sales tax rate (e.g., 0.065 for 6.5%)';
COMMENT ON COLUMN credit_applications.monthly_tax IS 'Monthly tax: base_monthly_payment × sales_tax_rate';
COMMENT ON COLUMN credit_applications.annual_mileage IS 'Annual mileage allowance (e.g., 12000, 15000)';
COMMENT ON COLUMN credit_applications.excess_mileage_rate IS 'Charge per mile over allowance (e.g., 0.25 = $0.25/mile)';
COMMENT ON COLUMN credit_applications.total_lease_cost IS 'Total cost over lease term: (estimated_monthly_payment × term_months) + down_payment';
COMMENT ON COLUMN credit_applications.lease_end_buyout_price IS 'Buyout price at lease end (same as residual_value)';

-- Create a function to calculate lease values automatically
CREATE OR REPLACE FUNCTION calculate_lease_values()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate for lease applications
  IF NEW.deal_type = 'lease' AND NEW.vehicle_msrp IS NOT NULL THEN
    
    -- Calculate residual value
    IF NEW.residual_percentage IS NOT NULL THEN
      NEW.residual_value := NEW.vehicle_msrp * (NEW.residual_percentage / 100);
      NEW.lease_end_buyout_price := NEW.residual_value;
    END IF;
    
    -- Calculate cap cost reductions
    NEW.cap_cost_reductions := COALESCE(NEW.down_payment, 0) + 
                                COALESCE(NEW.trade_in_value, 0) + 
                                COALESCE(NEW.rebate_amount, 0);
    
    -- Calculate capitalized fees
    NEW.capitalized_fees := COALESCE(NEW.acquisition_fee, 0) + 
                            COALESCE(NEW.doc_fee, 0);
    
    -- Calculate adjusted cap cost
    IF NEW.vehicle_purchase_price IS NOT NULL THEN
      NEW.adjusted_cap_cost := NEW.vehicle_purchase_price - 
                               NEW.cap_cost_reductions + 
                               NEW.capitalized_fees;
    END IF;
    
    -- Calculate monthly depreciation and finance charge
    IF NEW.adjusted_cap_cost IS NOT NULL AND 
       NEW.residual_value IS NOT NULL AND 
       NEW.requested_term_months IS NOT NULL AND 
       NEW.requested_term_months > 0 THEN
      
      NEW.depreciation_fee := (NEW.adjusted_cap_cost - NEW.residual_value) / NEW.requested_term_months;
      
      IF NEW.money_factor IS NOT NULL THEN
        NEW.finance_charge := (NEW.adjusted_cap_cost + NEW.residual_value) * NEW.money_factor;
      END IF;
    END IF;
    
    -- Calculate base payment and tax
    IF NEW.depreciation_fee IS NOT NULL AND NEW.finance_charge IS NOT NULL THEN
      NEW.base_monthly_payment := NEW.depreciation_fee + NEW.finance_charge;
      
      IF NEW.sales_tax_rate IS NOT NULL THEN
        NEW.monthly_tax := NEW.base_monthly_payment * NEW.sales_tax_rate;
        NEW.estimated_monthly_payment := NEW.base_monthly_payment + NEW.monthly_tax;
      ELSE
        NEW.estimated_monthly_payment := NEW.base_monthly_payment;
      END IF;
    END IF;
    
    -- Calculate total lease cost
    IF NEW.estimated_monthly_payment IS NOT NULL AND 
       NEW.requested_term_months IS NOT NULL THEN
      NEW.total_lease_cost := (NEW.estimated_monthly_payment * NEW.requested_term_months) + 
                              COALESCE(NEW.down_payment, 0);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate lease values on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_lease_values ON credit_applications;
CREATE TRIGGER trigger_calculate_lease_values
  BEFORE INSERT OR UPDATE ON credit_applications
  FOR EACH ROW
  EXECUTE FUNCTION calculate_lease_values();

-- Migration complete
SELECT 'Lease fields added to credit_applications table successfully!' as message;

