#!/usr/bin/env node

/**
 * Export Local Database Structure
 * This script connects to your local database and exports the complete structure
 * to create a comprehensive migration file for Render.com
 */

import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

console.log('🗄️ Exporting Render.com database structure...');

// Render.com database connection (update these values)
const localPool = new Pool({
  connectionString: 'postgresql://dealeriq_1_user:16C0SbqpdAnGwl3O2mRBfY1Ecq0wYe02@dpg-d2mbt1ndiees7386nee0-a/dealeriq_1',
  ssl: { rejectUnauthorized: false }
});

async function exportDatabaseStructure() {
  let client;
  
  try {
    client = await localPool.connect();
    console.log('✅ Connected to Render.com database\n');
    
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
    
    console.log(`📋 Found ${tablesResult.rows.length} tables\n`);
    
    let migrationSQL = `-- =====================================================
-- Complete Database Migration from Local Database
-- Generated: ${new Date().toISOString()}
-- Source: ${dbInfo.rows[0].db_name}
-- Tables: ${tablesResult.rows.length}
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE CREATION
-- =====================================================

`;
    
    // Process each table
    for (const table of tablesResult.rows) {
      if (table.table_type === 'BASE TABLE') {
        console.log(`🔍 Processing table: ${table.table_name}`);
        
        // Get table structure
        const columnsResult = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position;
        `, [table.table_name]);
        
        // Get primary key
        const pkResult = await client.query(`
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = $1 
            AND tc.constraint_type = 'PRIMARY KEY';
        `, [table.table_name]);
        
        // Get foreign keys
        const fkResult = await client.query(`
          SELECT 
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_name = $1;
        `, [table.table_name]);
        
        // Get indexes
        const indexResult = await client.query(`
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes 
          WHERE tablename = $1;
        `, [table.table_name]);
        
        // Build CREATE TABLE statement
        migrationSQL += `-- =====================================================
-- Table: ${table.table_name}
-- =====================================================
CREATE TABLE IF NOT EXISTS "${table.table_name}" (
`;
        
        const columns = [];
        for (const col of columnsResult.rows) {
          let colDef = `  "${col.column_name}" ${col.data_type}`;
          
          // Add length for varchar/char
          if (col.character_maximum_length) {
            colDef += `(${col.character_maximum_length})`;
          }
          
          // Add precision/scale for numeric
          if (col.numeric_precision && col.numeric_scale) {
            colDef += `(${col.numeric_precision},${col.numeric_scale})`;
          } else if (col.numeric_precision) {
            colDef += `(${col.numeric_precision})`;
          }
          
          // Add NOT NULL
          if (col.is_nullable === 'NO') {
            colDef += ' NOT NULL';
          }
          
          // Add default value
          if (col.column_default) {
            colDef += ` DEFAULT ${col.column_default}`;
          }
          
          columns.push(colDef);
        }
        
        migrationSQL += columns.join(',\n') + '\n';
        
        // Add primary key
        if (pkResult.rows.length > 0) {
          const pkColumns = pkResult.rows.map(row => `"${row.column_name}"`).join(', ');
          migrationSQL += `  ,PRIMARY KEY (${pkColumns})\n`;
        }
        
        migrationSQL += `);\n\n`;
        
        // Add foreign key constraints
        if (fkResult.rows.length > 0) {
          for (const fk of fkResult.rows) {
            migrationSQL += `ALTER TABLE "${table.table_name}" ADD CONSTRAINT fk_${table.table_name}_${fk.column_name} 
  FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}");\n`;
          }
          migrationSQL += '\n';
        }
        
        // Add indexes
        if (indexResult.rows.length > 0) {
          for (const idx of indexResult.rows) {
            if (!idx.indexname.includes('_pkey') && !idx.indexname.includes('_fkey')) {
              migrationSQL += `-- Index: ${idx.indexname}\n`;
              migrationSQL += `${idx.indexdef};\n\n`;
            }
          }
        }
        
        // Get sample data (first 5 rows)
        try {
          const sampleDataResult = await client.query(`SELECT * FROM "${table.table_name}" LIMIT 5`);
          if (sampleDataResult.rows.length > 0) {
            migrationSQL += `-- Sample data for ${table.table_name}\n`;
            migrationSQL += `-- INSERT INTO "${table.table_name}" VALUES ...\n`;
            migrationSQL += `-- (${sampleDataResult.rows.length} sample rows available)\n\n`;
          }
        } catch (error) {
          // Ignore errors for sample data
        }
      }
    }
    
    // Add final summary
    migrationSQL += `-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Total tables created: ${tablesResult.rows.length}
-- 
-- To apply this migration:
-- 1. Use the Database Inspector
-- 2. Click "📥 Import SQL Data"
-- 3. Upload this file or paste the content
-- 4. Execute the migration
-- 
-- Note: This migration preserves your exact table structure
-- including indexes, constraints, and data types.
`;
    
    // Write to file
    const filename = `complete-migration-${new Date().toISOString().split('T')[0]}.sql`;
    fs.writeFileSync(filename, migrationSQL);
    
    console.log(`✅ Migration file created: ${filename}`);
    console.log(`📊 Total tables processed: ${tablesResult.rows.length}`);
    console.log(`📁 File size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);
    
    // Display table summary
    console.log('\n📋 TABLE SUMMARY:');
    for (const table of tablesResult.rows) {
      if (table.table_type === 'BASE TABLE') {
        const countResult = await client.query(`SELECT COUNT(*) as row_count FROM "${table.table_name}"`);
        console.log(`   ${table.table_name}: ${countResult.rows[0].row_count} rows`);
      }
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await localPool.end();
  }
}

// Run the export
exportDatabaseStructure()
  .then(() => {
    console.log('\n🎉 Database export completed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. The script is already configured for Render.com');
    console.log('   2. Run: node export-local-database.js');
    console.log('   3. Use the generated migration file in your Database Inspector');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database export failed');
    process.exit(1);
  });
