-- =====================================================
-- Vehicle Management System Database Migration
-- Render.com PostgreSQL Database Setup
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    max_vehicles INTEGER DEFAULT 0,
    max_leads INTEGER DEFAULT 0,
    features TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. DEALERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dealers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    subscription_plan_id INTEGER REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active',
    logo_url TEXT,
    website_url TEXT,
    business_hours JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. VEHICLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    vin VARCHAR(17) UNIQUE,
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    mileage INTEGER,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    body_style VARCHAR(50),
    color VARCHAR(50),
    interior_color VARCHAR(50),
    engine_size VARCHAR(50),
    horsepower INTEGER,
    description TEXT,
    features TEXT[],
    images TEXT[],
    status VARCHAR(20) DEFAULT 'available',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. DEALER PROMPTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dealer_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    prompt_type VARCHAR(50) NOT NULL,
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. LEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    message TEXT,
    lead_type VARCHAR(50) DEFAULT 'inquiry',
    status VARCHAR(50) DEFAULT 'new',
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. TEST DRIVES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS test_drives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    preferred_date DATE,
    preferred_time TIME,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. INVENTORY ALERTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    customer_email VARCHAR(255) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year_from INTEGER,
    year_to INTEGER,
    max_price DECIMAL(10,2),
    max_mileage INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. DEALER SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dealer_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id) UNIQUE,
    tts_enabled BOOLEAN DEFAULT true,
    ai_bot_enabled BOOLEAN DEFAULT true,
    notification_email VARCHAR(255),
    auto_responder_enabled BOOLEAN DEFAULT true,
    business_hours JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 10. AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID REFERENCES dealers(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INSERT SAMPLE DATA
-- =====================================================

-- Insert subscription plans
INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads, features) 
VALUES 
    ('basic', 'Basic Plan', 'Essential features for small dealerships', 29.99, 299.99, 50, 100, ARRAY['vehicle_management', 'lead_tracking', 'basic_analytics']),
    ('premium', 'Premium Plan', 'Advanced features for growing dealerships', 79.99, 799.99, 200, 500, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support']),
    ('enterprise', 'Enterprise Plan', 'Full-featured solution for large dealerships', 199.99, 1999.99, 1000, 2000, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support', 'custom_integrations', 'dedicated_support'])
ON CONFLICT (name) DO NOTHING;

-- Insert sample dealer
INSERT INTO dealers (name, email, phone, address, city, state, zip_code, subscription_plan_id) 
VALUES (
    'Clay Cooley Hyundai',
    'info@claycooleyhyundai.com',
    '(555) 123-4567',
    '123 Main Street',
    'Dallas',
    'TX',
    '75201',
    2
) ON CONFLICT (email) DO NOTHING;

-- Insert sample vehicles
INSERT INTO vehicles (dealer_id, make, model, year, vin, price, mileage, fuel_type, transmission, body_style, color, description, status) 
SELECT 
    d.id,
    'Hyundai',
    'Tucson',
    2024,
    '1HGBH41JXMN109186',
    29999.00,
    1500,
    'Gasoline',
    'Automatic',
    'SUV',
    'Silver',
    '2024 Hyundai Tucson SEL with advanced safety features and modern technology.',
    'available'
FROM dealers d 
WHERE d.name = 'Clay Cooley Hyundai'
LIMIT 1;

INSERT INTO vehicles (dealer_id, make, model, year, vin, price, mileage, fuel_type, transmission, body_style, color, description, status) 
SELECT 
    d.id,
    'Hyundai',
    'Santa Fe',
    2024,
    '1HGBH41JXMN109187',
    35999.00,
    800,
    'Gasoline',
    'Automatic',
    'SUV',
    'White',
    '2024 Hyundai Santa Fe Limited with premium interior and advanced driver assistance.',
    'available'
FROM dealers d 
WHERE d.name = 'Clay Cooley Hyundai'
LIMIT 1;

-- Insert sample dealer prompts
INSERT INTO dealer_prompts (dealer_id, prompt_type, prompt_text, priority) 
SELECT 
    d.id,
    'greeting',
    'Welcome to Clay Cooley Hyundai! We''re here to help you find the perfect vehicle. How can we assist you today?',
    1
FROM dealers d 
WHERE d.name = 'Clay Cooley Hyundai'
LIMIT 1;

INSERT INTO dealer_prompts (dealer_id, prompt_type, prompt_text, priority) 
SELECT 
    d.id,
    'vehicle_inquiry',
    'Great choice! The {make} {model} is an excellent vehicle. What specific features are you looking for?',
    2
FROM dealers d 
WHERE d.name = 'Clay Cooley Hyundai'
LIMIT 1;

-- Insert dealer settings
INSERT INTO dealer_settings (dealer_id, tts_enabled, ai_bot_enabled, notification_email, auto_responder_enabled) 
SELECT 
    d.id,
    true,
    true,
    'notifications@claycooleyhyundai.com',
    true
FROM dealers d 
WHERE d.name = 'Clay Cooley Hyundai'
LIMIT 1;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Vehicles table indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_dealer_id ON vehicles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_price ON vehicles(price);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- Dealers table indexes
CREATE INDEX IF NOT EXISTS idx_dealers_subscription_plan_id ON dealers(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_dealers_status ON dealers(status);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_dealer_id ON users(dealer_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Display summary
SELECT 
    'Migration completed successfully!' as status,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
