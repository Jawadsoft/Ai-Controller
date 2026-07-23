-- =====================================================
-- COMPREHENSIVE SUPER ADMIN DATABASE MIGRATION
-- =====================================================
-- This migration includes ALL Super Admin functionality implemented in this chat:
-- 1. RBAC and Tenancy with Software Leads
-- 2. Integration Settings (Stripe, Twilio, Daive, SMTP)
-- 3. Stripe Subscription Management
-- 4. Marketing Journeys and Automation
-- 5. Advanced Lead Management (Workflows, SLAs, Activities)
-- 6. Comprehensive Audit Logging
-- 7. Email/SMS Communication Tracking
-- =====================================================

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. RBAC AND TENANCY + SOFTWARE LEADS SCHEMA
-- =====================================================

-- Integration settings table (supports global or tenant-scoped provider settings)
CREATE TABLE IF NOT EXISTS integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES dealers(id) ON DELETE CASCADE, -- NULL => global scope
    scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant')),
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'twilio', 'daive', 'smtp', 'sendgrid')),
    key TEXT NOT NULL, -- e.g., 'publishable_key', 'secret_key', 'webhook_secret', etc.
    secret TEXT,       -- sensitive value; consider envelope encryption/KMS in production
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, provider, key)
);

-- Indexes for integration settings
CREATE INDEX IF NOT EXISTS idx_integration_settings_tenant_id ON integration_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_settings_provider ON integration_settings(provider);
CREATE INDEX IF NOT EXISTS idx_integration_settings_scope ON integration_settings(scope);

-- Software Leads (platform-level, not tied to a dealer)
CREATE TABLE IF NOT EXISTS software_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- expected to be super_admin
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,   -- assigned platform owner (optional)
    full_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT, -- e.g., 'website', 'referral', 'event', 'import'
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

-- Indexes for software leads
CREATE INDEX IF NOT EXISTS idx_software_leads_status ON software_leads(status);
CREATE INDEX IF NOT EXISTS idx_software_leads_owner_id ON software_leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_software_leads_email ON software_leads(email);

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

-- Add Stripe-related columns to dealers
ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Useful indexes for Stripe
CREATE INDEX IF NOT EXISTS idx_dealers_stripe_customer_id ON dealers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_dealers_stripe_subscription_id ON dealers(stripe_subscription_id);

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

-- Helpful indexes for marketing
CREATE INDEX IF NOT EXISTS idx_marketing_enrollments_next_run ON marketing_enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketing_sends_enrollment ON marketing_sends(enrollment_id);

-- =====================================================
-- 4. ADVANCED LEAD MANAGEMENT
-- =====================================================

-- Add enhanced columns to existing software_leads table
ALTER TABLE software_leads 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assignment_notes TEXT,
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'unqualified' CHECK (qualification_status IN (
    'unqualified', 'qualified', 'highly_qualified', 'disqualified'
)),
ADD COLUMN IF NOT EXISTS qualification_criteria JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_qualified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS source_details JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS urgency_reason TEXT;

-- Workflow states table
CREATE TABLE IF NOT EXISTS lead_workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow transitions table
CREATE TABLE IF NOT EXISTS lead_workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_state_id UUID REFERENCES lead_workflow_states(id) ON DELETE CASCADE,
    to_state_id UUID REFERENCES lead_workflow_states(id) ON DELETE CASCADE,
    trigger_action TEXT NOT NULL,
    is_automatic BOOLEAN DEFAULT FALSE,
    conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_state_id, to_state_id, trigger_action)
);

-- SLA tracking table
CREATE TABLE IF NOT EXISTS lead_slas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
    sla_type TEXT NOT NULL CHECK (sla_type IN ('first_contact', 'qualification', 'demo', 'proposal', 'close')),
    target_hours INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'breached', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity log table
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'created', 'assigned', 'unassigned', 'status_changed', 'contacted', 
        'qualified', 'demo_scheduled', 'proposal_sent', 'closed_won', 'closed_lost',
        'note_added', 'email_sent', 'sms_sent', 'call_made', 'meeting_scheduled'
    )),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follow-up scheduling table
