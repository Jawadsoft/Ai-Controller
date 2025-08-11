import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkDealersSchema() {
  console.log('🔍 Checking Dealers Table Schema...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Check table structure
    console.log('1️⃣ Dealers table structure:');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'dealers'
      ORDER BY ordinal_position
    `);
    
    tableInfo.rows.forEach(column => {
      console.log(`   ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check sample data
    console.log('\n2️⃣ Sample dealer data:');
    const sampleData = await pool.query(`
      SELECT * FROM dealers LIMIT 2
    `);
    
    if (sampleData.rows.length > 0) {
      const dealer = sampleData.rows[0];
      console.log('   Sample dealer record:');
      Object.keys(dealer).forEach(key => {
        console.log(`     ${key}: ${dealer[key]}`);
      });
    }
    
    // Check vehicles table structure too
    console.log('\n3️⃣ Vehicles table structure:');
    const vehiclesTableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'vehicles'
      ORDER BY ordinal_position
    `);
    
    vehiclesTableInfo.rows.forEach(column => {
      console.log(`   ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the check
checkDealersSchema().catch(console.error); 