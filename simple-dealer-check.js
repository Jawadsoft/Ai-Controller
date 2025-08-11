import { pool } from './src/database/connection.js';

console.log('🔍 Simple dealer database check...');

const simpleCheck = async () => {
  try {
    // Check what tables exist
    console.log('📋 Checking available tables...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name LIKE '%dealer%'
      ORDER BY table_name
    `);
    
    console.log('Tables with "dealer" in name:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check users table structure
    console.log('\n👥 Checking users table...');
    const usersResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    usersResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if we have any users
    console.log('\n👤 Checking for users...');
    const userCountResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`Total users: ${userCountResult.rows[0].count}`);
    
    if (userCountResult.rows[0].count > 0) {
      const sampleUsers = await pool.query('SELECT id, email, role FROM users LIMIT 3');
      console.log('Sample users:');
      sampleUsers.rows.forEach(row => {
        console.log(`   - ${row.email} (${row.role})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in simple check:', error);
  } finally {
    await pool.end();
  }
};

simpleCheck(); 