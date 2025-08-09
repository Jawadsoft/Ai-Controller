import { pool } from './src/database/connection.js';

async function addPromptsConstraint() {
  try {
    console.log('🔧 Adding unique constraint to daive_prompts table...\n');
    
    // Add unique constraint on (dealer_id, prompt_type)
    const constraintQuery = `
      ALTER TABLE daive_prompts 
      ADD CONSTRAINT daive_prompts_dealer_type_unique 
      UNIQUE (dealer_id, prompt_type)
    `;
    
    try {
      await pool.query(constraintQuery);
      console.log('✅ Unique constraint added successfully!');
    } catch (error) {
      if (error.code === '42710') {
        console.log('✅ Constraint already exists');
      } else {
        console.log('❌ Error adding constraint:', error.message);
        throw error;
      }
    }
    
    // Verify the constraint was added
    const verifyQuery = `
      SELECT conname, contype, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'daive_prompts')
      AND contype = 'u'
    `;
    
    const result = await pool.query(verifyQuery);
    console.log('\nUnique constraints on daive_prompts table:');
    result.rows.forEach(row => console.log(row));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addPromptsConstraint(); 