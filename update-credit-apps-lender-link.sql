-- =====================================================
-- Update Credit Applications to Link with Lenders
-- =====================================================
-- Adds lender_id column to credit_applications table
-- This allows tracking which lender approved/processed the application

-- Add lender_id column to credit_applications
ALTER TABLE credit_applications
ADD COLUMN IF NOT EXISTS preferred_lender_id UUID REFERENCES lenders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_lender_id UUID REFERENCES lenders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lender_approval_date TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN credit_applications.preferred_lender_id IS 'Customer or dealer preferred lender for this application';
COMMENT ON COLUMN credit_applications.approved_lender_id IS 'Lender that approved the credit application';
COMMENT ON COLUMN credit_applications.lender_approval_date IS 'Date when lender approved the application';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_apps_preferred_lender ON credit_applications(preferred_lender_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_approved_lender ON credit_applications(approved_lender_id);

-- Update lender_submissions table to link with credit_applications
ALTER TABLE lender_submissions
ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES credit_applications(id) ON DELETE SET NULL;

COMMENT ON COLUMN lender_submissions.application_id IS 'Links submission to the credit application';

CREATE INDEX IF NOT EXISTS idx_submissions_application ON lender_submissions(application_id);

-- =====================================================
-- Function to auto-assign lender to deal when approved
-- =====================================================

CREATE OR REPLACE FUNCTION assign_lender_to_deal_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When a lender submission is approved, update the credit application
  IF NEW.submission_status = 'approved' AND OLD.submission_status != 'approved' THEN
    -- Update credit application with approved lender
    UPDATE credit_applications
    SET 
      approved_lender_id = NEW.lender_id,
      lender_approval_date = NOW(),
      application_status = 'approved'
    WHERE id = NEW.application_id;
    
    -- Update finance deal with approved lender
    UPDATE finance_deals
    SET approved_lender_id = NEW.lender_id
    WHERE application_id = NEW.application_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_assign_lender_on_approval ON lender_submissions;
CREATE TRIGGER trigger_assign_lender_on_approval
  AFTER UPDATE ON lender_submissions
  FOR EACH ROW
  EXECUTE FUNCTION assign_lender_to_deal_on_approval();

COMMENT ON FUNCTION assign_lender_to_deal_on_approval() IS 'Automatically assigns approved lender to credit application and deal';

-- =====================================================
-- END OF UPDATE
-- =====================================================

