/**
 * Test database connection with current environment variables
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n🔍 Verifying Database Connection...\n');

// Parse database connection
let poolConfig;

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    const password = process.env.DB_PASSWORD || decodeURIComponent(url.password || '') || 'Dealeriq';
    
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1),
      user: url.username,
      password: String(password),
      ssl: false
    };
    
    console.log('📋 Connection Config:');
    console.log(`   Host: ${poolConfig.host}`);
    console.log(`   Port: ${poolConfig.port}`);
    console.log(`   Database: ${poolConfig.database}`);
    console.log(`   User: ${poolConfig.user}`);
    console.log(`   Password: ${poolConfig.password ? '***' + poolConfig.password.slice(-2) : 'NOT SET'}`);
    console.log(`   Password source: ${process.env.DB_PASSWORD ? 'DB_PASSWORD env var' : (url.password ? 'DATABASE_URL' : 'default')}`);
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    process.exit(1);
  }
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'vehicle_management',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || 'Dealeriq'),
    ssl: false
  };
  
  console.log('📋 Connection Config (from env vars):');
  console.log(`   Host: ${poolConfig.host}`);
  console.log(`   Port: ${poolConfig.port}`);
  console.log(`   Database: ${poolConfig.database}`);
  console.log(`   User: ${poolConfig.user}`);
  console.log(`   Password: ${poolConfig.password ? '***' + poolConfig.password.slice(-2) : 'NOT SET'}`);
}

// Test connection
const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

async function testConnection() {
  const client = await pool.connect();
  
  try {
    console.log('\n🧪 Testing connection...');
    const result = await client.query('SELECT version(), current_database(), current_user');
    
    console.log('✅ Connection successful!');
    console.log(`   PostgreSQL Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   User: ${result.rows[0].current_user}`);
    
    // Test query
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'dealers')
      LIMIT 2
    `);
    
    console.log(`\n✅ Found ${tableCheck.rows.length} required tables`);
    tableCheck.rows.forEach(t => console.log(`   - ${t.table_name}`));
    
    console.log('\n🎉 Database connection is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.code === '28P01') {
      console.error('\n💡 Password authentication failed!');
      console.error('   Solution:');
      console.error('   1. Verify your PostgreSQL password');
      console.error('   2. Update .env file with correct password');
      console.error('   3. Set DB_PASSWORD=your_password in .env');
      console.error('   4. Or update password in DATABASE_URL');
      console.error('   5. Restart your server');
    }
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection();

