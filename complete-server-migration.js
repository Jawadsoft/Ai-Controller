import { Pool } from 'pg';
import fs from 'fs';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runCompleteMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting complete database migration...');
    console.log(`📡 Connected to database: ${process.env.DATABASE_URL ? 'Production' : 'Local'}`);
    
    // Step 1: Drop existing tables and functions
    console.log('\n📋 Step 1: Dropping existing tables and functions...');
    const dropStatements = [
      'DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE',
      'DROP FUNCTION IF EXISTS get_dealer_vehicles_count CASCADE',
      'DROP FUNCTION IF EXISTS search_vehicles CASCADE',
      'DROP FUNCTION IF EXISTS update_updated_at_column CASCADE',
      'DROP TRIGGER IF EXISTS update_users_updated_at ON users',
      'DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles',
      'DROP TRIGGER IF EXISTS update_dealers_updated_at ON dealers',
      'DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles',
      'DROP TRIGGER IF EXISTS update_leads_updated_at ON leads',
      'DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans',
      'DROP TABLE IF EXISTS import_field_mappings CASCADE',
      'DROP TABLE IF EXISTS import_schedule_settings CASCADE',
      'DROP TABLE IF EXISTS import_file_settings CASCADE',
      'DROP TABLE IF EXISTS import_connection_settings CASCADE',
      'DROP TABLE IF EXISTS import_configs CASCADE',
      'DROP TABLE IF EXISTS leads CASCADE',
      'DROP TABLE IF EXISTS vehicles CASCADE',
      'DROP TABLE IF EXISTS dealers CASCADE',
      'DROP TABLE IF EXISTS user_roles CASCADE',
      'DROP TABLE IF EXISTS users CASCADE',
      'DROP TABLE IF EXISTS subscription_plans CASCADE'
    ];
    
    for (const statement of dropStatements) {
      try {
        await client.query(statement);
        console.log(`✅ Dropped: ${statement.split(' ')[2]}`);
      } catch (error) {
        console.log(`⚠️ Drop warning: ${error.message}`);
      }
    }
    
    // Step 2: Enable extensions
    console.log('\n📋 Step 2: Enabling extensions...');
    const extensions = [
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'
    ];
    
    for (const ext of extensions) {
      try {
        await client.query(ext);
        console.log(`✅ Extension enabled: ${ext.split('"')[1]}`);
      } catch (error) {
        console.log(`⚠️ Extension warning: ${error.message}`);
      }
    }
    
    // Step 3: Create ENUM types
    console.log('\n📋 Step 3: Creating ENUM types...');
    const enumTypes = [
      "CREATE TYPE IF NOT EXISTS subscription_plan AS ENUM ('basic', 'premium', 'enterprise')",
      "CREATE TYPE IF NOT EXISTS user_role AS ENUM ('super_admin', 'dealer', 'client')"
    ];
    
    for (const enumType of enumTypes) {
      try {
        await client.query(enumType);
        console.log(`✅ ENUM type created: ${enumType.split(' ')[4]}`);
      } catch (error) {
        console.log(`⚠️ ENUM type warning: ${error.message}`);
      }
    }
    
    // Step 4: Create users table
    console.log('\n📋 Step 4: Creating users table...');
    await client.query(`
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
      )
    `);
    console.log('✅ Users table created');
    
    // Step 5: Create user_roles table
    console.log('\n📋 Step 5: Creating user_roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role user_role DEFAULT 'dealer' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ User_roles table created');
    
    // Step 6: Create dealers table
    console.log('\n📋 Step 6: Creating dealers table...');
    await client.query(`
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Dealers table created');
    
    // Step 7: Create vehicles table
    console.log('\n📋 Step 7: Creating vehicles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
        vin TEXT NOT NULL UNIQUE,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        trim TEXT,
        color TEXT,
        mileage INTEGER,
        price NUMERIC,
        description TEXT,
        features TEXT[],
        images TEXT[],
        status TEXT DEFAULT 'available',
        qr_code_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        stock_number TEXT,
        body_style TEXT,
        certified BOOLEAN DEFAULT false,
        interior_color TEXT,
        engine_type TEXT,
        displacement TEXT,
        transmission TEXT,
        msrp NUMERIC,
        dealer_discount NUMERIC,
        consumer_rebate NUMERIC,
        dealer_accessories NUMERIC,
        total_customer_savings NUMERIC,
        total_dealer_rebate NUMERIC,
        other_price NUMERIC,
        photo_url_list TEXT[],
        odometer INTEGER,
        import_source TEXT DEFAULT 'manual',
        import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        series TEXT,
        reference_dealer_id TEXT,
        new_used VARCHAR(10) DEFAULT 'used',
        vehicle_type TEXT
      )
    `);
    console.log('✅ Vehicles table created');
    
    // Step 8: Create import_configs table
    console.log('\n📋 Step 8: Creating import_configs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_configs (
        id SERIAL PRIMARY KEY,
        dealer_id VARCHAR(255) NOT NULL,
        config_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (dealer_id, config_name)
      )
    `);
    console.log('✅ Import_configs table created');
    
    // Step 9: Create import_connection_settings table
    console.log('\n📋 Step 9: Creating import_connection_settings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_connection_settings (
        id SERIAL PRIMARY KEY,
        import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
        connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('ftp', 'sftp', 'http', 'https')),
        host_url VARCHAR(500) NOT NULL,
        port INTEGER DEFAULT 21,
        username VARCHAR(255) NOT NULL,
        password_encrypted TEXT NOT NULL,
        remote_directory VARCHAR(500) DEFAULT '/',
        file_pattern VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_connection_settings table created');
    
    // Step 10: Create import_file_settings table
    console.log('\n📋 Step 10: Creating import_file_settings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_file_settings (
        id SERIAL PRIMARY KEY,
        import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
        file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'txt', 'xlsx', 'xls')),
        delimiter VARCHAR(10) DEFAULT ',',
        has_header BOOLEAN DEFAULT true,
        encoding VARCHAR(20) DEFAULT 'UTF-8',
        date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_file_settings table created');
    
    // Step 11: Create import_schedule_settings table
    console.log('\n📋 Step 11: Creating import_schedule_settings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_schedule_settings (
        id SERIAL PRIMARY KEY,
        import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
        frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'hourly')),
        time_hour INTEGER DEFAULT 0 CHECK (time_hour >= 0 AND time_hour <= 23),
        time_minute INTEGER DEFAULT 0 CHECK (time_minute >= 0 AND time_minute <= 59),
        day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
        day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
        is_active BOOLEAN DEFAULT true,
        last_run TIMESTAMP WITHOUT TIME ZONE,
        next_run TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_schedule_settings table created');
    
    // Step 12: Create import_field_mappings table
    console.log('\n📋 Step 12: Creating import_field_mappings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_field_mappings (
        id SERIAL PRIMARY KEY,
        import_config_id INTEGER REFERENCES import_configs(id) ON DELETE CASCADE,
        source_field VARCHAR(255) NOT NULL,
        target_field VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'array')),
        is_required BOOLEAN DEFAULT false,
        default_value TEXT,
        transformation_rule TEXT,
        field_order INTEGER NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_field_mappings table created');
    
    // Step 13: Create additional tables
    console.log('\n📋 Step 13: Creating additional tables...');
    
    // Subscription plans table
    await client.query(`
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
      )
    `);
    console.log('✅ Subscription_plans table created');
    
    // Leads table
    await client.query(`
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
      )
    `);
    console.log('✅ Leads table created');
    
    // Step 14: Create indexes
    console.log('\n📋 Step 14: Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_dealers_user_id ON dealers(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_dealers_business_name ON dealers(business_name)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_dealer_id ON vehicles(dealer_id)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status)',
      'CREATE INDEX IF NOT EXISTS idx_import_configs_dealer_id ON import_configs(dealer_id)',
      'CREATE INDEX IF NOT EXISTS idx_import_connection_settings_config_id ON import_connection_settings(import_config_id)',
      'CREATE INDEX IF NOT EXISTS idx_import_file_settings_config_id ON import_file_settings(import_config_id)',
      'CREATE INDEX IF NOT EXISTS idx_import_schedule_settings_config_id ON import_schedule_settings(import_config_id)',
      'CREATE INDEX IF NOT EXISTS idx_import_field_mappings_config_id ON import_field_mappings(import_config_id)',
      'CREATE INDEX IF NOT EXISTS idx_import_field_mappings_order ON import_field_mappings(import_config_id, field_order)',
      'CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id)',
      'CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON leads(vehicle_id)',
      'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)'
    ];
    
    for (const index of indexes) {
      try {
        await client.query(index);
        console.log(`✅ Index created: ${index.split(' ')[4]}`);
      } catch (error) {
        console.log(`⚠️ Index creation warning: ${error.message}`);
      }
    }
    
    // Step 15: Create triggers and functions
    console.log('\n📋 Step 15: Creating triggers and functions...');
    
    // Function to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Update timestamp function created');
    
    // Create triggers for updated_at
    const tablesWithUpdatedAt = ['users', 'user_roles', 'dealers', 'vehicles', 'leads', 'subscription_plans'];
    for (const table of tablesWithUpdatedAt) {
      try {
        await client.query(`
          DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
          CREATE TRIGGER update_${table}_updated_at
            BEFORE UPDATE ON ${table}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);
        console.log(`✅ Trigger created for ${table}`);
      } catch (error) {
        console.log(`⚠️ Trigger creation warning for ${table}: ${error.message}`);
      }
    }
    
    // Step 16: Create import_vehicle_from_csv function
    console.log('\n📋 Step 16: Creating import_vehicle_from_csv function...');
    await client.query(`
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
        p_reference_dealer_id TEXT DEFAULT NULL
      ) RETURNS UUID AS $$
      DECLARE
        v_vehicle_id UUID;
        v_features_array TEXT[];
        v_photo_urls_array TEXT[];
      BEGIN
        -- Check if dealer exists
        IF NOT EXISTS (SELECT 1 FROM dealers WHERE id = p_dealer_id) THEN
          RAISE EXCEPTION 'Dealer with ID % does not exist', p_dealer_id;
        END IF;
        
        -- Convert features string to array if provided
        IF p_features IS NOT NULL AND p_features != '' THEN
          v_features_array := string_to_array(p_features, ',');
        ELSE
          v_features_array := NULL;
        END IF;
        
        -- Convert photo URLs string to array if provided
        IF p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN
          v_photo_urls_array := string_to_array(p_photo_url_list, ',');
        ELSE
          v_photo_urls_array := NULL;
        END IF;
        
        -- Insert or update vehicle
        INSERT INTO vehicles (
          dealer_id, vin, make, model, series, stock_number, new_used, body_style, vehicle_type,
          certified, color, interior_color, engine_type, displacement, features, odometer,
          price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
          dealer_accessories, total_customer_savings, total_dealer_rebate, photo_url_list,
          year, reference_dealer_id, import_source, import_date, created_at, updated_at
        ) VALUES (
          p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_vehicle_type,
          p_certified, p_color, p_interior_color, p_engine_type, p_displacement, v_features_array, p_odometer,
          p_price, p_other_price, p_transmission, p_msrp, p_dealer_discount, p_consumer_rebate,
          p_dealer_accessories, p_total_customer_savings, p_total_dealer_rebate, v_photo_urls_array,
          p_year, p_reference_dealer_id, 'csv_import', NOW(), NOW(), NOW()
        )
        ON CONFLICT (vin) DO UPDATE SET
          dealer_id = EXCLUDED.dealer_id,
          make = EXCLUDED.make,
          model = EXCLUDED.model,
          series = EXCLUDED.series,
          stock_number = EXCLUDED.stock_number,
          new_used = EXCLUDED.new_used,
          body_style = EXCLUDED.body_style,
          vehicle_type = EXCLUDED.vehicle_type,
          certified = EXCLUDED.certified,
          color = EXCLUDED.color,
          interior_color = EXCLUDED.interior_color,
          engine_type = EXCLUDED.engine_type,
          displacement = EXCLUDED.displacement,
          features = EXCLUDED.features,
          odometer = EXCLUDED.odometer,
          price = EXCLUDED.price,
          other_price = EXCLUDED.other_price,
          transmission = EXCLUDED.transmission,
          msrp = EXCLUDED.msrp,
          dealer_discount = EXCLUDED.dealer_discount,
          consumer_rebate = EXCLUDED.consumer_rebate,
          dealer_accessories = EXCLUDED.dealer_accessories,
          total_customer_savings = EXCLUDED.total_customer_savings,
          total_dealer_rebate = EXCLUDED.total_dealer_rebate,
          photo_url_list = EXCLUDED.photo_url_list,
          year = EXCLUDED.year,
          reference_dealer_id = EXCLUDED.reference_dealer_id,
          import_source = 'csv_import',
          import_date = NOW(),
          updated_at = NOW()
        RETURNING id INTO v_vehicle_id;
        
        RETURN v_vehicle_id;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Import_vehicle_from_csv function created');
    
    // Step 17: Create additional utility functions
    console.log('\n📋 Step 17: Creating utility functions...');
    
    // Function to get dealer vehicles count
    await client.query(`
      CREATE OR REPLACE FUNCTION get_dealer_vehicles_count(p_dealer_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
        v_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_count
        FROM vehicles
        WHERE dealer_id = p_dealer_id;
        
        RETURN v_count;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Get dealer vehicles count function created');
    
    // Function to search vehicles
    await client.query(`
      CREATE OR REPLACE FUNCTION search_vehicles(
        p_dealer_id UUID,
        p_search_term TEXT DEFAULT NULL,
        p_make TEXT DEFAULT NULL,
        p_model TEXT DEFAULT NULL,
        p_year_min INTEGER DEFAULT NULL,
        p_year_max INTEGER DEFAULT NULL,
        p_price_min NUMERIC DEFAULT NULL,
        p_price_max NUMERIC DEFAULT NULL
      ) RETURNS TABLE (
        id UUID,
        vin TEXT,
        make TEXT,
        model TEXT,
        year INTEGER,
        price NUMERIC,
        color TEXT,
        mileage INTEGER,
        status TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT v.id, v.vin, v.make, v.model, v.year, v.price, v.color, v.mileage, v.status
        FROM vehicles v
        WHERE v.dealer_id = p_dealer_id
        AND (p_search_term IS NULL OR 
             v.make ILIKE '%' || p_search_term || '%' OR 
             v.model ILIKE '%' || p_search_term || '%' OR
             v.vin ILIKE '%' || p_search_term || '%')
        AND (p_make IS NULL OR v.make = p_make)
        AND (p_model IS NULL OR v.model = p_model)
        AND (p_year_min IS NULL OR v.year >= p_year_min)
        AND (p_year_max IS NULL OR v.year <= p_year_max)
        AND (p_price_min IS NULL OR v.price >= p_price_min)
        AND (p_price_max IS NULL OR v.price <= p_price_max)
        ORDER BY v.created_at DESC;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Search vehicles function created');
    
    // Step 18: Insert sample data
    console.log('\n📋 Step 18: Inserting sample data...');
    
    // Insert test dealer
    try {
      await client.query(`
        INSERT INTO dealers (id, business_name, contact_name, email, phone, address, city, state, zip_code) VALUES
        ('0aa94346-ed1d-420e-8823-bcd97bf6456f', 'Test Dealer', 'John Doe', 'test@dealer.com', '555-1234', '123 Main St', 'Test City', 'TS', '12345')
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✅ Test dealer inserted');
    } catch (error) {
      console.log('⚠️ Dealer insertion warning:', error.message);
    }
    
    // Insert default import config
    try {
      await client.query(`
        INSERT INTO import_configs (id, dealer_id, config_name, is_active) VALUES
        (1, '0aa94346-ed1d-420e-8823-bcd97bf6456f', 'Default Import Config', true)
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✅ Default import config inserted');
    } catch (error) {
      console.log('⚠️ Config insertion warning:', error.message);
    }
    
    // Insert field mappings
    const fieldMappings = [
      [1, 'VIN', 'vin', 'text', 1, true],
      [1, 'Make', 'make', 'text', 2, true],
      [1, 'Model', 'model', 'text', 3, true],
      [1, 'Year', 'year', 'number', 4, true],
      [1, 'Price', 'price', 'number', 5, false],
      [1, 'Color', 'color', 'text', 6, false],
      [1, 'Odometer', 'odometer', 'number', 7, false]
    ];
    
    for (const mapping of fieldMappings) {
      try {
        await client.query(`
          INSERT INTO import_field_mappings (import_config_id, source_field, target_field, field_type, field_order, is_required) VALUES
          ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (import_config_id, source_field) DO NOTHING
        `, mapping);
      } catch (error) {
        console.log('⚠️ Field mapping insertion warning:', error.message);
      }
    }
    console.log('✅ Field mappings inserted');
    
    // Insert subscription plans
    const subscriptionPlans = [
      ['basic', 'Basic Plan', 'Basic vehicle management features', 29.99, 299.99, 100, 50],
      ['premium', 'Premium Plan', 'Advanced features with analytics', 59.99, 599.99, 500, 200],
      ['enterprise', 'Enterprise Plan', 'Full features for large dealerships', 99.99, 999.99, -1, -1]
    ];
    
    for (const plan of subscriptionPlans) {
      try {
        await client.query(`
          INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads) VALUES
          ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (name) DO NOTHING
        `, plan);
      } catch (error) {
        console.log('⚠️ Subscription plan insertion warning:', error.message);
      }
    }
    console.log('✅ Subscription plans inserted');
    
    console.log('\n🎉 Complete migration completed successfully!');
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:', tablesResult.rows.map(row => row.table_name));
    
    const functionResult = await client.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname IN ('import_vehicle_from_csv', 'get_dealer_vehicles_count', 'search_vehicles', 'update_updated_at_column')
      ORDER BY proname
    `);
    
    console.log('🔧 Functions created:', functionResult.rows.map(row => `${row.proname} (${row.pronargs} args)`));
    
    const triggerResult = await client.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);
    
    console.log('⚡ Triggers created:', triggerResult.rows.map(row => `${row.trigger_name} on ${row.event_object_table}`));
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runCompleteMigration().catch(console.error);
