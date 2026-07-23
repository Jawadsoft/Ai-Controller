import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugDaivePrompts() {
  try {
    console.log('🔍 Debugging DAIVE prompts issue...');
    
    // Check if the daive_prompts table exists and has data
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'daive_prompts'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ daive_prompts table does not exist!');
      return;
    }
    
    console.log('✅ daive_prompts table exists');
    
    // Check the table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'daive_prompts'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table structure:');
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check for any existing prompts
    const existingPrompts = await pool.query(`
      SELECT dealer_id, prompt_type, prompt_text, created_at, updated_at
      FROM daive_prompts
      ORDER BY dealer_id, prompt_type;
    `);
    
    console.log(`\n📊 Found ${existingPrompts.rows.length} existing prompts:`);
    existingPrompts.rows.forEach(prompt => {
      console.log(`  - ${prompt.prompt_type}: "${prompt.prompt_text?.substring(0, 50)}..." (dealer: ${prompt.dealer_id})`);
    });
    
    // Check for dealers
    const dealers = await pool.query(`
      SELECT id, name, email
      FROM dealers
      LIMIT 5;
    `);
    
    console.log(`\n🏢 Found ${dealers.rows.length} dealers:`);
    dealers.rows.forEach(dealer => {
      console.log(`  - ${dealer.name} (${dealer.email}): ${dealer.id}`);
    });
    
    // Check for users with dealer_id
    const usersWithDealer = await pool.query(`
      SELECT u.id, u.email, d.id as dealer_id, d.name as dealer_name
      FROM users u
      LEFT JOIN dealers d ON u.id = d.user_id
      WHERE d.id IS NOT NULL
      LIMIT 5;
    `);
    
    console.log(`\n👥 Users with dealer access:`);
    usersWithDealer.rows.forEach(user => {
      console.log(`  - ${user.email}: dealer ${user.dealer_name} (${user.dealer_id})`);
    });
    
    // Test the upsert functionality with a sample dealer
    if (dealers.rows.length > 0) {
      const testDealerId = dealers.rows[0].id;
      console.log(`\n🧪 Testing upsert with dealer: ${testDealerId}`);
      
      // Test insert
      const testInsert = await pool.query(`
        INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
        VALUES ($1, $2, $3)
        ON CONFLICT (dealer_id, prompt_type) 
        DO UPDATE SET prompt_text = $3, updated_at = NOW()
        RETURNING *
      `, [testDealerId, 'test_debug_prompt', 'This is a test prompt for debugging']);
      
      console.log('✅ Test insert successful:', testInsert.rows[0]);
      
      // Test update (should trigger ON CONFLICT)
      const testUpdate = await pool.query(`
        INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
        VALUES ($1, $2, $3)
        ON CONFLICT (dealer_id, prompt_type) 
        DO UPDATE SET prompt_text = $3, updated_at = NOW()
        RETURNING *
      `, [testDealerId, 'test_debug_prompt', 'Updated test prompt for debugging']);
      
      console.log('✅ Test update successful:', testUpdate.rows[0]);
      
      // Clean up test data
      await pool.query('DELETE FROM daive_prompts WHERE prompt_type = $1', ['test_debug_prompt']);
      console.log('🧹 Cleaned up test data');
    }
    
    // Check for any unique constraints
    const constraints = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'daive_prompts'
      ORDER BY tc.constraint_type, tc.constraint_name;
    `);
    
    console.log(`\n🔒 Table constraints:`);
    constraints.rows.forEach(constraint => {
      console.log(`  - ${constraint.constraint_type}: ${constraint.constraint_name} on ${constraint.column_name}`);
    });
    
    // Check for duplicates
    const duplicates = await pool.query(`
      SELECT dealer_id, prompt_type, COUNT(*) as count
      FROM daive_prompts 
      WHERE dealer_id IS NOT NULL
      GROUP BY dealer_id, prompt_type 
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.rows.length} duplicate entries:`);
      duplicates.rows.forEach(dup => {
        console.log(`  - ${dup.prompt_type}: ${dup.count} entries for dealer ${dup.dealer_id}`);
      });
    } else {
      console.log('\n✅ No duplicate entries found');
    }
    
  } catch (error) {
    console.error('❌ Error debugging DAIVE prompts:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugDaivePrompts();
