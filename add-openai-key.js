// Add OpenAI API key to database for dealer
import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function addOpenAIKey() {
  try {
    console.log('🔑 Adding OpenAI API key to database...\n');
    
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Check if OpenAI key already exists
    console.log('📋 Checking existing OpenAI key...');
    const checkQuery = `
      SELECT setting_type, setting_value, dealer_id
      FROM daive_api_settings 
      WHERE setting_type = 'openai_key' AND (dealer_id = $1 OR dealer_id IS NULL)
    `;
    
    const existingResult = await pool.query(checkQuery, [dealerId]);
    
    if (existingResult.rows.length > 0) {
      console.log('⚠️ OpenAI key already exists:');
      existingResult.rows.forEach(row => {
        const source = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        console.log(`  - ${source}: ${row.setting_value?.substring(0, 20)}...`);
      });
      
      // Ask if user wants to update
      console.log('\n❓ OpenAI key already exists. Do you want to update it?');
      console.log('   Please provide your OpenAI API key or press Enter to skip:');
      
      // For now, we'll just show what exists
      return;
    }
    
    // Add OpenAI key (you'll need to provide the actual key)
    console.log('📝 To add OpenAI API key, please:');
    console.log('1. Get your OpenAI API key from: https://platform.openai.com/api-keys');
    console.log('2. Run this script with your key as an environment variable');
    console.log('3. Or manually insert it into the database');
    
    // Example of how to add it (commented out for security)
    /*
    const insertQuery = `
      INSERT INTO daive_api_settings (setting_type, setting_value, dealer_id, is_active, created_at)
      VALUES ('openai_key', $1, $2, true, NOW())
      ON CONFLICT (setting_type, dealer_id) 
      DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW()
    `;
    
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      await pool.query(insertQuery, [openaiKey, dealerId]);
      console.log('✅ OpenAI API key added successfully!');
    } else {
      console.log('❌ No OPENAI_API_KEY environment variable found');
    }
    */
    
    // Check crew_ai_settings table
    console.log('\n🤖 Checking crew_ai_settings table...');
    const crewQuery = `
      SELECT * FROM crew_ai_settings 
      WHERE dealer_id = $1
    `;
    
    const crewResult = await pool.query(crewQuery, [dealerId]);
    if (crewResult.rows.length > 0) {
      console.log('Crew AI settings found:');
      crewResult.rows.forEach(row => {
        console.log(`  - Enabled: ${row.enabled}`);
        console.log(`  - Max Tokens: ${row.max_tokens}`);
        console.log(`  - Auto Routing: ${row.auto_routing}`);
      });
    } else {
      console.log('No Crew AI settings found for this dealer');
      
      // Create default Crew AI settings
      console.log('\n📝 Creating default Crew AI settings...');
      const createCrewQuery = `
        INSERT INTO crew_ai_settings (
          dealer_id, enabled, auto_routing, enable_sales_crew, 
          enable_customer_service_crew, enable_inventory_crew, 
          crew_collaboration, agent_memory, performance_tracking, 
          fallback_to_traditional, crew_selection, max_tokens, created_at, updated_at
        ) VALUES ($1, true, true, true, true, true, true, true, true, true, 'auto', 150, NOW(), NOW())
      `;
      
      await pool.query(createCrewQuery, [dealerId]);
      console.log('✅ Default Crew AI settings created!');
    }
    
    console.log('\n✅ OpenAI key check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

addOpenAIKey(); 