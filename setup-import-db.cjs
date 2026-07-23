const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vehicle_management'
});

async function setupImportDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Setting up import database schema...');
    
    // Read the import schema file
    const schemaPath = path.join(process.cwd(), 'src', 'database', 'import-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await client.query(schemaSQL);
    
    console.log('✅ Import database schema setup completed successfully!');
    
    // Create uploads directories
    const uploadsDir = path.join(process.cwd(), 'uploads', 'imports');
    const processedDir = path.join(uploadsDir, 'processed');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads/imports directory');
    }
    
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
      console.log('✅ Created uploads/imports/processed directory');
    }
    
  } catch (error) {
    console.error('❌ Error setting up import database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupImportDatabase().catch(console.error); 