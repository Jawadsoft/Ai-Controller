/**
 * Check if the login query structure matches the actual database schema
 */

import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

// Parse DATABASE_URL or use individual env vars
let poolConfig;

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    const password = url.password || process.env.DB_PASSWORD || 'Dealeriq';
    
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1), // Remove leading slash
      user: url.username,
      password: String(password),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  } catch (error) {
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'vehicle_management',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || 'Dealeriq'),
      ssl: false
    };
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
}

const pool = new Pool(poolConfig);

async function checkLoginQuery() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking login query structure against database schema...\n');
    
    // Check all required columns exist
    const tables = {
      'users': ['id', 'email', 'password_hash'],
      'user_roles': ['user_id', 'role'],
      'dealership_staff': ['id', 'user_id', 'dealer_id', 'staff_role', 'permissions', 'is_active'],
      'dealers': ['id', 'user_id', 'business_name', 'contact_name']
    };
    
    console.log('📋 Checking table columns...\n');
    
    for (const [tableName, requiredColumns] of Object.entries(tables)) {
      console.log(`Checking ${tableName}...`);
      
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);
      
      const existingColumns = result.rows.map(r => r.column_name);
      
      for (const col of requiredColumns) {
        if (existingColumns.includes(col)) {
          console.log(`  ✅ ${col} exists`);
        } else {
          console.log(`  ❌ ${col} MISSING`);
        }
      }
      
      console.log('');
    }
    
    // Try to execute the login query structure
    console.log('🧪 Testing login query syntax...\n');
    
    try {
      // Get a sample email if available
      const emailResult = await client.query('SELECT email FROM users LIMIT 1');
      
      if (emailResult.rows.length > 0) {
        const testEmail = emailResult.rows[0].email;
        console.log(`Testing with email: ${testEmail}\n`);
        
        const userResult = await client.query(
          `SELECT 
            u.id, 
            u.email, 
            u.password_hash, 
            ur.role, 
            COALESCE(d_staff.id, d_owner.id) AS dealer_id,
            COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
            COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
            ds.id as staff_id,
            ds.staff_role,
            ds.permissions as staff_permissions,
            ds.is_active as staff_active
           FROM users u 
           LEFT JOIN user_roles ur ON u.id = ur.user_id 
           LEFT JOIN dealership_staff ds ON u.id = ds.user_id
           LEFT JOIN dealers d_staff ON ds.dealer_id = d_staff.id
           LEFT JOIN dealers d_owner ON d_owner.user_id = u.id
           WHERE u.email = $1`,
          [testEmail]
        );
        
        console.log('✅ Login query executed successfully!');
        console.log(`   Found ${userResult.rows.length} result(s)`);
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          console.log('\n📊 Query Result:');
          console.log(`   ID: ${user.id}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Role: ${user.role || 'NULL'}`);
          console.log(`   Dealer ID: ${user.dealer_id || 'NULL'}`);
          console.log(`   Staff ID: ${user.staff_id || 'NULL'}`);
          console.log(`   Staff Role: ${user.staff_role || 'NULL'}`);
          console.log(`   Staff Active: ${user.staff_active || 'NULL'}`);
        }
      } else {
        console.log('⚠️  No users found in database');
        console.log('   The query syntax is valid, but there are no users to test with');
      }
      
    } catch (queryError) {
      console.error('❌ Query Execution Error:');
      console.error(`   Message: ${queryError.message}`);
      console.error(`   Code: ${queryError.code}`);
      console.error(`   Detail: ${queryError.detail || 'N/A'}`);
      console.error(`   Hint: ${queryError.hint || 'N/A'}`);
      console.error(`   Position: ${queryError.position || 'N/A'}`);
      
      console.error('\n   Full Error:');
      console.error(queryError);
    }
    
    console.log('\n✅ Structure check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkLoginQuery();

