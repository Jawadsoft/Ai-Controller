-- =====================================================
-- Update conversation_messages table to work with daive_conversations
-- =====================================================
-- This migration updates the conversation_messages table to support both
-- chat_conversations and daive_conversations tables

-- =====================================================
-- 1. UPDATE CONVERSATION_MESSAGES TABLE STRUCTURE
-- =====================================================

-- First, we need to make the conversation_id column more flexible
-- Since it currently references chat_conversations, we'll need to:
-- 1. Drop the foreign key constraint
-- 2. Update the column to be more generic
-- 3. Add a new column to specify the conversation type

-- Drop the existing foreign key constraint
ALTER TABLE conversation_messages 
DROP CONSTRAINT IF EXISTS conversation_messages_conversation_id_fkey;

-- Add a new column to specify conversation type
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) DEFAULT 'chat' 
CHECK (conversation_type IN ('chat', 'daive'));

-- Add a new column to specify the table the conversation_id references
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS conversation_table VARCHAR(20) DEFAULT 'chat_conversations' 
CHECK (conversation_table IN ('chat_conversations', 'daive_conversations'));

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Create index on conversation_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_conversation_messages_type 
ON conversation_messages(conversation_type);

-- Create index on conversation_table for faster filtering
CREATE INDEX IF NOT EXISTS idx_conversation_messages_table 
ON conversation_messages(conversation_table);

-- Create composite index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversation_messages_lookup 
ON conversation_messages(conversation_id, conversation_type, conversation_table);

-- =====================================================
-- 3. UPDATE EXISTING RECORDS
-- =====================================================

-- Update existing records to have the correct conversation type and table
UPDATE conversation_messages 
SET 
  conversation_type = 'chat',
  conversation_table = 'chat_conversations'
WHERE conversation_type IS NULL OR conversation_table IS NULL;

-- =====================================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN conversation_messages.conversation_id IS 'References either chat_conversations.id or daive_conversations.id based on conversation_table';
COMMENT ON COLUMN conversation_messages.conversation_type IS 'Type of conversation: chat (legacy) or daive (AI)';
COMMENT ON COLUMN conversation_messages.conversation_table IS 'Table that conversation_id references: chat_conversations or daive_conversations';

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'conversation_messages' 
ORDER BY ordinal_position;

-- Check existing records
SELECT 
  conversation_type,
  conversation_table,
  COUNT(*) as record_count
FROM conversation_messages 
GROUP BY conversation_type, conversation_table;
