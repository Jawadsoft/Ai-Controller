import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDaiveConversations() {
  try {
    console.log('🔍 Checking DAIVE conversations table...');
    
    // Check if table exists and has data
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'daive_conversations'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ daive_conversations table does not exist');
      return;
    }
    
    console.log('✅ daive_conversations table exists');
    
    // Check table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table structure:');
    structure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if there are any conversations
    const countResult = await pool.query('SELECT COUNT(*) FROM daive_conversations');
    const totalConversations = parseInt(countResult.rows[0].count);
    
    console.log(`📊 Total conversations: ${totalConversations}`);
    
    if (totalConversations > 0) {
      // Show sample conversations
      const sampleResult = await pool.query(`
        SELECT dc.*, v.make, v.model, v.year, v.vin
        FROM daive_conversations dc
        LEFT JOIN vehicles v ON dc.vehicle_id = v.id
        LIMIT 3
      `);
      
      console.log('📝 Sample conversations:');
      sampleResult.rows.forEach((conv, index) => {
        console.log(`  ${index + 1}. ID: ${conv.id}`);
        console.log(`     Customer: ${conv.customer_name || 'Anonymous'}`);
        console.log(`     Vehicle: ${conv.vehicle_id ? `${conv.year} ${conv.make} ${conv.model}` : 'No vehicle'}`);
        console.log(`     Status: ${conv.lead_status}`);
        console.log(`     Created: ${conv.created_at}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No conversations found. This might be why the analytics page shows 0 data.');
    }
    
    // Check if there are any dealers
    const dealerCount = await pool.query('SELECT COUNT(*) FROM dealers');
    console.log(`🏢 Total dealers: ${dealerCount.rows[0].count}`);
    
    // Check if there are any users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Total users: ${userCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking DAIVE conversations:', error);
  } finally {
    await pool.end();
  }
}

checkDaiveConversations();



