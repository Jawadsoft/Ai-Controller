-- =====================================================
-- COMPLETE MIGRATION SCRIPT FOR IMPORT SYSTEM
-- =====================================================
-- This script will recreate all tables needed for the import system
-- WARNING: This will DELETE all existing data!

-- =====================================================
-- STEP 1: DROP EXISTING TABLES (in correct order)
-- =====================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS import_field_mappings CASCADE;
DROP TABLE IF EXISTS import_file_settings CASCADE;
DROP TABLE IF EXISTS import_connection_settings CASCADE;
DROP TABLE IF EXISTS import_schedule_settings CASCADE;
DROP TABLE IF EXISTS import_configs CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS dealers CASCADE;

-- Drop any existing functions
DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE;

-- =====================================================
-- STEP 2: CREATE DEALERS TABLE
-- =====================================================

CREATE TABLE dealers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
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
    subscription_status TEXT DEFAULT 'active',
    subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 3: CREATE VEHICLES TABLE
-- =====================================================

CREATE TABLE vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    vin TEXT NOT NULL,
    make TEXT,
    model TEXT,
    year INTEGER,
    trim TEXT,
    color TEXT,
    interior_color TEXT,
    mileage INTEGER,
    odometer INTEGER,
    price NUMERIC,
    msrp NUMERIC,
    stock_number TEXT,
    body_style TEXT,
    engine_type TEXT,
    displacement TEXT,
    transmission TEXT,
    features TEXT[],
    images TEXT[],
    photo_url_list TEXT[],
    certified BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'available',
    import_source TEXT DEFAULT 'manual',
    import_date TIMESTAMP WITH TIME ZONE,
    reference_dealer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, vin)
);

-- =====================================================
-- STEP 4: CREATE IMPORT CONFIGS TABLE
-- =====================================================

CREATE TABLE import_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    config_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 5: CREATE IMPORT CONNECTION SETTINGS TABLE
-- =====================================================

CREATE TABLE import_connection_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    import_config_id UUID REFERENCES import_configs(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('sftp', 'ftp', 'http', 'local')),
    host_url TEXT,
    port INTEGER,
    username TEXT,
    password_encrypted TEXT,
    remote_directory TEXT DEFAULT '/',
    file_pattern TEXT DEFAULT '*',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 6: CREATE IMPORT FILE SETTINGS TABLE
-- =====================================================

