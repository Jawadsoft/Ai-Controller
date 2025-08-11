-- Fix missing tables for Crew AI integration

-- Create voice_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS voice_settings (
  id SERIAL PRIMARY KEY,
  dealer_id UUID, -- NULL for global settings, UUID for dealer-specific settings
  enabled BOOLEAN DEFAULT true,
  language VARCHAR(10) DEFAULT 'en-US',
  voice_speed DECIMAL(3,2) DEFAULT 1.0,
  voice_pitch DECIMAL(3,2) DEFAULT 1.0,
  voice_provider VARCHAR(50) DEFAULT 'openai',
  speech_provider VARCHAR(50) DEFAULT 'whisper',
  tts_provider VARCHAR(50) DEFAULT 'openai',
  openai_voice VARCHAR(50) DEFAULT 'alloy',
  elevenlabs_voice VARCHAR(50) DEFAULT 'jessica',
  auto_voice_response BOOLEAN DEFAULT true,
  voice_quality VARCHAR(20) DEFAULT 'standard',
  voice_emotion VARCHAR(20) DEFAULT 'friendly',
  recording_quality VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure only one global setting and one per dealer
  UNIQUE(dealer_id)
);

-- Create indexes for voice settings
CREATE INDEX IF NOT EXISTS idx_voice_settings_dealer_id ON voice_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_voice_settings_enabled ON voice_settings(enabled);

-- Insert default global voice settings
INSERT INTO voice_settings (dealer_id, enabled, language, voice_speed, voice_pitch, voice_provider, speech_provider, tts_provider, openai_voice, elevenlabs_voice, auto_voice_response, voice_quality, voice_emotion, recording_quality)
VALUES (NULL, true, 'en-US', 1.0, 1.0, 'openai', 'whisper', 'openai', 'alloy', 'jessica', true, 'standard', 'friendly', 'medium')
ON CONFLICT (dealer_id) DO NOTHING;

-- Create conversation_messages table if it doesn't exist (for Crew AI)
CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for conversation messages
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON conversation_messages(role);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);

-- Create crew_ai_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS crew_ai_settings (
  id SERIAL PRIMARY KEY,
  dealer_id UUID, -- NULL for global settings, UUID for dealer-specific settings
  enabled BOOLEAN DEFAULT false,
  auto_routing BOOLEAN DEFAULT true,
  enable_sales_crew BOOLEAN DEFAULT true,
  enable_customer_service_crew BOOLEAN DEFAULT true,
  enable_inventory_crew BOOLEAN DEFAULT false,
  crew_collaboration BOOLEAN DEFAULT true,
  agent_memory BOOLEAN DEFAULT true,
  performance_tracking BOOLEAN DEFAULT true,
  fallback_to_traditional BOOLEAN DEFAULT true,
  crew_selection VARCHAR(20) DEFAULT 'auto' CHECK (crew_selection IN ('auto', 'manual', 'hybrid')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure only one global setting and one per dealer
  UNIQUE(dealer_id)
);

-- Create indexes for crew AI settings
CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_dealer_id ON crew_ai_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_enabled ON crew_ai_settings(enabled);

-- Insert default global crew AI settings
INSERT INTO crew_ai_settings (dealer_id, enabled, auto_routing, enable_sales_crew, enable_customer_service_crew, enable_inventory_crew, crew_collaboration, agent_memory, performance_tracking, fallback_to_traditional, crew_selection)
VALUES (NULL, false, true, true, true, false, true, true, true, true, 'auto')
ON CONFLICT (dealer_id) DO NOTHING;

-- Create crew_ai_performance table if it doesn't exist
CREATE TABLE IF NOT EXISTS crew_ai_performance (
  id SERIAL PRIMARY KEY,
  dealer_id UUID,
  crew_type VARCHAR(50) NOT NULL, -- 'sales', 'customer_service', 'inventory'
  agent_name VARCHAR(100) NOT NULL,
  conversation_id UUID,
  customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
  response_time_ms INTEGER,
  success_rate BOOLEAN,
  handoff_needed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for crew AI performance
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_dealer_id ON crew_ai_performance(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_crew_type ON crew_ai_performance(crew_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_created_at ON crew_ai_performance(created_at);

-- Create crew_ai_agent_memory table if it doesn't exist
CREATE TABLE IF NOT EXISTS crew_ai_agent_memory (
  id SERIAL PRIMARY KEY,
  dealer_id UUID,
  agent_name VARCHAR(100) NOT NULL,
  customer_id VARCHAR(100), -- Could be session ID or actual customer ID
  context_key VARCHAR(200) NOT NULL,
  context_value TEXT,
  importance INTEGER DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for crew AI agent memory
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_dealer_id ON crew_ai_agent_memory(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_agent_name ON crew_ai_agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_customer_id ON crew_ai_agent_memory(customer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_expires_at ON crew_ai_agent_memory(expires_at);

-- Create crew_ai_task_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS crew_ai_task_log (
  id SERIAL PRIMARY KEY,
  dealer_id UUID,
  crew_type VARCHAR(50) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  task_type VARCHAR(100) NOT NULL, -- 'lead_qualification', 'vehicle_recommendation', 'financing_calculation', etc.
  task_description TEXT,
  input_data JSONB,
  output_data JSONB,
  execution_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for crew AI task log
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_dealer_id ON crew_ai_task_log(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_crew_type ON crew_ai_task_log(crew_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_task_type ON crew_ai_task_log(task_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_created_at ON crew_ai_task_log(created_at);

-- Add comments for documentation
COMMENT ON TABLE voice_settings IS 'Voice and TTS configuration settings per dealer';
COMMENT ON TABLE conversation_messages IS 'Chat conversation messages for Crew AI';
COMMENT ON TABLE crew_ai_settings IS 'Configuration settings for Crew AI functionality per dealer';
COMMENT ON TABLE crew_ai_performance IS 'Performance metrics for Crew AI agents and crews';
COMMENT ON TABLE crew_ai_agent_memory IS 'Context and memory storage for Crew AI agents';
COMMENT ON TABLE crew_ai_task_log IS 'Log of tasks performed by Crew AI agents and crews';

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('voice_settings', 'conversation_messages', 'crew_ai_settings', 'crew_ai_performance', 'crew_ai_agent_memory', 'crew_ai_task_log')
ORDER BY table_name; 