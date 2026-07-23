import { pool } from './src/database/connection.js';

async function debugPromptsError() {
  try {
    console.log('🔍 Debugging prompts error...\n');
    
    // Get dealer ID for dealer1@example.com
    const dealerQuery = `
      SELECT d.id as dealer_id, u.email
      FROM dealers d
      JOIN users u ON d.user_id = u.id
      WHERE u.email = 'dealer1@example.com'
    `;
    
    const dealerResult = await pool.query(dealerQuery);
    console.log('Dealer query result:', dealerResult.rows);
    
    if (dealerResult.rows.length === 0) {
      console.log('❌ No dealer found for dealer1@example.com');
      return;
    }
    
    const dealerId = dealerResult.rows[0].dealer_id;
    console.log('Dealer ID:', dealerId);
    
    // Test the exact SQL query from the prompts endpoint
    const testQuery = `
      INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text)
      VALUES ($1, $2, $3)
      ON CONFLICT (dealer_id, prompt_type) 
      DO UPDATE SET prompt_text = $3, updated_at = NOW()
      RETURNING *
    `;
    
    console.log('\nTesting SQL query with parameters:');
    console.log('dealer_id:', dealerId);
    console.log('prompt_type:', 'greeting');
    console.log('prompt_text:', 'Test prompt');
    
    try {
      const result = await pool.query(testQuery, [dealerId, 'greeting', 'Test prompt']);
      console.log('✅ SQL query successful!');
      console.log('Result:', result.rows[0]);
    } catch (sqlError) {
      console.log('❌ SQL query failed:');
      console.log('Error:', sqlError.message);
      console.log('Code:', sqlError.code);
      console.log('Detail:', sqlError.detail);
    }
    
    // Check if there's a unique constraint issue
    console.log('\nChecking existing prompts for this dealer:');
    const existingQuery = `
      SELECT prompt_type, prompt_text
      FROM daive_prompts
      WHERE dealer_id = $1
    `;
    
    const existingResult = await pool.query(existingQuery, [dealerId]);
    console.log('Existing prompts:', existingResult.rows);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugPromptsError(); 