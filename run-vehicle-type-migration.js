import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, pool } from './src/database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('🚗 Starting vehicle type migration...');
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, 'src/database/add-vehicle-type-column.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration...');
    
    // Execute the migration
    await query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Vehicle type column has been added to the vehicles table');
    console.log('🔍 You can now filter and display vehicles by type (SUV, Sedan, Truck, etc.)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
