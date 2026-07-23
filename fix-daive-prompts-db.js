import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixDaivePromptsTable() {
  try {
    console.log('🔧 Starting to fix daive_prompts table...');
    
    // First, check if the unique constraint already exists
    const constraintCheck = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'daive_prompts' 
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name IN ('dealer_id', 'prompt_type')
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log('✅ Unique constraint already exists on daive_prompts table');
      console.log('Constraints found:', constraintCheck.rows);
      return;
    }
    
    console.log('❌ Unique constraint not found. Adding it now...');
    
    // Check for any duplicate entries first
    const duplicates = await pool.query(`
      SELECT dealer_id, prompt_type, COUNT(*) as count
      FROM daive_prompts 
      WHERE dealer_id IS NOT NULL
      GROUP BY dealer_id, prompt_type 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('⚠️  Found duplicate entries. Cleaning them up...');
      console.log('Duplicates found:', duplicates.rows);
      
      // Remove duplicates, keeping the most recent one
      for (const dup of duplicates.rows) {
        const deleteResult = await pool.query(`
          DELETE FROM daive_prompts 
          WHERE dealer_id = $1 AND prompt_type = $2
          AND id NOT IN (
            SELECT id FROM daive_prompts 
            WHERE dealer_id = $1 AND prompt_type = $2 
            ORDER BY updated_at DESC 
            LIMIT 1
          )
        `, [dup.dealer_id, dup.prompt_type]);
        
        console.log(`🧹 Removed ${deleteResult.rowCount} duplicate entries for ${dup.prompt_type}`);
      }
    }
    
    // Add the unique constraint
    await pool.query(`
      ALTER TABLE daive_prompts 
      ADD CONSTRAINT daive_prompts_dealer_id_prompt_type_unique 
      UNIQUE (dealer_id, prompt_type)
    `);
    
    console.log('✅ Successfully added unique constraint to daive_prompts table');
    
    // Verify the constraint was added
    const verifyConstraint = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'daive_prompts' 
        AND tc.constraint_type = 'UNIQUE'
    `);
    
    console.log('🔍 Verification - Constraints found:', verifyConstraint.rows);
    
    // Test the upsert functionality
    console.log('🧪 Testing upsert functionality...');
    
    // Get a sample dealer_id for testing
    const dealerResult = await pool.query('SELECT id FROM dealers LIMIT 1');
    if (dealerResult.rows.length > 0) {
      const testDealerId = dealerResult.rows[0].id;
      
      // Test insert
      const testInsert = await pool.query(`
        INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
        VALUES ($1, $2, $3)
        ON CONFLICT (dealer_id, prompt_type) 
        DO UPDATE SET prompt_text = $3, updated_at = NOW()
        RETURNING *
      `, [testDealerId, 'test_prompt', 'Test prompt text']);
      
      console.log('✅ Test insert successful:', testInsert.rows[0]);
      
      // Test update (should trigger ON CONFLICT)
      const testUpdate = await pool.query(`
        INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
        VALUES ($1, $2, $3)
        ON CONFLICT (dealer_id, prompt_type) 
        DO UPDATE SET prompt_text = $3, updated_at = NOW()
        RETURNING *
      `, [testDealerId, 'test_prompt', 'Updated test prompt text']);
      
      console.log('✅ Test update successful:', testUpdate.rows[0]);
      
      // Clean up test data
      await pool.query('DELETE FROM daive_prompts WHERE prompt_type = $1', ['test_prompt']);
      console.log('🧹 Cleaned up test data');
    }
    
    console.log('🎉 Database fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing daive_prompts table:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixDaivePromptsTable();
