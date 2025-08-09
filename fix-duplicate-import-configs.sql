-- Fix duplicate import configurations
-- This script adds a unique constraint and cleans up existing duplicates

-- First, let's see if there are any duplicates
SELECT dealer_id, config_name, COUNT(*) as count
FROM import_configs 
GROUP BY dealer_id, config_name 
HAVING COUNT(*) > 1;

-- Remove duplicates, keeping the most recent one
DELETE FROM import_configs 
WHERE id NOT IN (
    SELECT MAX(id) 
    FROM import_configs 
    GROUP BY dealer_id, config_name
);

-- Add unique constraint
ALTER TABLE import_configs 
ADD CONSTRAINT unique_dealer_config_name UNIQUE (dealer_id, config_name);

-- Verify the constraint was added
SELECT 
    constraint_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'import_configs' 
AND constraint_name = 'unique_dealer_config_name'; 