-- =====================================================
-- Remove Staff Role CHECK Constraint
-- =====================================================
-- This migration removes the hardcoded CHECK constraint on staff_role
-- to allow custom roles created through the Role Management UI
-- =====================================================

-- Drop the existing CHECK constraint
ALTER TABLE dealership_staff 
DROP CONSTRAINT IF EXISTS dealership_staff_staff_role_check;

-- Add a new constraint that just ensures staff_role is not empty
ALTER TABLE dealership_staff 
ADD CONSTRAINT dealership_staff_staff_role_not_empty 
CHECK (staff_role IS NOT NULL AND length(trim(staff_role)) > 0);

-- Verify the change
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'dealership_staff'::regclass
AND conname LIKE '%staff_role%';

-- Show success message
SELECT 'Staff role constraint removed - custom roles are now supported' as status;

