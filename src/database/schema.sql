-- Create database schema for vehicle management system

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles enum
CREATE TYPE user_role AS ENUM ('super_admin', 'dealer', 'client');

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'dealer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription plans enum
CREATE TYPE subscription_plan AS ENUM ('basic', 'premium', 'enterprise');

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name subscription_plan UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    max_vehicles INTEGER,
    max_leads INTEGER,
    features TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dealers table
CREATE TABLE IF NOT EXISTS dealers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vin TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    trim TEXT,
    color TEXT,
    mileage DECIMAL(10,1),
    price DECIMAL(10,2),
    description TEXT,
    features TEXT[],
    images TEXT[],
    status TEXT DEFAULT 'available',
    qr_code_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D.A.I.V.E. AI Conversations table
CREATE TABLE IF NOT EXISTS daive_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    conversation_type TEXT DEFAULT 'text', -- 'text', 'voice', 'mixed'
    messages JSONB DEFAULT '[]',
    ai_context JSONB DEFAULT '{}',
    lead_qualification_score INTEGER DEFAULT 0,
    lead_status TEXT DEFAULT 'new',
    handoff_requested BOOLEAN DEFAULT false,
    handoff_to_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D.A.I.V.E. Voice Sessions table
CREATE TABLE IF NOT EXISTS daive_voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES daive_conversations(id) ON DELETE CASCADE,
    audio_file_url TEXT,
    transcription TEXT,
    ai_response TEXT,
    audio_response_url TEXT,
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D.A.I.V.E. AI Prompts table (for customization)
CREATE TABLE IF NOT EXISTS daive_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    prompt_type TEXT NOT NULL, -- 'greeting', 'vehicle_info', 'financing', 'test_drive', 'handoff'
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, prompt_type)
);

-- D.A.I.V.E. API Settings table (for API keys and integrations)
CREATE TABLE IF NOT EXISTS daive_api_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    setting_type TEXT NOT NULL, -- 'openai_key', 'elevenlabs_key', 'azure_speech_key', 'voice_provider'
    setting_value TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, setting_type)
);

-- D.A.I.V.E. Analytics table
CREATE TABLE IF NOT EXISTS daive_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_conversations INTEGER DEFAULT 0,
    total_voice_sessions INTEGER DEFAULT 0,
    total_leads_generated INTEGER DEFAULT 0,
    average_conversation_duration INTEGER DEFAULT 0, -- in seconds
    handoff_rate DECIMAL(5,2) DEFAULT 0, -- percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_dealers_user_id ON dealers(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_dealer_id ON vehicles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_vehicle_id ON chat_conversations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_dealer_id ON daive_conversations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_vehicle_id ON daive_conversations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_daive_conversations_session_id ON daive_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_daive_voice_sessions_conversation_id ON daive_voice_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_daive_prompts_dealer_id ON daive_prompts(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_api_settings_dealer_id ON daive_api_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_api_settings_setting_type ON daive_api_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_daive_analytics_dealer_id ON daive_analytics(dealer_id);
CREATE INDEX IF NOT EXISTS idx_daive_analytics_date ON daive_analytics(date);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealers_updated_at BEFORE UPDATE ON dealers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daive_conversations_updated_at BEFORE UPDATE ON daive_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daive_voice_sessions_updated_at BEFORE UPDATE ON daive_voice_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daive_prompts_updated_at BEFORE UPDATE ON daive_prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daive_api_settings_updated_at BEFORE UPDATE ON daive_api_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daive_analytics_updated_at BEFORE UPDATE ON daive_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads, features) VALUES
('basic', 'Basic Plan', 'Basic features for small dealers', 29.99, 299.99, 50, 100, ARRAY['vehicle_management', 'lead_tracking']),
('premium', 'Premium Plan', 'Advanced features for growing businesses', 79.99, 799.99, 200, 500, ARRAY['vehicle_management', 'lead_tracking', 'analytics', 'bulk_import', 'daive_ai']),
('enterprise', 'Enterprise Plan', 'Full features for large dealerships', 199.99, 1999.99, NULL, NULL, ARRAY['vehicle_management', 'lead_tracking', 'analytics', 'bulk_import', 'custom_branding', 'api_access', 'daive_ai', 'daive_voice'])
ON CONFLICT (name) DO NOTHING;

-- Insert default D.A.I.V.E. prompts
INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text) VALUES
(NULL, 'greeting', 'Hi, I''m D.A.I.V.E., your AI sales assistant. How can I help you today?'),
(NULL, 'vehicle_info', 'This vehicle has excellent features including {features}. The price is ${price} and it has {mileage} miles. Would you like to know more about financing options?'),
(NULL, 'financing', 'I can help you with financing options. We offer competitive rates starting at {rate}% APR. Would you like to calculate your monthly payment?'),
(NULL, 'test_drive', 'Great choice! I can help you schedule a test drive. What day and time works best for you?'),
(NULL, 'handoff', 'I''d be happy to connect you with one of our sales representatives who can provide more detailed assistance. Let me transfer you now.')
ON CONFLICT DO NOTHING;