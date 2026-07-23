/**
 * Check if all tables required for login exist
 */

import { query } from './src/database/connection.js';

const requiredTables = ['users', 'user_roles', 'dealership_staff', 'dealers'];

async function checkTables() {
  try {
    console.log('🔍 Checking required tables for login...\n');
    
    for (const table of requiredTables) {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' is MISSING`);
      }
    }
    
    console.log('\n📋 Summary:');
    const missingTables = [];
    
    for (const table of requiredTables) {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (!result.rows[0].exists) {
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('\n📝 Solution:');
      
      if (missingTables.includes('dealership_staff')) {
        console.log('   Run: node src/database/migrate-multi-user.js');
        console.log('   Or execute: src/database/multi-user-migration.sql');
      }
      
      if (missingTables.includes('users') || missingTables.includes('user_roles') || missingTables.includes('dealers')) {
        console.log('   Run: node src/database/run-main-schema-migration.js');
      }
    } else {
      console.log('✅ All required tables exist!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();

