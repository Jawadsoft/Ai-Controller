import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixSalesConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting sales constraint fix migration...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Drop the existing overly restrictive constraint and index
    console.log('📝 Dropping existing unique_admin_per_dealer constraint and index...');
    await client.query(`
      ALTER TABLE dealership_staff DROP CONSTRAINT IF EXISTS unique_admin_per_dealer
    `);
    await client.query(`
      DROP INDEX IF EXISTS unique_admin_per_dealer
    `);
    console.log('✅ Dropped existing constraint and index');
    
    // Add new constraint that only restricts multiple admins
    console.log('📝 Adding new admin-only constraint...');
    await client.query(`
      CREATE UNIQUE INDEX unique_admin_per_dealer 
      ON dealership_staff (dealer_id, staff_role) 
      WHERE staff_role = 'admin'
    `);
    console.log('✅ Added new admin-only constraint');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('   • Removed constraint that prevented multiple sales agents');
    console.log('   • Added constraint that only prevents multiple admins');
    console.log('   • Now allows multiple: sales, finance, service, inventory staff');
    console.log('   • Still restricts: only one admin per dealership');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
fixSalesConstraint()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
