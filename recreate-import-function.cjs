const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function recreateImportFunction() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Recreating import_vehicle_from_csv function...');
    
    // First, drop any existing functions with this name
    console.log('🗑️ Dropping existing functions...');
    await client.query(`
      DROP FUNCTION IF EXISTS import_vehicle_from_csv(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, INTEGER, TEXT);
    `);
    
    await client.query(`
      DROP FUNCTION IF EXISTS import_vehicle_from_csv(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, INTEGER, TEXT);
    `);
    
    await client.query(`
      DROP FUNCTION IF EXISTS import_vehicle_from_csv();
    `);
    
    console.log('✅ Dropped existing functions');
    
    // Check if we need to add missing columns to vehicles table
    console.log('🔍 Checking for missing columns...');
    
    const missingColumns = [
      { name: 'new_used', type: 'TEXT DEFAULT \'used\'', check: 'new_used' },
      { name: 'vehicle_type', type: 'TEXT', check: 'vehicle_type' },
      { name: 'series', type: 'TEXT', check: 'series' },
      { name: 'other_price', type: 'DECIMAL', check: 'other_price' },
      { name: 'dealer_discount', type: 'DECIMAL', check: 'dealer_discount' },
      { name: 'consumer_rebate', type: 'DECIMAL', check: 'consumer_rebate' },
      { name: 'dealer_accessories', type: 'DECIMAL', check: 'dealer_accessories' },
      { name: 'total_customer_savings', type: 'DECIMAL', check: 'total_customer_savings' },
      { name: 'total_dealer_rebate', type: 'DECIMAL', check: 'total_dealer_rebate' },
      { name: 'photo_url_list', type: 'TEXT[]', check: 'photo_url_list' },
      { name: 'import_source', type: 'TEXT', check: 'import_source' },
      { name: 'import_date', type: 'TIMESTAMP', check: 'import_date' },
      { name: 'reference_dealer_id', type: 'TEXT', check: 'reference_dealer_id' }
    ];
    
    for (const column of missingColumns) {
      try {
        const columnExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'vehicles' 
            AND column_name = $1
          );
        `, [column.name]);
        
        if (!columnExists.rows[0].exists) {
          console.log(`➕ Adding missing column: ${column.name}`);
          await client.query(`ALTER TABLE vehicles ADD COLUMN ${column.name} ${column.type};`);
        } else {
          console.log(`✅ Column ${column.name} already exists`);
        }
      } catch (error) {
        console.log(`⚠️ Could not add column ${column.name}: ${error.message}`);
      }
    }
    
    // Now create the correct function with 28 parameters
    console.log('🔧 Creating import_vehicle_from_csv function...');
    
    const functionSQL = `
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
          p_price DECIMAL DEFAULT NULL,
          p_other_price DECIMAL DEFAULT NULL,
          p_transmission TEXT DEFAULT NULL,
          p_msrp DECIMAL DEFAULT NULL,
          p_dealer_discount DECIMAL DEFAULT NULL,
          p_consumer_rebate DECIMAL DEFAULT NULL,
          p_dealer_accessories DECIMAL DEFAULT NULL,
          p_total_customer_savings DECIMAL DEFAULT NULL,
          p_total_dealer_rebate DECIMAL DEFAULT NULL,
          p_photo_url_list TEXT DEFAULT NULL,
          p_year INTEGER DEFAULT NULL,
          p_reference_dealer_id TEXT DEFAULT NULL
      ) RETURNS UUID AS $$
      DECLARE
          v_vehicle_id UUID;
          v_photo_urls TEXT[];
      BEGIN
          -- Convert photo_url_list from formatted string to array
          IF p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN
              -- Remove curly brackets and split by comma
              v_photo_urls := string_to_array(
                  trim(both '{}' from p_photo_url_list), 
                  ','
              );
              -- Trim whitespace from each URL
              SELECT array_agg(trim(url)) INTO v_photo_urls 
              FROM unnest(v_photo_urls) AS url 
              WHERE trim(url) != '';
          ELSE
              v_photo_urls := NULL;
          END IF;

          -- Check if vehicle already exists by VIN
          SELECT id INTO v_vehicle_id 
          FROM vehicles 
          WHERE vin = p_vin AND dealer_id = p_dealer_id;

          IF v_vehicle_id IS NOT NULL THEN
              -- Update existing vehicle
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
                  updated_at = NOW()
              WHERE id = v_vehicle_id;
          ELSE
              -- Insert new vehicle
              INSERT INTO vehicles (
                  dealer_id, vin, make, model, series, stock_number, new_used, body_style, vehicle_type, certified,
                  color, interior_color, engine_type, displacement, features, odometer,
                  price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
                  dealer_accessories, total_customer_savings, total_dealer_rebate,
                  photo_url_list, year, import_source, import_date, reference_dealer_id
              ) VALUES (
                  p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_vehicle_type, p_certified,
                  p_color, p_interior_color, p_engine_type, p_displacement, 
                  CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE NULL END,
                  p_odometer, p_price, p_other_price, p_transmission, p_msrp, p_dealer_discount,
                  p_consumer_rebate, p_dealer_accessories, p_total_customer_savings, p_total_dealer_rebate,
                  v_photo_urls, p_year, 'csv', NOW(), p_reference_dealer_id
              ) RETURNING id INTO v_vehicle_id;
          END IF;
          
          RETURN v_vehicle_id;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(functionSQL);
    
    console.log('✅ import_vehicle_from_csv function created successfully!');
    console.log('📊 Function parameters: 28');
    console.log('🎯 Function is ready for CSV imports!');
    
    // Verify the function was created correctly
    const functionParams = await client.query(`
      SELECT parameter_name, data_type, parameter_default, ordinal_position
      FROM information_schema.parameters 
      WHERE specific_name = 'import_vehicle_from_csv'
      ORDER BY ordinal_position;
    `);
    
    console.log(`\n📋 Function verification - Parameters (${functionParams.rows.length}):`);
    functionParams.rows.forEach(param => {
      console.log(`  ${param.ordinal_position}. ${param.parameter_name}: ${param.data_type} ${param.parameter_default ? `(default: ${param.parameter_default})` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error recreating import function:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

recreateImportFunction().catch(console.error);
