/**
 * Diagnostic Script for PDF & Signature Feature
 * Run this to identify what's causing the 404 errors
 */

import { query } from './src/database/connection.js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Starting PDF & Signature Diagnostics...\n');

async function checkDatabase() {
  console.log('📊 Checking Database Tables...');
  try {
    // Check if tables exist
    const tables = [
      'deal_sheet_templates',
      'generated_deal_sheets',
      'signature_requests',
      'signature_events'
    ];

    for (const tableName of tables) {
      const result = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      const exists = result.rows[0].exists;
      console.log(`  ${exists ? '✅' : '❌'} Table '${tableName}' ${exists ? 'exists' : 'MISSING'}`);
    }

    // Check if default template exists
    const templateCheck = await query(
      'SELECT COUNT(*) as count FROM deal_sheet_templates WHERE is_default = TRUE'
    );
    const templateCount = parseInt(templateCheck.rows[0].count);
    console.log(`  ${templateCount > 0 ? '✅' : '❌'} Default template ${templateCount > 0 ? 'exists' : 'MISSING'} (found ${templateCount})`);

    // Check finance_deals columns
    const columnCheck = await query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'finance_deals' 
       AND column_name IN ('latest_deal_sheet_id', 'signature_request_id')`
    );
    const hasColumns = columnCheck.rows.length === 2;
    console.log(`  ${hasColumns ? '✅' : '❌'} finance_deals has new columns ${hasColumns ? '' : 'MISSING'}`);

  } catch (error) {
    console.error('  ❌ Database check failed:', error.message);
  }
  console.log('');
}

async function checkFileSystem() {
  console.log('📁 Checking File System...');
  
  // Check uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads', 'deal-sheets');
  const uploadsExist = fs.existsSync(uploadsDir);
  console.log(`  ${uploadsExist ? '✅' : '⚠️ '} Uploads directory ${uploadsExist ? 'exists' : 'MISSING'} at: ${uploadsDir}`);
  
  if (!uploadsExist) {
    console.log('     Creating directory...');
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('     ✅ Directory created');
    } catch (error) {
      console.log('     ❌ Failed to create:', error.message);
    }
  }

  // Check if directory is writable
  try {
    const testFile = path.join(uploadsDir, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('  ✅ Directory is writable');
  } catch (error) {
    console.log('  ❌ Directory is NOT writable:', error.message);
  }
  console.log('');
}

async function checkServices() {
  console.log('🔧 Checking Services...');
  
  try {
    const pdfGenerator = (await import('./src/lib/pdfGenerator.js')).default;
    console.log('  ✅ pdfGenerator service loaded');
    console.log(`     Storage directory: ${pdfGenerator.storageDir}`);
  } catch (error) {
    console.log('  ❌ pdfGenerator service failed to load:', error.message);
  }

  try {
    const signatureService = (await import('./src/lib/signatureService.js')).default;
    console.log('  ✅ signatureService loaded');
    console.log(`     Provider: ${signatureService.provider}`);
    console.log(`     Configured: ${signatureService.isConfigured}`);
  } catch (error) {
    console.log('  ❌ signatureService failed to load:', error.message);
  }
  console.log('');
}

async function checkPackages() {
  console.log('📦 Checking NPM Packages...');
  
  try {
    await import('puppeteer');
    console.log('  ✅ puppeteer is installed');
  } catch (error) {
    console.log('  ⚠️  puppeteer is NOT installed');
  }

  try {
    await import('html-pdf-node');
    console.log('  ✅ html-pdf-node is installed');
  } catch (error) {
    console.log('  ⚠️  html-pdf-node is NOT installed');
  }
  console.log('');
}

async function checkServerConfig() {
  console.log('⚙️  Checking Server Configuration...');
  
  const envVars = [
    'DATABASE_URL',
    'SIGNATURE_PROVIDER',
    'PDF_STORAGE_PATH'
  ];

  for (const varName of envVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName} = ${varName === 'DATABASE_URL' ? '[hidden]' : value}`);
    } else {
      console.log(`  ⚠️  ${varName} is not set (using default)`);
    }
  }
  console.log('');
}

async function testAPIEndpoint() {
  console.log('🌐 Testing API Availability...');
  
  try {
    // Check if routes file exists
    const financeRouteExists = fs.existsSync('./src/routes/finance.js');
    console.log(`  ${financeRouteExists ? '✅' : '❌'} finance.js routes file ${financeRouteExists ? 'exists' : 'MISSING'}`);
    
    const signaturesRouteExists = fs.existsSync('./src/routes/signatures.js');
    console.log(`  ${signaturesRouteExists ? '✅' : '❌'} signatures.js routes file ${signaturesRouteExists ? 'exists' : 'MISSING'}`);
    
  } catch (error) {
    console.log('  ❌ Route files check failed:', error.message);
  }
  console.log('');
}

async function runDiagnostics() {
  try {
    await checkDatabase();
    await checkFileSystem();
    await checkServices();
    await checkPackages();
    await checkServerConfig();
    await testAPIEndpoint();
    
    console.log('✅ Diagnostics Complete!\n');
    console.log('📋 Summary:');
    console.log('   If you see any ❌ marks above, those are issues that need to be fixed.');
    console.log('   ⚠️  marks are warnings but may not prevent the feature from working.');
    console.log('\n💡 Next Steps:');
    console.log('   1. Fix any ❌ issues shown above');
    console.log('   2. Restart your server: npm run dev');
    console.log('   3. Try the PDF generation and signature features again');
    console.log('   4. Check server console for any runtime errors\n');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
  process.exit(0);
}

runDiagnostics();

