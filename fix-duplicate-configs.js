import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management'
});

async function fixDuplicateConfigs() {
  const client = await pool.connect();
  
  try {
    console.log('Checking for duplicate configurations...');
    
    // Check for duplicates
    const duplicatesResult = await client.query(`
      SELECT dealer_id, config_name, COUNT(*) as count
      FROM import_configs 
      GROUP BY dealer_id, config_name 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatesResult.rows.length > 0) {
      console.log('Found duplicate configurations:');
      duplicatesResult.rows.forEach(row => {
        console.log(`- ${row.config_name} (${row.count} duplicates)`);
      });
      
      // Remove duplicates, keeping the most recent one
      const deleteResult = await client.query(`
        DELETE FROM import_configs 
        WHERE id NOT IN (
          SELECT MAX(id) 
          FROM import_configs 
          GROUP BY dealer_id, config_name
        )
      `);
      
      console.log(`Removed ${deleteResult.rowCount} duplicate configurations`);
    } else {
      console.log('No duplicate configurations found');
    }
    
    // Add unique constraint
    console.log('Adding unique constraint...');
    await client.query(`
      ALTER TABLE import_configs 
      ADD CONSTRAINT unique_dealer_config_name UNIQUE (dealer_id, config_name)
    `);
    
    console.log('Unique constraint added successfully');
    
    // Verify the constraint
    const constraintResult = await client.query(`
      SELECT 
        constraint_name, 
        constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'import_configs' 
      AND constraint_name = 'unique_dealer_config_name'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('Constraint verified successfully');
    } else {
      console.log('Warning: Constraint not found');
    }
    
  } catch (error) {
    console.error('Error fixing duplicate configurations:', error);
    
    // If constraint already exists, that's fine
    if (error.message.includes('already exists')) {
      console.log('Unique constraint already exists');
    } else {
      throw error;
    }
  } finally {
    client.release();
  }
}

fixDuplicateConfigs()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 