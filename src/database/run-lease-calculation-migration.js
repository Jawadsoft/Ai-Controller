/**
 * Lease Calculation Migration Runner
 * Adds new fields to finance_deals table for proper lease calculations
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection configuration
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
 * Execute SQL statement with error handling
 */
async function executeSQL(client, sql, statementName) {
  try {
    await client.query(sql);
    console.log(`✅ ${statementName}`);
    return true;
  } catch (error) {
    // Ignore "already exists" or "column already exists" errors
    if (error.message.includes('already exists') || 
        error.code === '42P07' || 
        error.code === '42701' ||
        error.message.includes('duplicate column')) {
      console.log(`ℹ️  ${statementName} (already exists - skipped)`);
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
  
  // Split by semicolons
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let parenDepth = 0;
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    
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
 * Check if finance_deals table exists
 */
async function checkPrerequisites(client) {
  console.log('\n🔍 Checking prerequisites...\n');
  
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'finance_deals'
    );
  `);
  
  if (result.rows[0].exists) {
    console.log('✅ finance_deals table exists');
    return true;
  } else {
    console.log('❌ finance_deals table is MISSING');
    console.log('   Please run finance-schema.sql first!');
    return false;
  }
}

/**
 * Run lease calculation migration
 */
async function runLeaseCalculationMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Lease Calculation Migration...\n');
    
    // Check prerequisites
    const prerequisitesMet = await checkPrerequisites(client);
    if (!prerequisitesMet) {
      console.log('\n⚠️  Migration cannot proceed. Please run finance-schema.sql first.');
      return false;
    }
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'lease-calculation-migration.sql');
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
      const firstWords = statement.substring(0, 60).replace(/\s+/g, ' ').trim();
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
    
    // Verify columns were added
    console.log('🔍 Verifying new columns...\n');
    
    const columnsToCheck = [
      'msrp',
      'cap_cost_reductions',
      'capitalized_fees',
      'adjusted_cap_cost',
      'residual_value',
      'depreciation_fee',
      'finance_charge',
      'base_payment',
      'tax_rate',
      'monthly_tax',
      'total_monthly_payment',
      'annual_mileage',
      'excess_mileage_rate',
      'allowed_miles',
      'actual_miles',
      'excess_miles',
      'excess_mileage_charge'
    ];
    
    let allColumnsExist = true;
    
    for (const columnName of columnsToCheck) {
      try {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'finance_deals'
            AND column_name = $1
          );
        `, [columnName]);
        
        if (result.rows[0].exists) {
          console.log(`✅ Column '${columnName}' exists`);
        } else {
          console.log(`❌ Column '${columnName}' is MISSING`);
          allColumnsExist = false;
        }
      } catch (error) {
        console.log(`⚠️  Could not verify '${columnName}': ${error.message}`);
        allColumnsExist = false;
      }
    }
    
    // Check index
    console.log('\n🔍 Checking index...\n');
    
    try {
      const indexResult = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'idx_finance_deals_lease_fields';
      `);
      
      if (indexResult.rows.length > 0) {
        console.log(`✅ Index 'idx_finance_deals_lease_fields' exists`);
      } else {
        console.log(`⚠️  Index 'idx_finance_deals_lease_fields' not found (may be created automatically)`);
      }
    } catch (error) {
      console.log(`⚠️  Could not check index: ${error.message}`);
    }
    
    if (allColumnsExist && errorCount === 0) {
      console.log('\n🎉 Lease Calculation Migration completed successfully!');
      console.log('\n📚 Next Steps:');
      console.log('   1. Test the lease calculation with the new fields');
      console.log('   2. Verify calculations match Developer Notes formulas');
      console.log('   3. Update existing lease deals if needed');
      return true;
    } else {
      console.log('\n⚠️  Migration completed with warnings. Some columns may need manual attention.');
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
runLeaseCalculationMigration()
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

