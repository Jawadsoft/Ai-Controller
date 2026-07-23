/**
 * PDF Generator Service
 * Generates PDF deal sheets from HTML templates with data substitution
 */

import { query } from '../database/connection.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFGeneratorService {
  constructor() {
    // PDF storage directory
    this.storageDir = process.env.PDF_STORAGE_PATH || path.join(__dirname, '../../uploads/deal-sheets');
    this.ensureStorageDir();
  }

  /**
   * Ensure storage directory exists
   */
  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Error creating storage directory:', error);
    }
  }

  /**
   * Get default or dealer-specific template
   * @param {string} dealerId - Dealer UUID
   * @param {string} templateType - 'finance' or 'lease'
   * @returns {Promise<object>} Template object
   */
  async getTemplate(dealerId, templateType = 'both') {
    try {
      // First try to get dealer-specific default template
      let sql = `
        SELECT * FROM deal_sheet_templates
        WHERE dealer_id = $1 
          AND (template_type = $2 OR template_type = 'both')
          AND is_default = TRUE
          AND is_active = TRUE
        LIMIT 1
      `;
      
      let result = await query(sql, [dealerId, templateType]);
      
      // If no dealer-specific template, get global default
      if (result.rows.length === 0) {
        sql = `
          SELECT * FROM deal_sheet_templates
          WHERE dealer_id IS NULL
            AND (template_type = $1 OR template_type = 'both')
            AND is_default = TRUE
            AND is_active = TRUE
          LIMIT 1
        `;
        
        result = await query(sql, [templateType]);
      }
      
      if (result.rows.length === 0) {
        throw new Error('No default template found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting template:', error);
      throw error;
    }
  }

  /**
   * Get deal data with all related information
   * @param {string} dealId - Deal UUID
   * @returns {Promise<object>} Complete deal data
   */
  async getDealData(dealId) {
    try {
      const sql = `
        SELECT 
          fd.*,
          -- Vehicle data
          v.year, v.make, v.model, v.trim, v.vin, v.stock_number, v.mileage, v.color,
          -- Finance terms data
          ftm.program_name, ftm.program_source,
          -- Credit application data
          ca.customer_name, ca.customer_email, ca.customer_phone, ca.credit_score,
          -- Dealer data
          d.business_name as dealer_name, d.address as dealer_address, 
          d.phone as dealer_phone, d.email as dealer_email, d.website as dealer_website,
          -- Lender data (if approved)
          l.lender_name, l.contact_phone as lender_phone
        FROM finance_deals fd
        LEFT JOIN vehicles v ON fd.vehicle_id = v.id
        LEFT JOIN finance_terms_master ftm ON fd.term_id = ftm.id
        LEFT JOIN credit_applications ca ON fd.application_id = ca.id
        LEFT JOIN dealers d ON fd.dealer_id = d.id
        LEFT JOIN lenders l ON fd.approved_lender_id = l.id
        WHERE fd.id = $1
      `;
      
      const result = await query(sql, [dealId]);
      
      if (result.rows.length === 0) {
        throw new Error('Deal not found');
      }
      
      const dealData = result.rows[0];
      
      // Fetch protection products
      const productsResult = await query(
        'SELECT * FROM finance_deal_products WHERE deal_id = $1 ORDER BY created_at',
        [dealId]
      );
      
      dealData.protection_products_list = productsResult.rows;
      
      return dealData;
    } catch (error) {
      console.error('Error getting deal data:', error);
      throw error;
    }
  }

  /**
   * Replace template placeholders with actual data
   * @param {string} template - HTML template with placeholders
   * @param {object} data - Deal data
   * @returns {string} HTML with replaced placeholders
   */
  replacePlaceholders(template, data) {
    let html = template;
    
    // Format currency
    const formatCurrency = (value) => {
      if (!value) return '$0.00';
      return '$' + parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    // Format number
    const formatNumber = (value) => {
      if (!value) return '0';
      return parseInt(value).toLocaleString('en-US');
    };
    
    // Build replacement map
    const replacements = {
      // Vehicle
      'vehicle.year': data.year || '',
      'vehicle.make': data.make || '',
      'vehicle.model': data.model || '',
      'vehicle.trim': data.trim || '',
      'vehicle.vin': data.vin || '',
      'vehicle.stock_number': data.stock_number || '',
      'vehicle.price': formatCurrency(data.vehicle_price),
      'vehicle.mileage': formatNumber(data.mileage),
      'vehicle.color': data.color || '',
      
      // Customer
      'customer.name': data.customer_name || '',
      'customer.email': data.customer_email || '',
      'customer.phone': data.customer_phone || '',
      'customer.credit_score': data.credit_score || '',
      
      // Deal
      'deal.deal_type': data.deal_type === 'finance' ? 'Finance' : 'Lease',
      'deal.monthly_payment': formatCurrency(data.monthly_payment),
      'deal.down_payment': formatCurrency(data.down_payment),
      'deal.term_months': data.term_months || '',
      'deal.apr': data.apr || '',
      'deal.total_amount': formatCurrency(data.total_amount),
      'deal.total_interest': formatCurrency(data.total_interest),
      'deal.money_factor': data.money_factor || '',
      'deal.residual_value_pct': data.residual_value_pct || '',
      
      // Dealer
      'dealer.business_name': data.dealer_name || '',
      'dealer.address': data.dealer_address || '',
      'dealer.phone': data.dealer_phone || '',
      'dealer.email': data.dealer_email || '',
      'dealer.website': data.dealer_website || '',
      
      // Lender
      'lender.name': data.lender_name || '',
      'lender.contact_phone': data.lender_phone || '',
      'lender.reference_number': data.lender_reference_number || '',
      
      // Government Fees (TTL)
      'government.sales_tax': formatCurrency(data.sales_tax),
      'government.title_fee': formatCurrency(data.title_fee),
      'government.license_fee': formatCurrency(data.license_fee),
      'government.registration_fee': formatCurrency(data.registration_fee),
      'government.inspection_fee': formatCurrency(data.inspection_fee),
      'government.processing_fee': formatCurrency(data.processing_fee),
      'government.total_fees': formatCurrency(data.total_government_fees),
      
      // Trade-In
      'trade_in.acv': formatCurrency(data.trade_in_acv),
      'trade_in.payoff': formatCurrency(data.trade_in_payoff),
      'trade_in.net_credit': formatCurrency(data.trade_in_net_credit),
      'trade_in.negative_equity': formatCurrency(data.trade_in_negative_equity),
      'trade_in.equity': formatCurrency(data.trade_in_equity),
      
      // Amount Financed
      'deal.amount_financed': formatCurrency(data.amount_financed),
      'deal.total_protection_products': formatCurrency(data.total_protection_products),
      'deal.protection_products_monthly': formatCurrency(data.protection_products_monthly),
      
      // Generated date
      'generated_date': new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };
    
    // Replace all placeholders
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, value);
    }
    
    // Auto-inject compliance section if template doesn't explicitly place it
    const complianceSection = this.buildComplianceSection(data, formatCurrency, formatNumber);
    
    if (html.includes('{{ compliance_section }}') || html.includes('{{compliance_section}}')) {
      html = html.replace(/{{\s*compliance_section\s*}}/g, complianceSection);
    } else if (html.toLowerCase().includes('</body>')) {
      html = html.replace(/<\/body>/i, `${complianceSection}</body>`);
    } else {
      html += complianceSection;
    }

    return html;
  }

  /**
   * Generate HTML from template and data
   * @param {string} dealId - Deal UUID
   * @param {string} templateId - Template UUID (optional)
   * @returns {Promise<object>} {html, data, template}
   */
  async generateHTML(dealId, templateId = null) {
    try {
      // Get deal data
      const dealData = await this.getDealData(dealId);
      
      // Get template
      let template;
      if (templateId) {
        const result = await query('SELECT * FROM deal_sheet_templates WHERE id = $1', [templateId]);
        if (result.rows.length === 0) {
          throw new Error('Template not found');
        }
        template = result.rows[0];
      } else {
        template = await this.getTemplate(dealData.dealer_id, dealData.deal_type);
      }
      
      // Combine HTML template with CSS
      let fullHTML = template.html_template;
      if (template.css_styles) {
        fullHTML = fullHTML.replace('</head>', `<style>${template.css_styles}</style></head>`);
      }
      
      // Replace placeholders
      const finalHTML = this.replacePlaceholders(fullHTML, dealData);
      
      return {
        html: finalHTML,
        data: dealData,
        template: template
      };
    } catch (error) {
      console.error('Error generating HTML:', error);
      throw error;
    }
  }

  /**
   * Generate PDF from HTML (using html-pdf-node as fallback if puppeteer not available)
   * @param {string} html - HTML content
   * @param {object} options - PDF options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePDF(html, options = {}) {
    try {
      // Try to use puppeteer first (if available)
      try {
        const puppeteer = await import('puppeteer');
        return await this.generatePDFWithPuppeteer(html, options, puppeteer);
      } catch (puppeteerError) {
        console.log('Puppeteer not available, using html-pdf-node fallback');
      }
      
      // Fallback to html-pdf-node
      const htmlPdf = await import('html-pdf-node');
      return await this.generatePDFWithHtmlPdfNode(html, options, htmlPdf);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('PDF generation failed. Please ensure puppeteer or html-pdf-node is installed.');
    }
  }

  /**
   * Generate PDF using Puppeteer
   */
  async generatePDFWithPuppeteer(html, options, puppeteer) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: options.page_size || 'letter',
        landscape: options.page_orientation === 'landscape',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      });
      
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate PDF using html-pdf-node (fallback)
   */
  async generatePDFWithHtmlPdfNode(html, options, htmlPdf) {
    const file = { content: html };
    const pdfOptions = {
      format: options.page_size || 'Letter',
      landscape: options.page_orientation === 'landscape',
      printBackground: true
    };
    
    const pdfBuffer = await htmlPdf.default.generatePdf(file, pdfOptions);
    return pdfBuffer;
  }

  /**
   * Save PDF to storage
   * @param {Buffer} pdfBuffer - PDF buffer
   * @param {string} dealId - Deal UUID
   * @returns {Promise<object>} {filename, filepath, size}
   */
  async savePDF(pdfBuffer, dealId) {
    try {
      await this.ensureStorageDir();
      
      const filename = `deal-sheet-${dealId}-${Date.now()}.pdf`;
      const filepath = path.join(this.storageDir, filename);
      
      await fs.writeFile(filepath, pdfBuffer);
      
      return {
        filename,
        filepath,
        size: pdfBuffer.length,
        url: `/uploads/deal-sheets/${filename}` // Public URL path
      };
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw error;
    }
  }

  /**
   * Generate and save complete deal sheet
   * @param {object} params - Generation parameters
   * @returns {Promise<object>} Generated deal sheet record
   */
  async generateDealSheet(params) {
    try {
      const { dealId, templateId, userId, dealerId } = params;
      
      // Generate HTML
      const { html, data, template } = await this.generateHTML(dealId, templateId);
      
      // Generate PDF
      const pdfBuffer = await this.generatePDF(html, template);
      
      // Save PDF
      const pdfInfo = await this.savePDF(pdfBuffer, dealId);
      
      // Check if there's an existing latest version
      const existingCheck = await query(
        'SELECT id FROM generated_deal_sheets WHERE deal_id = $1 AND is_latest = TRUE',
        [dealId]
      );
      
      // Mark existing as not latest
      if (existingCheck.rows.length > 0) {
        await query(
          'UPDATE generated_deal_sheets SET is_latest = FALSE WHERE deal_id = $1',
          [dealId]
        );
      }
      
      // Get next version number
      const versionResult = await query(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM generated_deal_sheets WHERE deal_id = $1',
        [dealId]
      );
      const version = versionResult.rows[0].next_version;
      
      // Save deal sheet record
      const insertSql = `
        INSERT INTO generated_deal_sheets (
          deal_id, dealer_id, template_id, pdf_filename, pdf_url, pdf_size_bytes,
          generated_by, version, is_latest, deal_data, vehicle_data, customer_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11)
        RETURNING *
      `;
      
      const dealData = {
        deal_type: data.deal_type,
        monthly_payment: data.monthly_payment,
        down_payment: data.down_payment,
        term_months: data.term_months,
        apr: data.apr
      };
      
      const vehicleData = {
        year: data.year,
        make: data.make,
        model: data.model,
        vin: data.vin
      };
      
      const customerData = {
        name: data.customer_name,
        email: data.customer_email,
        phone: data.customer_phone
      };
      
      const result = await query(insertSql, [
        dealId,
        dealerId,
        template.id,
        pdfInfo.filename,
        pdfInfo.url,
        pdfInfo.size,
        userId,
        version,
        JSON.stringify(dealData),
        JSON.stringify(vehicleData),
        JSON.stringify(customerData)
      ]);
      
      // Update finance_deals with latest deal sheet
      await query(
        'UPDATE finance_deals SET latest_deal_sheet_id = $1, deal_sheet_generated_at = NOW() WHERE id = $2',
        [result.rows[0].id, dealId]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error generating deal sheet:', error);
      throw error;
    }
  }

  /**
   * Get deal sheets for a deal
   * @param {string} dealId - Deal UUID
   * @returns {Promise<Array>} Deal sheets
   */
  async getDealSheets(dealId) {
    try {
      const sql = `
        SELECT 
          gds.*,
          dst.template_name,
          u.name as generated_by_name
        FROM generated_deal_sheets gds
        LEFT JOIN deal_sheet_templates dst ON gds.template_id = dst.id
        LEFT JOIN users u ON gds.generated_by = u.id
        WHERE gds.deal_id = $1
        ORDER BY gds.version DESC
      `;
      
      const result = await query(sql, [dealId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting deal sheets:', error);
      throw error;
    }
  }

  /**
   * Build compliance summary section for PDFs
   */
  buildComplianceSection(data, formatCurrency, _formatNumber) {
    const govFees = [
      { label: 'Sales Tax', value: data.sales_tax },
      { label: 'Title Fee', value: data.title_fee },
      { label: 'License Fee', value: data.license_fee },
      { label: 'Registration Fee', value: data.registration_fee },
      { label: 'Inspection Fee', value: data.inspection_fee },
      { label: 'Processing Fee', value: data.processing_fee }
    ].filter(fee => fee.value && Number(fee.value) !== 0);

    const tradeRows = [
      { label: 'Actual Cash Value (ACV)', value: data.trade_in_acv },
      { label: 'Payoff Amount', value: data.trade_in_payoff },
      { label: 'Net Trade-In Credit', value: data.trade_in_net_credit },
      { label: 'Negative Equity Added', value: data.trade_in_negative_equity },
      { label: 'Positive Equity Applied', value: data.trade_in_equity }
    ].filter(item => item.value && Number(item.value) !== 0);

    const products = (data.protection_products_list || []).map(product => `
      <tr>
        <td style="padding:4px 8px;">${product.product_name || product.product_type}</td>
        <td style="padding:4px 8px;">${product.product_type}</td>
        <td style="padding:4px 8px;">${product.is_financed ? 'Financed' : 'Paid Upfront'}</td>
        <td style="padding:4px 8px; text-align:right;">${formatCurrency(product.price)}</td>
      </tr>
    `).join('');

    const haveGovFees = govFees.length > 0;
    const haveTrade = tradeRows.length > 0;
    const haveProducts = products.length > 0;

    if (!haveGovFees && !haveTrade && !haveProducts) {
      return '';
    }

    return `
      <section style="margin-top:32px; font-family: Arial, sans-serif; font-size: 13px;">
        <h2 style="margin-bottom:16px; font-size:16px;">Finance Compliance Summary</h2>

        ${haveGovFees ? `
          <div style="margin-bottom:16px;">
            <h3 style="margin:8px 0; font-size:14px;">Government Fees (TTL)</h3>
            <table style="width:100%; border-collapse:collapse;">
              <tbody>
                ${govFees.map(fee => `
                  <tr>
                    <td style="padding:4px 8px; border-bottom:1px solid #eee;">${fee.label}</td>
                    <td style="padding:4px 8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(fee.value)}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td style="padding:6px 8px; font-weight:bold;">Total Government Fees</td>
                  <td style="padding:6px 8px; font-weight:bold; text-align:right;">${formatCurrency(data.total_government_fees || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}

        ${haveTrade ? `
          <div style="margin-bottom:16px;">
            <h3 style="margin:8px 0; font-size:14px;">Trade-In Summary</h3>
            <table style="width:100%; border-collapse:collapse;">
              <tbody>
                ${tradeRows.map(row => `
                  <tr>
                    <td style="padding:4px 8px; border-bottom:1px solid #eee;">${row.label}</td>
                    <td style="padding:4px 8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(row.value)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="margin-bottom:16px;">
          <h3 style="margin:8px 0; font-size:14px;">Amount Financed</h3>
          <table style="width:100%; border-collapse:collapse;">
            <tbody>
              <tr>
                <td style="padding:4px 8px;">Vehicle Price</td>
                <td style="padding:4px 8px; text-align:right;">${formatCurrency(data.vehicle_price)}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;">Down Payment</td>
                <td style="padding:4px 8px; text-align:right;">${formatCurrency(data.down_payment)}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;">Government Fees</td>
                <td style="padding:4px 8px; text-align:right;">${formatCurrency(data.total_government_fees || 0)}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;">Protection Products</td>
                <td style="padding:4px 8px; text-align:right;">${formatCurrency(data.total_protection_products || 0)}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;">Amount Financed</td>
                <td style="padding:4px 8px; text-align:right; font-weight:bold;">${formatCurrency(data.amount_financed || data.vehicle_price)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${haveProducts ? `
          <div style="margin-bottom:16px;">
            <h3 style="margin:8px 0; font-size:14px;">Protection Products</h3>
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:6px 8px; background:#f9f9f9;">Product</th>
                  <th style="text-align:left; padding:6px 8px; background:#f9f9f9;">Type</th>
                  <th style="text-align:left; padding:6px 8px; background:#f9f9f9;">Payment</th>
                  <th style="text-align:right; padding:6px 8px; background:#f9f9f9;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${products}
              </tbody>
            </table>
          </div>
        ` : ''}
      </section>
    `;
  }
}

// Export singleton instance
export default new PDFGeneratorService();

