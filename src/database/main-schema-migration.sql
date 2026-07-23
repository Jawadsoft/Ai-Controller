-- =====================================================
-- Main Database Schema Migration
-- =====================================================
-- This migration creates all the core tables for DealerIQ
-- Run this after the crew-ai-schema.sql migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

-- Subscription Plan Enum
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('basic', 'premium', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User Role Enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'dealer', 'client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 2. CORE TABLES
-- =====================================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dealers Table
CREATE TABLE IF NOT EXISTS dealers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    website TEXT,
    description TEXT,
    license_number TEXT,
    logo_url TEXT,
    established_year INTEGER,
    subscription_plan subscription_plan DEFAULT 'basic',
    subscription_status TEXT DEFAULT 'active',
    subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    managed_by_admin UUID,
    opening_hours JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add opening_hours to existing dealers table if column doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='dealers' AND column_name='opening_hours'
  ) THEN
    ALTER TABLE dealers ADD COLUMN opening_hours JSONB DEFAULT NULL;
  END IF;
END $$;

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vin TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    trim TEXT,
    color TEXT,
    mileage INTEGER,
    price NUMERIC(10,2),
    description TEXT,
    features TEXT[],
    images TEXT[],
    status TEXT DEFAULT 'available',
    qr_code_url TEXT,
    stock_number TEXT,
    body_style TEXT,
    certified BOOLEAN DEFAULT false,
    interior_color TEXT,
    engine_type TEXT,
    displacement TEXT,
    transmission TEXT,
    msrp NUMERIC(10,2),
    dealer_discount NUMERIC(10,2),
    consumer_rebate NUMERIC(10,2),
    dealer_accessories NUMERIC(10,2),
    total_customer_savings NUMERIC(10,2),
    total_dealer_rebate NUMERIC(10,2),
    other_price NUMERIC(10,2),
    photo_url_list TEXT[],
    odometer INTEGER,
    import_source TEXT DEFAULT 'manual',
    import_config_id INTEGER,
    import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    series TEXT,
    reference_dealer_id TEXT,
    new_used VARCHAR(10) DEFAULT 'used',
    vehicle_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    interest_level TEXT DEFAULT 'low',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'dealer' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name subscription_plan NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    monthly_price NUMERIC(10,2),
    yearly_price NUMERIC(10,2),
    max_vehicles INTEGER,
    max_leads INTEGER,
    features TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. DAIVE (AI CHAT) TABLES
-- =====================================================

-- DAIVE Conversations Table
CREATE TABLE IF NOT EXISTS daive_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    conversation_type TEXT DEFAULT 'text',
    messages JSONB DEFAULT '[]',
    ai_context JSONB DEFAULT '{}',
    lead_qualification_score INTEGER DEFAULT 0,
    lead_status TEXT DEFAULT 'new',
    handoff_requested BOOLEAN DEFAULT false,
    handoff_to_user_id UUID,
    handoff_reason TEXT,
    handoff_requested_at TIMESTAMP,
    handoff_accepted_at TIMESTAMP,
    handoff_accepted_by UUID,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DAIVE Prompts Table
CREATE TABLE IF NOT EXISTS daive_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    prompt_type TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, prompt_type)
);

-- DAIVE User Interests Table
CREATE TABLE IF NOT EXISTS daive_user_interests (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES daive_conversations(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    interest_type VARCHAR(50) NOT NULL,
    user_message TEXT NOT NULL,
    interest_level INTEGER DEFAULT 1 CHECK (interest_level >= 1 AND interest_level <= 5),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(conversation_id, vehicle_id, interest_type)
);

-- DAIVE Voice Sessions Table
CREATE TABLE IF NOT EXISTS daive_voice_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES daive_conversations(id) ON DELETE CASCADE,
    audio_file_url TEXT,
    transcription TEXT,
    ai_response TEXT,
    audio_response_url TEXT,
    processing_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DAIVE Analytics Table
CREATE TABLE IF NOT EXISTS daive_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_conversations INTEGER DEFAULT 0,
    total_voice_sessions INTEGER DEFAULT 0,
    total_leads_generated INTEGER DEFAULT 0,
    average_conversation_duration INTEGER DEFAULT 0,
    handoff_rate NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DAIVE API Settings Table
CREATE TABLE IF NOT EXISTS daive_api_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    setting_type TEXT NOT NULL,
    setting_value TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, setting_type)
);

