import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration...');
    
    // Step 1: Drop existing tables and functions
    console.log('\n📋 Step 1: Dropping existing tables and functions...');
    
    const dropStatements = [
      'DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE',
      'DROP TABLE IF EXISTS import_field_mappings CASCADE',
      'DROP TABLE IF EXISTS import_schedule_settings CASCADE',
      'DROP TABLE IF EXISTS import_file_settings CASCADE',
      'DROP TABLE IF EXISTS import_connection_settings CASCADE',
      'DROP TABLE IF EXISTS import_configs CASCADE',
      'DROP TABLE IF EXISTS vehicles CASCADE',
      'DROP TABLE IF EXISTS dealers CASCADE'
    ];
    
    for (const statement of dropStatements) {
      try {
        console.log(`⏳ Dropping: ${statement}`);
        await client.query(statement);
        console.log(`✅ Dropped successfully`);
      } catch (error) {
        console.log(`⚠️ Drop warning: ${error.message}`);
      }
    }
    
    // Step 2: Create dealers table
    console.log('\n📋 Step 2: Creating dealers table...');
    await client.query(`
      CREATE TABLE dealers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Dealers table created');
    
    // Step 3: Create vehicles table
    console.log('\n📋 Step 3: Creating vehicles table...');
    await client.query(`
      CREATE TABLE vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
        vin TEXT UNIQUE NOT NULL,
        make TEXT,
        model TEXT,
        series TEXT,
        stock_number TEXT,
        new_used TEXT DEFAULT 'used',
        body_style TEXT,
        vehicle_type TEXT,
        certified BOOLEAN DEFAULT false,
        color TEXT,
        interior_color TEXT,
        engine_type TEXT,
        displacement TEXT,
        features TEXT,
        odometer INTEGER,
        price NUMERIC,
        other_price NUMERIC,
        transmission TEXT,
        msrp NUMERIC,
        dealer_discount NUMERIC,
        consumer_rebate NUMERIC,
        dealer_accessories NUMERIC,
        total_customer_savings NUMERIC,
        total_dealer_rebate NUMERIC,
        photo_url_list TEXT,
        year INTEGER,
        reference_dealer_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Vehicles table created');
    
    // Step 4: Create import_configs table
    console.log('\n📋 Step 4: Creating import_configs table...');
    await client.query(`
      CREATE TABLE import_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_configs table created');
    
    // Step 5: Create import_connection_settings table
    console.log('\n📋 Step 5: Creating import_connection_settings table...');
    await client.query(`
      CREATE TABLE import_connection_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        import_config_id UUID NOT NULL REFERENCES import_configs(id) ON DELETE CASCADE,
        connection_type TEXT NOT NULL,
        host TEXT,
        port INTEGER,
        username TEXT,
        password TEXT,
        database_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_connection_settings table created');
    
    // Step 6: Create import_file_settings table
    console.log('\n📋 Step 6: Creating import_file_settings table...');
    await client.query(`
      CREATE TABLE import_file_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        import_config_id UUID NOT NULL REFERENCES import_configs(id) ON DELETE CASCADE,
        file_type TEXT NOT NULL,
        file_path TEXT,
        delimiter TEXT DEFAULT ',',
        has_header BOOLEAN DEFAULT true,
        encoding TEXT DEFAULT 'utf8',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_file_settings table created');
    
    // Step 7: Create import_schedule_settings table
    console.log('\n📋 Step 7: Creating import_schedule_settings table...');
    await client.query(`
      CREATE TABLE import_schedule_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        import_config_id UUID NOT NULL REFERENCES import_configs(id) ON DELETE CASCADE,
        schedule_type TEXT NOT NULL,
        cron_expression TEXT,
        is_enabled BOOLEAN DEFAULT false,
        last_run TIMESTAMP WITH TIME ZONE,
        next_run TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_schedule_settings table created');
    
    // Step 8: Create import_field_mappings table
    console.log('\n📋 Step 8: Creating import_field_mappings table...');
    await client.query(`
      CREATE TABLE import_field_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        import_config_id UUID NOT NULL REFERENCES import_configs(id) ON DELETE CASCADE,
        csv_field_name TEXT NOT NULL,
        database_field_name TEXT NOT NULL,
        field_order INTEGER NOT NULL,
        is_required BOOLEAN DEFAULT false,
        default_value TEXT,
        transformation_rule TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Import_field_mappings table created');
    
    // Step 9: Create indexes
    console.log('\n📋 Step 9: Creating indexes...');
    const indexStatements = [
      'CREATE INDEX idx_vehicles_dealer_id ON vehicles(dealer_id)',
      'CREATE INDEX idx_vehicles_vin ON vehicles(vin)',
      'CREATE INDEX idx_vehicles_make_model ON vehicles(make, model)',
      'CREATE INDEX idx_import_field_mappings_config_id ON import_field_mappings(import_config_id)',
      'CREATE INDEX idx_import_field_mappings_order ON import_field_mappings(import_config_id, field_order)'
    ];
    
    for (const statement of indexStatements) {
      try {
        console.log(`⏳ Creating index: ${statement}`);
        await client.query(statement);
        console.log(`✅ Index created successfully`);
      } catch (error) {
        console.error(`❌ Index creation failed: ${error.message}`);
        throw error;
      }
    }
    
    // Step 10: Create import_vehicle_from_csv function
    console.log('\n📋 Step 10: Creating import_vehicle_from_csv function...');
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
      BEGIN
        -- Check if dealer exists
        IF NOT EXISTS (SELECT 1 FROM dealers WHERE id = p_dealer_id) THEN
          RAISE EXCEPTION 'Dealer with ID % does not exist', p_dealer_id;
        END IF;
        
        -- Insert or update vehicle
        INSERT INTO vehicles (
          dealer_id, vin, make, model, series, stock_number, new_used, body_style, vehicle_type,
          certified, color, interior_color, engine_type, displacement, features, odometer,
          price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
          dealer_accessories, total_customer_savings, total_dealer_rebate, photo_url_list,
          year, reference_dealer_id, created_at, updated_at
        ) VALUES (
          p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_vehicle_type,
          p_certified, p_color, p_interior_color, p_engine_type, p_displacement, p_features, p_odometer,
          p_price, p_other_price, p_transmission, p_msrp, p_dealer_discount, p_consumer_rebate,
          p_dealer_accessories, p_total_customer_savings, p_total_dealer_rebate, p_photo_url_list,
          p_year, p_reference_dealer_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
          updated_at = CURRENT_TIMESTAMP
        RETURNING id INTO v_vehicle_id;
        
        RETURN v_vehicle_id;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Import_vehicle_from_csv function created');
    
    // Step 11: Insert sample data
    console.log('\n📋 Step 11: Inserting sample data...');
    
    // Insert test dealer
    await client.query(`
      INSERT INTO dealers (id, business_name, contact_name, email, phone, address, city, state, zip_code) VALUES
      ('0aa94346-ed1d-420e-8823-bcd97bf6456f', 'Test Dealer', 'John Doe', 'test@dealer.com', '555-1234', '123 Main St', 'Test City', 'TS', '12345')
    `);
    console.log('✅ Test dealer inserted');
    
    // Insert default import config
    await client.query(`
      INSERT INTO import_configs (id, name, description, is_active) VALUES
      ('550e8400-e29b-41d4-a716-446655440000', 'Default Import Config', 'Default configuration for vehicle imports', true)
    `);
    console.log('✅ Default import config inserted');
    
    // Insert field mappings
    const fieldMappings = [
      ['550e8400-e29b-41d4-a716-446655440000', 'VIN', 'vin', 1, true],
      ['550e8400-e29b-41d4-a716-446655440000', 'Make', 'make', 2, true],
      ['550e8400-e29b-41d4-a716-446655440000', 'Model', 'model', 3, true],
      ['550e8400-e29b-41d4-a716-446655440000', 'Year', 'year', 4, true],
      ['550e8400-e29b-41d4-a716-446655440000', 'Price', 'price', 5, false],
      ['550e8400-e29b-41d4-a716-446655440000', 'Color', 'color', 6, false],
      ['550e8400-e29b-41d4-a716-446655440000', 'Odometer', 'odometer', 7, false]
    ];
    
    for (const mapping of fieldMappings) {
      await client.query(`
        INSERT INTO import_field_mappings (import_config_id, csv_field_name, database_field_name, field_order, is_required) VALUES
        ($1, $2, $3, $4, $5)
      `, mapping);
    }
    console.log('✅ Field mappings inserted');
    
    console.log('\n🎉 Migration completed successfully!');
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('dealers', 'vehicles', 'import_configs', 'import_field_mappings')
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:', tablesResult.rows.map(row => row.table_name));
    
    const functionResult = await client.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv'
    `);
    
    if (functionResult.rows.length > 0) {
      console.log('🔧 Function created:', functionResult.rows[0]);
    } else {
      console.log('❌ Function not found!');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
