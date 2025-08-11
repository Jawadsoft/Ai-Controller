// Check database schema for daive_api_settings table
import { pool } from './src/database/connection.js';

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...\n');
    
    // Check if daive_api_settings table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daive_api_settings'
      );
    `;
    
    const tableExists = await pool.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ daive_api_settings table does not exist!');
      console.log('💡 Please run the database migration first');
      return;
    }
    
    console.log('✅ daive_api_settings table exists');
    
    // Get table structure
    const structureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'daive_api_settings'
      ORDER BY ordinal_position;
    `;
    
    const structure = await pool.query(structureQuery);
    
    console.log('\n📋 Table structure:');
    structure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Check if there are any rows
    const countQuery = `SELECT COUNT(*) as total FROM daive_api_settings;`;
    const count = await pool.query(countQuery);
    
    console.log(`\n📊 Total rows: ${count.rows[0].total}`);
    
    if (count.rows[0].total > 0) {
      // Show sample data
      const sampleQuery = `SELECT * FROM daive_api_settings LIMIT 3;`;
      const sample = await pool.query(sampleQuery);
      
      console.log('\n📋 Sample data:');
      sample.rows.forEach((row, index) => {
        console.log(`   Row ${index + 1}:`, row);
      });
    }
    
    // Check for similar tables
    const similarTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%api%' OR table_name LIKE '%setting%'
      ORDER BY table_name;
    `;
    
    const similarTables = await pool.query(similarTablesQuery);
    
    if (similarTables.rows.length > 0) {
      console.log('\n🔍 Similar tables found:');
      similarTables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking database schema:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkDatabaseSchema(); 