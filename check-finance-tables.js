import { query } from './src/database/connection.js';

const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';

async function checkFinanceTables() {
  try {
    console.log('🔍 Checking finance-related tables...\n');
    
    // Check which tables exist
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'credit_applications', 
        'finance_deals', 
        'finance_programs',
        'lender_submissions',
        'lenders'
      )
      ORDER BY table_name
    `);
    
    console.log('📋 Finance tables that exist:');
    for (const row of tables.rows) {
      console.log(`   ✓ ${row.table_name}`);
      
      // Count records for this dealer
      try {
        const count = await query(`SELECT COUNT(*) as count FROM ${row.table_name} WHERE dealer_id = $1`, [dealerId]);
        console.log(`     Records: ${count.rows[0].count}`);
      } catch (err) {
        console.log(`     Error counting: ${err.message}`);
      }
    }
    console.log('');
    
    // Check for foreign keys referencing credit_applications
    const creditAppFks = await query(`
      SELECT 
        conrelid::regclass as from_table,
        conname as constraint_name
      FROM pg_constraint
      WHERE confrelid = 'credit_applications'::regclass
      AND contype = 'f'
    `);
    
    if (creditAppFks.rows.length > 0) {
      console.log('⚠️  Tables referencing credit_applications:');
      creditAppFks.rows.forEach(row => {
        console.log(`   ${row.from_table} (${row.constraint_name})`);
      });
      console.log('');
    }
    
    // Check for foreign keys referencing finance_deals
    const dealsFks = await query(`
      SELECT 
        conrelid::regclass as from_table,
        conname as constraint_name
      FROM pg_constraint
      WHERE confrelid = 'finance_deals'::regclass
      AND contype = 'f'
    `);
    
    if (dealsFks.rows.length > 0) {
      console.log('⚠️  Tables referencing finance_deals:');
      dealsFks.rows.forEach(row => {
        console.log(`   ${row.from_table} (${row.constraint_name})`);
      });
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFinanceTables();

