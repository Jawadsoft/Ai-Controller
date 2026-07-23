-- =====================================================
-- DAIVE FOLLOW-UP AUTOMATION SYSTEM
-- Database Schema Migration
-- Created: November 26, 2025
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SYSTEM SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS followup_system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  
  -- Global ON/OFF
  system_enabled BOOLEAN DEFAULT false, -- STARTS DISABLED FOR SAFETY
  
  -- Channel Toggles
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  messenger_enabled BOOLEAN DEFAULT false,
  push_notification_enabled BOOLEAN DEFAULT false,
  
  -- Auto-Enrollment Settings
  auto_enrollment_enabled BOOLEAN DEFAULT true,
  auto_enrollment_categories JSONB DEFAULT '["lead_nurture"]'::jsonb,
  
  -- Timing Settings
  respect_quiet_hours BOOLEAN DEFAULT true,
  quiet_hours_start TIME DEFAULT '21:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  
  -- Rate Limiting (User-Friendly defaults)
  max_messages_per_day INTEGER DEFAULT 5,
  min_delay_between_messages_hours INTEGER DEFAULT 4,
  
  -- Opt-Out Handling
  auto_opt_out_keywords JSONB DEFAULT '["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "END"]'::jsonb,
  include_opt_out_link BOOLEAN DEFAULT true,
  
  -- Engagement Thresholds
  min_engagement_score INTEGER DEFAULT 30,
  pause_on_low_engagement BOOLEAN DEFAULT true,
  
  -- Credentials (use .env by default)
  email_use_env BOOLEAN DEFAULT true,
  sms_use_env BOOLEAN DEFAULT true,
  
  -- Metadata
  last_modified_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(dealer_id)
);

-- Default system-wide settings (for new dealers)
INSERT INTO followup_system_settings (dealer_id, system_enabled) 
VALUES (NULL, false) 
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. CUSTOMER LIFECYCLE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_lifecycle_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  
  -- Lifecycle Stage
  current_stage VARCHAR(50) NOT NULL CHECK (current_stage IN (
    'new_lead', 'warm_lead', 'hot_lead', 'cold_lead',
    'visited_no_purchase', 'purchased', 'service_customer',
    'at_risk', 'churned', 'loyal_customer'
  )),
  previous_stage VARCHAR(50),
  stage_entered_at TIMESTAMP DEFAULT NOW(),
  
  -- Engagement Tracking
  engagement_score INTEGER DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  last_interaction_at TIMESTAMP,
  interaction_count INTEGER DEFAULT 0,
  
  -- Customer History
  purchase_count INTEGER DEFAULT 0,
  service_visits INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0.00,
  
  -- Additional Data
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(lead_id)
);

-- =====================================================
-- 3. FOLLOW-UP RULE TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS followup_rule_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  
  -- Template Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'lead_nurture', 'unsold_visit', 'post_purchase', 
    'service_customer', 'at_risk', 'churn_prevention', 
    'long_term_loyalty'
  )),
  
  -- Trigger Conditions (JSON)
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 4. FOLLOW-UP STEPS
-- =====================================================

CREATE TABLE IF NOT EXISTS followup_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_template_id UUID REFERENCES followup_rule_templates(id) ON DELETE CASCADE,
  
  -- Step Order
  step_order INTEGER NOT NULL,
  step_name VARCHAR(255),
  
  -- Timing
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  
  -- Channel
  channel VARCHAR(50) NOT NULL CHECK (channel IN (
    'sms', 'email', 'whatsapp', 'messenger', 'phone_call', 'push_notification'
  )),
  
  -- Message Content
  message_template TEXT NOT NULL,
  subject_template TEXT, -- For email
  
  -- Call-to-Action
  include_cta BOOLEAN DEFAULT true,
  cta_text VARCHAR(255),
  cta_url VARCHAR(500),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (rule_template_id, step_order)
);

-- =====================================================
-- 5. FOLLOW-UP ENROLLMENTS (Active Sequences)
-- =====================================================

CREATE TABLE IF NOT EXISTS followup_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lifecycle_stage_id UUID REFERENCES customer_lifecycle_stages(id) ON DELETE CASCADE,
  rule_template_id UUID REFERENCES followup_rule_templates(id) ON DELETE CASCADE,
  
  -- Progress Tracking
  current_step_order INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'completed', 'cancelled', 'opted_out'
  )),
  
  -- Scheduling
  last_sent_at TIMESTAMP,
  next_run_at TIMESTAMP,
  
  -- Source
  enrollment_source VARCHAR(50) DEFAULT 'automatic', -- 'automatic', 'manual', 'daive_conversation'
  enrolled_by UUID REFERENCES users(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(lead_id, rule_template_id)
);

