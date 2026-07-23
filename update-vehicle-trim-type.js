/**
 * Update Vehicle Table with Trim and Type Data
 * Populates missing trim and type information based on existing column data
 * This ensures the AI bot has all fields needed for effective communication
 */

import { pool } from './src/database/connection.js';

console.log('🚗 Updating Vehicle Table with Trim and Type Data...');

async function updateVehicleTable() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('✅ Database connected');
    
    // First, let's see what we're working with
    console.log('\n1. Checking current vehicle data structure...');
    const sampleQuery = `
      SELECT id, make, model, trim, vehicle_type, body_style, year, price, status
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      LIMIT 5
    `;
    
    const sampleResult = await client.query(sampleQuery);
    console.log('📊 Sample vehicle data:');
    sampleResult.rows.forEach((vehicle, index) => {
      console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} ${vehicle.trim || 'NO TRIM'} - Type: ${vehicle.vehicle_type || vehicle.body_style || 'NO TYPE'}`);
    });
    
    // Check what needs updating
    console.log('\n2. Analyzing data that needs updates...');
    const needsUpdateQuery = `
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN trim IS NULL OR trim = '' THEN 1 END) as missing_trim,
        COUNT(CASE WHEN vehicle_type IS NULL OR vehicle_type = '' THEN 1 END) as missing_type,
        COUNT(CASE WHEN (trim IS NULL OR trim = '') AND (vehicle_type IS NULL OR vehicle_type = '') THEN 1 END) as missing_both
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const needsUpdateResult = await client.query(needsUpdateQuery);
    const stats = needsUpdateResult.rows[0];
    
    console.log(`📊 Update Statistics:`);
    console.log(`   Total vehicles: ${stats.total_vehicles}`);
    console.log(`   Missing trim: ${stats.missing_trim}`);
    console.log(`   Missing type: ${stats.missing_type}`);
    console.log(`   Missing both: ${stats.missing_both}`);
    
    if (stats.missing_trim === 0 && stats.missing_type === 0) {
      console.log('✅ All vehicles already have trim and type data!');
      return;
    }
    
    // Start updating vehicles
    console.log('\n3. Updating vehicle data...');
    
    // Update 1: Set vehicle_type based on body_style if vehicle_type is missing
    console.log('   🔄 Updating vehicle_type from body_style...');
    const updateTypeQuery = `
      UPDATE vehicles 
      SET vehicle_type = CASE 
        WHEN body_style ILIKE '%sport utility%' OR body_style ILIKE '%suv%' THEN 'SUV'
        WHEN body_style ILIKE '%sedan%' THEN 'sedan'
        WHEN body_style ILIKE '%coupe%' THEN 'coupe'
        WHEN body_style ILIKE '%hatchback%' THEN 'hatchback'
        WHEN body_style ILIKE '%convertible%' THEN 'convertible'
        WHEN body_style ILIKE '%crew cab%' OR body_style ILIKE '%supercrew%' THEN 'truck'
        WHEN body_style ILIKE '%standard cab%' THEN 'truck'
        WHEN body_style ILIKE '%passenger van%' THEN 'van'
        WHEN body_style ILIKE '%wagon%' THEN 'wagon'
        WHEN body_style ILIKE '%pickup%' THEN 'truck'
        ELSE 'sedan'
      END
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND (vehicle_type IS NULL OR vehicle_type = '')
    `;
    
    const updateTypeResult = await client.query(updateTypeQuery);
    console.log(`   ✅ Updated ${updateTypeResult.rowCount} vehicles with vehicle_type`);
    
    // Update 2: Set trim based on model and other data if trim is missing
    console.log('   🔄 Updating trim information...');
    const updateTrimQuery = `
      UPDATE vehicles 
      SET trim = CASE 
        -- Toyota models
        WHEN make ILIKE '%toyota%' AND model ILIKE '%rav4%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Limited'
            WHEN price >= 35000 THEN 'XLE Premium'
            WHEN price >= 30000 THEN 'XLE'
            WHEN price >= 25000 THEN 'LE'
            ELSE 'Base'
          END
        WHEN make ILIKE '%toyota%' AND model ILIKE '%camry%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'XSE V6'
            WHEN price >= 35000 THEN 'XLE'
            WHEN price >= 30000 THEN 'SE'
            WHEN price >= 25000 THEN 'LE'
            ELSE 'Base'
          END
        WHEN make ILIKE '%toyota%' AND model ILIKE '%corolla%' THEN 
          CASE 
            WHEN price >= 30000 THEN 'SE'
            WHEN price >= 25000 THEN 'LE'
            ELSE 'Base'
          END
        WHEN make ILIKE '%toyota%' AND model ILIKE '%highlander%' THEN 
          CASE 
            WHEN price >= 50000 THEN 'Platinum'
            WHEN price >= 45000 THEN 'Limited'
            WHEN price >= 40000 THEN 'XLE'
            WHEN price >= 35000 THEN 'LE'
            ELSE 'Base'
          END
          
        -- Honda models
        WHEN make ILIKE '%honda%' AND model ILIKE '%cr-v%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Touring'
            WHEN price >= 35000 THEN 'EX-L'
            WHEN price >= 30000 THEN 'EX'
            WHEN price >= 25000 THEN 'LX'
            ELSE 'Base'
          END
        WHEN make ILIKE '%honda%' AND model ILIKE '%accord%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Touring'
            WHEN price >= 35000 THEN 'EX-L'
            WHEN price >= 30000 THEN 'EX'
            WHEN price >= 25000 THEN 'LX'
            ELSE 'Base'
          END
        WHEN make ILIKE '%honda%' AND model ILIKE '%pilot%' THEN 
          CASE 
            WHEN price >= 50000 THEN 'Elite'
            WHEN price >= 45000 THEN 'Touring'
            WHEN price >= 40000 THEN 'EX-L'
            WHEN price >= 35000 THEN 'EX'
            ELSE 'Base'
          END
          
        -- Hyundai models
        WHEN make ILIKE '%hyundai%' AND model ILIKE '%tucson%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Limited'
            WHEN price >= 35000 THEN 'SEL Convenience'
            WHEN price >= 30000 THEN 'SEL'
            WHEN price >= 25000 THEN 'SE'
            ELSE 'Base'
          END
        WHEN make ILIKE '%hyundai%' AND model ILIKE '%santa fe%' THEN 
          CASE 
            WHEN price >= 50000 THEN 'Calligraphy'
            WHEN price >= 45000 THEN 'Limited'
            WHEN price >= 40000 THEN 'SEL Premium'
            WHEN price >= 35000 THEN 'SEL'
            ELSE 'Base'
          END
        WHEN make ILIKE '%hyundai%' AND model ILIKE '%palisade%' THEN 
          CASE 
            WHEN price >= 55000 THEN 'Calligraphy'
            WHEN price >= 50000 THEN 'Limited'
            WHEN price >= 45000 THEN 'SEL Premium'
            WHEN price >= 40000 THEN 'SEL'
            ELSE 'Base'
          END
          
        -- Ford models
        WHEN make ILIKE '%ford%' AND model ILIKE '%escape%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Titanium'
            WHEN price >= 35000 THEN 'SE'
            WHEN price >= 30000 THEN 'S'
            ELSE 'Base'
          END
        WHEN make ILIKE '%ford%' AND model ILIKE '%explorer%' THEN 
          CASE 
            WHEN price >= 50000 THEN 'Platinum'
            WHEN price >= 45000 THEN 'Limited'
            WHEN price >= 40000 THEN 'XLT'
            WHEN price >= 35000 THEN 'Base'
            ELSE 'Base'
          END
          
        -- Kia models
        WHEN make ILIKE '%kia%' AND model ILIKE '%sorento%' THEN 
          CASE 
            WHEN price >= 45000 THEN 'SX Prestige'
            WHEN price >= 40000 THEN 'SX'
            WHEN price >= 35000 THEN 'EX'
            WHEN price >= 30000 THEN 'LX'
            ELSE 'Base'
          END
        WHEN make ILIKE '%kia%' AND model ILIKE '%sportage%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'SX Prestige'
            WHEN price >= 35000 THEN 'SX'
            WHEN price >= 30000 THEN 'EX'
            WHEN price >= 25000 THEN 'LX'
            ELSE 'Base'
          END
          
        -- Subaru models
        WHEN make ILIKE '%subaru%' AND model ILIKE '%forester%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Touring'
            WHEN price >= 35000 THEN 'Limited'
            WHEN price >= 30000 THEN 'Premium'
            WHEN price >= 25000 THEN 'Base'
            ELSE 'Base'
          END
        WHEN make ILIKE '%subaru%' AND model ILIKE '%outback%' THEN 
          CASE 
            WHEN price >= 45000 THEN 'Touring XT'
            WHEN price >= 40000 THEN 'Limited'
            WHEN price >= 35000 THEN 'Premium'
            WHEN price >= 30000 THEN 'Base'
            ELSE 'Base'
          END
          
        -- Nissan models
        WHEN make ILIKE '%nissan%' AND model ILIKE '%rogue%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Platinum'
            WHEN price >= 35000 THEN 'SL'
            WHEN price >= 30000 THEN 'SV'
            WHEN price >= 25000 THEN 'S'
            ELSE 'Base'
          END
          
        -- Chevrolet models
        WHEN make ILIKE '%chevrolet%' AND model ILIKE '%equinox%' THEN 
          CASE 
            WHEN price >= 40000 THEN 'Premier'
            WHEN price >= 35000 THEN 'LT'
            WHEN price >= 30000 THEN 'LS'
            ELSE 'Base'
          END
          
        -- Volkswagen models
        WHEN make ILIKE '%volkswagen%' AND model ILIKE '%atlas%' THEN 
          CASE 
            WHEN price >= 50000 THEN 'SEL Premium R-Line'
            WHEN price >= 45000 THEN 'SEL Premium'
            WHEN price >= 40000 THEN 'SEL'
            WHEN price >= 35000 THEN 'SE'
            ELSE 'Base'
          END
          
        -- Mercedes models
        WHEN make ILIKE '%mercedes%' AND model ILIKE '%glc%' THEN 
          CASE 
            WHEN price >= 60000 THEN 'AMG GLC 43'
            WHEN price >= 50000 THEN 'GLC 300 4MATIC'
            WHEN price >= 45000 THEN 'GLC 300'
            ELSE 'Base'
          END
          
        -- Tesla models
        WHEN make ILIKE '%tesla%' AND model ILIKE '%model y%' THEN 
          CASE 
            WHEN price >= 60000 THEN 'Performance'
            WHEN price >= 50000 THEN 'Long Range'
            WHEN price >= 40000 THEN 'Standard Range'
            ELSE 'Base'
          END
          
        -- Default logic based on price
        ELSE 
          CASE 
            WHEN price >= 50000 THEN 'Premium'
            WHEN price >= 40000 THEN 'Limited'
            WHEN price >= 35000 THEN 'SE'
            WHEN price >= 30000 THEN 'LE'
            WHEN price >= 25000 THEN 'Base'
            ELSE 'Base'
          END
      END
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND (trim IS NULL OR trim = '')
    `;
    
    const updateTrimResult = await client.query(updateTrimQuery);
    console.log(`   ✅ Updated ${updateTrimResult.rowCount} vehicles with trim information`);
    
    // Update 3: Set vehicle_type based on make/model if still missing
    console.log('   🔄 Setting vehicle_type based on make/model...');
    const updateTypeFromMakeQuery = `
      UPDATE vehicles 
      SET vehicle_type = CASE 
        -- SUVs
        WHEN model ILIKE '%rav4%' OR model ILIKE '%cr-v%' OR model ILIKE '%escape%' 
             OR model ILIKE '%tucson%' OR model ILIKE '%santa fe%' OR model ILIKE '%palisade%'
             OR model ILIKE '%sorento%' OR model ILIKE '%sportage%' OR model ILIKE '%forester%'
             OR model ILIKE '%outback%' OR model ILIKE '%rogue%' OR model ILIKE '%equinox%'
             OR model ILIKE '%atlas%' OR model ILIKE '%pilot%' OR model ILIKE '%highlander%'
             OR model ILIKE '%bronco%' OR model ILIKE '%passport%' OR model ILIKE '%durango%'
             OR model ILIKE '%glc%' OR model ILIKE '%model y%' THEN 'SUV'
        -- Sedans
        WHEN model ILIKE '%camry%' OR model ILIKE '%accord%' OR model ILIKE '%corolla%'
             OR model ILIKE '%sonata%' OR model ILIKE '%civic%' OR model ILIKE '%altima%'
             OR model ILIKE '%malibu%' OR model ILIKE '%passat%' OR model ILIKE '%a4%'
             OR model ILIKE '%3 series%' OR model ILIKE '%c-class%' THEN 'sedan'
        -- Trucks
        WHEN model ILIKE '%f-150%' OR model ILIKE '%silverado%' OR model ILIKE '%ram%'
             OR model ILIKE '%tacoma%' OR model ILIKE '%tundra%' OR model ILIKE '%frontier%'
             OR model ILIKE '%colorado%' OR model ILIKE '%canyon%' THEN 'truck'
        -- Hatchbacks
        WHEN model ILIKE '%golf%' OR model ILIKE '%focus%' OR model ILIKE '%civic hatch%'
             OR model ILIKE '%corolla hatch%' OR model ILIKE '%veloster%' THEN 'hatchback'
        -- Coupes
        WHEN model ILIKE '%mustang%' OR model ILIKE '%camaro%' OR model ILIKE '%challenger%'
             OR model ILIKE '%brz%' OR model ILIKE '%86%' OR model ILIKE '%miata%' THEN 'coupe'
        -- Convertibles
        WHEN model ILIKE '%mustang convertible%' OR model ILIKE '%camaro convertible%'
             OR model ILIKE '%miata%' OR model ILIKE '%boxster%' THEN 'convertible'
        -- Wagons
        WHEN model ILIKE '%outback%' OR model ILIKE '%alltrack%' OR model ILIKE '%v60%' THEN 'wagon'
        -- Vans
        WHEN model ILIKE '%odyssey%' OR model ILIKE '%sienna%' OR model ILIKE '%pacifica%'
             OR model ILIKE '%carnival%' OR model ILIKE '%transit%' THEN 'van'
        ELSE 'sedan'
      END
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND (vehicle_type IS NULL OR vehicle_type = '')
    `;
    
    const updateTypeFromMakeResult = await client.query(updateTypeFromMakeQuery);
    console.log(`   ✅ Updated ${updateTypeFromMakeResult.rowCount} vehicles with vehicle_type from make/model`);
    
    // Verify the updates
    console.log('\n4. Verifying updates...');
    const verifyQuery = `
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN trim IS NULL OR trim = '' THEN 1 END) as missing_trim,
        COUNT(CASE WHEN vehicle_type IS NULL OR vehicle_type = '' THEN 1 END) as missing_type,
        COUNT(CASE WHEN (trim IS NULL OR trim = '') AND (vehicle_type IS NULL OR vehicle_type = '') THEN 1 END) as missing_both
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
    `;
    
    const verifyResult = await client.query(verifyQuery);
    const finalStats = verifyResult.rows[0];
    
    console.log(`📊 Final Statistics:`);
    console.log(`   Total vehicles: ${finalStats.total_vehicles}`);
    console.log(`   Missing trim: ${finalStats.missing_trim}`);
    console.log(`   Missing type: ${finalStats.missing_type}`);
    console.log(`   Missing both: ${finalStats.missing_both}`);
    
    // Show some examples of updated vehicles
    console.log('\n5. Sample of updated vehicles:');
    const sampleUpdatedQuery = `
      SELECT id, make, model, trim, vehicle_type, body_style, year, price
      FROM vehicles 
      WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      AND trim IS NOT NULL AND trim != ''
      AND vehicle_type IS NOT NULL AND vehicle_type != ''
      ORDER BY make, model, price DESC
      LIMIT 10
    `;
    
    const sampleUpdatedResult = await client.query(sampleUpdatedQuery);
    sampleUpdatedResult.rows.forEach((vehicle, index) => {
      console.log(`   ${index + 1}. ${vehicle.make} ${vehicle.model} ${vehicle.trim} - Type: ${vehicle.vehicle_type} - $${vehicle.price}`);
    });
    
    console.log('\n✅ Vehicle table update completed successfully!');
    console.log('🚗 AI bot now has all the fields needed for effective communication!');
    
  } catch (error) {
    console.error('❌ Error updating vehicle table:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the update
updateVehicleTable().then(() => {
  console.log('\n🏁 Vehicle table update process completed!');
}).catch(error => {
  console.error('❌ Update process failed:', error);
});