CREATE TABLE import_file_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    import_config_id UUID REFERENCES import_configs(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xml', 'json')),
    delimiter TEXT DEFAULT ',',
    has_header BOOLEAN DEFAULT true,
    encoding TEXT DEFAULT 'UTF-8',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 7: CREATE IMPORT SCHEDULE SETTINGS TABLE
-- =====================================================

CREATE TABLE import_schedule_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    import_config_id UUID REFERENCES import_configs(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('manual', 'hourly', 'daily', 'weekly', 'monthly')),
    time_hour INTEGER DEFAULT 0 CHECK (time_hour >= 0 AND time_hour <= 23),
    time_minute INTEGER DEFAULT 0 CHECK (time_minute >= 0 AND time_minute <= 59),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 8: CREATE IMPORT FIELD MAPPINGS TABLE
-- =====================================================

CREATE TABLE import_field_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    import_config_id UUID REFERENCES import_configs(id) ON DELETE CASCADE,
    source_field TEXT NOT NULL,
    target_field TEXT NOT NULL,
    data_type TEXT DEFAULT 'text' CHECK (data_type IN ('text', 'number', 'date', 'boolean', 'array')),
    is_required BOOLEAN DEFAULT false,
    field_order INTEGER DEFAULT 0,
    transformation_rule TEXT,
    default_value TEXT,
    validation_rule TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 9: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Dealers table indexes
CREATE INDEX idx_dealers_email ON dealers(email);
CREATE INDEX idx_dealers_business_name ON dealers(business_name);
CREATE INDEX idx_dealers_subscription_status ON dealers(subscription_status);

-- Vehicles table indexes
CREATE INDEX idx_vehicles_dealer_id ON vehicles(dealer_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX idx_vehicles_year ON vehicles(year);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_import_source ON vehicles(import_source);

-- Import configs indexes
CREATE INDEX idx_import_configs_dealer_id ON import_configs(dealer_id);
CREATE INDEX idx_import_configs_active ON import_configs(is_active);

-- Import field mappings indexes
CREATE INDEX idx_import_field_mappings_config_id ON import_field_mappings(import_config_id);
CREATE INDEX idx_import_field_mappings_target_field ON import_field_mappings(target_field);
CREATE INDEX idx_import_field_mappings_order ON import_field_mappings(field_order);

-- =====================================================
-- STEP 10: CREATE THE IMPORT FUNCTION
-- =====================================================

CREATE FUNCTION import_vehicle_from_csv(
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
    p_reference_dealer_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_vehicle_id UUID;
    v_dealer_exists BOOLEAN;
BEGIN
    -- Check if dealer exists
    SELECT EXISTS(SELECT 1 FROM dealers WHERE id = p_dealer_id) INTO v_dealer_exists;
    
    IF NOT v_dealer_exists THEN
        RAISE EXCEPTION 'Dealer with ID % does not exist', p_dealer_id;
    END IF;
    
    -- Check if vehicle already exists
    SELECT id INTO v_vehicle_id 
    FROM vehicles 
    WHERE vin = p_vin AND dealer_id = p_dealer_id;
    
    IF v_vehicle_id IS NOT NULL THEN
        -- Update existing vehicle
        UPDATE vehicles SET
            make = COALESCE(p_make, make),
            model = COALESCE(p_model, model),
            year = COALESCE(p_year, year),
            trim = COALESCE(p_series, trim),
            color = COALESCE(p_color, color),
            interior_color = COALESCE(p_interior_color, interior_color),
            mileage = COALESCE(p_odometer, mileage),
            odometer = COALESCE(p_odometer, odometer),
            price = COALESCE(p_price, price),
            msrp = COALESCE(p_msrp, msrp),
            stock_number = COALESCE(p_stock_number, stock_number),
            body_style = COALESCE(p_body_style, body_style),
            engine_type = COALESCE(p_engine_type, engine_type),
            displacement = COALESCE(p_displacement, displacement),
            transmission = COALESCE(p_transmission, transmission),
            certified = COALESCE(p_certified, certified),
            photo_url_list = CASE 
                WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' 
                THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') 
                ELSE photo_url_list 
            END,
            features = CASE 
                WHEN p_features IS NOT NULL AND p_features != '' 
                THEN string_to_array(trim(both '{}' from p_features), ',') 
                ELSE features 
            END,
            import_source = 'csv',
            import_date = NOW(),
            reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),
            updated_at = NOW()
        WHERE id = v_vehicle_id;
    ELSE
        -- Insert new vehicle
        INSERT INTO vehicles (
            dealer_id, vin, make, model, year, trim, color, interior_color, 
            mileage, odometer, price, msrp, stock_number, body_style, 
            engine_type, displacement, transmission, certified, 
            photo_url_list, features, import_source, import_date, 
            reference_dealer_id, created_at, updated_at
        ) VALUES (
            p_dealer_id, p_vin, p_make, p_model, p_year, p_series, p_color, p_interior_color,
            p_odometer, p_odometer, p_price, p_msrp, p_stock_number, p_body_style,
            p_engine_type, p_displacement, p_transmission, p_certified,
            CASE 
                WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' 
                THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') 
                ELSE NULL 
            END,
            CASE 
                WHEN p_features IS NOT NULL AND p_features != '' 
                THEN string_to_array(trim(both '{}' from p_features), ',') 
                ELSE NULL 
            END,
            'csv', NOW(), p_reference_dealer_id, NOW(), NOW()
        ) RETURNING id INTO v_vehicle_id;
    END IF;
    
    RETURN v_vehicle_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 11: INSERT SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert a sample dealer
INSERT INTO dealers (id, business_name, contact_name, email, phone, address, city, state, zip_code, website)
VALUES (
    '0aa94346-ed1d-420e-8823-bcd97bf6456f',
    'Test Dealer Business',
    'Test Contact',
    'test@dealer.com',
    '555-123-4567',
    '123 Test Street',
    'Test City',
    'TX',
    '12345',
    'https://testdealer.com'
) ON CONFLICT (id) DO NOTHING;

-- Insert a sample import config
INSERT INTO import_configs (dealer_id, config_name, description)
SELECT 
    '0aa94346-ed1d-420e-8823-bcd97bf6456f',
    'Default CSV Import',
    'Default configuration for CSV vehicle imports'
WHERE EXISTS (SELECT 1 FROM dealers WHERE id = '0aa94346-ed1d-420e-8823-bcd97bf6456f');

-- =====================================================
-- STEP 12: VERIFY CREATION
-- =====================================================

-- Check all tables were created
SELECT 
    table_name,
    'Table created successfully' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'dealers', 'vehicles', 'import_configs', 
    'import_connection_settings', 'import_file_settings', 
    'import_schedule_settings', 'import_field_mappings'
)
ORDER BY table_name;

-- Check function was created
SELECT 
    proname as function_name,
    pronargs as parameter_count,
    pg_get_function_result(oid) as return_type,
    'Function created successfully' as status
FROM pg_proc 
WHERE proname = 'import_vehicle_from_csv';

-- Check indexes were created
SELECT 
    indexname,
    tablename,
    'Index created successfully' as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- All tables, indexes, and functions have been created.
-- Your import system is now ready to use!
