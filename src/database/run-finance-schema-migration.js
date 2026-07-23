import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection configuration (supports DATABASE_URL or individual env vars)
let poolConfig;

if (process.env.DATABASE_URL) {
  try {
    // Parse the connection string
    const url = new URL(process.env.DATABASE_URL);
    const password = url.password || process.env.DB_PASSWORD || 'Dealeriq';
    
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1), // Remove leading slash
      user: url.username,
      password: String(password), // Force to string
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Database connection configured from DATABASE_URL');
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error);
    // Fallback to individual environment variables
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'vehicle_management',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || 'Dealeriq'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Using fallback database configuration');
  }
} else {
  // Use individual environment variables as fallback
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'vehicle_management',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || 'Dealeriq'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
  console.log('Database connection configured from environment variables');
}

const pool = new Pool(poolConfig);

async function runFinanceSchemaMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Finance Schema Migration...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'finance-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration file loaded successfully');
    console.log(`📊 File size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);
    
    // Execute the migration
    console.log('⚡ Executing migration...\n');
    
    const result = await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log(`📈 Result: ${result.command || 'Migration executed'}\n`);
    
    // Verify key tables were created
    console.log('🔍 Verifying finance tables...\n');
    
    const tablesToCheck = [
      'credit_applications',
      'finance_terms_master',
      'finance_deals'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        if (tableCheck.rows[0].exists) {
          // Get row count
          const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
          console.log(`✅ Table '${tableName}' exists (${countResult.rows[0].count} rows)`);
        } else {
          console.log(`❌ Table '${tableName}' missing`);
        }
      } catch (error) {
        console.log(`⚠️ Could not check table '${tableName}': ${error.message}`);
      }
    }
    
    // Check indexes
    console.log('\n🔍 Checking finance indexes...\n');
    
    const indexCheck = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND (indexname LIKE 'idx_credit_apps%' OR indexname LIKE 'idx_finance_terms%' OR indexname LIKE 'idx_finance_deals%')
      ORDER BY tablename, indexname;
    `);
    
    console.log(`📊 Found ${indexCheck.rows.length} finance-related indexes:`);
    indexCheck.rows.forEach(row => {
      console.log(`   - ${row.indexname} (${row.tablename})`);
    });
    
    // Check if global finance programs were inserted
    console.log('\n🔍 Checking global finance programs...\n');
    
    const programsCheck = await client.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN type = 'finance' THEN 1 END) as finance,
             COUNT(CASE WHEN type = 'lease' THEN 1 END) as lease,
             COUNT(CASE WHEN dealer_id IS NULL THEN 1 END) as global
      FROM finance_terms_master;
    `);
    
    if (programsCheck.rows.length > 0) {
      const stats = programsCheck.rows[0];
      console.log(`📊 Finance Programs:`);
      console.log(`   - Total: ${stats.total}`);
      console.log(`   - Finance: ${stats.finance}`);
      console.log(`   - Lease: ${stats.lease}`);
      console.log(`   - Global (default): ${stats.global}`);
    }
    
    console.log('\n🎉 Finance Schema Migration completed successfully!');
    console.log('\n📚 Next Steps:');
    console.log('   1. Verify all tables were created correctly');
    console.log('   2. Check that indexes are in place');
    console.log('   3. Verify global finance programs were inserted');
    console.log('   4. Test the finance API endpoints');
    console.log('   5. Configure dealer-specific finance programs as needed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n🔍 Error details:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Detail:', error.detail);
    console.error('   Hint:', error.hint);
    
    // Try to get more context about where the error occurred
    if (error.position) {
      console.error('\n📍 Error position in SQL:', error.position);
      
      // Try to show the context around the error
      const migrationPath = path.join(__dirname, 'finance-schema.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      const lines = migrationSQL.split('\n');
      const errorLine = Math.floor(error.position / 80) + 1; // Rough estimate
      
      console.error('\n📄 Context around error (approximate):');
      for (let i = Math.max(0, errorLine - 3); i < Math.min(lines.length, errorLine + 3); i++) {
        const marker = i === errorLine ? '>>> ' : '    ';
        console.error(`${marker}${i + 1}: ${lines[i]}`);
      }
    }
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runFinanceSchemaMigration().catch(console.error);

