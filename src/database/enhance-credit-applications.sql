-- =====================================================
-- Enhanced Credit Application Schema
-- Adds comprehensive fields for customer credit applications
-- =====================================================

-- Add new columns to credit_applications table
ALTER TABLE credit_applications
  -- Borrower Information
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
  
  -- Vehicle Information (from selected vehicle or manual entry)
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_year INT,
  ADD COLUMN IF NOT EXISTS vehicle_mileage INT,
  ADD COLUMN IF NOT EXISTS vehicle_purchase_price DECIMAL(12,2),
  
  -- Loan Details
  ADD COLUMN IF NOT EXISTS requested_loan_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS requested_term_months INT,
  ADD COLUMN IF NOT EXISTS estimated_monthly_payment DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS estimated_interest_rate DECIMAL(5,4),
  
  -- Employment Information (detailed)
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS work_address TEXT,
  ADD COLUMN IF NOT EXISTS work_city TEXT,
  ADD COLUMN IF NOT EXISTS work_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS work_zip_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS annual_income DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS employment_status TEXT,
  ADD COLUMN IF NOT EXISTS employer_name TEXT,
  ADD COLUMN IF NOT EXISTS years_employed DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  
  -- Authorization & Signatures
  ADD COLUMN IF NOT EXISTS signature_data TEXT, -- Base64 encoded signature image
  ADD COLUMN IF NOT EXISTS signature_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  
  -- PDF Document
  ADD COLUMN IF NOT EXISTS pdf_url TEXT, -- URL to generated PDF
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Customer session tracking
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_source VARCHAR(50) DEFAULT 'customer_portal' -- 'customer_portal', 'dealer_portal', 'api'
;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_apps_customer_id ON credit_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_vehicle_id ON credit_applications(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_date_of_birth ON credit_applications(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_credit_apps_submitted_at ON credit_applications(submitted_at);
CREATE INDEX IF NOT EXISTS idx_credit_apps_application_source ON credit_applications(application_source);

-- Add comments for documentation
COMMENT ON COLUMN credit_applications.date_of_birth IS 'Customer date of birth';
COMMENT ON COLUMN credit_applications.street_address IS 'Customer street address';
COMMENT ON COLUMN credit_applications.vehicle_id IS 'Reference to the vehicle being financed (if applicable)';
COMMENT ON COLUMN credit_applications.vehicle_make IS 'Vehicle make (stored for historical reference)';
COMMENT ON COLUMN credit_applications.vehicle_model IS 'Vehicle model';
COMMENT ON COLUMN credit_applications.vehicle_year IS 'Vehicle year';
COMMENT ON COLUMN credit_applications.vehicle_purchase_price IS 'Vehicle purchase price';
COMMENT ON COLUMN credit_applications.requested_loan_amount IS 'Loan amount requested by customer';
COMMENT ON COLUMN credit_applications.requested_term_months IS 'Desired loan term in months';
COMMENT ON COLUMN credit_applications.estimated_monthly_payment IS 'Estimated monthly payment';
COMMENT ON COLUMN credit_applications.job_title IS 'Customer job title';
COMMENT ON COLUMN credit_applications.monthly_income IS 'Customer monthly income';
COMMENT ON COLUMN credit_applications.signature_data IS 'Base64 encoded signature image for electronic signature';
COMMENT ON COLUMN credit_applications.terms_accepted IS 'Whether customer accepted terms and conditions';
COMMENT ON COLUMN credit_applications.ip_address IS 'IP address from which application was submitted';
COMMENT ON COLUMN credit_applications.pdf_url IS 'URL to generated PDF application';
COMMENT ON COLUMN credit_applications.customer_id IS 'Reference to customer account (for customer-submitted applications)';
COMMENT ON COLUMN credit_applications.application_source IS 'Source of application submission';

-- Create view for customer-facing applications (excluding encrypted sensitive data)
CREATE OR REPLACE VIEW customer_credit_applications AS
SELECT 
  id,
  dealer_id,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  date_of_birth,
  street_address,
  city,
  state,
  zip_code,
  vehicle_id,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  vehicle_mileage,
  vehicle_purchase_price,
  requested_loan_amount,
  requested_term_months,
  estimated_monthly_payment,
  estimated_interest_rate,
  job_title,
  employer_name,
  monthly_income,
  years_employed,
  employment_status,
  credit_score,
  application_status,
  signature_date,
  terms_accepted,
  terms_accepted_at,
  pdf_url,
  pdf_generated_at,
  submitted_at,
  reviewed_at,
  notes,
  created_at,
  updated_at,
  -- Mask sensitive data
  CASE WHEN ssn_encrypted IS NOT NULL THEN '***-**-****' ELSE NULL END as ssn_masked,
  CASE WHEN dl_number_encrypted IS NOT NULL THEN '********' ELSE NULL END as dl_masked
FROM credit_applications;

COMMENT ON VIEW customer_credit_applications IS 'Customer-safe view of credit applications with sensitive data masked';

-- Grant permissions (adjust based on your user setup)
-- GRANT SELECT ON customer_credit_applications TO customer_role;

-- Migration complete
SELECT 'Enhanced credit application schema migration completed successfully!' as message;
