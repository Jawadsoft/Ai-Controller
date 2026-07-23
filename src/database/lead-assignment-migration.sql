-- Lead Assignment Migration
-- Adds assignment functionality to leads table

-- Add assigned_to field to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES dealership_staff(id) ON DELETE SET NULL;

-- Add assignment tracking fields
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for better performance on assignment queries
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_by ON leads(assigned_by);

-- Add comments for documentation
COMMENT ON COLUMN leads.assigned_to IS 'Sales agent assigned to this lead';
COMMENT ON COLUMN leads.assigned_at IS 'When the lead was assigned';
COMMENT ON COLUMN leads.assigned_by IS 'Who assigned the lead (admin user)';

-- Update existing leads to have NULL assignment (unassigned)
UPDATE leads SET assigned_to = NULL, assigned_at = NULL, assigned_by = NULL WHERE assigned_to IS NULL;
