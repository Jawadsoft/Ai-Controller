// Check database prompts for the dealer
import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabasePrompts() {
  try {
    console.log('🔍 Checking database prompts for dealer...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Check daive_prompts table
    console.log('📋 Checking daive_prompts table...');
    const promptsQuery = `
      SELECT prompt_type, prompt_text, dealer_id, is_active
      FROM daive_prompts 
      WHERE (dealer_id = $1 OR dealer_id IS NULL) AND is_active = true
      ORDER BY dealer_id DESC, prompt_type
    `;
    
    const promptsResult = await pool.query(promptsQuery, [dealerId]);
    console.log(`Found ${promptsResult.rows.length} prompts:`);
    
    promptsResult.rows.forEach(row => {
      const source = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
      const preview = row.prompt_text?.substring(0, 100) + '...';
      console.log(`  - ${row.prompt_type}: ${preview} (${source})`);
    });
    
    // Check if master_prompt exists
    const masterPrompt = promptsResult.rows.find(row => 
      row.prompt_type === 'master_prompt' && 
      (row.dealer_id === dealerId || row.dealer_id === null)
    );
    
    if (masterPrompt) {
      console.log(`\n📝 Master Prompt Found:`);
      console.log(`Source: ${masterPrompt.dealer_id ? 'Dealer' : 'Global'}`);
      console.log(`Content: ${masterPrompt.prompt_text}`);
    } else {
      console.log('\n❌ No master_prompt found in database');
    }
    
    // Check specific prompt types
    const specificPrompts = ['greeting', 'test_drive', 'financing', 'vehicle_info', 'inventory_introduction'];
    console.log('\n🔍 Checking specific prompt types:');
    
    specificPrompts.forEach(promptType => {
      const prompt = promptsResult.rows.find(row => 
        row.prompt_type === promptType && 
        (row.dealer_id === dealerId || row.dealer_id === null)
      );
      
      if (prompt) {
        console.log(`  ✅ ${promptType}: ${prompt.prompt_text?.substring(0, 80)}...`);
      } else {
        console.log(`  ❌ ${promptType}: Not found`);
      }
    });
    
    console.log('\n✅ Database prompts check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkDatabasePrompts();
