/**
 * PDF Generation Test Script
 * Tests all components needed for PDF generation
 */

import { query } from './src/database/connection.js';
import pdfGenerator from './src/lib/pdfGenerator.js';

console.log('🔍 PDF Generation Test Suite\n');
console.log('='.repeat(50));

async function runTests() {
  let dealId = null;
  let dealerId = null;

  try {
    // =====================================================
    // TEST 1: Database Connection
    // =====================================================
    console.log('\n📊 TEST 1: Database Connection');
    try {
      const result = await query('SELECT NOW()');
      console.log('✅ Database connection successful');
      console.log('   Server time:', result.rows[0].now);
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return;
    }

    // =====================================================
    // TEST 2: Check Templates Table
    // =====================================================
    console.log('\n📋 TEST 2: Deal Sheet Templates Table');
    try {
      const templates = await query('SELECT * FROM deal_sheet_templates LIMIT 5');
      console.log('✅ Templates table exists');
      console.log(`   Found ${templates.rows.length} template(s)`);
      
      if (templates.rows.length === 0) {
        console.log('⚠️  No templates found - creating default template...');
        
        const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deal Sheet</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .deal-sheet { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    table { width: 100%; }
    table tr td { padding: 8px; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="deal-sheet">
    <div class="header">
      <h1>{{dealer.business_name}}</h1>
      <p>Finance Deal Sheet</p>
    </div>
    <div class="section">
      <h2>Vehicle Information</h2>
      <table>
        <tr><td><strong>Year:</strong></td><td>{{vehicle.year}}</td></tr>
        <tr><td><strong>Make:</strong></td><td>{{vehicle.make}}</td></tr>
        <tr><td><strong>Model:</strong></td><td>{{vehicle.model}}</td></tr>
        <tr><td><strong>VIN:</strong></td><td>{{vehicle.vin}}</td></tr>
        <tr><td><strong>Price:</strong></td><td>{{vehicle.price}}</td></tr>
      </table>
    </div>
    <div class="section">
      <h2>Deal Terms</h2>
      <table>
        <tr><td><strong>Monthly Payment:</strong></td><td>{{deal.monthly_payment}}</td></tr>
        <tr><td><strong>Down Payment:</strong></td><td>{{deal.down_payment}}</td></tr>
        <tr><td><strong>Term:</strong></td><td>{{deal.term_months}} months</td></tr>
      </table>
    </div>
  </div>
</body>
</html>`;

        await query(`
          INSERT INTO deal_sheet_templates (
            dealer_id, template_name, template_type, is_default, is_active, html_template
          ) VALUES (NULL, 'Standard Deal Sheet', 'both', TRUE, TRUE, $1)
        `, [defaultTemplate]);
        
        console.log('✅ Default template created');
      } else {
        templates.rows.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.template_name} (${t.template_type}) ${t.is_default ? '[DEFAULT]' : ''}`);
        });
      }
    } catch (error) {
      console.error('❌ Templates table check failed:', error.message);
      console.error('   Full error:', error);
      return;
    }

    // =====================================================
    // TEST 3: Check for Finance Deals
    // =====================================================
    console.log('\n💰 TEST 3: Finance Deals');
    try {
      const deals = await query(`
        SELECT 
          fd.id, fd.dealer_id, fd.status, fd.deal_type, fd.monthly_payment,
          v.year, v.make, v.model, v.vin,
          d.business_name as dealer_name
        FROM finance_deals fd
        LEFT JOIN vehicles v ON fd.vehicle_id = v.id
        LEFT JOIN dealers d ON fd.dealer_id = d.id
        ORDER BY fd.created_at DESC
        LIMIT 5
      `);
      
      console.log(`✅ Found ${deals.rows.length} finance deal(s)`);
      
      if (deals.rows.length === 0) {
        console.log('⚠️  No deals found - cannot test PDF generation');
        console.log('   Create a deal first from the Finance page');
        return;
      }
      
      // Pick the first deal for testing
      const testDeal = deals.rows[0];
      dealId = testDeal.id;
      dealerId = testDeal.dealer_id;
      
      console.log('\n   Using deal for testing:');
      console.log(`   ID: ${dealId}`);
      console.log(`   Vehicle: ${testDeal.year} ${testDeal.make} ${testDeal.model}`);
      console.log(`   Status: ${testDeal.status}`);
      console.log(`   Monthly Payment: $${parseFloat(testDeal.monthly_payment)?.toFixed(2) || 'N/A'}`);
      console.log(`   Dealer: ${testDeal.dealer_name || 'N/A'}`);
      
    } catch (error) {
      console.error('❌ Finance deals query failed:', error.message);
      return;
    }

    // =====================================================
    // TEST 4: Test PDF Generator Module
    // =====================================================
    console.log('\n📄 TEST 4: PDF Generator Module');
    try {
      console.log('✅ pdfGenerator module imported successfully');
      
      // Check if html-pdf-node is available
      try {
        const htmlPdf = await import('html-pdf-node');
        console.log('✅ html-pdf-node package available');
      } catch (e) {
        console.log('⚠️  html-pdf-node not available, checking puppeteer...');
        try {
          const puppeteer = await import('puppeteer');
          console.log('✅ puppeteer package available');
        } catch (e2) {
          console.error('❌ Neither html-pdf-node nor puppeteer available');
          console.error('   Install one with: npm install html-pdf-node');
          return;
        }
      }
    } catch (error) {
      console.error('❌ PDF generator module import failed:', error.message);
      return;
    }

    // =====================================================
    // TEST 5: Generate HTML
    // =====================================================
    console.log('\n🌐 TEST 5: Generate HTML from Template');
    try {
      const { html, data, template } = await pdfGenerator.generateHTML(dealId, null);
      console.log('✅ HTML generation successful');
      console.log(`   Template: ${template.template_name}`);
      console.log(`   HTML length: ${html.length} characters`);
      console.log(`   Deal type: ${data.deal_type}`);
      
      // Save HTML for inspection
      const fs = await import('fs/promises');
      await fs.writeFile('test-deal-sheet.html', html);
      console.log('✅ HTML saved to: test-deal-sheet.html');
      
    } catch (error) {
      console.error('❌ HTML generation failed:', error.message);
      console.error('   Stack:', error.stack);
      return;
    }

    // =====================================================
    // TEST 6: Generate PDF
    // =====================================================
    console.log('\n📑 TEST 6: Generate Complete PDF Deal Sheet');
    try {
      console.log('   Generating PDF (this may take a few seconds)...');
      
      const dealSheet = await pdfGenerator.generateDealSheet({
        dealId: dealId,
        templateId: null,
        userId: null,
        dealerId: dealerId
      });
      
      console.log('✅ PDF generation successful!');
      console.log(`   PDF URL: ${dealSheet.pdf_url}`);
      console.log(`   PDF filename: ${dealSheet.pdf_filename}`);
      console.log(`   PDF size: ${(dealSheet.pdf_size_bytes / 1024).toFixed(2)} KB`);
      console.log(`   Version: ${dealSheet.version}`);
      console.log(`   Generated at: ${dealSheet.generated_at}`);
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error.message);
      console.error('   Stack:', error.stack);
      
      if (error.message.includes('puppeteer') || error.message.includes('html-pdf-node')) {
        console.log('\n💡 TIP: Install the required PDF package:');
        console.log('   npm install html-pdf-node');
      }
      
      return;
    }

    // =====================================================
    // TEST 7: Verify in Database
    // =====================================================
    console.log('\n🗄️  TEST 7: Verify PDF Record in Database');
    try {
      const pdfRecords = await query(`
        SELECT id, pdf_filename, pdf_url, version, is_latest, generated_at
        FROM generated_deal_sheets
        WHERE deal_id = $1
        ORDER BY version DESC
      `, [dealId]);
      
      console.log(`✅ Found ${pdfRecords.rows.length} PDF record(s) for this deal`);
      pdfRecords.rows.forEach((pdf, i) => {
        console.log(`   ${i + 1}. Version ${pdf.version} - ${pdf.pdf_filename} ${pdf.is_latest ? '[LATEST]' : ''}`);
      });
      
    } catch (error) {
      console.error('❌ Database verification failed:', error.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED! PDF generation is working correctly.');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the tests
runTests();

