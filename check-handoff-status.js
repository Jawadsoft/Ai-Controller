import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkHandoffStatus() {
  try {
    console.log('🔍 Checking handoff status in conversations...');
    
    // Check conversations with handoff requests
    const handoffResult = await pool.query(`
      SELECT 
        id,
        customer_name,
        lead_status,
        handoff_requested,
        handoff_to_user_id,
        created_at
      FROM daive_conversations 
      WHERE handoff_requested = true
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Conversations with handoff requests: ${handoffResult.rows.length}`);
    
    if (handoffResult.rows.length > 0) {
      console.log('\n📝 Handoff conversations:');
      handoffResult.rows.forEach((conv, index) => {
        console.log(`  ${index + 1}. ID: ${conv.id}`);
        console.log(`     Customer: ${conv.customer_name || 'Anonymous'}`);
        console.log(`     Status: ${conv.lead_status}`);
        console.log(`     Handoff requested: ${conv.handoff_requested}`);
        console.log(`     Handoff to user: ${conv.handoff_to_user_id || 'Not assigned'}`);
        console.log(`     Created: ${conv.created_at}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No conversations have handoff requests. This is why the Actions column is empty.');
    }
    
    // Check all conversations to see their handoff status
    const allResult = await pool.query(`
      SELECT 
        id,
        customer_name,
        lead_status,
        handoff_requested,
        created_at
      FROM daive_conversations 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('\n📋 Recent conversations handoff status:');
    allResult.rows.forEach((conv, index) => {
      console.log(`  ${index + 1}. ${conv.customer_name || 'Anonymous'} - Handoff: ${conv.handoff_requested}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking handoff status:', error);
  } finally {
    await pool.end();
  }
}

checkHandoffStatus();



