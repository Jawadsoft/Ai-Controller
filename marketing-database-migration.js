#!/usr/bin/env node

/**
 * Marketing Database Migration
 * 
 * This script creates all marketing-related database tables and structures
 * for the DealerIQ marketing automation system.
 * 
 * Tables created:
 * - marketing_journeys: Marketing campaign journeys
 * - marketing_journey_steps: Individual steps in each journey
 * - marketing_enrollments: Lead enrollments in journeys
 * - marketing_sends: Email/SMS send records
 * - marketing_email_events: Email tracking events
 * - lead_score_history: Lead score changes over time
 * - marketing_revenue_attribution: Revenue attribution to campaigns
 * - marketing_campaign_analytics: Daily campaign performance metrics
 * - marketing_template_analytics: Template performance metrics
 * - marketing_activity_feed: Real-time activity feed
 * - lead_workflow_states: Lead workflow states
 * - lead_tags: Lead tags
 * - lead_tag_assignments: Lead-tag relationships
 * - audit_logs: Comprehensive audit logging
 * 
 * Usage: node marketing-database-migration.js
 */

import { pool } from './src/database/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMarketingMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Marketing Database Migration...');
    console.log('=====================================');
    
    await client.query('BEGIN');
    
    // =====================================================
    // 1. MARKETING JOURNEYS AND AUTOMATION
    // =====================================================
    
    console.log('📧 Creating marketing journeys table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_journeys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('📝 Creating marketing journey steps table...');
    await client.query(`
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
    `);
    
    console.log('👥 Creating marketing enrollments table...');
    await client.query(`
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
    `);
    
    console.log('📤 Creating marketing sends table...');
    await client.query(`
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
    `);
    
    // =====================================================
    // 2. MARKETING ANALYTICS AND TRACKING
    // =====================================================
    
    console.log('📊 Creating marketing email events table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_email_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        send_id UUID NOT NULL REFERENCES marketing_sends(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'bounce', 'unsubscribe', 'delivered')),
        event_data JSONB DEFAULT '{}',
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('📈 Creating lead score history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_score_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
        old_score INTEGER NOT NULL,
        new_score INTEGER NOT NULL,
        change_reason TEXT,
        marketing_trigger_id UUID REFERENCES marketing_sends(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('💰 Creating marketing revenue attribution table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_revenue_attribution (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
        journey_id UUID NOT NULL REFERENCES marketing_journeys(id) ON DELETE CASCADE,
        revenue_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        attribution_type TEXT NOT NULL CHECK (attribution_type IN ('direct', 'assisted', 'influenced')),
        conversion_date TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('📊 Creating marketing campaign analytics table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_campaign_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journey_id UUID NOT NULL REFERENCES marketing_journeys(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        emails_sent INTEGER DEFAULT 0,
        emails_delivered INTEGER DEFAULT 0,
        emails_opened INTEGER DEFAULT 0,
        emails_clicked INTEGER DEFAULT 0,
        emails_bounced INTEGER DEFAULT 0,
        emails_unsubscribed INTEGER DEFAULT 0,
        unique_opens INTEGER DEFAULT 0,
        unique_clicks INTEGER DEFAULT 0,
        conversion_count INTEGER DEFAULT 0,
        revenue_attributed DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(journey_id, date)
      );
    `);
    
    console.log('📧 Creating marketing template analytics table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_template_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        step_id UUID NOT NULL REFERENCES marketing_journey_steps(id) ON DELETE CASCADE,
        template_subject TEXT,
        template_body TEXT,
        total_sends INTEGER DEFAULT 0,
        total_opens INTEGER DEFAULT 0,
        total_clicks INTEGER DEFAULT 0,
        open_rate DECIMAL(5,4) DEFAULT 0,
        click_rate DECIMAL(5,4) DEFAULT 0,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('🔄 Creating marketing activity feed table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_activity_feed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
        journey_id UUID NOT NULL REFERENCES marketing_journeys(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL CHECK (activity_type IN ('email_sent', 'email_opened', 'email_clicked', 'conversion', 'unsubscribe')),
        activity_data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    // =====================================================
    // 3. ENHANCED LEAD MANAGEMENT
    // =====================================================
    
    console.log('🏷️ Creating lead workflow states table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_workflow_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('🏷️ Creating lead tags table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#3B82F6',
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('🔗 Creating lead tag assignments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_tag_assignments (
        lead_id UUID NOT NULL REFERENCES software_leads(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        PRIMARY KEY (lead_id, tag_id)
      );
    `);
    
    // =====================================================
    // 4. COMPREHENSIVE AUDIT LOGGING
    // =====================================================
    
    console.log('📋 Creating audit logs table...');
    await client.query(`
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
    `);
    
    // =====================================================
    // 5. ENHANCE EXISTING TABLES
    // =====================================================
    
    console.log('🔧 Enhancing software_leads table...');
    await client.query(`
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
    `);
    
    console.log('🔧 Enhancing marketing_sends table...');
    await client.query(`
      ALTER TABLE marketing_sends 
      ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS tracking_pixel_id UUID DEFAULT gen_random_uuid();
    `);
    
    console.log('🔧 Enhancing marketing_journeys table...');
    await client.query(`
      ALTER TABLE marketing_journeys 
      ADD COLUMN IF NOT EXISTS total_sends INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_opens INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_conversions INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(10,2) DEFAULT 0;
    `);
    
    // =====================================================
    // 6. PERFORMANCE INDEXES
    // =====================================================
    
    console.log('📊 Creating performance indexes...');
    
    // Marketing core indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_enrollments_next_run ON marketing_enrollments(next_run_at) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_marketing_sends_enrollment ON marketing_sends(enrollment_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_sends_tracking_pixel_id ON marketing_sends(tracking_pixel_id);
    `);
    
    // Email events indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_email_events_send_id ON marketing_email_events(send_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_email_events_type ON marketing_email_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_marketing_email_events_created_at ON marketing_email_events(created_at);
    `);
    
    // Lead score history indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead_id ON lead_score_history(lead_id);
      CREATE INDEX IF NOT EXISTS idx_lead_score_history_created_at ON lead_score_history(created_at);
    `);
    
    // Revenue attribution indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_revenue_attribution_lead_id ON marketing_revenue_attribution(lead_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_revenue_attribution_journey_id ON marketing_revenue_attribution(journey_id);
    `);
    
    // Campaign analytics indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_campaign_analytics_journey_date ON marketing_campaign_analytics(journey_id, date);
    `);
    
    // Template analytics indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_template_analytics_step_id ON marketing_template_analytics(step_id);
    `);
    
    // Activity feed indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_activity_feed_lead_id ON marketing_activity_feed(lead_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_activity_feed_journey_id ON marketing_activity_feed(journey_id);
      CREATE INDEX IF NOT EXISTS idx_marketing_activity_feed_created_at ON marketing_activity_feed(created_at);
    `);
    
    // Audit logs indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);
    
    // =====================================================
    // 7. FUNCTIONS AND TRIGGERS
    // =====================================================
    
    console.log('⚙️ Creating analytics update function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_campaign_analytics()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update daily analytics when email events occur
        IF TG_TABLE_NAME = 'marketing_email_events' THEN
          INSERT INTO marketing_campaign_analytics (
            journey_id, 
            date, 
            emails_sent, 
            emails_delivered, 
            emails_opened, 
            emails_clicked,
            emails_bounced,
            emails_unsubscribed,
            unique_opens,
            unique_clicks
          )
          SELECT 
            j.id as journey_id,
            CURRENT_DATE as date,
            COUNT(CASE WHEN s.status = 'sent' THEN 1 END) as emails_sent,
            COUNT(CASE WHEN s.status = 'sent' THEN 1 END) as emails_delivered,
            COUNT(CASE WHEN e.event_type = 'open' THEN 1 END) as emails_opened,
            COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) as emails_clicked,
            COUNT(CASE WHEN e.event_type = 'bounce' THEN 1 END) as emails_bounced,
            COUNT(CASE WHEN e.event_type = 'unsubscribe' THEN 1 END) as emails_unsubscribed,
            COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN e.send_id END) as unique_opens,
            COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN e.send_id END) as unique_clicks
          FROM marketing_sends s
          JOIN marketing_enrollments en ON s.enrollment_id = en.id
          JOIN marketing_journeys j ON en.journey_id = j.id
          LEFT JOIN marketing_email_events e ON s.id = e.send_id
          WHERE s.created_at >= CURRENT_DATE
          GROUP BY j.id
          ON CONFLICT (journey_id, date) 
          DO UPDATE SET
            emails_sent = EXCLUDED.emails_sent,
            emails_delivered = EXCLUDED.emails_delivered,
            emails_opened = EXCLUDED.emails_opened,
            emails_clicked = EXCLUDED.emails_clicked,
            emails_bounced = EXCLUDED.emails_bounced,
            emails_unsubscribed = EXCLUDED.emails_unsubscribed,
            unique_opens = EXCLUDED.unique_opens,
            unique_clicks = EXCLUDED.unique_clicks,
            updated_at = NOW();
        END IF;
        
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('⚙️ Creating activity feed function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION add_to_activity_feed()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Add to activity feed when email events occur
        IF TG_TABLE_NAME = 'marketing_email_events' THEN
          INSERT INTO marketing_activity_feed (
            lead_id,
            journey_id,
            activity_type,
            activity_data
          )
          SELECT 
            en.lead_id,
            en.journey_id,
            CASE 
              WHEN NEW.event_type = 'open' THEN 'email_opened'
              WHEN NEW.event_type = 'click' THEN 'email_clicked'
              WHEN NEW.event_type = 'unsubscribe' THEN 'unsubscribe'
              ELSE 'email_sent'
            END,
            jsonb_build_object(
              'event_type', NEW.event_type,
              'send_id', NEW.send_id,
              'created_at', NEW.created_at
            )
          FROM marketing_sends s
          JOIN marketing_enrollments en ON s.enrollment_id = en.id
          WHERE s.id = NEW.send_id;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('⚙️ Creating audit log categorization function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION categorize_audit_log()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Categorize audit logs based on action type
        IF NEW.action_type IN ('login', 'logout', 'password_change', 'profile_update') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "authentication"}';
        ELSIF NEW.action_type IN ('dealer_create', 'dealer_update', 'dealer_delete', 'dealer_suspend') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "dealer_management"}';
        ELSIF NEW.action_type IN ('user_create', 'user_update', 'user_delete', 'user_role_change') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "user_management"}';
        ELSIF NEW.action_type IN ('lead_create', 'lead_update', 'lead_delete', 'lead_assign', 'lead_import', 'lead_export') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "lead_management"}';
        ELSIF NEW.action_type IN ('journey_create', 'journey_update', 'journey_delete', 'journey_enroll') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "marketing"}';
        ELSIF NEW.action_type IN ('email_send', 'sms_send', 'lead_email_send', 'lead_sms_send') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "communication"}';
        ELSIF NEW.action_type IN ('subscription_create', 'subscription_update', 'subscription_cancel') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "billing"}';
        ELSIF NEW.action_type IN ('settings_update', 'integration_test', 'integration_configure') THEN
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "configuration"}';
        ELSE
          NEW.metadata = COALESCE(NEW.metadata, '{}') || '{"category": "system"}';
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('⚙️ Creating triggers...');
    
    // Analytics update trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_update_campaign_analytics ON marketing_email_events;
      CREATE TRIGGER trigger_update_campaign_analytics
        AFTER INSERT ON marketing_email_events
        FOR EACH ROW
        EXECUTE FUNCTION update_campaign_analytics();
    `);
    
    // Activity feed trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_add_to_activity_feed ON marketing_email_events;
      CREATE TRIGGER trigger_add_to_activity_feed
        AFTER INSERT ON marketing_email_events
        FOR EACH ROW
        EXECUTE FUNCTION add_to_activity_feed();
    `);
    
    // Audit log categorization trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_categorize_audit_log ON audit_logs;
      CREATE TRIGGER trigger_categorize_audit_log
        BEFORE INSERT ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION categorize_audit_log();
    `);
    
    // =====================================================
    // 8. DEFAULT DATA INSERTION
    // =====================================================
    
    console.log('🌱 Inserting default data...');
    
    // Insert default workflow states
    await client.query(`
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
    `);
    
    // Insert default tags
    await client.query(`
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
    `);
    
    // =====================================================
    // 9. TABLE COMMENTS
    // =====================================================
    
    console.log('📝 Adding table comments...');
    
    await client.query(`
      COMMENT ON TABLE marketing_journeys IS 'Marketing campaign journeys for automated email sequences';
      COMMENT ON TABLE marketing_journey_steps IS 'Individual steps within marketing journeys';
      COMMENT ON TABLE marketing_enrollments IS 'Lead enrollments in marketing journeys';
      COMMENT ON TABLE marketing_sends IS 'Email/SMS send records and tracking';
      COMMENT ON TABLE marketing_email_events IS 'Tracks all email events (opens, clicks, bounces, etc.)';
      COMMENT ON TABLE lead_score_history IS 'Tracks changes in lead scores over time';
      COMMENT ON TABLE marketing_revenue_attribution IS 'Tracks revenue attributed to marketing campaigns';
      COMMENT ON TABLE marketing_campaign_analytics IS 'Daily summary of campaign performance metrics';
      COMMENT ON TABLE marketing_template_analytics IS 'Performance metrics for individual email templates';
      COMMENT ON TABLE marketing_activity_feed IS 'Real-time activity feed for marketing events';
      COMMENT ON TABLE lead_workflow_states IS 'Lead workflow states for pipeline management';
      COMMENT ON TABLE lead_tags IS 'Tags for categorizing leads';
      COMMENT ON TABLE lead_tag_assignments IS 'Many-to-many relationship between leads and tags';
      COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging for all system activities';
    `);
    
    await client.query('COMMIT');
    
    console.log('✅ Marketing Database Migration Completed Successfully!');
    console.log('=====================================');
    console.log('📊 Tables Created:');
    console.log('  • marketing_journeys');
    console.log('  • marketing_journey_steps');
    console.log('  • marketing_enrollments');
    console.log('  • marketing_sends');
    console.log('  • marketing_email_events');
    console.log('  • lead_score_history');
    console.log('  • marketing_revenue_attribution');
    console.log('  • marketing_campaign_analytics');
    console.log('  • marketing_template_analytics');
    console.log('  • marketing_activity_feed');
    console.log('  • lead_workflow_states');
    console.log('  • lead_tags');
    console.log('  • lead_tag_assignments');
    console.log('  • audit_logs');
    console.log('');
    console.log('🔧 Enhanced Tables:');
    console.log('  • software_leads (added lead management columns)');
    console.log('  • marketing_sends (added tracking columns)');
    console.log('  • marketing_journeys (added analytics columns)');
    console.log('');
    console.log('⚙️ Functions & Triggers:');
    console.log('  • update_campaign_analytics() - Auto-updates campaign metrics');
    console.log('  • add_to_activity_feed() - Auto-adds events to activity feed');
    console.log('  • categorize_audit_log() - Auto-categorizes audit logs');
    console.log('');
    console.log('🌱 Default Data:');
    console.log('  • 8 Lead workflow states');
    console.log('  • 9 Lead tags');
    console.log('');
    console.log('📊 Performance Indexes: Created for optimal query performance');
    console.log('');
    console.log('🎉 Your marketing automation system is ready to use!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
runMarketingMigration()
  .then(() => {
    console.log('🚀 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
