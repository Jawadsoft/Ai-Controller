/**
 * Customer Finance API Routes
 * Handles customer-facing credit application submissions
 * Requires customer authentication (not dealer authentication)
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import creditApplicationPDFService from '../lib/creditApplicationPDFService.js';
import financeNotificationService from '../lib/financeNotificationService.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';
import { validateCreditApplicationToken, markTokenAsUsed } from '../lib/creditApplicationTokens.js';
import crypto from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * GET /api/customer/credit-application-link-info?token=
 * Public: resolve DAIVE / email credit-application link (credit_application_tokens) for form prefill.
 */
router.get('/credit-application-link-info', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const data = await validateCreditApplicationToken(token.trim());
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Invalid, expired, or already used application link.',
      });
    }

    let vehicle = null;
    if (data.vehicle_id) {
      const vehicleResult = await query(
        `SELECT id, make, model, year, mileage, price, vin, stock_number
         FROM vehicles WHERE id = $1`,
        [data.vehicle_id]
      );
      if (vehicleResult.rows.length > 0) {
        vehicle = vehicleResult.rows[0];
      }
    }

    return res.json({
      success: true,
      data: {
        dealer_id: data.dealer_id,
        conversation_id: data.conversation_id,
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        vehicle_id: data.vehicle_id,
        vehicle,
        prefill_data: data.prefill_data || {},
      },
    });
  } catch (error) {
    console.error('credit-application-link-info error:', error);
    return res.status(500).json({ success: false, error: 'Failed to resolve link' });
  }
});

