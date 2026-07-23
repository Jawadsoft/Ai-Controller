import { query } from './src/database/connection.js';

const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';

async function verifyDeletion() {
  try {
    console.log('🔍 Checking database for dealer:', dealerId);
    console.log('');
    
    // Check leads
    const leads = await query('SELECT COUNT(*) as count FROM leads WHERE dealer_id = $1', [dealerId]);
    console.log('📋 Leads count:', leads.rows[0].count);
    
    // Check conversations
    const conversations = await query('SELECT COUNT(*) as count FROM daive_conversations WHERE dealer_id = $1', [dealerId]);
    console.log('💬 Conversations count:', conversations.rows[0].count);
    
    // Check rebates
    const rebates = await query('SELECT COUNT(*) as count FROM rebates WHERE dealer_id = $1', [dealerId]);
    console.log('💵 Rebates count:', rebates.rows[0].count);
    
    // Check rebate applications
    const rebateApps = await query('SELECT COUNT(*) as count FROM rebate_applications WHERE dealer_id = $1', [dealerId]);
    console.log('📝 Rebate applications count:', rebateApps.rows[0].count);
    
    console.log('');
    console.log('✅ Verification complete');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyDeletion();

