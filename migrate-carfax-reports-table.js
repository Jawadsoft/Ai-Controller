#!/usr/bin/env node

import { pool } from './src/database/connection.js';

/**
 * CARFAX Reports Table Migration
 * Creates the carfax_reports table with all necessary fields for storing CARFAX PDF data
 */
async function createCarfaxReportsTable() {
  try {
    console.log('🚀 Starting CARFAX Reports Table Migration...');

    // Check if table already exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'carfax_reports'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('📋 carfax_reports table already exists, checking structure...');
      
      // Check if new columns exist
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'carfax_reports' 
        AND column_name IN ('certified_pre_owned', 'personal_vehicle', 'commercial_vehicle')
        ORDER BY column_name
      `);
      
      const existingColumns = columnCheck.rows.map(row => row.column_name);
      console.log('📊 Existing vehicle attribute columns:', existingColumns);
      
      // Add missing columns
      const missingColumns = [];
      if (!existingColumns.includes('certified_pre_owned')) missingColumns.push('certified_pre_owned');
      if (!existingColumns.includes('personal_vehicle')) missingColumns.push('personal_vehicle');
      if (!existingColumns.includes('commercial_vehicle')) missingColumns.push('commercial_vehicle');
      
      if (missingColumns.length > 0) {
        console.log('🔧 Adding missing columns:', missingColumns);
        
        for (const column of missingColumns) {
          await pool.query(`
            ALTER TABLE carfax_reports 
            ADD COLUMN ${column} BOOLEAN DEFAULT false
          `);
          console.log(`   ✅ Added ${column} column`);
        }
        
        // Add indexes for new columns
        for (const column of missingColumns) {
          await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_carfax_reports_${column} ON carfax_reports(${column})
          `);
          console.log(`   ✅ Added index for ${column}`);
        }
      } else {
        console.log('✅ All vehicle attribute columns already exist');
      }
      
    } else {
      console.log('📋 Creating carfax_reports table...');
      
      // Create the main table
      await pool.query(`
        CREATE TABLE carfax_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
          report_url TEXT DEFAULT NULL,
          report_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          uploaded_by UUID REFERENCES users(id),
          
          -- Basic report info
          accident_count INTEGER DEFAULT 0,
          service_records INTEGER DEFAULT 0,
          owners INTEGER DEFAULT 0,
          
          -- Title and damage flags
          title_issues BOOLEAN DEFAULT false,
          odometer_rollback BOOLEAN DEFAULT false,
          structural_damage BOOLEAN DEFAULT false,
          airbag_deployment BOOLEAN DEFAULT false,
          flood_damage BOOLEAN DEFAULT false,
          lemon_title BOOLEAN DEFAULT false,
          manufacturer_recall BOOLEAN DEFAULT false,
          
          -- Previous usage flags
          previous_rental BOOLEAN DEFAULT false,
          previous_taxi BOOLEAN DEFAULT false,
          previous_police BOOLEAN DEFAULT false,
          previous_fleet BOOLEAN DEFAULT false,
          previous_lease BOOLEAN DEFAULT false,
          previous_corporate BOOLEAN DEFAULT false,
          previous_government BOOLEAN DEFAULT false,
          previous_auction BOOLEAN DEFAULT false,
          previous_repo BOOLEAN DEFAULT false,
          previous_salvage BOOLEAN DEFAULT false,
          previous_fire BOOLEAN DEFAULT false,
          previous_hail BOOLEAN DEFAULT false,
          previous_theft BOOLEAN DEFAULT false,
          previous_vandalism BOOLEAN DEFAULT false,
          previous_water BOOLEAN DEFAULT false,
          previous_other BOOLEAN DEFAULT false,
          
          -- Vehicle attributes
          certified_pre_owned BOOLEAN DEFAULT false,
          personal_vehicle BOOLEAN DEFAULT false,
          commercial_vehicle BOOLEAN DEFAULT false,
          
          -- Summary and notes
          summary TEXT DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          
          -- Metadata
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('✅ Created carfax_reports table');

      // Create indexes for better performance
      const indexes = [
        'idx_carfax_reports_vehicle_id ON carfax_reports(vehicle_id)',
        'idx_carfax_reports_report_date ON carfax_reports(report_date)',
        'idx_carfax_reports_uploaded_at ON carfax_reports(uploaded_at)',
        'idx_carfax_reports_accident_count ON carfax_reports(accident_count)',
        'idx_carfax_reports_title_issues ON carfax_reports(title_issues)',
        'idx_carfax_reports_certified_pre_owned ON carfax_reports(certified_pre_owned)',
        'idx_carfax_reports_personal_vehicle ON carfax_reports(personal_vehicle)',
        'idx_carfax_reports_commercial_vehicle ON carfax_reports(commercial_vehicle)'
      ];

      for (const index of indexes) {
        await pool.query(`CREATE INDEX IF NOT EXISTS ${index}`);
        console.log(`   ✅ Created index: ${index.split(' ')[0]}`);
      }

      // Add reference to latest CARFAX report in vehicles table
      const vehiclesColumnExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'vehicles' 
          AND column_name = 'latest_carfax_report_id'
        );
      `);

      if (!vehiclesColumnExists.rows[0].exists) {
        await pool.query(`
          ALTER TABLE vehicles 
          ADD COLUMN latest_carfax_report_id UUID REFERENCES carfax_reports(id)
        `);
        console.log('✅ Added latest_carfax_report_id column to vehicles table');
        
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_vehicles_latest_carfax_report_id ON vehicles(latest_carfax_report_id)
        `);
        console.log('✅ Created index for latest_carfax_report_id');
      } else {
        console.log('✅ latest_carfax_report_id column already exists in vehicles table');
      }
    }

    // Verify the final structure
    const finalStructure = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'carfax_reports' 
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Final carfax_reports table structure:');
    finalStructure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'NULL'})`);
    });

    console.log('\n🎉 CARFAX Reports Table Migration Completed Successfully!');
    console.log('📋 Table is ready for storing CARFAX PDF data with all vehicle attributes');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
createCarfaxReportsTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
