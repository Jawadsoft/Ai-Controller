import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting enhanced credit applications migration...\n');
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'enhance-credit-applications.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await client.query(sql);
    
    console.log('✅ Enhanced credit applications migration completed successfully!');
    console.log('\nNew fields added:');
    console.log('  📋 Borrower: date_of_birth, address fields');
    console.log('  🚗 Vehicle: make, model, year, mileage, price');
    console.log('  💰 Loan: requested_amount, term, monthly_payment, interest_rate');
    console.log('  💼 Employment: job_title, work_address, monthly_income');
    console.log('  ✍️  Authorization: signature_data, terms_accepted, ip_address');
    console.log('  📄 PDF: pdf_url, pdf_generated_at');
    console.log('  👤 Customer: customer_id, application_source\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