CREATE TABLE IF NOT EXISTS lead_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    follow_up_type TEXT NOT NULL CHECK (follow_up_type IN (
        'call', 'email', 'meeting', 'demo', 'proposal', 'contract_review'
    )),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Conversions table
CREATE TABLE IF NOT EXISTS lead_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
    conversion_type TEXT NOT NULL CHECK (conversion_type IN (
        'trial_signup', 'demo_request', 'proposal_request', 'purchase', 'subscription'
    )),
    conversion_value DECIMAL(10,2),
    conversion_date TIMESTAMP WITH TIME ZONE NOT NULL,
    conversion_source TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    tenant_id UUID REFERENCES dealers(id) ON DELETE SET NULL, -- NULL for global actions
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
    resource_type TEXT, -- e.g., 'dealer', 'user', 'lead', 'subscription', 'settings'
    resource_id UUID, -- ID of the affected resource
    resource_name TEXT, -- Human-readable name of the resource
    description TEXT NOT NULL,
    old_values JSONB, -- Previous state (for updates)
    new_values JSONB, -- New state (for creates/updates)
    metadata JSONB DEFAULT '{}', -- Additional context (IP, user agent, etc.)
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit categories for organizing audit types
CREATE TABLE IF NOT EXISTS audit_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT 'activity',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit severity levels for prioritizing events
CREATE TABLE IF NOT EXISTS audit_severity_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL UNIQUE, -- 1=low, 2=medium, 3=high, 4=critical
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit reports for scheduled/on-demand reporting
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('activity_summary', 'security_audit', 'compliance_report', 'custom')),
    filters JSONB DEFAULT '{}', -- Date range, user filters, action filters, etc.
    schedule TEXT, -- 'daily', 'weekly', 'monthly', 'none' for on-demand
    last_generated_at TIMESTAMP WITH TIME ZONE,
    next_generation_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit report results for storing generated reports