// Helper function to save PDF file
function savePDFFile(pdfBuffer, filename) {
  const uploadDir = join(__dirname, '../../uploads/credit-applications');
  
  // Create directory if it doesn't exist
  try {
    mkdirSync(uploadDir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
  
  const filePath = join(uploadDir, filename);
  writeFileSync(filePath, pdfBuffer);
  
  // Return relative URL path
  return `/uploads/credit-applications/${filename}`;
}

/**
 * GET /api/customer/application/:id
 * Get application data by ID with token verification (for pre-filling form)
 * No authentication required - uses link token
 */
router.get('/application/:id', async (req, res) => {
  console.log('🔍 GET /api/customer/application/:id - Request received');
  console.log('  - Application ID:', req.params.id);
  console.log('  - Token provided:', req.query.token ? 'YES' : 'NO');
  
  try {
    const { id } = req.params;
    const token = req.query.token;
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).json({
        success: false,
        error: 'Token required'
      });
    }
    
    // Verify and decode token
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      console.log('✅ Token decoded successfully');
      console.log('  - Token ID:', decoded.id);
      console.log('  - Token Email:', decoded.email);
      console.log('  - Token Expiry:', new Date(decoded.exp));
      
      // Check if token is expired
      if (decoded.exp && decoded.exp < Date.now()) {
        console.log('❌ Token expired');
        return res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      }
      
      // Check if token ID matches application ID
      if (decoded.id !== id) {
        console.log('❌ Token ID mismatch');
        console.log('  - Expected:', id);
        console.log('  - Got:', decoded.id);
        return res.status(403).json({
          success: false,
          error: 'Invalid token for this application'
        });
      }
      
      console.log('✅ Token validation passed');
    } catch (tokenError) {
      console.log('❌ Token decode error:', tokenError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    // Fetch application data
    const result = await query(
      `SELECT 
        id, dealer_id, customer_name, customer_email, customer_phone,
        vehicle_id, credit_score, deal_type, down_payment, requested_term_months,
        estimated_monthly_payment, estimated_interest_rate, application_status, created_at
      FROM credit_applications
      WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Application not found in database');
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    const application = result.rows[0];
    console.log('✅ Application found:', application.id);
    console.log('  - Customer:', application.customer_name, application.customer_email);
    console.log('  - Credit Score:', application.credit_score);
    console.log('  - Down Payment:', application.down_payment);
    console.log('  - Vehicle ID:', application.vehicle_id);
    
    // Fetch vehicle data if vehicle_id exists
    let vehicleData = null;
    if (application.vehicle_id) {
      console.log('🚗 Fetching vehicle data...');
      const vehicleResult = await query(
        `SELECT id, make, model, year, mileage, price, vin, stock_number
        FROM vehicles
        WHERE id = $1`,
        [application.vehicle_id]
      );
      
      if (vehicleResult.rows.length > 0) {
        vehicleData = vehicleResult.rows[0];
        console.log('✅ Vehicle found:', vehicleData.year, vehicleData.make, vehicleData.model);
      } else {
        console.log('⚠️ Vehicle not found for ID:', application.vehicle_id);
      }
    }
    
    const responseData = {
      success: true,
      data: {
        ...application,
        vehicle: vehicleData
      }
    };
    
    console.log('📤 Sending response with application data');
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error fetching application:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application',
      message: error.message
    });
  }
});

/**
 * POST /api/customer/credit-application
 * Submit a new credit application (customer-facing)
 * Requires customer authentication
 */
router.post('/credit-application', authenticateCustomer, [
  // Required fields
  body('customer_name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('customer_email').isEmail().normalizeEmail(),
  body('customer_phone').notEmpty().trim(),
  body('date_of_birth').optional().isISO8601(),
  
  // Address
  body('street_address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional({ checkFalsy: true }).isLength({ min: 2, max: 2 }),
  body('zip_code').optional().trim(),
  
  // Vehicle info
  body('vehicle_id').optional().isUUID(),
  body('vehicle_make').optional().trim(),
  body('vehicle_model').optional().trim(),
  body('vehicle_year').optional().isInt({ min: 1900, max: 2030 }),
  body('vehicle_mileage').optional().isInt({ min: 0 }),
  body('vehicle_purchase_price').optional().isFloat({ min: 0 }),
  
  // Loan details
  body('requested_loan_amount').optional().isFloat({ min: 0 }),
  body('requested_term_months').optional().isInt({ min: 1, max: 84 }),
  body('down_payment').optional().isFloat({ min: 0 }),
  
  // Employment
  body('employer_name').optional().trim(),
  body('job_title').optional().trim(),
  body('work_address').optional().trim(),
  body('work_city').optional().trim(),
  body('work_state').optional().isLength({ max: 2 }),
  body('work_zip_code').optional().trim(),
  body('employment_status').optional().trim(),
  body('monthly_income').optional().isFloat({ min: 0 }),
  body('annual_income').optional().isFloat({ min: 0 }),
  body('years_employed').optional().isFloat({ min: 0 }),
  
  // Credit info
  body('ssn').optional().matches(/^\d{3}-\d{2}-\d{4}$/),
  body('dl_number').optional().trim(),
  body('credit_score').optional().isInt({ min: 300, max: 850 }),
  
  // Signature & authorization
  body('signature_data').optional(),  // Base64 image
  body('terms_accepted').isBoolean(),
  body('dealer_id').isUUID(),
  body('credit_application_link_token').optional().isString().trim(),
], async (req, res) => {
  console.log('\n🟢 ===== CUSTOMER CREDIT APPLICATION START =====');
  console.log('📍 Endpoint: POST /api/customer/credit-application');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation failed:', errors.array());
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const customerId = req.customer?.id ?? req.customerSession?.customer_id ?? null;
    const customerEmail = req.customer?.email;
    console.log('👤 Customer:', { customerId, customerEmail });

    if (!req.body.terms_accepted) {
      return res.status(400).json({
        success: false,
        error: 'You must accept the terms and conditions'
      });
    }

    const dealerId = req.body.dealer_id;
    console.log('🏢 Dealer ID:', dealerId);

    // Get dealer information for PDF
    const dealerResult = await query(
      'SELECT id, business_name, address, phone, email FROM dealers WHERE id = $1',
      [dealerId]
    );

    if (dealerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    const dealer = dealerResult.rows[0];

    // Encrypt sensitive data if provided
    let ssnEncrypted = null;
    let dlEncrypted = null;

    if (req.body.ssn) {
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
      ssnEncrypted = cipher.update(req.body.ssn, 'utf8', 'hex') + cipher.final('hex');
    }

    if (req.body.dl_number) {
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
      dlEncrypted = cipher.update(req.body.dl_number, 'utf8', 'hex') + cipher.final('hex');
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log('💾 Creating credit application...');
    
    // Insert credit application
    const result = await query(
      `INSERT INTO credit_applications (
        dealer_id,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        date_of_birth,
        street_address,
        city,
        state,
        zip_code,
        vehicle_id,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        vehicle_mileage,
        vehicle_purchase_price,
        requested_loan_amount,
        requested_term_months,
        down_payment,
        employer_name,
        job_title,
        work_address,
        work_city,
        work_state,
        work_zip_code,
        employment_status,
        monthly_income,
        annual_income,
        years_employed,
        ssn_encrypted,
        dl_number_encrypted,
        credit_score,
        signature_data,
        signature_date,
        terms_accepted,
        terms_accepted_at,
        ip_address,
        user_agent,
        application_source,
        application_status,
        submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, NOW()
      ) RETURNING *`,
      [
        dealerId,
        customerId,
        req.body.customer_name,
        req.body.customer_email,
        req.body.customer_phone,
        req.body.date_of_birth || null,
        req.body.street_address || null,
        req.body.city || null,
        req.body.state || null,
        req.body.zip_code || null,
        req.body.vehicle_id || null,
        req.body.vehicle_make || null,
        req.body.vehicle_model || null,
        req.body.vehicle_year || null,
        req.body.vehicle_mileage || null,
        req.body.vehicle_purchase_price || null,
        req.body.requested_loan_amount || null,
        req.body.requested_term_months || null,
        req.body.down_payment || null,
        req.body.employer_name || null,
        req.body.job_title || null,
        req.body.work_address || null,
        req.body.work_city || null,
        req.body.work_state || null,
        req.body.work_zip_code || null,
        req.body.employment_status || null,
        req.body.monthly_income || null,
        req.body.annual_income || null,
        req.body.years_employed || null,
        ssnEncrypted,
        dlEncrypted,
        req.body.credit_score || null,
        req.body.signature_data || null,
        req.body.signature_data ? new Date() : null,
        req.body.terms_accepted,
        new Date(),
        ipAddress,
        userAgent,
        'customer_portal',
        'pending'
      ]
    );

    const application = result.rows[0];
    console.log('✅ Application created:', application.id);

    // Generate PDF
    console.log('📄 Generating PDF...');
    try {
      const pdfUrl = await creditApplicationPDFService.generatePDF(application);
      
      // Update application with PDF URL
      await query(
        'UPDATE credit_applications SET pdf_url = $1, pdf_generated_at = NOW() WHERE id = $2',
        [pdfUrl, application.id]
      );
      
      application.pdf_url = pdfUrl;
      console.log('✅ PDF generated:', pdfUrl);
    } catch (pdfError) {
      console.error('⚠️ PDF generation failed (non-critical):', pdfError);
    }

    // Send notifications
    console.log('📧 Sending notifications...');
    try {
      // Notify customer
      // Send notifications with PDF attachment
      await financeNotificationService.notifyCustomerCreditApplicationSubmitted(
        application, 
        dealerId, 
        pdfUrl
      );
      console.log('✅ Notifications sent');
    } catch (notifError) {
      console.error('⚠️ Notification failed (non-critical):', notifError);
    }

    console.log('✅ ===== CUSTOMER CREDIT APPLICATION COMPLETE =====\n');

    if (req.body.credit_application_link_token) {
      try {
        await markTokenAsUsed(String(req.body.credit_application_link_token).trim());
      } catch (markErr) {
        console.warn('⚠️ Could not mark credit application link token used:', markErr.message);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: application.id,
        application_status: application.application_status,
        submitted_at: application.submitted_at,
        pdf_url: application.pdf_url
      },
      message: 'Credit application submitted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error creating customer credit application:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit credit application',
      message: error.message 
    });
  }
});

/**
 * GET /api/customer/credit-applications
 * Get all credit applications for the logged-in customer
 */
router.get('/credit-applications', authenticateCustomer, async (req, res) => {
  try {
    const customerId = req.customer?.id;
    
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Customer authentication required'
      });
    }

    const result = await query(
      `SELECT 
        id,
        dealer_id,
        customer_name,
        customer_email,
        customer_phone,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        requested_loan_amount,
        requested_term_months,
        application_status,
        submitted_at,
        pdf_url,
        created_at
      FROM credit_applications
      WHERE customer_id = $1
      ORDER BY created_at DESC`,
      [customerId]
    );

    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching customer credit applications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch credit applications',
      message: error.message 
    });
  }
});

/**
 * GET /api/customer/credit-application/:id
 * Get single credit application details
 */
router.get('/credit-application/:id', authenticateCustomer, async (req, res) => {
  try {
    const customerId = req.customer?.id;
    const { id } = req.params;
    
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Customer authentication required'
      });
    }

    const result = await query(
      `SELECT * FROM credit_applications
      WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Credit application not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching credit application:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch credit application',
      message: error.message 
    });
  }
});

