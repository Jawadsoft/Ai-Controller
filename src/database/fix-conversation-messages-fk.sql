-- Fix conversation_messages foreign key to reference daive_conversations
-- This migration fixes the foreign key relationship issue

-- First, drop the existing foreign key constraint
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_conversation_id_fkey;

-- Update the foreign key to reference daive_conversations instead of chat_conversations
ALTER TABLE conversation_messages 
ADD CONSTRAINT conversation_messages_conversation_id_fkey 
FOREIGN KEY (conversation_id) REFERENCES daive_conversations(id) ON DELETE CASCADE;

-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

-- Add an index for role-based queries
CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON conversation_messages(role);

-- Add an index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);

COMMENT ON TABLE conversation_messages IS 'Individual messages within D.A.I.V.E. conversations - now properly linked to daive_conversations';
COMMENT ON COLUMN conversation_messages.conversation_id IS 'References daive_conversations.id (fixed from chat_conversations)';
