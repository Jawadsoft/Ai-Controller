import { query } from './src/database/connection.js';

async function addStickerTrackingFields() {
  try {
    console.log('🚀 Starting sticker tracking fields migration...');
    console.log('==========================================');
    
    // Check if fields already exist
    console.log('📋 Checking existing fields...');
    const checkFields = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      AND column_name IN ('sticker_generation_status', 'sticker_generated_at', 'sticker_printed_at')
    `);
    
    const existingFields = checkFields.rows.map(row => row.column_name);
    console.log('Existing fields:', existingFields);
    
    if (existingFields.length === 3) {
      console.log('✅ All sticker tracking fields already exist!');
      console.log('Skipping field creation...');
    } else {
      console.log('🔧 Adding missing fields...');
      
      // Add sticker_generation_status field
      if (!existingFields.includes('sticker_generation_status')) {
        console.log('  ➕ Adding sticker_generation_status field...');
        await query(`
          ALTER TABLE vehicles 
          ADD COLUMN sticker_generation_status TEXT DEFAULT 'not_generated'
        `);
        console.log('  ✅ Added sticker_generation_status field');
      } else {
        console.log('  ✅ sticker_generation_status field already exists');
      }
      
      // Add sticker_generated_at field
      if (!existingFields.includes('sticker_generated_at')) {
        console.log('  ➕ Adding sticker_generated_at field...');
        await query(`
          ALTER TABLE vehicles 
          ADD COLUMN sticker_generated_at TIMESTAMP WITH TIME ZONE
        `);
        console.log('  ✅ Added sticker_generated_at field');
      } else {
        console.log('  ✅ sticker_generated_at field already exists');
      }
      
      // Add sticker_printed_at field
      if (!existingFields.includes('sticker_printed_at')) {
        console.log('  ➕ Adding sticker_printed_at field...');
        await query(`
          ALTER TABLE vehicles 
          ADD COLUMN sticker_printed_at TIMESTAMP WITH TIME ZONE
        `);
        console.log('  ✅ Added sticker_printed_at field');
      } else {
        console.log('  ✅ sticker_printed_at field already exists');
      }
    }
    
    // Update existing vehicles with QR codes to have 'generated' status
    console.log('\n🔄 Updating existing vehicles with QR codes...');
    const updateResult = await query(`
      UPDATE vehicles 
      SET sticker_generation_status = 'generated',
          sticker_generated_at = COALESCE(sticker_generated_at, NOW()),
          updated_at = NOW()
      WHERE qr_code_url IS NOT NULL 
      AND qr_code_url != ''
      AND sticker_generation_status = 'not_generated'
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} vehicles with QR codes to 'generated' status`);
    
    // Show final status
    console.log('\n📊 Final Database Status:');
    console.log('========================');
    const finalStatus = await query(`
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN qr_code_url IS NOT NULL AND qr_code_url != '' THEN 1 END) as vehicles_with_qr,
        COUNT(CASE WHEN sticker_generation_status = 'generated' THEN 1 END) as generated_status,
        COUNT(CASE WHEN sticker_generation_status = 'printed' THEN 1 END) as printed_status,
        COUNT(CASE WHEN sticker_generation_status = 'not_generated' THEN 1 END) as not_generated_status
      FROM vehicles
    `);
    
    const stats = finalStatus.rows[0];
    console.log(`📈 Total vehicles: ${stats.total_vehicles}`);
    console.log(`🔗 Vehicles with QR codes: ${stats.vehicles_with_qr}`);
    console.log(`🟡 Generated status: ${stats.generated_status}`);
    console.log(`🟢 Printed status: ${stats.printed_status}`);
    console.log(`🔴 Not generated status: ${stats.not_generated_status}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('==========================================');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Run the migration
console.log('🏁 Starting sticker tracking fields migration...');
addStickerTrackingFields()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  });
