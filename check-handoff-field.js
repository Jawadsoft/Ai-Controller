import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkHandoffField() {
  try {
    console.log('🔍 Checking handoff_requested field structure and data...');
    
    // Check the exact column definition
    const columnInfo = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations' 
      AND column_name = 'handoff_requested'
    `);
    
    if (columnInfo.rows.length > 0) {
      const col = columnInfo.rows[0];
      console.log('📋 handoff_requested column info:');
      console.log(`  Data type: ${col.data_type}`);
      console.log(`  Nullable: ${col.is_nullable}`);
      console.log(`  Default: ${col.column_default}`);
      console.log(`  Max length: ${col.character_maximum_length}`);
    } else {
      console.log('❌ handoff_requested column not found!');
      return;
    }
    
    // Check sample data with handoff_requested
    const sampleData = await pool.query(`
      SELECT 
        id,
        customer_name,
        handoff_requested,
        handoff_requested::text as handoff_text
      FROM daive_conversations 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📊 Sample handoff_requested data:');
    sampleData.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ID: ${row.id}`);
      console.log(`     Customer: ${row.customer_name || 'Anonymous'}`);
      console.log(`     handoff_requested: ${row.handoff_requested} (${typeof row.handoff_requested})`);
      console.log(`     As text: ${row.handoff_text}`);
      console.log('');
    });
    
    // Check if there are any conversations with handoff_requested = true
    const trueHandoffs = await pool.query(`
      SELECT COUNT(*) as count
      FROM daive_conversations 
      WHERE handoff_requested = true
    `);
    
    console.log(`✅ Conversations with handoff_requested = true: ${trueHandoffs.rows[0].count}`);
    
    // Check if there are any conversations with handoff_requested = 'true' (string)
    const stringTrueHandoffs = await pool.query(`
      SELECT COUNT(*) as count
      FROM daive_conversations 
      WHERE handoff_requested = 'true'
    `);
    
    console.log(`✅ Conversations with handoff_requested = 'true': ${stringTrueHandoffs.rows[0].count}`);
    
    // Check all unique values
    const uniqueValues = await pool.query(`
      SELECT DISTINCT handoff_requested, COUNT(*) as count
      FROM daive_conversations 
      GROUP BY handoff_requested
      ORDER BY handoff_requested
    `);
    
    console.log('\n🔍 All unique handoff_requested values:');
    uniqueValues.rows.forEach(row => {
      console.log(`  ${row.handoff_requested} (${typeof row.handoff_requested}): ${row.count} conversations`);
    });
    
  } catch (error) {
    console.error('❌ Error checking handoff field:', error);
  } finally {
    await pool.end();
  }
}

checkHandoffField();
