/**
 * Finance Compliance Migration Runner
 * Adds TTL fees, trade-in handling, and protection products support
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

async function executeSQL(client, sql, statementName) {
  try {
    await client.query(sql);
    console.log(`✅ ${statementName}`);
    return true;
  } catch (error) {
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

function splitSQLStatements(sql) {
  let cleaned = sql.replace(/--[^\n]*/g, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
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
  
  const trimmed = current.trim();
  if (trimmed && trimmed.length > 0) {
    statements.push(trimmed);
  }
  
  return statements.filter(s => s.length > 0);
}

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

async function runFinanceComplianceMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Finance Compliance Migration...\n');
    
    const prerequisitesMet = await checkPrerequisites(client);
    if (!prerequisitesMet) {
      console.log('\n⚠️  Migration cannot proceed. Please run finance-schema.sql first.');
      return false;
    }
    
    const migrationPath = path.join(__dirname, 'finance-compliance-migration.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      return false;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📖 Migration file loaded successfully');
    console.log(`📊 File size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);
    
    const statements = splitSQLStatements(migrationSQL);
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
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
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${statements.length}\n`);
    
    // Verify new columns and table
    console.log('🔍 Verifying new structures...\n');
    
    const columnsToCheck = [
      'sales_tax', 'title_fee', 'license_fee', 'registration_fee',
      'inspection_fee', 'processing_fee', 'total_government_fees',
      'trade_in_acv', 'trade_in_payoff', 'trade_in_net_credit',
      'trade_in_negative_equity', 'trade_in_equity', 'amount_financed',
      'total_protection_products', 'protection_products_monthly'
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
    
    // Check protection products table
    console.log('\n🔍 Checking protection products table...\n');
    
    try {
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'finance_deal_products'
        );
      `);
      
      if (tableResult.rows[0].exists) {
        console.log(`✅ Table 'finance_deal_products' exists`);
      } else {
        console.log(`❌ Table 'finance_deal_products' is MISSING`);
        allColumnsExist = false;
      }
    } catch (error) {
      console.log(`⚠️  Could not check table: ${error.message}`);
      allColumnsExist = false;
    }
    
    if (allColumnsExist && errorCount === 0) {
      console.log('\n🎉 Finance Compliance Migration completed successfully!');
      console.log('\n📚 Next Steps:');
      console.log('   1. Test TTL fee calculations');
      console.log('   2. Test trade-in equity calculations');
      console.log('   3. Test protection products functionality');
      return true;
    } else {
      console.log('\n⚠️  Migration completed with warnings. Some structures may need manual attention.');
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

runFinanceComplianceMigration()
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

