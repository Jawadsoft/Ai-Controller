-- =====================================================
-- SUPER ADMIN CORE MIGRATION (PRODUCTION READY)
-- =====================================================
-- This migration includes the ESSENTIAL Super Admin functionality
-- Focuses on core features that are actually implemented and working
-- =====================================================

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. RBAC AND TENANCY + SOFTWARE LEADS SCHEMA
-- =====================================================

-- Integration settings table (supports global or tenant-scoped provider settings)
CREATE TABLE IF NOT EXISTS integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant')),
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'twilio', 'daive', 'smtp', 'sendgrid')),
    key TEXT NOT NULL,
    secret TEXT,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, provider, key)
);

-- Software Leads (platform-level, not tied to a dealer)
CREATE TABLE IF NOT EXISTS software_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new', 'contacted', 'qualified', 'nurturing', 'won', 'lost'
    )),
    tags TEXT[] DEFAULT '{}',
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add dealer_admin to user_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dealer_admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'dealer_admin';
    END IF;
END $$;

-- =====================================================
-- 2. STRIPE SUBSCRIPTION SUPPORT
-- =====================================================

-- Add Stripe-related columns to dealers (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE dealers ADD COLUMN stripe_customer_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'stripe_subscription_id') THEN
        ALTER TABLE dealers ADD COLUMN stripe_subscription_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'stripe_price_id') THEN
        ALTER TABLE dealers ADD COLUMN stripe_price_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'subscription_current_period_end') THEN
        ALTER TABLE dealers ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dealers' AND column_name = 'cancel_at_period_end') THEN
        ALTER TABLE dealers ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- 3. MARKETING JOURNEYS AND AUTOMATION
-- =====================================================

-- Marketing Journeys
CREATE TABLE IF NOT EXISTS marketing_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Journey steps
CREATE TABLE IF NOT EXISTS marketing_journey_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES marketing_journeys(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  template_subject TEXT,
  template_body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (journey_id, step_order)
);

-- Lead enrollments
CREATE TABLE IF NOT EXISTS marketing_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES marketing_journeys(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  current_step_order INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, journey_id)
);

-- Sends audit
CREATE TABLE IF NOT EXISTS marketing_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES marketing_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES marketing_journey_steps(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  to_address TEXT,
  to_phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed')),
  error TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. ENHANCED LEAD MANAGEMENT (CORE FEATURES)
-- =====================================================

-- Add enhanced columns to existing software_leads table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_leads' AND column_name = 'assigned_to') THEN
        ALTER TABLE software_leads ADD COLUMN assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_leads' AND column_name = 'assignment_notes') THEN
        ALTER TABLE software_leads ADD COLUMN assignment_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_leads' AND column_name = 'lead_score') THEN
        ALTER TABLE software_leads ADD COLUMN lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_leads' AND column_name = 'qualification_status') THEN
        ALTER TABLE software_leads ADD COLUMN qualification_status TEXT DEFAULT 'unqualified' CHECK (qualification_status IN (
            'unqualified', 'qualified', 'highly_qualified', 'disqualified'
        ));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_leads' AND column_name = 'priority') THEN
        ALTER TABLE software_leads ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
    END IF;
END $$;

-- Workflow states table
CREATE TABLE IF NOT EXISTS lead_workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS lead_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tag assignments table
CREATE TABLE IF NOT EXISTS lead_tag_assignments (
    lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (lead_id, tag_id)
);

-- =====================================================
-- 5. COMPREHENSIVE AUDIT LOGGING
-- =====================================================

-- Audit logs table for comprehensive activity tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,
    tenant_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'login', 'logout', 'password_change', 'profile_update',
        'dealer_create', 'dealer_update', 'dealer_delete', 'dealer_suspend',
        'user_create', 'user_update', 'user_delete', 'user_role_change',
        'lead_create', 'lead_update', 'lead_delete', 'lead_assign', 'lead_import', 'lead_export',
        'lead_email_send', 'lead_sms_send', 'email_send', 'sms_send',
        'subscription_create', 'subscription_update', 'subscription_cancel',
        'settings_update', 'integration_test', 'integration_configure',
        'journey_create', 'journey_update', 'journey_delete', 'journey_enroll',
        'bulk_operation', 'data_export', 'data_import',
        'system_config', 'security_event', 'error_event'
    )),
    resource_type TEXT,
    resource_id UUID,
    resource_name TEXT,
    description TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. DEFAULT DATA INSERTION
