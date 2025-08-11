import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkCrewAISettings() {
  console.log('🔍 Checking Crew AI Settings...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Check if crew_ai_settings table exists
    console.log('1️⃣ Checking if crew_ai_settings table exists...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'crew_ai_settings'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ crew_ai_settings table exists');
      
      // Check table structure
      console.log('\n2️⃣ Table structure:');
      const tableInfo = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'crew_ai_settings'
        ORDER BY ordinal_position
      `);
      
      tableInfo.rows.forEach(column => {
        console.log(`   ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      // Check if there are any records
      console.log('\n3️⃣ Checking for records...');
      const recordCount = await pool.query('SELECT COUNT(*) as count FROM crew_ai_settings');
      console.log(`   Total records: ${recordCount.rows[0].count}`);
      
      if (recordCount.rows[0].count > 0) {
        // Show sample records
        const sampleRecords = await pool.query('SELECT * FROM crew_ai_settings LIMIT 3');
        console.log('\n4️⃣ Sample records:');
        sampleRecords.rows.forEach((record, index) => {
          console.log(`   Record ${index + 1}:`);
          Object.keys(record).forEach(key => {
            console.log(`     ${key}: ${record[key]}`);
          });
        });
      } else {
        console.log('   ⚠️ No records found in crew_ai_settings table');
      }
      
    } else {
      console.log('❌ crew_ai_settings table does not exist');
      
      // Check what tables exist that might be related
      console.log('\n2️⃣ Looking for related tables...');
      const relatedTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE '%crew%' OR table_name LIKE '%ai%'
        ORDER BY table_name
      `);
      
      if (relatedTables.rows.length > 0) {
        console.log('   Found related tables:');
        relatedTables.rows.forEach(row => {
          console.log(`     ${row.table_name}`);
        });
      } else {
        console.log('   No related tables found');
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the check
checkCrewAISettings().catch(console.error); 