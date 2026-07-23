-- Add handoff-related columns to daive_conversations table
-- This script adds the necessary columns for the handoff functionality

-- Add handoff_reason column for storing the reason for handoff request
ALTER TABLE daive_conversations 
ADD COLUMN IF NOT EXISTS handoff_reason TEXT;

-- Add handoff_requested_at column for tracking when handoff was requested
ALTER TABLE daive_conversations 
ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMP;

-- Add handoff_accepted_at column for tracking when handoff was accepted
ALTER TABLE daive_conversations 
ADD COLUMN IF NOT EXISTS handoff_accepted_at TIMESTAMP;

-- Add handoff_accepted_by column for tracking who accepted the handoff
ALTER TABLE daive_conversations 
ADD COLUMN IF NOT EXISTS handoff_accepted_by UUID;

-- Add updated_at column if it doesn't exist (for tracking last modification)
ALTER TABLE daive_conversations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create index on handoff_requested for better query performance
CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_requested 
ON daive_conversations(handoff_requested);

-- Create index on handoff_requested_at for better query performance
CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_requested_at 
ON daive_conversations(handoff_requested_at);

-- Create index on handoff_accepted_at for better query performance
CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_accepted_at 
ON daive_conversations(handoff_accepted_at);

-- Update existing records to set updated_at to created_at if it's NULL
UPDATE daive_conversations 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Display the updated table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'daive_conversations' 
ORDER BY ordinal_position;



