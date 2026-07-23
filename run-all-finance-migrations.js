/**
 * Comprehensive Finance Migration Runner
 * Handles all finance-related migrations with error recovery
 */

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
    const url = new URL(process.env.DATABASE_URL);
    const password = url.password || process.env.DB_PASSWORD || 'Dealeriq';
    
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1),
      user: url.username,
      password: String(password),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('✅ Database connection configured from DATABASE_URL');
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'vehicle_management',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || 'Dealeriq'),
      ssl: false
    };
  }
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'vehicle_management',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || 'Dealeriq'),
    ssl: false
  };
}

const pool = new Pool(poolConfig);

/**
 * Check if required tables exist
 */
async function checkPrerequisites(client) {
  console.log('\n🔍 Checking prerequisites...\n');
  
  const requiredTables = ['dealers', 'vehicles', 'daive_conversations'];
  const missing = [];
  
  for (const table of requiredTables) {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [table]);
    
    if (result.rows[0].exists) {
      console.log(`✅ Table '${table}' exists`);
    } else {
      console.log(`❌ Table '${table}' is MISSING`);
      missing.push(table);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n⚠️  WARNING: Missing required tables: ${missing.join(', ')}`);
    console.log('   Please run main-schema-migration.sql first!');
    return false;
  }
  
  console.log('\n✅ All prerequisites met!');
  return true;
}

/**
 * Execute SQL statement with error handling
 */
async function executeSQL(client, sql, statementName) {
  try {
    await client.query(sql);
    console.log(`✅ ${statementName}`);
    return true;
  } catch (error) {
    // Ignore "already exists" errors (IF NOT EXISTS should prevent these)
    if (error.message.includes('already exists') || error.code === '42P07') {
      console.log(`ℹ️  ${statementName} (already exists - skipped)`);
      return true;
    }
    
    // Ignore duplicate key errors for INSERT statements
    if (error.message.includes('duplicate key') || error.code === '23505') {
      console.log(`ℹ️  ${statementName} (duplicate - skipped)`);
      return true;
    }
    
    console.error(`❌ ${statementName} - ERROR: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    if (error.detail) console.error(`   Detail: ${error.detail}`);
    return false;
  }
}

/**
 * Split SQL into individual statements
 */
function splitSQLStatements(sql) {
  // Remove comments
  let cleaned = sql.replace(/--[^\n]*/g, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Split by semicolons, but keep CREATE TYPE and multi-line statements together
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let parenDepth = 0;
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1];
    
    if ((char === "'" || char === '"') && (i === 0 || cleaned[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }
    
    if (!inString) {
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
      
      if (char === ';' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed && trimmed.length > 0) {
          statements.push(trimmed);
        }
        current = '';
        continue;
      }
    }
    
    current += char;
  }
  
  // Add last statement if exists
  const trimmed = current.trim();
  if (trimmed && trimmed.length > 0) {
    statements.push(trimmed);
  }
  
  return statements.filter(s => s.length > 0);
}

/**
 * Run finance schema migration
 */
async function runFinanceSchemaMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Finance Schema Migration...\n');
    
    // Check prerequisites
    const prerequisitesMet = await checkPrerequisites(client);
    if (!prerequisitesMet) {
      console.log('\n⚠️  Migration cannot proceed. Please run main-schema-migration.sql first.');
      return false;
    }
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'finance-schema.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      return false;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📖 Migration file loaded successfully');
    console.log(`📊 File size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);
    
    // Split into statements
    const statements = splitSQLStatements(migrationSQL);
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute statements one by one
    let successCount = 0;
    let errorCount = 0;
    
    console.log('⚡ Executing migration statements...\n');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const firstWords = statement.substring(0, 50).replace(/\s+/g, ' ').trim();
      const statementName = `Statement ${i + 1}/${statements.length}: ${firstWords}...`;
      
      const success = await executeSQL(client, statement, statementName);
      if (success) {
        successCount++;
      } else {
        errorCount++;
        // Continue with next statement even if one fails
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${statements.length}\n`);
    
    // Verify tables were created
    console.log('🔍 Verifying finance tables...\n');
    
    const tablesToCheck = [
      { name: 'credit_applications', description: 'Credit Applications' },
      { name: 'finance_terms_master', description: 'Finance Terms Master' },
      { name: 'finance_deals', description: 'Finance Deals' }
    ];
    
    let allTablesExist = true;
    
    for (const { name, description } of tablesToCheck) {
      try {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [name]);
        
        if (result.rows[0].exists) {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${name}`);
          console.log(`✅ ${description} table exists (${countResult.rows[0].count} rows)`);
        } else {
          console.log(`❌ ${description} table is MISSING`);
          allTablesExist = false;
        }
      } catch (error) {
        console.log(`⚠️  Could not verify '${name}': ${error.message}`);
        allTablesExist = false;
      }
    }
    
    // Check indexes
    console.log('\n🔍 Checking finance indexes...\n');
    
    try {
      const indexResult = await client.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND (
          indexname LIKE 'idx_credit_apps%' 
          OR indexname LIKE 'idx_finance_terms%' 
          OR indexname LIKE 'idx_finance_deals%'
        )
        ORDER BY tablename, indexname;
      `);
      
      if (indexResult.rows.length > 0) {
        console.log(`✅ Found ${indexResult.rows.length} finance indexes:`);
        indexResult.rows.forEach(row => {
          console.log(`   - ${row.indexname} (${row.tablename})`);
        });
      } else {
        console.log('⚠️  No finance indexes found');
      }
    } catch (error) {
      console.log(`⚠️  Could not check indexes: ${error.message}`);
    }
    
    // Check global finance programs
    console.log('\n🔍 Checking global finance programs...\n');
    
    try {
      const programsResult = await client.query(`
        SELECT 
          COUNT(*) as total, 
          COUNT(CASE WHEN type = 'finance' THEN 1 END) as finance,
          COUNT(CASE WHEN type = 'lease' THEN 1 END) as lease,
          COUNT(CASE WHEN dealer_id IS NULL THEN 1 END) as global
        FROM finance_terms_master;
      `);
      
      if (programsResult.rows.length > 0) {
        const stats = programsResult.rows[0];
        console.log(`📊 Finance Programs Statistics:`);
        console.log(`   - Total Programs: ${stats.total}`);
        console.log(`   - Finance Programs: ${stats.finance}`);
        console.log(`   - Lease Programs: ${stats.lease}`);
        console.log(`   - Global (Default) Programs: ${stats.global}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not check programs: ${error.message}`);
    }
    
    if (allTablesExist && errorCount === 0) {
      console.log('\n🎉 Finance Schema Migration completed successfully!');
      console.log('\n📚 Next Steps:');
      console.log('   1. Test the finance API endpoints');
      console.log('   2. Configure dealer-specific finance programs as needed');
      console.log('   3. Test credit application workflow');
      return true;
    } else {
      console.log('\n⚠️  Migration completed with warnings. Some objects may need manual attention.');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    if (error.detail) console.error('   Detail:', error.detail);
    if (error.hint) console.error('   Hint:', error.hint);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runFinanceSchemaMigration()
  .then(success => {
    if (success) {
      console.log('\n✅ All done!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration completed with issues. Please review the output above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