CREATE TABLE IF NOT EXISTS audit_report_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES audit_reports(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    report_data JSONB NOT NULL,
    file_path TEXT,
    file_size_bytes INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit alerts for important events requiring attention
CREATE TABLE IF NOT EXISTS audit_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('security_breach', 'failed_login', 'privilege_escalation', 'data_export', 'bulk_delete', 'system_error')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    log_id UUID REFERENCES audit_logs(id) ON DELETE SET NULL,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit retention policies for data retention
CREATE TABLE IF NOT EXISTS audit_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    retention_days INTEGER NOT NULL,
    action_type_filter TEXT[], -- NULL means all action types
    severity_filter TEXT[], -- NULL means all severities
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. DEFAULT DATA INSERTION
-- =====================================================

-- Seed placeholders for global providers (optional, inactive by default)
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

-- Insert default workflow transitions
INSERT INTO lead_workflow_transitions (from_state_id, to_state_id, trigger_action, is_automatic) 
SELECT 
    fs.id as from_state_id,
    ts.id as to_state_id,
    transition.trigger_action,
    transition.is_automatic
FROM lead_workflow_states fs
CROSS JOIN lead_workflow_states ts
CROSS JOIN (VALUES 
    ('New', 'Contacted', 'contact', false),
    ('Contacted', 'Qualified', 'qualify', false),
    ('Qualified', 'Demo Scheduled', 'schedule_demo', false),
    ('Demo Scheduled', 'Proposal Sent', 'send_proposal', false),
    ('Proposal Sent', 'Negotiation', 'start_negotiation', false),
    ('Negotiation', 'Closed Won', 'close_won', false),
    ('Negotiation', 'Closed Lost', 'close_lost', false),
    ('New', 'Closed Lost', 'disqualify', false),
    ('Contacted', 'Closed Lost', 'disqualify', false),
    ('Qualified', 'Closed Lost', 'disqualify', false)
) AS transition(from_state, to_state, trigger_action, is_automatic)
WHERE fs.name = transition.from_state AND ts.name = transition.to_state
ON CONFLICT (from_state_id, to_state_id, trigger_action) DO NOTHING;

-- Insert default audit categories
INSERT INTO audit_categories (name, description, color, icon) VALUES
('Authentication', 'Login, logout, and password changes', '#EF4444', 'lock'),
('User Management', 'User creation, updates, and role changes', '#3B82F6', 'users'),
('Dealer Management', 'Dealer operations and management', '#10B981', 'building'),
('Lead Management', 'Lead operations and communications', '#8B5CF6', 'target'),
('Subscription Management', 'Billing and subscription operations', '#F59E0B', 'credit-card'),
('System Configuration', 'Settings and configuration changes', '#6B7280', 'settings'),
('Data Operations', 'Import, export, and bulk operations', '#059669', 'database'),
('Security Events', 'Security-related events and alerts', '#DC2626', 'shield')
ON CONFLICT (name) DO NOTHING;

-- Insert default severity levels
INSERT INTO audit_severity_levels (name, level, color, description) VALUES
('Low', 1, '#10B981', 'Informational events'),
('Medium', 2, '#F59E0B', 'Important events requiring attention'),
('High', 3, '#EF4444', 'Critical events requiring immediate action'),
('Critical', 4, '#DC2626', 'Emergency events requiring immediate response')
ON CONFLICT (name) DO NOTHING;

-- Insert default retention policies
INSERT INTO audit_retention_policies (name, description, retention_days, action_type_filter, severity_filter) VALUES
('General Retention', 'Default retention for all audit logs', 365, NULL, NULL),
('Security Events', 'Extended retention for security events', 2555, ARRAY['security_event', 'failed_login', 'privilege_escalation'], ARRAY['high', 'critical']),
('Data Operations', 'Retention for data export/import operations', 1095, ARRAY['data_export', 'data_import', 'bulk_operation'], NULL)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 7. AUDIT LOGGING FUNCTIONS AND TRIGGERS
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

-- Function to generate audit reports
CREATE OR REPLACE FUNCTION generate_audit_report(
    p_report_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_filters JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    report_data JSONB;
    total_events INTEGER;
    success_rate DECIMAL(5,2);
    top_actions JSONB;
    user_activity JSONB;
    error_summary JSONB;
BEGIN
    -- Get total events in date range
    SELECT COUNT(*) INTO total_events
    FROM audit_logs
    WHERE created_at BETWEEN p_start_date AND p_end_date;
    
    -- Calculate success rate
    SELECT ROUND(
        (COUNT(*) FILTER (WHERE success = TRUE)::DECIMAL / COUNT(*)) * 100, 2
    ) INTO success_rate
    FROM audit_logs
    WHERE created_at BETWEEN p_start_date AND p_end_date;
    
    -- Get top actions
    SELECT jsonb_agg(
        jsonb_build_object(
            'action_type', action_type,
            'count', count
        ) ORDER BY count DESC
    ) INTO top_actions
    FROM (
        SELECT action_type, COUNT(*) as count
        FROM audit_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY action_type
        ORDER BY count DESC
        LIMIT 10
    ) t;
    
    -- Get user activity summary
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_email', user_email,
            'event_count', count,
            'last_activity', last_activity
        ) ORDER BY count DESC
    ) INTO user_activity
    FROM (
        SELECT 
            user_email,
            COUNT(*) as count,
            MAX(created_at) as last_activity
        FROM audit_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
            AND user_email IS NOT NULL
        GROUP BY user_email
        ORDER BY count DESC
        LIMIT 20
    ) t;
    
    -- Get error summary
    SELECT jsonb_agg(
        jsonb_build_object(
            'error_message', error_message,
            'count', count,
            'last_occurrence', last_occurrence
        ) ORDER BY count DESC
    ) INTO error_summary
    FROM (
        SELECT 
            error_message,
            COUNT(*) as count,
            MAX(created_at) as last_occurrence
        FROM audit_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
            AND success = FALSE
            AND error_message IS NOT NULL
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 10
    ) t;
    
    -- Build report data
    report_data := jsonb_build_object(
        'report_id', p_report_id,
        'generated_at', NOW(),
        'date_range', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        ),
        'summary', jsonb_build_object(
            'total_events', total_events,
            'success_rate', success_rate,
            'top_actions', top_actions,
            'user_activity', user_activity,
            'error_summary', error_summary
        ),
        'filters', p_filters
    );
    
    -- Store report result
    INSERT INTO audit_report_results (report_id, report_data, generated_at)
    VALUES (p_report_id, report_data, NOW());
    
    RETURN report_data;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old audit logs based on retention policies
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    policy_record RECORD;
    policy_deleted_count INTEGER;
