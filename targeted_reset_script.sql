-- =====================================================
-- TARGETED RESET SCRIPT FOR PRODUCTION TESTING
-- =====================================================
-- This script resets only the essential conversation and lead tables
-- while preserving dealer configurations and settings

-- =====================================================
-- 1. RESET CONVERSATION DATA ONLY
-- =====================================================

-- Reset D.A.I.V.E. Conversations (Main AI chat conversations)
DELETE FROM daive_conversations;
-- Reset auto-increment sequences
ALTER SEQUENCE IF EXISTS daive_conversations_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. Voice Sessions (Voice chat data)
DELETE FROM daive_voice_sessions;
ALTER SEQUENCE IF EXISTS daive_voice_sessions_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. User Interests (User interest tracking)
DELETE FROM daive_user_interests;
ALTER SEQUENCE IF EXISTS daive_user_interests_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. Analytics (Daily analytics data)
DELETE FROM daive_analytics;
ALTER SEQUENCE IF EXISTS daive_analytics_id_seq RESTART WITH 1;

-- =====================================================
-- 2. RESET LEGACY CHAT DATA
-- =====================================================

-- Reset Chat Conversations (Legacy chat system)
DELETE FROM chat_conversations;
ALTER SEQUENCE IF EXISTS chat_conversations_id_seq RESTART WITH 1;

-- Reset Conversation Messages (Individual chat messages)
DELETE FROM conversation_messages;
ALTER SEQUENCE IF EXISTS conversation_messages_id_seq RESTART WITH 1;

-- =====================================================
-- 3. RESET LEADS DATA
-- =====================================================

-- Reset Main Leads Table
DELETE FROM leads;
ALTER SEQUENCE IF EXISTS leads_id_seq RESTART WITH 1;

-- Reset Customer Leads (Alternative leads table)
DELETE FROM customer_leads;
ALTER SEQUENCE IF EXISTS customer_leads_id_seq RESTART WITH 1;

-- =====================================================
-- 4. VERIFICATION
-- =====================================================

-- Check record counts after reset
SELECT 
    'daive_conversations' as table_name, 
    COUNT(*) as remaining_records 
FROM daive_conversations
UNION ALL
SELECT 
    'daive_voice_sessions' as table_name, 
    COUNT(*) as remaining_records 
FROM daive_voice_sessions
UNION ALL
SELECT 
    'leads' as table_name, 
    COUNT(*) as remaining_records 
FROM leads
UNION ALL
SELECT 
    'chat_conversations' as table_name, 
    COUNT(*) as remaining_records 
FROM chat_conversations
ORDER BY table_name;

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================
SELECT '✅ Targeted reset completed - conversation and lead data cleared!' as status;
