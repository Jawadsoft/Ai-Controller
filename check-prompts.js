// Check current DAIVE prompts
import { pool } from './src/database/connection.js';

async function checkPrompts() {
  try {
    console.log('🔍 Checking DAIVE Prompts...\n');
    
    const result = await pool.query(`
      SELECT dp.prompt_type, dp.prompt_text, d.business_name as dealer_name
      FROM daive_prompts dp
      LEFT JOIN dealers d ON dp.dealer_id = d.id
      ORDER BY dp.dealer_id NULLS FIRST, dp.prompt_type
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No prompts found in database');
    } else {
      console.log('📋 Current DAIVE Prompts:');
      result.rows.forEach(row => {
        const dealer = row.dealer_name || 'GLOBAL';
        const preview = row.prompt_text ? row.prompt_text.substring(0, 100) + '...' : 'NULL';
        console.log(`\n  - Type: ${row.prompt_type}`);
        console.log(`    Dealer: ${dealer}`);
        console.log(`    Content: ${preview}`);
      });
    }
    
    console.log('\n💡 If you see any prompts with formal email format, they need to be updated.');
    
  } catch (error) {
    console.error('❌ Error checking prompts:', error.message);
  } finally {
    await pool.end();
  }
}

checkPrompts();
