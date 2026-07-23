import { pool } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runNotificationsMigration() {
  try {
    console.log('🚀 Starting Finance Notifications Schema Migration...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'finance-notifications-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schemaSql);
    
    console.log('✅ Finance Notifications Schema Migration completed successfully!');
    console.log('📋 Created:');
    console.log('   - finance_notifications_log table');
    console.log('   - notification_settings column in dealers table');
    console.log('   - Indexes for performance');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
runNotificationsMigration();

