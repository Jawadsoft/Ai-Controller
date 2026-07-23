/**
 * Run Credit Applications - Lender Link Update
 * Adds lender fields to credit applications table
 * 
 * Usage: node update-credit-lender-link.js
 */

import { query } from './src/database/connection.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runUpdate() {
  console.log('🔗 Linking Credit Applications with Lenders...\n');
  
  try {
    const sqlPath = path.join(__dirname, 'src/database/update-credit-apps-lender-link.sql');
    const sql = await fs.readFile(sqlPath, 'utf-8');
    
    await query(sql);
    
    console.log('✅ Credit applications now linked with lenders!');
    console.log('   - Added preferred_lender_id column');
    console.log('   - Added approved_lender_id column');
    console.log('   - Added application_id to lender_submissions');
    console.log('   - Created auto-assignment trigger');
    console.log('\n🎉 Update complete!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runUpdate();