-- =====================================================
-- 4. CHAT & CONVERSATION TABLES
-- =====================================================

-- Chat Conversations Table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Messages Table
CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Interests Table
CREATE TABLE IF NOT EXISTS user_interests (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    interest_type VARCHAR(100),
    interest_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 5. ETL & IMPORT/EXPORT TABLES
-- =====================================================

-- ETL Export Configs Table
CREATE TABLE IF NOT EXISTS etl_export_configs (
    id SERIAL PRIMARY KEY,
    dealer_id VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dealer_id, config_name)
);

-- ETL Connection Settings Table
CREATE TABLE IF NOT EXISTS etl_connection_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('ftp', 'sftp')),
    host_url VARCHAR(500) NOT NULL,
    port INTEGER DEFAULT 21,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    remote_directory VARCHAR(500) DEFAULT '/',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL Company Settings Table
CREATE TABLE IF NOT EXISTS etl_company_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_id VARCHAR(255),
    authorization_document_url VARCHAR(500),
    dealer_authorization_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL Dealer Authorizations Table
CREATE TABLE IF NOT EXISTS etl_dealer_authorizations (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    dealer_id VARCHAR(255) NOT NULL,
    authorized_by VARCHAR(255),
    authorization_date DATE,
    authorization_document_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL Export Filters Table
CREATE TABLE IF NOT EXISTS etl_export_filters (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    filter_field VARCHAR(255) NOT NULL,
    filter_operator VARCHAR(20) NOT NULL CHECK (filter_operator IN ('equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'between', 'in', 'not_in')),
    filter_value TEXT NOT NULL,
    filter_value2 TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL Field Mappings Table
CREATE TABLE IF NOT EXISTS etl_field_mappings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    source_field VARCHAR(255) NOT NULL,
    target_field VARCHAR(255) NOT NULL,
    field_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    transformation_rule TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL File Format Settings Table
CREATE TABLE IF NOT EXISTS etl_file_format_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'txt', 'xml', 'json')),
    delimiter VARCHAR(10) DEFAULT ',',
    multi_value_delimiter VARCHAR(10) DEFAULT '|',
    include_header BOOLEAN DEFAULT true,
    encoding VARCHAR(20) DEFAULT 'UTF-8',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL File Naming Settings Table
CREATE TABLE IF NOT EXISTS etl_file_naming_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    naming_pattern VARCHAR(255) NOT NULL,
    include_timestamp BOOLEAN DEFAULT true,
    timestamp_format VARCHAR(50) DEFAULT 'YYYYMMDD_HHMMSS',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL Schedule Settings Table
CREATE TABLE IF NOT EXISTS etl_schedule_settings (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
    time_hour INTEGER NOT NULL CHECK (time_hour >= 0 AND time_hour <= 23),
    time_minute INTEGER NOT NULL CHECK (time_minute >= 0 AND time_minute <= 59),
    day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITHOUT TIME ZONE,
    next_run TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL Export History Table
CREATE TABLE IF NOT EXISTS etl_export_history (
    id SERIAL PRIMARY KEY,
    export_config_id INTEGER REFERENCES etl_export_configs(id) ON DELETE CASCADE,
    export_status VARCHAR(50) NOT NULL CHECK (export_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    file_name VARCHAR(500),
    file_size BIGINT,
    records_exported INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. IMPORT TABLES
-- =====================================================

-- =====================================================
-- 7. CREW AI TABLES (Additional)
-- =====================================================

-- Crew AI Agents Table
CREATE TABLE IF NOT EXISTS crew_ai_agents (
    id SERIAL PRIMARY KEY,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    agent_role TEXT NOT NULL,
    agent_capabilities TEXT[],
    agent_priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, agent_type)
);

-- Crew AI Conversation Routing Table
CREATE TABLE IF NOT EXISTS crew_ai_conversation_routing (
    id SERIAL PRIMARY KEY,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    intent_pattern VARCHAR(200) NOT NULL,
    primary_agent VARCHAR(50) NOT NULL,
    secondary_agents VARCHAR(50)[],
    routing_rules TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Crew AI Workflows Table
CREATE TABLE IF NOT EXISTS crew_ai_workflows (
    id SERIAL PRIMARY KEY,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    workflow_name VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL,
    workflow_steps TEXT[] NOT NULL,
    agent_sequence VARCHAR(50)[],
    decision_points TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Crew AI Performance Table
CREATE TABLE IF NOT EXISTS crew_ai_performance (
    id SERIAL PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    crew_type VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    conversation_id UUID,
    customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
    response_time_ms INTEGER,
    success_rate BOOLEAN,
    handoff_needed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crew AI Agent Memory Table
CREATE TABLE IF NOT EXISTS crew_ai_agent_memory (
    id SERIAL PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100),
    context_key VARCHAR(200) NOT NULL,
    context_value TEXT,
    importance INTEGER DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crew AI Task Log Table
CREATE TABLE IF NOT EXISTS crew_ai_task_log (
    id SERIAL PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    crew_type VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    task_description TEXT,
    input_data JSONB,
    output_data JSONB,
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 8. ADDITIONAL BUSINESS TABLES
-- =====================================================

-- Dealer Prompts Table
CREATE TABLE IF NOT EXISTS dealer_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    prompt_type VARCHAR(100) NOT NULL,
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test Drives Table
CREATE TABLE IF NOT EXISTS test_drives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    test_drive_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Alerts Table
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    alert_message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dealer Settings Table
CREATE TABLE IF NOT EXISTS dealer_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, setting_key)
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Import Configs Table
CREATE TABLE IF NOT EXISTS import_configs (
    id SERIAL PRIMARY KEY,
    dealer_id VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dealer_id, config_name)
);

-- Link vehicles to the import config that owns them (multi-FTP inventory isolation)
DO $$ BEGIN
  ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_import_config_id_fkey
    FOREIGN KEY (import_config_id) REFERENCES import_configs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Import Connection Settings Table
CREATE TABLE IF NOT EXISTS import_connection_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('ftp', 'sftp')),
    host_url VARCHAR(500) NOT NULL,
    port INTEGER DEFAULT 21,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    remote_directory VARCHAR(500) DEFAULT '/',
    file_pattern VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import File Settings Table
CREATE TABLE IF NOT EXISTS import_file_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'xml', 'json')),
    delimiter VARCHAR(10) DEFAULT ',',
    has_header BOOLEAN DEFAULT true,
    encoding VARCHAR(20) DEFAULT 'UTF-8',
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import Field Mappings Table
CREATE TABLE IF NOT EXISTS import_field_mappings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    source_field VARCHAR(255) NOT NULL,
    target_field VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('string', 'number', 'date', 'boolean', 'json')),
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    transformation_rule TEXT,
    field_order INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import Processing Settings Table
CREATE TABLE IF NOT EXISTS import_processing_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    duplicate_handling VARCHAR(20) NOT NULL CHECK (duplicate_handling IN ('skip', 'update', 'replace')),
    batch_size INTEGER DEFAULT 1000,
    max_errors INTEGER DEFAULT 100,
    validate_data BOOLEAN DEFAULT true,
    archive_processed_files BOOLEAN DEFAULT true,
    archive_directory VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import Schedule Settings Table
CREATE TABLE IF NOT EXISTS import_schedule_settings (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('manual', 'hourly', 'daily', 'weekly', 'monthly')),
    time_hour INTEGER DEFAULT 0 CHECK (time_hour >= 0 AND time_hour <= 23),
    time_minute INTEGER DEFAULT 0 CHECK (time_minute >= 0 AND time_minute <= 59),
    day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITHOUT TIME ZONE,
    next_run TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import History Table
CREATE TABLE IF NOT EXISTS import_history (
    id SERIAL PRIMARY KEY,
    import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
    import_status VARCHAR(50) NOT NULL CHECK (import_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    file_name VARCHAR(500),
    file_size BIGINT,
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import Errors Table
CREATE TABLE IF NOT EXISTS import_errors (
    id SERIAL PRIMARY KEY,
    import_history_id INTEGER REFERENCES import_history(id) ON DELETE CASCADE,
    row_number INTEGER,
    field_name VARCHAR(255),
    error_message TEXT,
    raw_data TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. VOICE SETTINGS TABLE
-- =====================================================

-- Voice Settings Table
CREATE TABLE IF NOT EXISTS voice_settings (
    id SERIAL PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    language VARCHAR(10) DEFAULT 'en-US',
    voice_speed NUMERIC(3,2) DEFAULT 1.0,
    voice_pitch NUMERIC(3,2) DEFAULT 1.0,
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
    UNIQUE(dealer_id)
);

-- =====================================================
-- 10. VIEWS
-- =====================================================

-- Vehicle Export View
CREATE OR REPLACE VIEW vehicle_export_view AS
SELECT 
    v.id,
    v.dealer_id,
    v.vin,
    v.make,
    v.model,
    v.year,
    v.trim,
    v.color,
    v.mileage,
    v.price,
    v.description,
    v.features,
    v.images,
    v.status,
    v.qr_code_url,
    v.created_at,
    v.updated_at,
    v.stock_number,
    v.body_style,
    v.certified,
    v.interior_color,
    v.engine_type,
    v.displacement,
    v.transmission,
    v.msrp,
    v.dealer_discount,
    v.consumer_rebate,
    v.dealer_accessories,
    v.total_customer_savings,
    v.total_dealer_rebate,
    v.other_price,
    v.photo_url_list,
    v.odometer,
    v.import_source,
    v.import_date,
    v.series,
    v.reference_dealer_id,
    v.new_used,
    d.business_name AS dealer_name
FROM vehicles v
LEFT JOIN dealers d ON v.dealer_id = d.id;

-- =====================================================
-- 11. INDEXES
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- Dealers table indexes
CREATE INDEX IF NOT EXISTS idx_dealers_user_id ON dealers(user_id);

-- Vehicles table indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_dealer_id ON vehicles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicles_model ON vehicles(model);
CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_stock_number ON vehicles(stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_body_style ON vehicles(body_style);
CREATE INDEX IF NOT EXISTS idx_vehicles_certified ON vehicles(certified);
CREATE INDEX IF NOT EXISTS idx_vehicles_new_used ON vehicles(new_used);
CREATE INDEX IF NOT EXISTS idx_vehicles_import_source ON vehicles(import_source);
CREATE INDEX IF NOT EXISTS idx_vehicles_import_date ON vehicles(import_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_series ON vehicles(series);
CREATE INDEX IF NOT EXISTS idx_vehicles_reference_dealer_id ON vehicles(reference_dealer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_transmission ON vehicles(transmission);

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- User roles table indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- DAIVE table indexes
CREATE INDEX IF NOT EXISTS idx_daive_conversations_dealer_id ON daive_conversations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_vehicle_id ON daive_conversations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_session_id ON daive_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_requested ON daive_conversations(handoff_requested);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_requested_at ON daive_conversations(handoff_requested_at);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_accepted_at ON daive_conversations(handoff_accepted_at);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_lead_id ON daive_conversations(lead_id);

CREATE INDEX IF NOT EXISTS idx_daive_prompts_dealer_id ON daive_prompts(dealer_id);

CREATE INDEX IF NOT EXISTS idx_daive_user_interests_conversation ON daive_user_interests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_daive_user_interests_vehicle ON daive_user_interests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_daive_user_interests_interest_level ON daive_user_interests(interest_level DESC);

CREATE INDEX IF NOT EXISTS idx_daive_voice_sessions_conversation_id ON daive_voice_sessions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_daive_analytics_dealer_id ON daive_analytics(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_analytics_date ON daive_analytics(date);

CREATE INDEX IF NOT EXISTS idx_daive_api_settings_dealer_id ON daive_api_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_api_settings_setting_type ON daive_api_settings(setting_type);

-- Chat table indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_vehicle_id ON chat_conversations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id ON chat_conversations(session_id);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON conversation_messages(role);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_user_interests_session_id ON user_interests(session_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_vehicle_id ON user_interests(vehicle_id);

-- ETL table indexes
CREATE INDEX IF NOT EXISTS idx_etl_export_configs_dealer_id ON etl_export_configs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_etl_connection_settings_export_config_id ON etl_connection_settings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_export_filters_export_config_id ON etl_export_filters(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_field_mappings_export_config_id ON etl_field_mappings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_file_format_settings_export_config_id ON etl_file_format_settings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_file_naming_settings_export_config_id ON etl_file_naming_settings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_schedule_settings_export_config_id ON etl_schedule_settings(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_export_history_export_config_id ON etl_export_history(export_config_id);
CREATE INDEX IF NOT EXISTS idx_etl_export_history_status ON etl_export_history(export_status);
CREATE INDEX IF NOT EXISTS idx_etl_export_history_created_at ON etl_export_history(created_at);

-- Import table indexes
CREATE INDEX IF NOT EXISTS idx_import_configs_dealer_id ON import_configs(dealer_id);
CREATE INDEX IF NOT EXISTS idx_import_connection_settings_import_config_id ON import_connection_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_file_settings_import_config_id ON import_file_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_field_mappings_import_config_id ON import_field_mappings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_processing_settings_import_config_id ON import_processing_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_schedule_settings_import_config_id ON import_schedule_settings(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_history_import_config_id ON import_history(import_config_id);
CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history(import_status);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON import_history(created_at);

-- Voice settings table indexes
CREATE INDEX IF NOT EXISTS idx_voice_settings_dealer_id ON voice_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_voice_settings_enabled ON voice_settings(enabled);

-- Additional business table indexes
CREATE INDEX IF NOT EXISTS idx_dealer_prompts_dealer_id ON dealer_prompts(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_prompts_prompt_type ON dealer_prompts(prompt_type);

CREATE INDEX IF NOT EXISTS idx_test_drives_dealer_id ON test_drives(dealer_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_vehicle_id ON test_drives(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_test_drives_status ON test_drives(status);
CREATE INDEX IF NOT EXISTS idx_test_drives_test_drive_date ON test_drives(test_drive_date);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_dealer_id ON inventory_alerts(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_alert_type ON inventory_alerts(alert_type);

CREATE INDEX IF NOT EXISTS idx_dealer_settings_dealer_id ON dealer_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_settings_setting_key ON dealer_settings(setting_key);

CREATE INDEX IF NOT EXISTS idx_audit_log_dealer_id ON audit_log(dealer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Crew AI additional table indexes
CREATE INDEX IF NOT EXISTS idx_crew_ai_agents_dealer_id ON crew_ai_agents(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agents_agent_type ON crew_ai_agents(agent_type);

CREATE INDEX IF NOT EXISTS idx_crew_ai_conversation_routing_dealer_id ON crew_ai_conversation_routing(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_conversation_routing_intent_pattern ON crew_ai_conversation_routing(intent_pattern);

CREATE INDEX IF NOT EXISTS idx_crew_ai_workflows_dealer_id ON crew_ai_workflows(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_dealer_id ON crew_ai_performance(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_performance_agent_name ON crew_ai_performance(agent_name);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_dealer_id ON crew_ai_agent_memory(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_agent_name ON crew_ai_agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_crew_ai_agent_memory_customer_id ON crew_ai_agent_memory(customer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_dealer_id ON crew_ai_task_log(dealer_id);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_agent_name ON crew_ai_task_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_crew_ai_task_log_task_type ON crew_ai_task_log(task_type);
CREATE INDEX IF NOT EXISTS idx_crew_ai_workflows_workflow_type ON crew_ai_workflows(workflow_type);

-- =====================================================
-- 12. FUNCTIONS
-- =====================================================

-- Function to import vehicle from CSV
-- NOTE: Live function is managed by migrations/add-vehicle-import-config-id.sql
-- (includes inventory_status, import_config_id, import_source). Keep this stub aligned.
CREATE OR REPLACE FUNCTION import_vehicle_from_csv(
    p_dealer_id UUID,
    p_vin TEXT,
    p_make TEXT,
    p_model TEXT,
    p_series TEXT DEFAULT NULL,
    p_stock_number TEXT DEFAULT NULL,
    p_new_used TEXT DEFAULT 'used',
    p_body_style TEXT DEFAULT NULL,
    p_vehicle_type TEXT DEFAULT NULL,
    p_certified BOOLEAN DEFAULT false,
    p_color TEXT DEFAULT NULL,
    p_interior_color TEXT DEFAULT NULL,
    p_engine_type TEXT DEFAULT NULL,
    p_displacement TEXT DEFAULT NULL,
    p_features TEXT DEFAULT NULL,
    p_odometer INTEGER DEFAULT NULL,
    p_price NUMERIC DEFAULT NULL,
    p_other_price NUMERIC DEFAULT NULL,
    p_transmission TEXT DEFAULT NULL,
    p_msrp NUMERIC DEFAULT NULL,
    p_dealer_discount NUMERIC DEFAULT NULL,
    p_consumer_rebate NUMERIC DEFAULT NULL,
    p_dealer_accessories NUMERIC DEFAULT NULL,
    p_total_customer_savings NUMERIC DEFAULT NULL,
    p_total_dealer_rebate NUMERIC DEFAULT NULL,
    p_photo_url_list TEXT DEFAULT NULL,
    p_year INTEGER DEFAULT NULL,
    p_reference_dealer_id TEXT DEFAULT NULL,
    p_inventory_status TEXT DEFAULT 'available',
    p_import_config_id INTEGER DEFAULT NULL,
    p_import_source TEXT DEFAULT 'csv'
) RETURNS UUID AS $$
DECLARE
    v_vehicle_id UUID;
    v_photo_urls TEXT[];
    v_source TEXT;
BEGIN
    IF p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN
        v_photo_urls := string_to_array(
            trim(both '{}' from p_photo_url_list), 
            ','
        );
        SELECT array_agg(trim(url)) INTO v_photo_urls 
        FROM unnest(v_photo_urls) AS url 
        WHERE trim(url) != '';
    ELSE
        v_photo_urls := NULL;
    END IF;

    v_source := COALESCE(NULLIF(TRIM(p_import_source), ''), 'csv');

    SELECT id INTO v_vehicle_id 
    FROM vehicles 
    WHERE vin = p_vin AND dealer_id = p_dealer_id;

    IF v_vehicle_id IS NOT NULL THEN
        UPDATE vehicles SET
            make = COALESCE(p_make, make),
            model = COALESCE(p_model, model),
            series = COALESCE(p_series, series),
            stock_number = COALESCE(p_stock_number, stock_number),
            new_used = COALESCE(p_new_used, new_used),
            body_style = COALESCE(p_body_style, body_style),
            vehicle_type = COALESCE(p_vehicle_type, vehicle_type),
            certified = COALESCE(p_certified, certified),
            color = COALESCE(p_color, color),
            interior_color = COALESCE(p_interior_color, interior_color),
            engine_type = COALESCE(p_engine_type, engine_type),
            displacement = COALESCE(p_displacement, displacement),
            features = CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE features END,
            odometer = COALESCE(p_odometer, odometer),
            price = COALESCE(p_price, price),
            other_price = COALESCE(p_other_price, other_price),
            transmission = COALESCE(p_transmission, transmission),
            msrp = COALESCE(p_msrp, msrp),
            dealer_discount = COALESCE(p_dealer_discount, dealer_discount),
            consumer_rebate = COALESCE(p_consumer_rebate, consumer_rebate),
            dealer_accessories = COALESCE(p_dealer_accessories, dealer_accessories),
            total_customer_savings = COALESCE(p_total_customer_savings, total_customer_savings),
            total_dealer_rebate = COALESCE(p_total_dealer_rebate, total_dealer_rebate),
            photo_url_list = COALESCE(v_photo_urls, photo_url_list),
            year = COALESCE(p_year, year),
            reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),
            inventory_status = COALESCE(p_inventory_status, inventory_status),
            import_source = v_source,
            import_config_id = COALESCE(p_import_config_id, import_config_id),
            import_date = NOW(),
            updated_at = NOW()
        WHERE id = v_vehicle_id;
    ELSE
        INSERT INTO vehicles (
            dealer_id, vin, make, model, series, stock_number, new_used, body_style, vehicle_type, certified,
            color, interior_color, engine_type, displacement, features, odometer,
            price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
            dealer_accessories, total_customer_savings, total_dealer_rebate,
            photo_url_list, year, import_source, import_config_id, import_date, reference_dealer_id,
            inventory_status
        ) VALUES (
            p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_vehicle_type, p_certified,
            p_color, p_interior_color, p_engine_type, p_displacement, 
            CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE NULL END,
            p_odometer, p_price, p_other_price, p_transmission, p_msrp, p_dealer_discount,
            p_consumer_rebate, p_dealer_accessories, p_total_customer_savings, p_total_dealer_rebate,
            v_photo_urls, p_year, v_source, p_import_config_id, NOW(), p_reference_dealer_id,
            COALESCE(p_inventory_status, 'available')
        ) RETURNING id INTO v_vehicle_id;
    END IF;
    
    RETURN v_vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13. TRIGGERS
-- =====================================================

-- Update updated_at column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
-- Wrapped in DO blocks so re-running is safe on PostgreSQL < 17 (no IF NOT EXISTS for triggers)
DO $$ BEGIN
  CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_dealers_updated_at BEFORE UPDATE ON dealers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_daive_conversations_updated_at BEFORE UPDATE ON daive_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_daive_prompts_updated_at BEFORE UPDATE ON daive_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_daive_user_interests_updated_at BEFORE UPDATE ON daive_user_interests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_daive_voice_sessions_updated_at BEFORE UPDATE ON daive_voice_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_daive_analytics_updated_at BEFORE UPDATE ON daive_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_daive_api_settings_updated_at BEFORE UPDATE ON daive_api_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Additional table triggers
DO $$ BEGIN
  CREATE TRIGGER update_dealer_prompts_updated_at BEFORE UPDATE ON dealer_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_test_drives_updated_at BEFORE UPDATE ON test_drives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_inventory_alerts_updated_at BEFORE UPDATE ON inventory_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_dealer_settings_updated_at BEFORE UPDATE ON dealer_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_crew_ai_agents_updated_at BEFORE UPDATE ON crew_ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_crew_ai_conversation_routing_updated_at BEFORE UPDATE ON crew_ai_conversation_routing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_crew_ai_workflows_updated_at BEFORE UPDATE ON crew_ai_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_crew_ai_agent_memory_updated_at BEFORE UPDATE ON crew_ai_agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 14. COMMENTS
-- =====================================================

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON TABLE dealers IS 'Dealer business information and profiles';
COMMENT ON TABLE vehicles IS 'Vehicle inventory with detailed specifications';
COMMENT ON TABLE leads IS 'Customer leads generated from various sources';
COMMENT ON TABLE user_roles IS 'User role assignments for access control';
COMMENT ON TABLE subscription_plans IS 'Available subscription plans and pricing';
COMMENT ON TABLE daive_conversations IS 'AI-powered customer conversations';
COMMENT ON TABLE daive_prompts IS 'Customizable AI prompts for different scenarios';
COMMENT ON TABLE daive_user_interests IS 'Customer interest tracking from conversations';
COMMENT ON TABLE daive_voice_sessions IS 'Voice-based AI interactions';
COMMENT ON TABLE daive_analytics IS 'Analytics data for AI conversations';
COMMENT ON TABLE daive_api_settings IS 'API configuration for AI services';
COMMENT ON TABLE chat_conversations IS 'Traditional chat conversations';
COMMENT ON TABLE conversation_messages IS 'Individual messages in conversations';
COMMENT ON TABLE user_interests IS 'User interest tracking from sessions';
COMMENT ON TABLE voice_settings IS 'Voice AI configuration per dealer';
COMMENT ON TABLE etl_export_configs IS 'ETL export configuration settings';
COMMENT ON TABLE etl_connection_settings IS 'ETL connection configuration';
COMMENT ON TABLE etl_company_settings IS 'ETL company-specific settings';
COMMENT ON TABLE etl_dealer_authorizations IS 'ETL dealer authorization records';
COMMENT ON TABLE etl_export_filters IS 'ETL export filtering rules';
COMMENT ON TABLE etl_field_mappings IS 'ETL field mapping configuration';
COMMENT ON TABLE etl_file_format_settings IS 'ETL file format configuration';
COMMENT ON TABLE etl_file_naming_settings IS 'ETL file naming configuration';
COMMENT ON TABLE etl_schedule_settings IS 'ETL scheduling configuration';
COMMENT ON TABLE etl_export_history IS 'ETL export execution history';
COMMENT ON TABLE import_configs IS 'Import configuration settings';
COMMENT ON TABLE import_connection_settings IS 'Import connection configuration';
COMMENT ON TABLE import_file_settings IS 'Import file format configuration';
COMMENT ON TABLE import_field_mappings IS 'Import field mapping configuration';
COMMENT ON TABLE import_processing_settings IS 'Import processing configuration';
COMMENT ON TABLE import_schedule_settings IS 'Import scheduling configuration';
COMMENT ON TABLE import_history IS 'Import execution history';
COMMENT ON TABLE import_errors IS 'Import error records';

-- Additional table comments
COMMENT ON TABLE dealer_prompts IS 'Custom prompts for dealer AI interactions';
COMMENT ON TABLE test_drives IS 'Test drive scheduling and management';
COMMENT ON TABLE inventory_alerts IS 'Inventory-related alerts and notifications';
COMMENT ON TABLE dealer_settings IS 'Dealer-specific configuration settings';
COMMENT ON TABLE audit_log IS 'Audit trail for all system actions';
COMMENT ON TABLE crew_ai_agents IS 'AI agent definitions for crew AI system';
COMMENT ON TABLE crew_ai_conversation_routing IS 'Rules for routing conversations to AI crews';
COMMENT ON TABLE crew_ai_workflows IS 'Workflow definitions for AI crew operations';
COMMENT ON TABLE crew_ai_performance IS 'Crew AI performance metrics and analytics';
COMMENT ON TABLE crew_ai_agent_memory IS 'Crew AI agent memory and context storage';
COMMENT ON TABLE crew_ai_task_log IS 'Crew AI task execution logs and monitoring';
COMMENT ON TABLE chat_conversations IS 'Traditional chat conversation tracking';
COMMENT ON TABLE conversation_messages IS 'Individual messages in chat conversations';
COMMENT ON TABLE user_interests IS 'User interest tracking from sessions';

-- =====================================================
-- 15. INITIAL DATA
-- =====================================================

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads, features) VALUES
('basic', 'Basic', 'Essential features for small dealers', 29.99, 299.99, 50, 100, ARRAY['inventory_management', 'qr_codes', 'basic_ai_chat']),
('premium', 'Premium', 'Advanced features for growing dealers', 79.99, 799.99, 200, 500, ARRAY['inventory_management', 'qr_codes', 'advanced_ai_chat', 'voice_ai', 'analytics', 'etl_export']),
('enterprise', 'Enterprise', 'Full features for large dealers', 199.99, 1999.99, 1000, 2000, ARRAY['inventory_management', 'qr_codes', 'advanced_ai_chat', 'voice_ai', 'analytics', 'etl_export', 'import_automation', 'crew_ai'])
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Migration Complete!
-- =====================================================
-- This migration creates the complete DealerIQ database schema
-- Run this after crew-ai-schema.sql to set up the full system
-- Total Tables: 44 (including all crew-ai tables)
