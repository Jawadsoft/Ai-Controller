import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function runInventoryStatusMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting inventory status migration...');
    
    // =====================================================
    // STEP 1: ADD INVENTORY_STATUS FIELD TO VEHICLES TABLE
    // =====================================================
    
    console.log('📋 Step 1: Adding inventory_status field to vehicles table...');
    
    // Add inventory_status field to vehicles table
    await client.query(`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS inventory_status TEXT DEFAULT 'available' 
      CHECK (inventory_status IN ('available', 'sold', 'removed'))
    `);
    console.log('✅ Added inventory_status field');
    
    // Add index for better performance when querying by inventory status
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicles_inventory_status ON vehicles(inventory_status)
    `);
    console.log('✅ Added inventory_status index');
    
    // Add index for dealer_id and inventory_status combination
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicles_dealer_inventory_status ON vehicles(dealer_id, inventory_status)
    `);
    console.log('✅ Added dealer_id + inventory_status composite index');
    
    // Update existing vehicles to have 'available' status
    const updateResult = await client.query(`
      UPDATE vehicles 
      SET inventory_status = 'available' 
      WHERE inventory_status IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing vehicles to 'available' status`);
    
    // =====================================================
    // STEP 2: UPDATE IMPORT FUNCTION WITH INVENTORY_STATUS
    // =====================================================
    
    console.log('📋 Step 2: Updating import_vehicle_from_csv function...');
    
    // Drop existing function if it exists
    await client.query(`
      DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE
    `);
    console.log('✅ Dropped existing import function');
    
    // Create the updated function with inventory_status parameter
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
          p_inventory_status TEXT DEFAULT 'available'
      ) RETURNS UUID AS $$
      DECLARE
          v_vehicle_id UUID;
          v_dealer_exists BOOLEAN;
      BEGIN
          -- Check if dealer exists first
          SELECT EXISTS(SELECT 1 FROM dealers WHERE id = p_dealer_id) INTO v_dealer_exists;
          
          IF NOT v_dealer_exists THEN
            RAISE EXCEPTION 'Dealer with ID % does not exist', p_dealer_id;
          END IF;
          
          -- Check if vehicle already exists by VIN
          SELECT id INTO v_vehicle_id FROM vehicles WHERE vin = p_vin AND dealer_id = p_dealer_id;
          
          IF v_vehicle_id IS NOT NULL THEN
            -- Update existing vehicle
            UPDATE vehicles SET
              make = p_make,
              model = p_model,
              year = COALESCE(p_year, year),
              trim = COALESCE(p_series, trim),
              color = COALESCE(p_color, color),
              mileage = COALESCE(p_odometer, mileage),
              price = COALESCE(p_price, price),
              features = CASE WHEN p_features IS NOT NULL AND p_features != '' THEN string_to_array(trim(both '{}' from p_features), ',') ELSE features END,
              images = CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE images END,
              status = 'available',
              inventory_status = COALESCE(p_inventory_status, 'available'),
              stock_number = COALESCE(p_stock_number, stock_number),
              body_style = COALESCE(p_body_style, body_style),
              certified = COALESCE(p_certified, certified),
              interior_color = COALESCE(p_interior_color, interior_color),
              engine_type = COALESCE(p_engine_type, engine_type),
              displacement = COALESCE(p_displacement, displacement),
              transmission = COALESCE(p_transmission, transmission),
              msrp = COALESCE(p_msrp, msrp),
              dealer_discount = COALESCE(p_dealer_discount, dealer_discount),
              consumer_rebate = COALESCE(p_consumer_rebate, consumer_rebate),
              dealer_accessories = COALESCE(p_dealer_accessories, dealer_accessories),
              total_customer_savings = COALESCE(p_total_customer_savings, total_customer_savings),
              total_dealer_rebate = COALESCE(p_total_dealer_rebate, total_dealer_rebate),
              other_price = COALESCE(p_other_price, other_price),
              photo_url_list = CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE photo_url_list END,
              odometer = COALESCE(p_odometer, odometer),
              import_source = 'csv',
              import_date = NOW(),
              reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),
              new_used = COALESCE(p_new_used, new_used),
              vehicle_type = COALESCE(p_vehicle_type, vehicle_type),
              updated_at = NOW()
            WHERE id = v_vehicle_id;
          ELSE
            -- Insert new vehicle
            INSERT INTO vehicles (
              dealer_id, vin, make, model, year, trim, color, mileage, price,
              features, images, status, inventory_status, stock_number, body_style, certified,
              interior_color, engine_type, displacement, transmission, msrp,
              dealer_discount, consumer_rebate, dealer_accessories,
              total_customer_savings, total_dealer_rebate, other_price,
              photo_url_list, odometer, import_source, import_date,
              reference_dealer_id, new_used, vehicle_type, created_at, updated_at
            ) VALUES (
              p_dealer_id, p_vin, p_make, p_model, p_year, p_series, p_color, p_odometer, p_price,
              CASE WHEN p_features IS NOT NULL AND p_features != '' THEN string_to_array(trim(both '{}' from p_features), ',') ELSE NULL END,
              CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE NULL END,
              'available', COALESCE(p_inventory_status, 'available'), p_stock_number, p_body_style, p_certified,
              p_interior_color, p_engine_type, p_displacement, p_transmission, p_msrp,
              p_dealer_discount, p_consumer_rebate, p_dealer_accessories,
              p_total_customer_savings, p_total_dealer_rebate, p_other_price,
              CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE NULL END,
              p_odometer, 'csv', NOW(),
              p_reference_dealer_id, p_new_used, p_vehicle_type, NOW(), NOW()
            ) RETURNING id INTO v_vehicle_id;
          END IF;
          
          RETURN v_vehicle_id;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(functionSQL);
    console.log('✅ Created updated import_vehicle_from_csv function with inventory_status parameter');
    
    // =====================================================
    // STEP 3: VERIFY THE CHANGES
    // =====================================================
    
    console.log('📋 Step 3: Verifying the changes...');
    
    // Verify the inventory_status field was added
    const fieldCheck = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' AND column_name = 'inventory_status'
    `);
    
    if (fieldCheck.rows.length > 0) {
      console.log('✅ inventory_status field verified:', fieldCheck.rows[0]);
    } else {
      console.log('❌ inventory_status field not found');
    }
    
    // Verify the function was created
    const functionCheck = await client.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv'
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log('✅ import_vehicle_from_csv function verified:', functionCheck.rows[0]);
    } else {
      console.log('❌ import_vehicle_from_csv function not found');
    }
    
    // Show current inventory status distribution
    const statusDistribution = await client.query(`
      SELECT inventory_status, COUNT(*) as count 
      FROM vehicles 
      GROUP BY inventory_status 
      ORDER BY inventory_status
    `);
    
    console.log('📊 Current inventory status distribution:');
    statusDistribution.rows.forEach(row => {
      console.log(`   ${row.inventory_status}: ${row.count} vehicles`);
    });
    
    // =====================================================
    // COMPLETION MESSAGE
    // =====================================================
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ Added inventory_status field to vehicles table');
    console.log('✅ Updated import_vehicle_from_csv function with inventory_status parameter');
    console.log('✅ All existing vehicles marked as available');
    console.log('✅ Added performance indexes');
    
    console.log('\n📝 Next steps:');
    console.log('1. Test the CSV import functionality');
    console.log('2. Verify that vehicles not in new inventory are marked as sold');
    console.log('3. Confirm that all new inventory is marked as available');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runInventoryStatusMigration()
    .then(() => {
      console.log('\n✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { runInventoryStatusMigration };
