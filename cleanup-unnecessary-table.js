import { pool } from './src/database/connection.js';

async function cleanupUnnecessaryTable() {
  try {
    console.log('🧹 Cleaning up unnecessary daive_voice_settings table...\n');

    // Check if the table exists
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'daive_voice_settings'
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    
    if (tableCheckResult.rows.length > 0) {
      console.log('🗑️ Dropping daive_voice_settings table...');
      
      // Drop the table
      await pool.query('DROP TABLE IF EXISTS daive_voice_settings');
      console.log('✅ daive_voice_settings table dropped successfully');
    } else {
      console.log('ℹ️ daive_voice_settings table does not exist');
    }

    console.log('\n🎯 Cleanup Complete!');
    console.log('✅ Using existing daive_api_settings table for voice configuration');
    console.log('✅ No unnecessary tables created');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupUnnecessaryTable(); 