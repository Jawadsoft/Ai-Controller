-- =====================================================
-- PRODUCTION RESET SCRIPT FOR CHAT CONVERSATIONS & LEADS
-- =====================================================
-- ⚠️  WARNING: This script will DELETE ALL data from conversation and lead tables
-- ⚠️  Use only for production testing/cleanup
-- ⚠️  Make sure to backup important data before running

-- =====================================================
-- 1. MAIN CONVERSATION & LEAD TABLES
-- =====================================================

-- Reset D.A.I.V.E. Conversations (Main AI chat table)
TRUNCATE TABLE daive_conversations CASCADE;
ALTER SEQUENCE IF EXISTS daive_conversations_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. Voice Sessions
TRUNCATE TABLE daive_voice_sessions CASCADE;
ALTER SEQUENCE IF EXISTS daive_voice_sessions_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. User Interests
TRUNCATE TABLE daive_user_interests CASCADE;
ALTER SEQUENCE IF EXISTS daive_user_interests_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. Analytics
TRUNCATE TABLE daive_analytics CASCADE;
ALTER SEQUENCE IF EXISTS daive_analytics_id_seq RESTART WITH 1;

-- Reset D.A.I.V.E. API Settings (Optional - keeps dealer configurations)
-- TRUNCATE TABLE daive_api_settings CASCADE;

-- Reset D.A.I.V.E. Prompts (Optional - keeps dealer customizations)
-- TRUNCATE TABLE daive_prompts CASCADE;

-- Reset D.A.I.V.E. Scenario Flows (Optional - keeps dealer flows)
-- TRUNCATE TABLE daive_scenario_flows CASCADE;

-- =====================================================
-- 2. LEGACY CHAT TABLES
-- =====================================================

-- Reset Chat Conversations (Legacy chat system)
TRUNCATE TABLE chat_conversations CASCADE;
ALTER SEQUENCE IF EXISTS chat_conversations_id_seq RESTART WITH 1;

-- Reset Conversation Messages
TRUNCATE TABLE conversation_messages CASCADE;
ALTER SEQUENCE IF EXISTS conversation_messages_id_seq RESTART WITH 1;

-- Reset User Interests (Legacy)
TRUNCATE TABLE user_interests CASCADE;
ALTER SEQUENCE IF EXISTS user_interests_id_seq RESTART WITH 1;

-- =====================================================
-- 3. LEADS TABLES
-- =====================================================

-- Reset Main Leads Table
TRUNCATE TABLE leads CASCADE;
ALTER SEQUENCE IF EXISTS leads_id_seq RESTART WITH 1;

-- Reset Customer Leads (Alternative leads table)
TRUNCATE TABLE customer_leads CASCADE;
ALTER SEQUENCE IF EXISTS customer_leads_id_seq RESTART WITH 1;

-- =====================================================
-- 4. CREW AI TABLES (Optional)
-- =====================================================

-- Reset Crew AI Conversation Routing (Optional - keeps routing rules)
-- TRUNCATE TABLE crew_ai_conversation_routing CASCADE;

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- Verify all tables are empty
SELECT 
    'daive_conversations' as table_name, 
    COUNT(*) as record_count 
FROM daive_conversations
UNION ALL
SELECT 
    'daive_voice_sessions' as table_name, 
    COUNT(*) as record_count 
FROM daive_voice_sessions
UNION ALL
SELECT 
    'daive_user_interests' as table_name, 
    COUNT(*) as record_count 
FROM daive_user_interests
UNION ALL
SELECT 
    'daive_analytics' as table_name, 
    COUNT(*) as record_count 
FROM daive_analytics
UNION ALL
SELECT 
    'chat_conversations' as table_name, 
    COUNT(*) as record_count 
FROM chat_conversations
UNION ALL
SELECT 
    'conversation_messages' as table_name, 
    COUNT(*) as record_count 
FROM conversation_messages
UNION ALL
SELECT 
    'leads' as table_name, 
    COUNT(*) as record_count 
FROM leads
UNION ALL
SELECT 
    'customer_leads' as table_name, 
    COUNT(*) as record_count 
FROM customer_leads
ORDER BY table_name;

-- =====================================================
-- 6. RESET SUCCESS MESSAGE
-- =====================================================
SELECT '✅ Production reset completed successfully!' as status;
