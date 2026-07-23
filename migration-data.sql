-- =====================================================
-- COMPLETE DATA MIGRATION SCRIPT FOR RENDER.COM
-- This script will populate all tables with sample data
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SUBSCRIPTION PLANS
-- =====================================================
INSERT INTO subscription_plans (id, name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads, features, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'basic', 'Basic Plan', 'Essential features for small dealerships', 29.99, 299.99, 50, 100, ARRAY['vehicle_management', 'lead_tracking', 'basic_analytics'], NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'premium', 'Premium Plan', 'Advanced features for growing dealerships', 79.99, 799.99, 200, 500, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support'], NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'enterprise', 'Enterprise Plan', 'Full-featured solution for large dealerships', 199.99, 1999.99, 1000, 2000, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support', 'custom_integrations', 'dedicated_support'], NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. DEALERS
-- =====================================================
INSERT INTO dealers (id, name, email, phone, address, city, state, zip_code, country, website, logo_url, subscription_plan_id, status, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440010', 'Clay Cooley Hyundai', 'info@claycooleyhyundai.com', '+1-817-421-1000', '1234 Main Street', 'Fort Worth', 'TX', '76102', 'USA', 'https://claycooleyhyundai.com', 'https://example.com/logo1.png', '550e8400-e29b-41d4-a716-446655440002', 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440011', 'Toyota of Dallas', 'sales@toyotadallas.com', '+1-214-555-0123', '5678 Oak Avenue', 'Dallas', 'TX', '75201', 'USA', 'https://toyotadallas.com', 'https://example.com/logo2.png', '550e8400-e29b-41d4-a716-446655440003', 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440012', 'Honda World', 'info@hondaworld.com', '+1-972-333-4567', '9012 Pine Street', 'Plano', 'TX', '75023', 'USA', 'https://hondaworld.com', 'https://example.com/logo3.png', '550e8400-e29b-41d4-a716-446655440001', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. USERS
-- =====================================================
INSERT INTO users (id, dealer_id, email, password_hash, first_name, last_name, role, phone, status, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440010', 'john.smith@claycooleyhyundai.com', '$2b$10$example.hash.here', 'John', 'Smith', 'sales_manager', '+1-817-421-1001', 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440010', 'sarah.jones@claycooleyhyundai.com', '$2b$10$example.hash.here', 'Sarah', 'Jones', 'sales_consultant', '+1-817-421-1002', 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440011', 'mike.wilson@toyotadallas.com', '$2b$10$example.hash.here', 'Mike', 'Wilson', 'sales_manager', '+1-214-555-0124', 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440012', 'lisa.brown@hondaworld.com', '$2b$10$example.hash.here', 'Lisa', 'Brown', 'sales_consultant', '+1-972-333-4568', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. VEHICLES
-- =====================================================
INSERT INTO vehicles (id, dealer_id, vin, make, model, year, trim, body_style, color, mileage, price, msrp, condition, fuel_type, transmission, engine, drivetrain, features, description, images, status, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440010', '1HGBH41JXMN109186', 'Hyundai', 'Tucson', 2024, 'Limited', 'SUV', 'Phantom Black', 150, 34950.00, 36950.00, 'new', 'gasoline', 'automatic', '2.5L I4', 'AWD', ARRAY['Blind Spot Detection', 'Lane Keeping Assist', 'Forward Collision Warning', 'Apple CarPlay', 'Android Auto'], '2024 Hyundai Tucson Limited AWD - Premium SUV with advanced safety features and modern technology.', ARRAY['https://example.com/tucson1.jpg', 'https://example.com/tucson2.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440010', '1HGBH41JXMN109187', 'Hyundai', 'Santa Fe', 2024, 'SEL', 'SUV', 'Sierra Burgundy', 250, 38950.00, 40950.00, 'new', 'hybrid', 'automatic', '1.6L Turbo Hybrid', 'AWD', ARRAY['Hybrid Powertrain', 'SmartSense Safety', 'Wireless Charging', 'Panoramic Sunroof'], '2024 Hyundai Santa Fe SEL Hybrid - Efficient and spacious family SUV with hybrid technology.', ARRAY['https://example.com/santafe1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440011', '1HGBH41JXMN109188', 'Toyota', 'RAV4', 2024, 'XLE', 'SUV', 'Super White', 180, 32950.00, 34950.00, 'new', 'gasoline', 'automatic', '2.5L I4', 'FWD', ARRAY['Toyota Safety Sense 2.0', 'Entune Audio', 'Smart Key System'], '2024 Toyota RAV4 XLE - Reliable compact SUV with Toyota''s legendary dependability.', ARRAY['https://example.com/rav4-1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440011', '1HGBH41JXMN109189', 'Toyota', 'Camry', 2024, 'SE', 'Sedan', 'Midnight Black', 120, 28950.00, 30950.00, 'new', 'gasoline', 'automatic', '2.5L I4', 'FWD', ARRAY['Toyota Safety Sense 2.5+', '7-inch Touchscreen', 'Apple CarPlay', 'Android Auto'], '2024 Toyota Camry SE - Sporty sedan with excellent fuel economy and safety features.', ARRAY['https://example.com/camry1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440034', '550e8400-e29b-41d4-a716-446655440012', '1HGBH41JXMN109190', 'Honda', 'CR-V', 2024, 'EX-L', 'SUV', 'Crystal Black Pearl', 200, 33950.00, 35950.00, 'new', 'gasoline', 'automatic', '1.5L Turbo', 'AWD', ARRAY['Honda Sensing', 'Power Tailgate', 'Heated Seats', 'Dual Zone Climate'], '2024 Honda CR-V EX-L - Versatile SUV with Honda''s innovative safety technology.', ARRAY['https://example.com/crv1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440035', '550e8400-e29b-41d4-a716-446655440012', '1HGBH41JXMN109191', 'Honda', 'Civic', 2024, 'Sport', 'Sedan', 'Rallye Red', 150, 24950.00, 26950.00, 'new', 'gasoline', 'manual', '1.5L Turbo', 'FWD', ARRAY['Honda Sensing', 'Sport Suspension', '18-inch Wheels', 'Sport Pedals'], '2024 Honda Civic Sport - Dynamic compact car with sporty styling and performance.', ARRAY['https://example.com/civic1.jpg'], 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 5. DEALER PROMPTS
-- =====================================================
INSERT INTO dealer_prompts (id, dealer_id, prompt_type, title, content, is_active, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440010', 'greeting', 'Welcome Message', 'Welcome to Clay Cooley Hyundai! We''re here to help you find the perfect vehicle. How can we assist you today?', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440010', 'sales_pitch', 'Hyundai Advantage', 'Hyundai vehicles come with America''s Best Warranty, including 10-year/100,000-mile powertrain coverage. Plus, our vehicles feature the latest safety technology and fuel efficiency.', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440011', 'greeting', 'Toyota Welcome', 'Welcome to Toyota of Dallas! Experience Toyota''s legendary reliability and innovative technology. What brings you in today?', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440012', 'greeting', 'Honda Welcome', 'Welcome to Honda World! Discover Honda''s commitment to safety, reliability, and innovation. How can we help you today?', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. LEADS
-- =====================================================
INSERT INTO leads (id, dealer_id, vehicle_id, first_name, last_name, email, phone, message, lead_source, status, priority, assigned_to, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440030', 'David', 'Johnson', 'david.johnson@email.com', '+1-817-555-0101', 'Interested in the 2024 Tucson Limited. Can you tell me more about the financing options?', 'website', 'new', 'high', '550e8400-e29b-41d4-a716-446655440020', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440031', 'Maria', 'Garcia', 'maria.garcia@email.com', '+1-817-555-0102', 'Looking for a hybrid SUV. Is the Santa Fe available for a test drive this weekend?', 'phone', 'contacted', 'medium', '550e8400-e29b-41d4-a716-446655440021', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440032', 'Robert', 'Chen', 'robert.chen@email.com', '+1-214-555-0103', 'Interested in the RAV4 XLE. What are the current incentives?', 'website', 'qualified', 'high', '550e8400-e29b-41d4-a716-446655440022', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440053', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440034', 'Jennifer', 'Williams', 'jennifer.williams@email.com', '+1-972-555-0104', 'Looking for a family SUV. Can you compare the CR-V with other options?', 'walk_in', 'new', 'medium', '550e8400-e29b-41d4-a716-446655440023', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 7. TEST DRIVES
-- =====================================================
INSERT INTO test_drives (id, lead_id, vehicle_id, scheduled_date, scheduled_time, duration, status, notes, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440060', '550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440031', '2024-01-15', '14:00:00', 60, 'scheduled', 'Customer interested in hybrid technology and fuel efficiency.', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440032', '2024-01-16', '10:00:00', 45, 'scheduled', 'Customer wants to test the AWD capabilities.', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440053', '550e8400-e29b-41d4-a716-446655440034', '2024-01-17', '15:30:00', 60, 'scheduled', 'Family of 4, interested in cargo space and safety features.', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 8. INVENTORY ALERTS
-- =====================================================
INSERT INTO inventory_alerts (id, dealer_id, customer_email, customer_phone, make, model, year, max_price, max_mileage, status, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440070', '550e8400-e29b-41d4-a716-446655440010', 'alex.smith@email.com', '+1-817-555-0105', 'Hyundai', 'Palisade', 2024, 50000.00, 5000, 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440011', 'sarah.davis@email.com', '+1-214-555-0106', 'Toyota', 'Highlander', 2024, 45000.00, 10000, 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440072', '550e8400-e29b-41d4-a716-446655440012', 'michael.brown@email.com', '+1-972-555-0107', 'Honda', 'Pilot', 2024, 48000.00, 8000, 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. DEALER SETTINGS
-- =====================================================
INSERT INTO dealer_settings (id, dealer_id, setting_key, setting_value, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440080', '550e8400-e29b-41d4-a716-446655440010', 'ai_bot_enabled', 'true', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440081', '550e8400-e29b-41d4-a716-446655440010', 'auto_lead_assignment', 'true', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440082', '550e8400-e29b-41d4-a716-446655440010', 'email_notifications', 'true', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440083', '550e8400-e29b-41d4-a716-446655440011', 'ai_bot_enabled', 'true', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440084', '550e8400-e29b-41d4-a716-446655440011', 'auto_lead_assignment', 'false', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440085', '550e8400-e29b-41d4-a716-446655440012', 'ai_bot_enabled', 'true', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440086', '550e8400-e29b-41d4-a716-446655440012', 'auto_lead_assignment', 'true', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 10. AUDIT LOG
-- =====================================================
INSERT INTO audit_log (id, dealer_id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440090', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440020', 'CREATE', 'vehicles', '550e8400-e29b-41d4-a716-446655440030', NULL, '{"make": "Hyundai", "model": "Tucson"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW()),
('550e8400-e29b-41d4-a716-446655440091', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440021', 'CREATE', 'leads', '550e8400-e29b-41d4-a716-446655440050', NULL, '{"first_name": "David", "last_name": "Johnson"}', '192.168.1.101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW()),
('550e8400-e29b-41d4-a716-446655440092', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440022', 'UPDATE', 'vehicles', '550e8400-e29b-41d4-a716-446655440032', '{"price": 33950.00}', '{"price": 32950.00}', '192.168.1.102', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 11. ADDITIONAL VEHICLES FOR VARIETY
-- =====================================================
INSERT INTO vehicles (id, dealer_id, vin, make, model, year, trim, body_style, color, mileage, price, msrp, condition, fuel_type, transmission, engine, drivetrain, features, description, images, status, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440036', '550e8400-e29b-41d4-a716-446655440010', '1HGBH41JXMN109192', 'Hyundai', 'Elantra', 2024, 'SEL', 'Sedan', 'Intense Blue', 100, 22950.00, 24950.00, 'new', 'gasoline', 'automatic', '2.0L I4', 'FWD', ARRAY['Hyundai SmartSense', '8-inch Touchscreen', 'Apple CarPlay', 'Android Auto'], '2024 Hyundai Elantra SEL - Compact sedan with modern design and advanced safety.', ARRAY['https://example.com/elantra1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440037', '550e8400-e29b-41d4-a716-446655440010', '1HGBH41JXMN109193', 'Hyundai', 'Kona', 2024, 'Limited', 'SUV', 'Sonic Silver', 150, 27950.00, 29950.00, 'new', 'electric', 'automatic', 'Electric Motor', 'FWD', ARRAY['Electric Powertrain', 'DC Fast Charging', 'Bluelink Connected Car', 'Forward Collision Avoidance'], '2024 Hyundai Kona Electric Limited - Zero-emission SUV with impressive range and features.', ARRAY['https://example.com/kona1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440038', '550e8400-e29b-41d4-a716-446655440011', '1HGBH41JXMN109194', 'Toyota', 'Prius', 2024, 'LE', 'Hatchback', 'Supersonic Red', 200, 27950.00, 29950.00, 'new', 'hybrid', 'automatic', '1.8L Hybrid', 'FWD', ARRAY['Toyota Safety Sense 3.0', 'Hybrid Synergy Drive', 'Eco Mode', 'Regenerative Braking'], '2024 Toyota Prius LE - Iconic hybrid with exceptional fuel economy and reliability.', ARRAY['https://example.com/prius1.jpg'], 'available', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440039', '550e8400-e29b-41d4-a716-446655440012', '1HGBH41JXMN109195', 'Honda', 'Accord', 2024, 'Touring', 'Sedan', 'Platinum White Pearl', 180, 34950.00, 36950.00, 'new', 'gasoline', 'automatic', '1.5L Turbo', 'FWD', ARRAY['Honda Sensing', '12.3-inch Digital Instrument Cluster', 'Wireless Charging', 'Head-Up Display'], '2024 Honda Accord Touring - Premium sedan with cutting-edge technology and comfort.', ARRAY['https://example.com/accord1.jpg'], 'available', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 12. ADDITIONAL LEADS FOR REALISTIC DATA
-- =====================================================
INSERT INTO leads (id, dealer_id, vehicle_id, first_name, last_name, email, phone, message, lead_source, status, priority, assigned_to, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440054', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440036', 'Thomas', 'Anderson', 'thomas.anderson@email.com', '+1-817-555-0108', 'Looking for an economical sedan. What are the current financing rates for the Elantra?', 'website', 'qualified', 'medium', '550e8400-e29b-41d4-a716-446655440021', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440055', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440037', 'Emily', 'Davis', 'emily.davis@email.com', '+1-817-555-0109', 'Interested in electric vehicles. What is the range and charging time for the Kona Electric?', 'phone', 'new', 'high', '550e8400-e29b-41d4-a716-446655440020', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440056', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440038', 'Christopher', 'Wilson', 'chris.wilson@email.com', '+1-214-555-0110', 'Looking for a fuel-efficient car. Can you tell me more about the Prius hybrid system?', 'walk_in', 'contacted', 'medium', '550e8400-e29b-41d4-a716-446655440022', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440057', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440039', 'Amanda', 'Taylor', 'amanda.taylor@email.com', '+1-972-555-0111', 'Interested in the Accord Touring. What premium features does it include?', 'website', 'qualified', 'high', '550e8400-e29b-41d4-a716-446655440023', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 13. ADDITIONAL TEST DRIVES
-- =====================================================
INSERT INTO test_drives (id, lead_id, vehicle_id, scheduled_date, scheduled_time, duration, status, notes, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440063', '550e8400-e29b-41d4-a716-446655440055', '550e8400-e29b-41d4-a716-446655440037', '2024-01-18', '11:00:00', 60, 'scheduled', 'Customer wants to test electric vehicle performance and range.', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440064', '550e8400-e29b-41d4-a716-446655440056', '550e8400-e29b-41d4-a716-446655440038', '2024-01-19', '13:00:00', 45, 'scheduled', 'Customer interested in hybrid technology and fuel efficiency.', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440065', '550e8400-e29b-41d4-a716-446655440057', '550e8400-e29b-41d4-a716-446655440039', '2024-01-20', '15:00:00', 60, 'scheduled', 'Customer wants to experience premium features and comfort.', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 14. ADDITIONAL INVENTORY ALERTS
-- =====================================================
INSERT INTO inventory_alerts (id, dealer_id, customer_email, customer_phone, make, model, year, max_price, max_mileage, status, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440073', '550e8400-e29b-41d4-a716-446655440010', 'jessica.martin@email.com', '+1-817-555-0112', 'Hyundai', 'Venue', 2024, 25000.00, 5000, 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440074', '550e8400-e29b-41d4-a716-446655440011', 'daniel.lee@email.com', '+1-214-555-0113', 'Toyota', 'Corolla', 2024, 28000.00, 8000, 'active', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440075', '550e8400-e29b-41d4-a716-446655440012', 'rachel.green@email.com', '+1-972-555-0114', 'Honda', 'HR-V', 2024, 30000.00, 6000, 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 15. ADDITIONAL DEALER PROMPTS
-- =====================================================
INSERT INTO dealer_prompts (id, dealer_id, prompt_type, title, content, is_active, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440044', '550e8400-e29b-41d4-a716-446655440010', 'financing', 'Financing Options', 'We offer competitive financing rates starting at 2.9% APR for qualified buyers. We also have special lease programs and can work with various credit situations.', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440045', '550e8400-e29b-41d4-a716-446655440010', 'service', 'Service Department', 'Our certified technicians use genuine Hyundai parts and provide comprehensive maintenance services. We offer convenient scheduling and competitive pricing.', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440046', '550e8400-e29b-41d4-a716-446655440011', 'financing', 'Toyota Financial Services', 'Toyota Financial Services offers flexible financing options, including low APR rates, extended terms, and special programs for first-time buyers.', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440047', '550e8400-e29b-41d4-a716-446655440012', 'financing', 'Honda Financial Services', 'Honda Financial Services provides competitive financing rates and flexible payment options to help you drive home in your dream Honda.', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check total counts
SELECT 'subscription_plans' as table_name, COUNT(*) as total_records FROM subscription_plans
UNION ALL
SELECT 'dealers' as table_name, COUNT(*) as total_records FROM dealers
UNION ALL
SELECT 'users' as table_name, COUNT(*) as total_records FROM users
UNION ALL
SELECT 'vehicles' as table_name, COUNT(*) as total_records FROM vehicles
UNION ALL
SELECT 'dealer_prompts' as table_name, COUNT(*) as total_records FROM dealer_prompts
UNION ALL
SELECT 'leads' as table_name, COUNT(*) as total_records FROM leads
UNION ALL
SELECT 'test_drives' as table_name, COUNT(*) as total_records FROM test_drives
UNION ALL
SELECT 'inventory_alerts' as table_name, COUNT(*) as total_records FROM inventory_alerts
UNION ALL
SELECT 'dealer_settings' as table_name, COUNT(*) as total_records FROM dealer_settings
UNION ALL
SELECT 'audit_log' as table_name, COUNT(*) as total_records FROM audit_log;

-- Check sample data from key tables
SELECT 'Sample Vehicles:' as info;
SELECT make, model, year, trim, price, status FROM vehicles LIMIT 5;

SELECT 'Sample Leads:' as info;
SELECT first_name, last_name, email, status, lead_source FROM leads LIMIT 5;

SELECT 'Sample Dealers:' as info;
SELECT name, city, state, subscription_plan_id FROM dealers;

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- This script has successfully populated your database with:
-- • 3 subscription plans
-- • 3 dealers (Clay Cooley Hyundai, Toyota of Dallas, Honda World)
-- • 4 users (sales managers and consultants)
-- • 10 vehicles (Hyundai, Toyota, Honda models)
-- • 8 dealer prompts (greetings, financing, service info)
-- • 8 leads (customer inquiries)
-- • 6 test drives (scheduled appointments)
-- • 6 inventory alerts (customer notifications)
-- • 7 dealer settings (configuration options)
-- • 3 audit log entries (activity tracking)
-- =====================================================