BEGIN
    -- Process each active retention policy
    FOR policy_record IN 
        SELECT * FROM audit_retention_policies 
        WHERE is_active = TRUE
    LOOP
        -- Delete logs older than retention period
        WITH deleted AS (
            DELETE FROM audit_logs
            WHERE created_at < (NOW() - INTERVAL '1 day' * policy_record.retention_days)
                AND (
                    policy_record.action_type_filter IS NULL 
                    OR action_type = ANY(policy_record.action_type_filter)
                )
                AND (
                    policy_record.severity_filter IS NULL 
                    OR metadata->>'severity' = ANY(policy_record.severity_filter)
                )
            RETURNING id
        )
        SELECT COUNT(*) INTO policy_deleted_count FROM deleted;
        
        deleted_count := deleted_count + policy_deleted_count;
        
        -- Log the cleanup action
        INSERT INTO audit_logs (
            action_type, 
            resource_type, 
            description, 
            metadata, 
            success
        ) VALUES (
            'system_config',
            'AuditRetentionPolicy',
            'Cleaned up ' || policy_deleted_count || ' audit logs using policy: ' || policy_record.name,
            jsonb_build_object(
                'policy_id', policy_record.id,
                'policy_name', policy_record.name,
                'retention_days', policy_record.retention_days,
                'deleted_count', policy_deleted_count
            ),
            TRUE
        );
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. PERFORMANCE INDEXES (After all tables and columns are created)
-- =====================================================

-- Software leads indexes (commented out until columns are confirmed to exist)
-- CREATE INDEX IF NOT EXISTS idx_software_leads_assigned_to ON software_leads(assigned_to);
-- CREATE INDEX IF NOT EXISTS idx_software_leads_priority ON software_leads(priority);
-- CREATE INDEX IF NOT EXISTS idx_software_leads_qualification_status ON software_leads(qualification_status);
-- CREATE INDEX IF NOT EXISTS idx_software_leads_lead_score ON software_leads(lead_score);

-- Lead management indexes (commented out until tables are confirmed to exist)
-- CREATE INDEX IF NOT EXISTS idx_lead_slas_lead_id ON lead_slas(lead_id);
-- CREATE INDEX IF NOT EXISTS idx_lead_slas_status ON lead_slas(status);
-- CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
-- CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at);
-- CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead_id ON lead_follow_ups(lead_id);
-- CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_scheduled_at ON lead_follow_ups(scheduled_at);
-- CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_assigned_to ON lead_follow_ups(assigned_to);
-- CREATE INDEX IF NOT EXISTS idx_lead_conversions_lead_id ON lead_conversions(lead_id);
-- CREATE INDEX IF NOT EXISTS idx_lead_conversions_conversion_date ON lead_conversions(conversion_date);

-- Audit logging indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);

