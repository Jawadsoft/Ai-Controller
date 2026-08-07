/**
 * Run Dealer Knowledge Base Migration
 * Sets up the database tables for website scraping functionality
 */

import { db } from './src/database/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Dealer Knowledge Base Migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src', 'database', 'dealer-knowledge-base-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📊 Executing migration SQL...\n');

    // Execute the migration
    await db.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    const verifyQuery = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dealer_knowledge_base'
      ORDER BY ordinal_position
    `;

    const result = await db.query(verifyQuery);

    if (result.rows.length > 0) {
      console.log('✅ Verified: dealer_knowledge_base table created with columns:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.warn('⚠️  Warning: Could not verify table creation');
    }

    // Check view
    const viewQuery = `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'dealer_knowledge_summary'
    `;

    const viewResult = await db.query(viewQuery);

    if (viewResult.rows.length > 0) {
      console.log('\n✅ Verified: dealer_knowledge_summary view created');
    }

    console.log('\n🎉 All done! The knowledge base system is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('  1. Register API routes in server.js');
    console.log('  2. Ensure Puppeteer is installed: npm install puppeteer');
    console.log('  3. Test scraping: POST /api/scraping/dealers/:dealerId/scrape');
    console.log('  4. View knowledge: GET /api/scraping/dealers/:dealerId/knowledge\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
