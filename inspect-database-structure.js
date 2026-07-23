#!/usr/bin/env node

/**
 * Database Structure Inspector for Render.com PostgreSQL
 * This script shows the current structure of your database
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

console.log('🔍 Inspecting Render.com PostgreSQL database structure...');

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : true
});

async function inspectDatabase() {
  let client;
  
  try {
    // Connect to database
    client = await pool.connect();
    console.log('✅ Connected to Render.com PostgreSQL database\n');
    
    // Get database info
    const dbInfo = await client.query('SELECT current_database() as db_name, current_user as username, version() as db_version');
    console.log('📊 DATABASE INFORMATION:');
    console.log('   Database Name:', dbInfo.rows[0].db_name);
    console.log('   Username:', dbInfo.rows[0].username);
    console.log('   Version:', dbInfo.rows[0].db_version.split('\n')[0]);
    console.log('');
    
    // Get all tables
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 EXISTING TABLES:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name} (${row.table_type})`);
      });
      console.log('');
      
      // Get detailed table structure for each table
      for (const table of tablesResult.rows) {
        if (table.table_type === 'BASE TABLE') {
          console.log(`🔍 TABLE STRUCTURE: ${table.table_name}`);
          console.log('─'.repeat(50));
          
          // Get columns
          const columnsResult = await client.query(`
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY ordinal_position;
          `, [table.table_name]);
          
          console.log('   Columns:');
          columnsResult.rows.forEach(col => {
            let colInfo = `     ${col.column_name}: ${col.data_type}`;
            if (col.character_maximum_length) {
              colInfo += `(${col.character_maximum_length})`;
            }
            if (col.is_nullable === 'NO') {
              colInfo += ' NOT NULL';
            }
            if (col.column_default) {
              colInfo += ` DEFAULT ${col.column_default}`;
            }
            console.log(colInfo);
          });
          
          // Get row count
          const countResult = await client.query(`SELECT COUNT(*) as row_count FROM "${table.table_name}"`);
          console.log(`   Row count: ${countResult.rows[0].row_count}`);
          console.log('');
        }
      }
      
      // Get indexes
      const indexesResult = await client.query(`
        SELECT 
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `);
      
      if (indexesResult.rows.length > 0) {
        console.log('🔗 INDEXES:');
        indexesResult.rows.forEach(idx => {
          console.log(`   ${idx.tablename}.${idx.indexname}: ${idx.indexdef}`);
        });
        console.log('');
      }
      
      // Get foreign keys
      const fkResult = await client.query(`
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name;
      `);
      
      if (fkResult.rows.length > 0) {
        console.log('🔗 FOREIGN KEY RELATIONSHIPS:');
        fkResult.rows.forEach(fk => {
          console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
        console.log('');
      }
      
    } else {
      console.log('📋 No tables found in database (this is expected for a new database)');
    }
    
    // Get database size
    const sizeResult = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as db_size;
    `);
    console.log('💾 DATABASE SIZE:', sizeResult.rows[0].db_size);
    
    console.log('\n🎉 Database inspection completed successfully!');
    
  } catch (error) {
    console.error('❌ Database inspection failed:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the inspection
inspectDatabase()
  .then(() => {
    console.log('✅ Database inspection completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database inspection failed');
    process.exit(1);
  });
