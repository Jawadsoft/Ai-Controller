/**
 * Credit Application PDF Generation Service
 * Generates formatted PDF documents from credit application data
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CreditApplicationPDFService {
  constructor() {
    // Ensure PDF output directory exists (use uploads dir for consistency)
    this.pdfDir = path.join(process.cwd(), 'uploads', 'credit-applications');
    if (!fs.existsSync(this.pdfDir)) {
      fs.mkdirSync(this.pdfDir, { recursive: true });
    }
  }

  /**
   * Generate a credit application PDF
   * @param {Object} application - Credit application data
   * @returns {Promise<string>} - Path to generated PDF
   */
  async generatePDF(application) {
    return new Promise((resolve, reject) => {
      try {
        // Generate unique filename
        const filename = `credit-app-${application.id}-${Date.now()}.pdf`;
        const filepath = path.join(this.pdfDir, filename);
        const relativePath = `/uploads/credit-applications/${filename}`;

        // Create PDF document
        const doc = new PDFDocument({ 
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Pipe to file
        const writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);

        // Generate PDF content
        this.addHeader(doc);
        this.addBorrowerInfo(doc, application);
        this.addVehicleInfo(doc, application);
        this.addLoanDetails(doc, application);
        this.addEmploymentInfo(doc, application);
        this.addAuthorization(doc, application);
        this.addFooter(doc);

        // Finalize PDF
        doc.end();

        writeStream.on('finish', () => {
          console.log(`✅ PDF generated: ${filepath}`);
          resolve(relativePath);
        });

        writeStream.on('error', (error) => {
          console.error('❌ PDF generation error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('❌ PDF generation failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Add header section
   */
  addHeader(doc) {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('Car Loan Application Form', { align: 'center' })
      .moveDown();

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Application Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
      .moveDown(2);
  }

  /**
   * Add borrower information section
   */
  addBorrowerInfo(doc, app) {
    this.addSectionTitle(doc, 'Borrower\'s Information');

    const borrowerData = [
      ['Full Name:', app.customer_name || 'N/A'],
      ['Date of Birth:', app.date_of_birth ? new Date(app.date_of_birth).toLocaleDateString() : 'N/A'],
      ['SSN:', app.ssn_encrypted ? '***-**-****' : 'N/A'],
      ['Address:', this.formatAddress(app)],
      ['Email:', app.customer_email || 'N/A'],
      ['Contact Number:', app.customer_phone || 'N/A'],
    ];

    this.addDataTable(doc, borrowerData);
    doc.moveDown();
  }

  /**
   * Add vehicle information section
   */
  addVehicleInfo(doc, app) {
    this.addSectionTitle(doc, 'Vehicle Information');

    const vehicleData = [
      ['Make:', app.vehicle_make || 'N/A'],
      ['Model:', app.vehicle_model || 'N/A'],
      ['Year:', app.vehicle_year || 'N/A'],
      ['Mileage:', app.vehicle_mileage ? `${app.vehicle_mileage} miles` : 'N/A'],
      ['Purchase Price:', app.vehicle_purchase_price ? `$${Number(app.vehicle_purchase_price).toLocaleString()}` : 'N/A'],
      ['Down Payment:', app.down_payment ? `$${Number(app.down_payment).toLocaleString()}` : 'N/A'],
    ];

    this.addDataTable(doc, vehicleData);
    doc.moveDown();
  }

  /**
   * Add loan details section
   */
  addLoanDetails(doc, app) {
    this.addSectionTitle(doc, 'Loan Details');

    const loanData = [
      ['Loan Amount Requested:', app.requested_loan_amount ? `$${Number(app.requested_loan_amount).toLocaleString()}` : 'N/A'],
      ['Loan Term:', app.requested_term_months ? `${app.requested_term_months} months` : 'N/A'],
      ['Monthly Payment Estimate:', app.estimated_monthly_payment ? `$${Number(app.estimated_monthly_payment).toLocaleString()}` : 'N/A'],
      ['Interest Rate:', app.estimated_interest_rate ? `${(Number(app.estimated_interest_rate) * 100).toFixed(2)}%` : 'N/A'],
      ['Credit Score:', app.credit_score || 'N/A'],
    ];

    this.addDataTable(doc, loanData);
    doc.moveDown();
  }

  /**
   * Add employment information section
   */
  addEmploymentInfo(doc, app) {
    this.addSectionTitle(doc, 'Employment Information');

    const employmentData = [
      ['Employer Name:', app.employer_name || 'N/A'],
      ['Job Title:', app.job_title || 'N/A'],
      ['Work Address:', this.formatWorkAddress(app)],
      ['Monthly Income:', app.monthly_income ? `$${Number(app.monthly_income).toLocaleString()}` : 'N/A'],
      ['Years Employed:', app.years_employed || 'N/A'],
      ['Employment Status:', app.employment_status || 'N/A'],
    ];

    this.addDataTable(doc, employmentData);
    doc.moveDown();
  }

  /**
   * Add authorization section
   */
  addAuthorization(doc, app) {
    this.addSectionTitle(doc, 'Authorization & Declaration');

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(
        'I certify that the provided information is correct and authorize the lender to perform credit checks and background verification.',
        { align: 'justify' }
      )
      .moveDown();

    // Add signature if available
    if (app.signature_data) {
      doc.fontSize(9).text('Applicant\'s Signature:');
      
      try {
        // If signature is base64, decode and add to PDF
        const signatureBuffer = Buffer.from(app.signature_data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        doc.image(signatureBuffer, doc.x, doc.y, { width: 200, height: 50 });
        doc.moveDown(4);
      } catch (error) {
        console.error('Error adding signature to PDF:', error);
        doc.text('[Signature Error]').moveDown();
      }
    } else {
      doc.text('Applicant\'s Signature: _______________________________').moveDown();
    }

    doc.text(`Date: ${app.signature_date ? new Date(app.signature_date).toLocaleDateString() : new Date().toLocaleDateString()}`);
    doc.moveDown();

    if (app.terms_accepted) {
      doc.fontSize(8).fillColor('green').text('✓ Terms and Conditions Accepted', { continued: false });
      if (app.terms_accepted_at) {
        doc.fillColor('black').text(`   Accepted at: ${new Date(app.terms_accepted_at).toLocaleString()}`);
      }
    }
  }

  /**
   * Add footer
   */
  addFooter(doc) {
    const bottomY = doc.page.height - 50;
    
    doc
      .fontSize(8)
      .fillColor('gray')
      .text(
        'Copyright © SampleForms.com | This document is confidential and intended for authorized personnel only.',
        50,
        bottomY,
        { align: 'center', width: doc.page.width - 100 }
      );
  }

  /**
   * Helper: Add section title
   */
  addSectionTitle(doc, title) {
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('black')
      .text(title)
      .moveDown(0.5);
  }

  /**
   * Helper: Add data table
   */
  addDataTable(doc, data) {
    doc.fontSize(10).font('Helvetica');

    data.forEach(([label, value]) => {
      const y = doc.y;
      doc
        .font('Helvetica-Bold')
        .text(label, 50, y, { width: 150, continued: false })
        .font('Helvetica')
        .text(value, 210, y, { width: 300 });
      doc.moveDown(0.3);
    });
  }

  /**
   * Helper: Format address
   */
  formatAddress(app) {
    const parts = [
      app.street_address,
      app.city,
      app.state ? app.state.toUpperCase() : null,
      app.zip_code
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  /**
   * Helper: Format work address
   */
  formatWorkAddress(app) {
    const parts = [
      app.work_address,
      app.work_city,
      app.work_state ? app.work_state.toUpperCase() : null,
      app.work_zip_code
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  /**
   * Delete PDF file
   */
  async deletePDF(pdfPath) {
    try {
      // Remove leading slash if present
      const cleanPath = pdfPath.startsWith('/') ? pdfPath.substring(1) : pdfPath;
      const fullPath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`✅ PDF deleted: ${fullPath}`);
      }
    } catch (error) {
      console.error('❌ PDF deletion error:', error);
    }
  }
}

export default new CreditApplicationPDFService();