-- Audit reports indexes
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_by ON audit_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_reports_next_generation ON audit_reports(next_generation_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON audit_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_is_resolved ON audit_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_created_at ON audit_alerts(created_at);

-- =====================================================
-- 9. ENHANCED AUDIT LOG VIEW
-- =====================================================

-- Create enhanced audit log view with user and tenant information
CREATE OR REPLACE VIEW audit_log_details AS
SELECT 
    al.id,
    al.user_id,
    al.user_email,
    al.user_role,
    al.tenant_id,
    d.business_name as tenant_name,
    al.action_type,
    al.resource_type,
    al.resource_id,
    al.resource_name,
    al.description,
    al.old_values,
    al.new_values,
    al.metadata,
    al.ip_address,
    al.user_agent,
    al.session_id,
    al.success,
    al.error_message,
    al.created_at,
    -- Extract category from metadata
    COALESCE(al.metadata->>'category', 'System Configuration') as category,
    -- Calculate severity based on action type and success
    CASE 
        WHEN al.action_type IN ('security_event', 'failed_login', 'privilege_escalation') THEN 'Critical'
        WHEN al.success = FALSE THEN 'High'
        WHEN al.action_type IN ('bulk_operation', 'data_export', 'data_import') THEN 'Medium'
        ELSE 'Low'
    END as severity
FROM audit_logs al
LEFT JOIN dealers d ON al.tenant_id = d.id;

-- =====================================================
-- 10. DOCUMENTATION COMMENTS
-- =====================================================

-- Table comments
COMMENT ON TABLE integration_settings IS 'Provider settings for Stripe/Twilio/Daive/SMTP; tenant_id NULL => global scope';
COMMENT ON COLUMN integration_settings.key IS 'Configuration key name (e.g., publishable_key, webhook_secret)';
COMMENT ON TABLE software_leads IS 'Platform-level leads managed by super admins, separate from dealer vehicle leads';
COMMENT ON TABLE marketing_journeys IS 'Automated marketing sequences for lead nurturing';
COMMENT ON TABLE marketing_journey_steps IS 'Individual steps within marketing journeys';
COMMENT ON TABLE marketing_enrollments IS 'Lead enrollments in marketing journeys';
COMMENT ON TABLE marketing_sends IS 'Audit trail of marketing communications sent';
COMMENT ON TABLE lead_workflow_states IS 'Defined states in the lead management workflow';
COMMENT ON TABLE lead_workflow_transitions IS 'Allowed transitions between workflow states';
COMMENT ON TABLE lead_slas IS 'Service Level Agreement tracking for lead processes';
COMMENT ON TABLE lead_activities IS 'Detailed activity log for lead interactions';
COMMENT ON TABLE lead_follow_ups IS 'Scheduled follow-up activities for leads';
COMMENT ON TABLE lead_tags IS 'Categorization tags for leads';
COMMENT ON TABLE lead_tag_assignments IS 'Many-to-many relationship between leads and tags';
COMMENT ON TABLE lead_conversions IS 'Conversion tracking for lead outcomes';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all Super Admin activities';
COMMENT ON TABLE audit_categories IS 'Categories for organizing audit log types';
COMMENT ON TABLE audit_severity_levels IS 'Severity levels for prioritizing audit events';
COMMENT ON TABLE audit_reports IS 'Scheduled and on-demand audit reports';
COMMENT ON TABLE audit_report_results IS 'Generated audit report data and files';
COMMENT ON TABLE audit_alerts IS 'Important audit events requiring attention';
COMMENT ON TABLE audit_retention_policies IS 'Data retention policies for audit logs';

-- Function comments
COMMENT ON FUNCTION categorize_audit_log IS 'Automatically categorizes audit logs based on action type';
COMMENT ON FUNCTION generate_audit_report IS 'Generates comprehensive audit reports with summaries and statistics';
COMMENT ON FUNCTION cleanup_audit_logs IS 'Cleans up old audit logs based on retention policies';
COMMENT ON VIEW audit_log_details IS 'Enhanced audit log view with user, tenant, and category information';

-- =====================================================
-- MIGRATION COMPLETION
-- =====================================================

SELECT 'Super Admin comprehensive migration completed successfully!' AS status;