/**
 * PUT /api/customer/application/:id
 * Update an existing credit application (for AI-generated pre-created apps)
 * Uses JWT token for authentication, no link_token required
 */
router.put('/application/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    console.log('\n🟢 ===== UPDATE CREDIT APPLICATION START =====');
    console.log('📍 Endpoint: PUT /api/customer/application/:id');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🆔 Application ID:', id);
    console.log('🔗 Token provided:', token ? 'Yes' : 'No');

    // Verify JWT token
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }

    // Decode and validate token
    try {
      // ✅ FIX: Token is base64url encoded, not a standard JWT
      // Replace base64url characters back to base64
      const base64Token = token.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(Buffer.from(base64Token, 'base64').toString());
      
      console.log('🔍 Decoded token:', { id: decoded.id, email: decoded.email, exp: decoded.exp });
      
      if (decoded.exp && decoded.exp < Date.now()) {
        console.log('❌ Token expired at:', new Date(decoded.exp).toISOString());
        return res.status(401).json({
          success: false,
          error: 'Token has expired'
        });
      }

      if (decoded.id !== id) {
        console.log('❌ Token ID mismatch:', { tokenId: decoded.id, requestedId: id });
        return res.status(401).json({
          success: false,
          error: 'Invalid token for this application'
        });
      }
      
      console.log('✅ Token validated successfully');
    } catch (tokenError) {
      console.log('❌ Invalid token format:', tokenError.message);
      console.log('❌ Token value:', token);
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Check if application exists
    const existingApp = await query(
      'SELECT id, dealer_id, customer_email FROM credit_applications WHERE id = $1',
      [id]
    );

    if (existingApp.rows.length === 0) {
      console.log('❌ Application not found');
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const dealerId = existingApp.rows[0].dealer_id;
    console.log('✅ Application found, updating...');

    // Import financeService for encryption
    const { default: financeService } = await import('../lib/financeService.js');

    // Build dynamic UPDATE query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // Map request body fields to database columns
    const fieldMapping = {
      // Personal Info
      customer_name: 'customer_name',
      first_name: 'first_name',
      last_name: 'last_name',
      customer_email: 'customer_email',
      customer_phone: 'customer_phone',
      date_of_birth: 'date_of_birth',
      
      // Address
      street_address: 'street_address',
      city: 'city',
      state: 'state',
      zip_code: 'zip_code',
      
      // Vehicle
      vehicle_id: 'vehicle_id',
      vehicle_make: 'vehicle_make',
      vehicle_model: 'vehicle_model',
      vehicle_year: 'vehicle_year',
      vehicle_mileage: 'vehicle_mileage',
      vehicle_purchase_price: 'vehicle_purchase_price',
      vehicle_msrp: 'vehicle_msrp',
      
      // Finance
      deal_type: 'deal_type',
      requested_loan_amount: 'requested_loan_amount',
      requested_term_months: 'requested_term_months',
      down_payment: 'down_payment',
      trade_in_value: 'trade_in_value',
      rebate_amount: 'rebate_amount',
      acquisition_fee: 'acquisition_fee',
      doc_fee: 'doc_fee',
      residual_percentage: 'residual_percentage',
      money_factor: 'money_factor',
      sales_tax_rate: 'sales_tax_rate',
      annual_mileage: 'annual_mileage',
      excess_mileage_rate: 'excess_mileage_rate',
      
      // Employment
      employer_name: 'employer_name',
      job_title: 'job_title',
      work_address: 'work_address',
      work_city: 'work_city',
      work_state: 'work_state',
      work_zip_code: 'work_zip_code',
      monthly_income: 'monthly_income',
      annual_income: 'annual_income',
      employment_status: 'employment_status',
      years_employed: 'years_employed',
      
      // Credit
      credit_score: 'credit_score',
      ssn: 'ssn_encrypted',
      dl_number: 'dl_number_encrypted',
    };

    // Add fields to update
    for (const [bodyField, dbField] of Object.entries(fieldMapping)) {
      if (req.body[bodyField] !== undefined && req.body[bodyField] !== null && req.body[bodyField] !== '') {
        // Encrypt sensitive fields
        if (bodyField === 'ssn' && req.body[bodyField]) {
          updateFields.push(`${dbField} = $${paramIndex}`);
          updateValues.push(financeService.encrypt(req.body[bodyField]));
          paramIndex++;
        } else if (bodyField === 'dl_number' && req.body[bodyField]) {
          updateFields.push(`${dbField} = $${paramIndex}`);
          updateValues.push(financeService.encrypt(req.body[bodyField]));
          paramIndex++;
        } else {
          updateFields.push(`${dbField} = $${paramIndex}`);
          updateValues.push(req.body[bodyField]);
          paramIndex++;
        }
      }
    }

    // Always update status and timestamp
    // ✅ FIX: Use 'reviewing' instead of 'submitted' (CHECK constraint only allows: pending, approved, rejected, reviewing)
    updateFields.push(`application_status = $${paramIndex}`);
    updateValues.push('reviewing');  // Changed from 'submitted' to 'reviewing'
    paramIndex++;
    
    updateFields.push(`submitted_at = NOW()`);

    if (updateFields.length === 2) { // Only status and timestamp
      console.log('❌ No fields to update');
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
    }

    // Add application ID as last parameter
    updateValues.push(id);

    const updateQuery = `
      UPDATE credit_applications
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    console.log('📝 Updating application with', updateFields.length, 'fields');
    const result = await query(updateQuery, updateValues);
    const application = result.rows[0];
    
    console.log('✅ Application updated:', application.id);

    // Generate PDF
    console.log('📄 Generating PDF...');
    try {
      const pdfUrl = await creditApplicationPDFService.generatePDF(application);
      
      await query(
        'UPDATE credit_applications SET pdf_url = $1, pdf_generated_at = NOW() WHERE id = $2',
        [pdfUrl, application.id]
      );
      
      application.pdf_url = pdfUrl;
      console.log('✅ PDF generated:', pdfUrl);
    } catch (pdfError) {
      console.error('⚠️ PDF generation failed (non-critical):', pdfError);
    }

    // Send notifications
    console.log('📧 Sending notifications...');
    try {
      await financeNotificationService.notifyCustomerCreditApplicationSubmitted(
        application,
        dealerId,
        application.pdf_url
      );
      console.log('✅ Notifications sent');
    } catch (notifError) {
      console.error('⚠️ Notification failed (non-critical):', notifError);
    }

    console.log('✅ ===== UPDATE CREDIT APPLICATION COMPLETE =====\n');

    res.status(200).json({
      success: true,
      data: {
        id: application.id,
        application_status: application.application_status,
        submitted_at: application.submitted_at,
        pdf_url: application.pdf_url
      },
      message: 'Credit application updated and submitted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating credit application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update credit application',
      message: error.message
    });
  }
});

/**
 * POST /api/customer/credit-application/guest
 * Submit credit application via shareable link (no authentication required)
 * Uses link token for verification instead of customer authentication
 */
router.post('/credit-application/guest', [
  // Required fields
  body('customer_name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('customer_email').isEmail().normalizeEmail(),
  body('customer_phone').notEmpty().trim(),
  body('link_token').notEmpty().trim(), // Link token is required for guest mode
  body('terms_accepted').isBoolean(),
  
  // Optional fields (same as authenticated endpoint)
  body('date_of_birth').optional().isISO8601(),
  body('street_address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional({ checkFalsy: true }).isLength({ min: 2, max: 2 }),
  body('zip_code').optional().trim(),
  body('vehicle_id').optional().isUUID(),
  body('vehicle_make').optional().trim(),
  body('vehicle_model').optional().trim(),
  body('vehicle_year').optional().isInt({ min: 1900, max: 2030 }),
  body('vehicle_mileage').optional().isInt({ min: 0 }),
  body('vehicle_purchase_price').optional().isFloat({ min: 0 }),
  body('requested_loan_amount').optional().isFloat({ min: 0 }),
  body('requested_term_months').optional().isInt({ min: 1, max: 84 }),
  body('down_payment').optional().isFloat({ min: 0 }),
  body('employer_name').optional().trim(),
  body('job_title').optional().trim(),
  body('work_address').optional().trim(),
  body('work_city').optional().trim(),
  body('work_state').optional().isLength({ max: 2 }),
  body('work_zip_code').optional().trim(),
  body('employment_status').optional().trim(),
  body('monthly_income').optional().isFloat({ min: 0 }),
  body('annual_income').optional().isFloat({ min: 0 }),
  body('years_employed').optional().isFloat({ min: 0 }),
  body('ssn').optional().matches(/^\d{3}-\d{2}-\d{4}$/),
  body('dl_number').optional().trim(),
  body('credit_score').optional().isInt({ min: 300, max: 850 }),
  body('signature_data').optional(),
], async (req, res) => {
  console.log('\n🟢 ===== GUEST CREDIT APPLICATION START =====');
  console.log('📍 Endpoint: POST /api/customer/credit-application/guest');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation failed:', errors.array());
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    if (!req.body.terms_accepted) {
      return res.status(400).json({
        success: false,
        error: 'You must accept the terms and conditions'
      });
    }

    const { link_token } = req.body;
    console.log('🔗 Link token provided:', link_token ? 'Yes' : 'No');

    // Verify link token
    const linkResult = await query(`
      SELECT 
        al.id as link_id,
        al.dealer_id,
        al.customer_id,
        al.vehicle_id,
        al.expires_at,
        al.used_at,
        c.email as customer_email,
        c.first_name,
        c.last_name
      FROM application_links al
      LEFT JOIN customers c ON al.customer_id = c.id
      WHERE al.token = $1
    `, [link_token]);

    if (linkResult.rows.length === 0) {
      console.log('❌ Invalid link token');
      return res.status(400).json({
        success: false,
        error: 'Invalid application link. Please request a new link from the dealer.'
      });
    }

    const link = linkResult.rows[0];
    console.log('✅ Link found:', {
      linkId: link.link_id,
      dealerId: link.dealer_id,
      customerId: link.customer_id,
      expiresAt: link.expires_at,
      usedAt: link.used_at
    });

    // Check if expired
    if (new Date(link.expires_at) < new Date()) {
      console.log('❌ Link has expired');
      return res.status(400).json({
        success: false,
        error: 'This application link has expired. Please request a new link from the dealer.'
      });
    }

    // Check if already used
    if (link.used_at) {
      console.log('❌ Link already used');
      return res.status(400).json({
        success: false,
        error: 'This application link has already been used. Please request a new link if needed.'
      });
    }

    const dealerId = link.dealer_id;
    const customerId = link.customer_id;
    console.log('🏢 Dealer ID:', dealerId);
    console.log('👤 Customer ID:', customerId || 'Not linked');

    // Get dealer information
    const dealerResult = await query(
      'SELECT id, business_name, address, phone, email FROM dealers WHERE id = $1',
      [dealerId]
    );

    if (dealerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    const dealer = dealerResult.rows[0];

    // Encrypt sensitive data if provided
    let ssnEncrypted = null;
    let dlEncrypted = null;

    if (req.body.ssn) {
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), Buffer.alloc(16, 0));
      ssnEncrypted = cipher.update(req.body.ssn, 'utf8', 'hex') + cipher.final('hex');
    }

    if (req.body.dl_number) {
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), Buffer.alloc(16, 0));
      dlEncrypted = cipher.update(req.body.dl_number, 'utf8', 'hex') + cipher.final('hex');
    }

    // Create application
    console.log('📝 Creating application...');
    const applicationId = uuidv4();
    
    const insertResult = await query(
      `INSERT INTO credit_applications (
        id, dealer_id, customer_id, customer_name, customer_email, customer_phone,
        date_of_birth, street_address, city, state, zip_code,
        vehicle_id, vehicle_make, vehicle_model, vehicle_year, vehicle_mileage, vehicle_purchase_price,
        requested_loan_amount, requested_term_months, down_payment,
        employer_name, job_title, work_address, work_city, work_state, work_zip_code,
        monthly_income, annual_income, employment_status, years_employed,
        ssn, dl_number, credit_score,
        signature_data, signature_date, terms_accepted, terms_accepted_at,
        ip_address, user_agent, application_source, application_status, submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33,
        $34, $35, $36, $37,
        $38, $39, $40, $41, NOW()
      ) RETURNING *`,
      [
        applicationId,
        dealerId,
        customerId,
        req.body.customer_name,
        req.body.customer_email,
        req.body.customer_phone,
        req.body.date_of_birth || null,
        req.body.street_address || null,
        req.body.city || null,
        req.body.state || null,
        req.body.zip_code || null,
        link.vehicle_id || req.body.vehicle_id || null,
        req.body.vehicle_make || null,
        req.body.vehicle_model || null,
        req.body.vehicle_year || null,
        req.body.vehicle_mileage || null,
        req.body.vehicle_purchase_price || null,
        req.body.requested_loan_amount || null,
        req.body.requested_term_months || null,
        req.body.down_payment || null,
        req.body.employer_name || null,
        req.body.job_title || null,
        req.body.work_address || null,
        req.body.work_city || null,
        req.body.work_state || null,
        req.body.work_zip_code || null,
        req.body.monthly_income || null,
        req.body.annual_income || null,
        req.body.employment_status || null,
        req.body.years_employed || null,
        ssnEncrypted,
        dlEncrypted,
        req.body.credit_score || null,
        req.body.signature_data || null,
        req.body.signature_data ? new Date() : null,
        req.body.terms_accepted,
        new Date(),
        req.ip,
        req.get('user-agent'),
        'guest_link',
        'pending'
      ]
    );

    const application = insertResult.rows[0];
    console.log('✅ Application created:', application.id);

    // Generate PDF
    console.log('📄 Generating PDF...');
    const pdfBuffer = await creditApplicationPDFService.generatePDF(application, dealer);
    const filename = `credit-app-${application.id}-${Date.now()}.pdf`;
    const pdfUrl = savePDFFile(pdfBuffer, filename);
    
    // Update application with PDF URL
    await query(
      'UPDATE credit_applications SET pdf_url = $1, pdf_generated_at = NOW() WHERE id = $2',
      [pdfUrl, application.id]
    );
    console.log('✅ PDF generated:', pdfUrl);

    // Mark link as used
    await query(
      'UPDATE application_links SET used_at = NOW() WHERE id = $1',
      [link.link_id]
    );
    console.log('✅ Link marked as used');

    // Send notifications
    try {
      console.log('📧 Sending notifications...');
      await financeNotificationService.notifyCustomerCreditApplicationSubmitted(
        { ...application, pdf_url: pdfUrl },
        dealerId,
        pdfUrl
      );
      console.log('✅ Notifications sent');
    } catch (notifError) {
      console.error('⚠️ Notification failed (non-critical):', notifError);
    }

    console.log('✅ ===== GUEST CREDIT APPLICATION COMPLETE =====\n');

    res.json({
      success: true,
      data: {
        id: application.id,
        application_status: application.application_status,
        submitted_at: application.submitted_at,
        pdf_url: pdfUrl
      },
      message: 'Credit application submitted successfully'
    });

  } catch (error) {
    console.error('❌ Error creating guest application:', error);
    console.log('❌ ===== GUEST CREDIT APPLICATION FAILED =====\n');
    res.status(500).json({
      success: false,
      error: 'Failed to submit application',
      message: error.message
    });
  }
});

export default router;

