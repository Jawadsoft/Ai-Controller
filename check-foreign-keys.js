import { query } from './src/database/connection.js';

async function checkForeignKeys() {
  try {
    console.log('🔍 Checking foreign key constraints...\n');
    
    // Check FKs referencing leads
    const leadFks = await query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as from_table,
        confrelid::regclass as to_table,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE confrelid = 'leads'::regclass
      AND contype = 'f'
    `);
    
    console.log('📋 Tables referencing LEADS:');
    leadFks.rows.forEach(row => {
      console.log(`   ${row.from_table} -> ${row.to_table}`);
      console.log(`   Constraint: ${row.constraint_name}`);
    });
    console.log('');
    
    // Check FKs referencing rebates
    const rebateFks = await query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as from_table,
        confrelid::regclass as to_table,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE confrelid = 'rebates'::regclass
      AND contype = 'f'
    `);
    
    console.log('💵 Tables referencing REBATES:');
    rebateFks.rows.forEach(row => {
      console.log(`   ${row.from_table} -> ${row.to_table}`);
      console.log(`   Constraint: ${row.constraint_name}`);
    });
    console.log('');
    
    // Check FKs referencing vehicles
    const vehicleFks = await query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as from_table,
        confrelid::regclass as to_table
      FROM pg_constraint
      WHERE confrelid = 'vehicles'::regclass
      AND contype = 'f'
    `);
    
    console.log('🚗 Tables referencing VEHICLES:');
    vehicleFks.rows.forEach(row => {
      console.log(`   ${row.from_table} -> ${row.to_table}`);
      console.log(`   Constraint: ${row.constraint_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkForeignKeys();