-- =====================================================

-- Seed placeholders for global providers
INSERT INTO integration_settings (tenant_id, scope, provider, key, secret, config, is_active)
VALUES
    (NULL, 'global', 'stripe', 'mode', NULL, '{"test": true}', false),
    (NULL, 'global', 'twilio', 'messaging_service_sid', NULL, '{}', false),
    (NULL, 'global', 'daive', 'base_url', NULL, '{}', false),
    (NULL, 'global', 'smtp', 'host', NULL, '{}', false)
ON CONFLICT (tenant_id, provider, key) DO NOTHING;

-- Insert default workflow states
INSERT INTO lead_workflow_states (name, description, sort_order) VALUES
('New', 'Newly created lead', 1),
('Contacted', 'Initial contact made', 2),
('Qualified', 'Lead has been qualified', 3),
('Demo Scheduled', 'Product demo scheduled', 4),
('Proposal Sent', 'Proposal has been sent', 5),
('Negotiation', 'In negotiation phase', 6),
('Closed Won', 'Successfully converted', 7),
('Closed Lost', 'Lead did not convert', 8)
ON CONFLICT (name) DO NOTHING;

-- Insert default tags
INSERT INTO lead_tags (name, color, description) VALUES
('Hot Lead', '#EF4444', 'High priority lead'),
('Cold Lead', '#6B7280', 'Low priority lead'),
('Enterprise', '#8B5CF6', 'Enterprise customer'),
('SMB', '#10B981', 'Small to medium business'),
('Trial User', '#F59E0B', 'Currently in trial'),
('Competitor', '#DC2626', 'Mentioned competitor'),
('Referral', '#059669', 'Came from referral'),
('Marketing Qualified', '#3B82F6', 'MQL from marketing'),
('Sales Qualified', '#7C3AED', 'SQL from sales team')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 7. PERFORMANCE INDEXES (SAFE ONES ONLY)
-- =====================================================

-- Basic indexes for core tables
CREATE INDEX IF NOT EXISTS idx_integration_settings_tenant_id ON integration_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_settings_provider ON integration_settings(provider);
CREATE INDEX IF NOT EXISTS idx_software_leads_status ON software_leads(status);
CREATE INDEX IF NOT EXISTS idx_software_leads_email ON software_leads(email);
CREATE INDEX IF NOT EXISTS idx_marketing_enrollments_next_run ON marketing_enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketing_sends_enrollment ON marketing_sends(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================
-- 8. AUDIT LOGGING FUNCTIONS
-- =====================================================

-- Function to categorize audit logs automatically
CREATE OR REPLACE FUNCTION categorize_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-assign category based on action_type
    CASE NEW.action_type
        WHEN 'login', 'logout', 'password_change' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "Authentication"}'::jsonb;
        WHEN 'user_create', 'user_update', 'user_delete', 'user_role_change' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "User Management"}'::jsonb;
        WHEN 'dealer_create', 'dealer_update', 'dealer_delete', 'dealer_suspend' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "Dealer Management"}'::jsonb;
        WHEN 'lead_create', 'lead_update', 'lead_delete', 'lead_assign', 'lead_import', 'lead_export', 'lead_email_send', 'lead_sms_send', 'email_send', 'sms_send' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "Lead Management"}'::jsonb;
        WHEN 'subscription_create', 'subscription_update', 'subscription_cancel' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "Subscription Management"}'::jsonb;
        WHEN 'settings_update', 'integration_test', 'integration_configure' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "System Configuration"}'::jsonb;
        WHEN 'bulk_operation', 'data_export', 'data_import' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "Data Operations"}'::jsonb;
        WHEN 'security_event', 'error_event' THEN
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "Security Events"}'::jsonb;
        ELSE
            NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || '{"category": "System Configuration"}'::jsonb;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic categorization
DROP TRIGGER IF EXISTS trigger_categorize_audit_log ON audit_logs;
CREATE TRIGGER trigger_categorize_audit_log
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION categorize_audit_log();

-- =====================================================
-- MIGRATION COMPLETION
-- =====================================================

SELECT 'Super Admin CORE migration completed successfully!' AS status;
