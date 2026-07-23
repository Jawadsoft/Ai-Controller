import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function insertFieldMappings() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding import configs...');
    
    // Get available import configs
    const configResult = await client.query(`
      SELECT id, config_name, dealer_id, created_at
      FROM import_configs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (configResult.rows.length === 0) {
      console.log('❌ No import configs found. Please create an import config first.');
      return;
    }
    
    console.log('📋 Available import configs:');
    configResult.rows.forEach((config, index) => {
      console.log(`  ${index + 1}. ID: ${config.id}`);
      console.log(`     Name: ${config.config_name}`);
      console.log(`     Dealer: ${config.dealer_id}`);
      console.log(`     Created: ${config.created_at}`);
      console.log('');
    });
    
    // Use the specific dealer ID you provided
    const targetDealerId = 'f0cb09da-a8f0-4971-84e6-492f2ee8eda3';
    
    // Find config for the specific dealer
    const dealerConfigResult = await client.query(`
      SELECT id, config_name, dealer_id, created_at
      FROM import_configs 
      WHERE dealer_id = $1
      ORDER BY created_at DESC 
      LIMIT 1
    `, [targetDealerId]);
    
    let selectedConfig;
    if (dealerConfigResult.rows.length > 0) {
      selectedConfig = dealerConfigResult.rows[0];
      console.log(`🎯 Found config for dealer ${targetDealerId}: ${selectedConfig.config_name} (${selectedConfig.id})`);
    } else {
      // Use the most recent config if no config found for this dealer
      selectedConfig = configResult.rows[0];
      console.log(`⚠️ No config found for dealer ${targetDealerId}, using most recent: ${selectedConfig.config_name} (${selectedConfig.id})`);
    }
    
    // Always delete existing field mappings first
    console.log('🗑️ Deleting existing field mappings...');
    const deleteResult = await client.query('DELETE FROM import_field_mappings WHERE import_config_id = $1', [selectedConfig.id]);
    console.log(`✅ Deleted ${deleteResult.rowCount} existing field mappings`);
    
    // Define field mappings with valid field types
    const fieldMappings = [
      { source: 'VIN', target: 'vin', type: 'text', required: true, order: 1 },
      { source: 'Year', target: 'year', type: 'number', required: true, order: 2 },
      { source: 'Make', target: 'make', type: 'text', required: true, order: 3 },
      { source: 'Model', target: 'model', type: 'text', required: true, order: 4 },
      { source: 'Series', target: 'series', type: 'text', required: true, order: 5 },
      { source: 'New/Used', target: 'is_new', type: 'boolean', required: true, order: 6 },
      { source: 'Stock #', target: 'stock_number', type: 'text', required: true, order: 7 },
      { source: 'Body', target: 'body_style', type: 'text', required: true, order: 8 },
      { source: 'Color', target: 'exterior_color', type: 'text', required: true, order: 9 },
      { source: 'Interior Color', target: 'interior_color', type: 'text', required: true, order: 10 },
      { source: 'Engine', target: 'engine', type: 'text', required: true, order: 11 },
      { source: 'Transmission', target: 'transmission', type: 'text', required: true, order: 12 },
      { source: 'Odometer', target: 'odometer', type: 'number', required: true, order: 13 },
      { source: 'Price', target: 'price', type: 'number', required: true, order: 14 },
      { source: 'Other Price', target: 'other_price', type: 'number', required: false, order: 15 },
      { source: 'MSRP', target: 'msrp', type: 'number', required: false, order: 16 },
      { source: 'Dealer Discounted', target: 'dealer_discounted', type: 'number', required: false, order: 17 },
      { source: 'Consumer Cash', target: 'consumer_cash', type: 'number', required: false, order: 18 },
      { source: 'Dlr Accessories', target: 'dealer_accessories', type: 'number', required: false, order: 19 },
      { source: 'Total Customer Incentives', target: 'total_customer_incentives', type: 'number', required: false, order: 20 },
      { source: 'Total Dealer Rebate', target: 'total_dealer_rebate', type: 'number', required: false, order: 21 },
      { source: 'Certified', target: 'certified', type: 'boolean', required: false, order: 22 },
      { source: 'Certification', target: 'certification', type: 'text', required: false, order: 23 },
      { source: 'Photo Url List', target: 'photo_url_list', type: 'text', required: true, order: 24 },
      { source: 'Vehicle Detail Link', target: 'vehicle_detail_link', type: 'text', required: false, order: 25 },
      { source: 'Autowriter Description', target: 'description', type: 'text', required: true, order: 26 },
      { source: 'Features', target: 'features', type: 'text', required: false, order: 27 },
      { source: 'DealerId', target: 'reference_dealer_id', type: 'text', required: false, order: 28 }
    ];
    
    console.log(`\n📝 Inserting ${fieldMappings.length} field mappings...`);
    
    // Insert field mappings
    for (const mapping of fieldMappings) {
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
          selectedConfig.id,
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
    
    // Verify insertions
    console.log('\n🔍 Verifying field mappings...');
    const verifyResult = await client.query(`
      SELECT 
        source_field, 
        target_field, 
        field_type, 
        is_required, 
        field_order
      FROM import_field_mappings 
      WHERE import_config_id = $1
      ORDER BY field_order
    `, [selectedConfig.id]);
    
    console.log(`\n📊 Successfully inserted ${verifyResult.rows.length} field mappings:`);
    verifyResult.rows.forEach(row => {
      const required = row.is_required ? 'REQUIRED' : 'optional';
      console.log(`  ${row.field_order}. ${row.source_field} → ${row.target_field} (${row.field_type}, ${required})`);
    });
    
    // Show field type distribution
    console.log('\n📈 Field type distribution:');
    const typeResult = await client.query(`
      SELECT field_type, COUNT(*) as count
      FROM import_field_mappings
      WHERE import_config_id = $1
      GROUP BY field_type
      ORDER BY count DESC
    `, [selectedConfig.id]);
    
    typeResult.rows.forEach(row => {
      console.log(`  - ${row.field_type}: ${row.count} fields`);
    });
    
    console.log('\n🎉 Field mappings inserted successfully!');
    console.log(`\n💡 You can now use config ID: ${selectedConfig.id}`);
    
  } catch (error) {
    console.error('💥 Field mapping insertion failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the insertion
insertFieldMappings().catch(console.error);
