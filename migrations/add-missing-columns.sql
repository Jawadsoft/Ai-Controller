-- ====================================================================
-- Database Migration: Add Missing Columns
-- Created: 2025-12-09
-- Purpose: Add missing columns to support DAIVE conversation features
-- ====================================================================

-- Run this migration to add all missing columns and avoid fallback logic

-- ====================================================================
-- 1. Add customer_id to daive_conversations
-- ====================================================================
DO $$ 
BEGIN
    -- Check if customer_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'daive_conversations' 
        AND column_name = 'customer_id'
    ) THEN
        -- Add customer_id column
        ALTER TABLE daive_conversations 
        ADD COLUMN customer_id UUID;
        
        RAISE NOTICE '✅ Added customer_id column to daive_conversations';
        
        -- Add foreign key constraint if customers table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
            ALTER TABLE daive_conversations 
            ADD CONSTRAINT fk_daive_conversations_customer 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
            
            RAISE NOTICE '✅ Added foreign key constraint for customer_id';
        END IF;
        
        -- Add index for better performance
        CREATE INDEX IF NOT EXISTS idx_daive_conversations_customer_id 
        ON daive_conversations(customer_id);
        
        RAISE NOTICE '✅ Added index on customer_id';
    ELSE
        RAISE NOTICE 'ℹ️  customer_id column already exists in daive_conversations';
    END IF;
END $$;

-- ====================================================================
-- 2. Add conversation_type to conversation_messages
-- ====================================================================
DO $$ 
BEGIN
    -- Check if conversation_type column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' 
        AND column_name = 'conversation_type'
    ) THEN
        -- Add conversation_type column with default value
        ALTER TABLE conversation_messages 
        ADD COLUMN conversation_type VARCHAR(50) DEFAULT 'daive';
        
        RAISE NOTICE '✅ Added conversation_type column to conversation_messages';
        
        -- Add index for filtering by type
        CREATE INDEX IF NOT EXISTS idx_conversation_messages_type 
        ON conversation_messages(conversation_type);
        
        RAISE NOTICE '✅ Added index on conversation_type';
    ELSE
        RAISE NOTICE 'ℹ️  conversation_type column already exists in conversation_messages';
    END IF;
END $$;

-- ====================================================================
-- 3. Add conversation_table to conversation_messages
-- ====================================================================
DO $$ 
BEGIN
    -- Check if conversation_table column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' 
        AND column_name = 'conversation_table'
    ) THEN
        -- Add conversation_table column with default value
        ALTER TABLE conversation_messages 
        ADD COLUMN conversation_table VARCHAR(100) DEFAULT 'daive_conversations';
        
        RAISE NOTICE '✅ Added conversation_table column to conversation_messages';
        
        -- Add index for filtering by table
        CREATE INDEX IF NOT EXISTS idx_conversation_messages_table 
        ON conversation_messages(conversation_table);
        
        RAISE NOTICE '✅ Added index on conversation_table';
    ELSE
        RAISE NOTICE 'ℹ️  conversation_table column already exists in conversation_messages';
    END IF;
END $$;

-- ====================================================================
-- 4. Update existing records (optional)
-- ====================================================================
DO $$ 
BEGIN
    -- Update existing conversation_messages to have proper conversation_type
    UPDATE conversation_messages 
    SET conversation_type = 'daive'
    WHERE conversation_type IS NULL;
    
    -- Update existing conversation_messages to have proper conversation_table
    UPDATE conversation_messages 
    SET conversation_table = 'daive_conversations'
    WHERE conversation_table IS NULL;
    
    RAISE NOTICE '✅ Updated existing records with default values';
END $$;

-- ====================================================================
-- 5. Verify Migration
-- ====================================================================
DO $$ 
DECLARE
    customer_id_exists BOOLEAN;
    conversation_type_exists BOOLEAN;
    conversation_table_exists BOOLEAN;
BEGIN
    -- Check all columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daive_conversations' AND column_name = 'customer_id'
    ) INTO customer_id_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'conversation_type'
    ) INTO conversation_type_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'conversation_table'
    ) INTO conversation_table_exists;
    
    -- Print verification results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    
    IF customer_id_exists THEN
        RAISE NOTICE '✅ daive_conversations.customer_id: EXISTS';
    ELSE
        RAISE NOTICE '❌ daive_conversations.customer_id: MISSING';
    END IF;
    
    IF conversation_type_exists THEN
        RAISE NOTICE '✅ conversation_messages.conversation_type: EXISTS';
    ELSE
        RAISE NOTICE '❌ conversation_messages.conversation_type: MISSING';
    END IF;
    
    IF conversation_table_exists THEN
        RAISE NOTICE '✅ conversation_messages.conversation_table: EXISTS';
    ELSE
        RAISE NOTICE '❌ conversation_messages.conversation_table: MISSING';
    END IF;
    
    RAISE NOTICE '========================================';
    
    IF customer_id_exists AND conversation_type_exists AND conversation_table_exists THEN
        RAISE NOTICE '✅ ALL COLUMNS SUCCESSFULLY ADDED!';
    ELSE
        RAISE NOTICE '⚠️  SOME COLUMNS ARE STILL MISSING';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ====================================================================
-- Migration Complete
-- ====================================================================
-- After running this migration:
-- 1. Restart your Node.js server
-- 2. The fallback logic will no longer be needed
-- 3. All database operations will work at full speed
-- ====================================================================

