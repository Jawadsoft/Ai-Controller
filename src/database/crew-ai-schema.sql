-- Crew AI Settings Table
-- This table stores configuration for Crew AI functionality per dealer

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_dealer_id ON crew_ai_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_enabled ON crew_ai_settings(enabled);

-- Insert default global settings
INSERT INTO crew_ai_settings (dealer_id, enabled, auto_routing, enable_sales_crew, enable_customer_service_crew, enable_inventory_crew, crew_collaboration, agent_memory, performance_tracking, fallback_to_traditional, crew_selection)
VALUES (NULL, false, true, true, true, false, true, true, true, true, 'auto')
ON CONFLICT (dealer_id) DO NOTHING;

-- Crew AI Performance Tracking Table
-- This table tracks how well different crews and agents perform

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

-- Create indexes for performance tracking
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_dealer_id ON crew_ai_performance(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_crew_type ON crew_ai_performance(crew_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_created_at ON crew_ai_performance(created_at);

-- Crew AI Agent Memory Table
-- This table stores context and memory for agents across conversations

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

-- Create indexes for agent memory
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_dealer_id ON crew_ai_agent_memory(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_agent_name ON crew_ai_agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_customer_id ON crew_ai_agent_memory(customer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_expires_at ON crew_ai_agent_memory(expires_at);

-- Crew AI Task Log Table
-- This table logs tasks performed by different crews and agents

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

-- Create indexes for task logging
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_dealer_id ON crew_ai_task_log(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_crew_type ON crew_ai_task_log(crew_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_task_type ON crew_ai_task_log(task_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_created_at ON crew_ai_task_log(created_at);

-- Add comments for documentation
COMMENT ON TABLE crew_ai_settings IS 'Configuration settings for Crew AI functionality per dealer';
COMMENT ON TABLE crew_ai_performance IS 'Performance metrics for Crew AI agents and crews';
COMMENT ON TABLE crew_ai_agent_memory IS 'Context and memory storage for Crew AI agents';
COMMENT ON TABLE crew_ai_task_log IS 'Log of tasks performed by Crew AI agents and crews'; 