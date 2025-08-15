-- Migration: Add unique constraint to daive_prompts table
-- This fixes the issue where prompts weren't updating due to missing unique constraint

-- First, remove any duplicate entries that might exist
DELETE FROM daive_prompts 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM daive_prompts 
    GROUP BY dealer_id, prompt_type
);

-- Add the unique constraint
ALTER TABLE daive_prompts 
ADD CONSTRAINT daive_prompts_dealer_id_prompt_type_unique 
UNIQUE (dealer_id, prompt_type);

-- Verify the constraint was added
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'daive_prompts' 
    AND tc.constraint_type = 'UNIQUE';
