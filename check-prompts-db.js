import { pool } from './src/database/connection.js';

async function checkPromptsDB() {
  try {
    console.log('🔍 Checking prompts in database...\n');
    
    // Get dealer ID for dealer1@example.com
    const dealerQuery = `
      SELECT d.id as dealer_id, u.email
      FROM dealers d
      JOIN users u ON d.user_id = u.id
      WHERE u.email = 'dealer1@example.com'
    `;
    
    const dealerResult = await pool.query(dealerQuery);
    if (dealerResult.rows.length === 0) {
      console.log('❌ No dealer found for dealer1@example.com');
      return;
    }
    
    const dealerId = dealerResult.rows[0].dealer_id;
    console.log('Dealer ID:', dealerId);
    console.log('Dealer Email:', dealerResult.rows[0].email);
    console.log('');
    
    // Check all prompts in the database
    console.log('📋 All prompts in database:');
    const allPromptsQuery = `
      SELECT 
        dp.dealer_id,
        dp.prompt_type,
        dp.prompt_text,
        dp.is_active,
        dp.created_at,
        dp.updated_at,
        d.business_name
      FROM daive_prompts dp
      LEFT JOIN dealers d ON dp.dealer_id = d.id
      ORDER BY dp.dealer_id NULLS FIRST, dp.prompt_type
    `;
    
    const allPromptsResult = await pool.query(allPromptsQuery);
    console.log(`Found ${allPromptsResult.rows.length} prompts:`);
    allPromptsResult.rows.forEach((prompt, index) => {
      console.log(`${index + 1}. Type: ${prompt.prompt_type}`);
      console.log(`   Dealer: ${prompt.business_name || 'Global (NULL)'}`);
      console.log(`   Text: ${prompt.prompt_text.substring(0, 50)}...`);
      console.log(`   Active: ${prompt.is_active}`);
      console.log(`   Updated: ${prompt.updated_at}`);
      console.log('');
    });
    
    // Check specific dealer prompts
    console.log('🎯 Prompts for this dealer:');
    const dealerPromptsQuery = `
      SELECT prompt_type, prompt_text, is_active, updated_at
      FROM daive_prompts
      WHERE dealer_id = $1
      ORDER BY prompt_type
    `;
    
    const dealerPromptsResult = await pool.query(dealerPromptsQuery, [dealerId]);
    if (dealerPromptsResult.rows.length === 0) {
      console.log('❌ No prompts found for this dealer');
    } else {
      console.log(`Found ${dealerPromptsResult.rows.length} prompts for dealer:`);
      dealerPromptsResult.rows.forEach((prompt, index) => {
        console.log(`${index + 1}. ${prompt.prompt_type}: ${prompt.prompt_text.substring(0, 50)}...`);
        console.log(`   Active: ${prompt.is_active}, Updated: ${prompt.updated_at}`);
      });
    }
    
    // Test updating a prompt
    console.log('\n🧪 Testing prompt update...');
    const testUpdateQuery = `
      INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
      VALUES ($1, $2, $3)
      ON CONFLICT (dealer_id, prompt_type) 
      DO UPDATE SET prompt_text = $3, updated_at = NOW()
      RETURNING *
    `;
    
    const testPrompt = 'This is a test prompt updated at ' + new Date().toISOString();
    const updateResult = await pool.query(testUpdateQuery, [dealerId, 'greeting', testPrompt]);
    
    console.log('✅ Test update successful:');
    console.log('   ID:', updateResult.rows[0].id);
    console.log('   Type:', updateResult.rows[0].prompt_type);
    console.log('   Text:', updateResult.rows[0].prompt_text);
    console.log('   Updated:', updateResult.rows[0].updated_at);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkPromptsDB(); 