-- =====================================================
-- 6. EXECUTION LOG (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS followup_execution_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES followup_enrollments(id) ON DELETE CASCADE,
  step_id UUID REFERENCES followup_steps(id),
  
  -- Message Details
  channel VARCHAR(50) NOT NULL,
  to_address VARCHAR(255), -- Email or phone
  message_content TEXT,
  subject_content TEXT,
  
  -- Delivery Status
  status VARCHAR(20) CHECK (status IN (
    'queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'replied'
  )),
  
  -- Provider Info
  provider_message_id VARCHAR(255),
  provider_status VARCHAR(100),
  error_message TEXT,
  
  -- Timestamps
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 7. OPT-OUTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS followup_opt_outs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Opt-Out Details
  channel VARCHAR(50), -- Which channel they opted out from
  opt_out_method VARCHAR(50), -- 'keyword', 'link', 'manual'
  opt_out_message TEXT,
  
  -- Can re-opt-in later
  opted_back_in BOOLEAN DEFAULT false,
  opted_back_in_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(lead_id, channel)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Settings
CREATE INDEX IF NOT EXISTS idx_followup_settings_dealer ON followup_system_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_followup_settings_enabled ON followup_system_settings(system_enabled);

-- Lifecycle Stages
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_lead_id ON customer_lifecycle_stages(lead_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_current_stage ON customer_lifecycle_stages(current_stage);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_engagement_score ON customer_lifecycle_stages(engagement_score);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_email ON customer_lifecycle_stages(customer_email);

-- Rule Templates
CREATE INDEX IF NOT EXISTS idx_followup_templates_dealer ON followup_rule_templates(dealer_id);
CREATE INDEX IF NOT EXISTS idx_followup_templates_category ON followup_rule_templates(category);
CREATE INDEX IF NOT EXISTS idx_followup_templates_active ON followup_rule_templates(is_active);

-- Steps
CREATE INDEX IF NOT EXISTS idx_followup_steps_template ON followup_steps(rule_template_id);
CREATE INDEX IF NOT EXISTS idx_followup_steps_order ON followup_steps(step_order);

-- Enrollments (CRITICAL FOR PERFORMANCE)
CREATE INDEX IF NOT EXISTS idx_followup_enrollments_lead ON followup_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_enrollments_status ON followup_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_followup_enrollments_next_run ON followup_enrollments(next_run_at) 
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_followup_enrollments_template ON followup_enrollments(rule_template_id);

-- Execution Log
CREATE INDEX IF NOT EXISTS idx_execution_log_enrollment ON followup_execution_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_status ON followup_execution_log(status);
CREATE INDEX IF NOT EXISTS idx_execution_log_sent_at ON followup_execution_log(sent_at);

-- Opt-Outs
CREATE INDEX IF NOT EXISTS idx_opt_outs_lead ON followup_opt_outs(lead_id);
CREATE INDEX IF NOT EXISTS idx_opt_outs_channel ON followup_opt_outs(channel);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_followup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_followup_settings_updated_at 
  BEFORE UPDATE ON followup_system_settings
  FOR EACH ROW EXECUTE FUNCTION update_followup_updated_at();

CREATE TRIGGER update_lifecycle_stages_updated_at 
  BEFORE UPDATE ON customer_lifecycle_stages
  FOR EACH ROW EXECUTE FUNCTION update_followup_updated_at();

CREATE TRIGGER update_rule_templates_updated_at 
  BEFORE UPDATE ON followup_rule_templates
  FOR EACH ROW EXECUTE FUNCTION update_followup_updated_at();

CREATE TRIGGER update_followup_steps_updated_at 
  BEFORE UPDATE ON followup_steps
  FOR EACH ROW EXECUTE FUNCTION update_followup_updated_at();

CREATE TRIGGER update_followup_enrollments_updated_at 
  BEFORE UPDATE ON followup_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_followup_updated_at();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ DAIVE Follow-Up System tables created successfully!';
  RAISE NOTICE '📊 Tables created:';
  RAISE NOTICE '   - followup_system_settings';
  RAISE NOTICE '   - customer_lifecycle_stages';
  RAISE NOTICE '   - followup_rule_templates';
  RAISE NOTICE '   - followup_steps';
  RAISE NOTICE '   - followup_enrollments';
  RAISE NOTICE '   - followup_execution_log';
  RAISE NOTICE '   - followup_opt_outs';
  RAISE NOTICE '🔒 System starts DISABLED by default for safety';
END $$;

