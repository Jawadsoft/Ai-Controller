import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addMultipleColorMappings() {
  const client = await pool.connect();
  
  try {
    console.log('🎨 Adding multiple color field mappings to catch all variations...');
    
    // Get the config for your dealer
    const configResult = await client.query(`
      SELECT id, config_name, dealer_id
      FROM import_configs 
      WHERE dealer_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, ['f0cb09da-a8f0-4971-84e6-492f2ee8eda3']);
    
    if (configResult.rows.length === 0) {
      console.log('❌ No import configs found');
      return;
    }
    
    const configId = configResult.rows[0].id;
    console.log(`📋 Using config: ${configResult.rows[0].config_name} (${configId})`);
    
    // Delete existing color mappings
    console.log('🗑️ Deleting existing color mappings...');
    await client.query(`
      DELETE FROM import_field_mappings 
      WHERE import_config_id = $1 
      AND target_field IN ('exterior_color', 'interior_color')
    `, [configId]);
    
    // Add multiple color field variations
    const colorMappings = [
      // Exterior Color variations
      { source: 'Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Exterior Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'ExteriorColor', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'EXT_COLOR', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'ExtColor', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Paint Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'PaintColor', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Body Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'BodyColor', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Vehicle Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'VehicleColor', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Car Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'CarColor', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Exterior', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'EXT', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Color Code', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'ColorCode', target: 'exterior_color', type: 'text', required: true, order: 9 },
      
      // Interior Color variations
      { source: 'Interior Color', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'InteriorColor', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'INT_COLOR', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'IntColor', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'Interior', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'INT', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'Upholstery', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'Upholstery Color', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'Seat Color', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'SeatColor', target: 'interior_color', type: 'text', required: true, order: 10 }
    ];
    
    console.log(`\n📝 Adding ${colorMappings.length} color field mappings...`);
    
    // Insert color mappings
    for (const mapping of colorMappings) {
      try {
        await client.query(`
          INSERT INTO import_field_mappings (
            import_config_id, 
            source_field, 
            target_field, 
            field_type, 
            is_required, 
            field_order,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [
          configId,
          mapping.source,
          mapping.target,
          mapping.type,
          mapping.required,
          mapping.order
        ]);
        
        console.log(`  ✅ ${mapping.source} → ${mapping.target} (${mapping.type})`);
      } catch (error) {
        console.log(`  ❌ Failed to insert ${mapping.source}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Color field mappings added successfully!');
    console.log('\n💡 Now try importing again - it should catch the color field regardless of the exact column name in your CSV.');
    
  } catch (error) {
    console.error('💥 Color mapping addition failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the addition
addMultipleColorMappings().catch(console.error);
