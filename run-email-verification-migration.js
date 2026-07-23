import { query } from './src/database/connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEmailVerificationMigration() {
  try {
    console.log('🚀 Starting email verification migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src/database/add-email-verification.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration SQL...');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        await query(statement);
      }
    }
    
    console.log('✅ Email verification migration completed successfully!');
    
    // Verify the changes
    console.log('\n🔍 Verifying migration...');
    
    const verifyResult = await query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('verification_token', 'verification_token_expires', 'email_verified')
      ORDER BY column_name
    `);
    
    console.log('\n📊 Migration verification results:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
    // Check if index was created
    const indexResult = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname = 'idx_users_verification_token'
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('\n✅ Verification token index created successfully');
    } else {
      console.log('\n⚠️  Verification token index not found');
    }
    
    console.log('\n🎉 Email verification migration is ready!');
    console.log('\nNext steps:');
    console.log('1. Update your .env file with SMTP settings');
    console.log('2. Test the email service');
    console.log('3. Update the registration flow to send verification emails');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runEmailVerificationMigration();
