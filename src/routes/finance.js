/**
 * Finance API Routes
 * Handles all finance and lease-related endpoints
 * Includes credit applications, finance terms, and deal generation
 */

import express from 'express';
import { body, validationResult, query as queryValidator } from 'express-validator';
import { query } from '../database/connection.js';
import financeService from '../lib/financeService.js';
import financeNotificationService from '../lib/financeNotificationService.js';
import protectionProductsService from '../lib/protectionProductsService.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Note: Authentication and tenant context are handled at server.js level
// All routes below are already protected by authenticateToken and attachTenantContext

// Require finance_management permission for all routes
router.use(requirePermission('finance_management'));

// =====================================================
// CREDIT APPLICATIONS ENDPOINTS
// =====================================================

/**
 * POST /api/finance/credit-application
 * Create a new credit application
 */
router.post('/credit-application', [
  body('customer_name')
    .notEmpty().withMessage('Customer name is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Customer name must be between 2 and 100 characters'),
  body('customer_email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('customer_phone')
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true; // Allow empty
      // Remove all non-digit characters
      const cleaned = value.replace(/\D/g, '');
      // Must be 10 digits (or 11 with country code starting with 1)
      if (cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1')) {
        return true;
      }
      throw new Error('Phone number must be 10 digits (US format)');
    }),
  body('ssn').optional().matches(/^\d{3}-\d{2}-\d{4}$/).withMessage('SSN must be in format XXX-XX-XXXX'),
  body('dl_number').optional().trim().isLength({ max: 50 }).withMessage('Driver license number is too long'),
  body('conversation_id').optional().isUUID().withMessage('Invalid conversation ID'),
  body('credit_score').optional().isInt({ min: 300, max: 850 }).withMessage('Credit score must be between 300 and 850'),
  body('preferred_lender_id').optional().isUUID().withMessage('Invalid lender ID'),
  // Lease-specific validations
  body('deal_type').optional().isIn(['finance', 'lease']).withMessage('Deal type must be finance or lease'),
  body('vehicle_msrp').optional().isFloat({ min: 0 }).withMessage('Vehicle MSRP must be a positive number'),
  body('down_payment').optional().isFloat({ min: 0 }).withMessage('Down payment must be a positive number'),
  body('trade_in_value').optional().isFloat({ min: 0 }).withMessage('Trade-in value must be a positive number'),
  body('rebate_amount').optional().isFloat({ min: 0 }).withMessage('Rebate amount must be a positive number'),
  body('residual_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Residual percentage must be between 0 and 100'),
  body('money_factor').optional().isFloat({ min: 0 }).withMessage('Money factor must be a positive number'),
  body('sales_tax_rate').optional().isFloat({ min: 0, max: 1 }).withMessage('Sales tax rate must be between 0 and 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const { 
      customer_name, 
      customer_email, 
      customer_phone, 
      ssn, 
      dl_number, 
      conversation_id,
      credit_score,
      preferred_lender_id,
      // Lease-specific fields
      deal_type,
      vehicle_msrp,
      vehicle_purchase_price,
      down_payment,
      trade_in_value,
      rebate_amount,
      acquisition_fee,
      doc_fee,
      residual_percentage,
      money_factor,
      sales_tax_rate,
      annual_mileage,
      excess_mileage_rate,
      requested_term_months
    } = req.body;

    // Encrypt sensitive data if provided
    const ssnEncrypted = ssn ? financeService.encrypt(ssn) : null;
    const dlEncrypted = dl_number ? financeService.encrypt(dl_number) : null;

    // Build dynamic insert query based on provided fields
    const fields = [
      'dealer_id', 'conversation_id', 'customer_name', 'customer_email', 'customer_phone',
      'ssn_encrypted', 'dl_number_encrypted', 'credit_score', 'preferred_lender_id', 'application_status'
    ];
    const values = [
      dealerId,
      conversation_id || null,
      customer_name,
      customer_email,
      customer_phone || null,
      ssnEncrypted,
      dlEncrypted,
      credit_score || null,
      preferred_lender_id || null,
      'pending'
    ];
    let paramIndex = 11;

    // Add lease-specific fields if provided
    if (deal_type) {
      fields.push('deal_type');
      values.push(deal_type);
      paramIndex++;
    }
    if (vehicle_msrp !== undefined) {
      fields.push('vehicle_msrp');
      values.push(vehicle_msrp);
      paramIndex++;
    }
    if (vehicle_purchase_price !== undefined) {
      fields.push('vehicle_purchase_price');
      values.push(vehicle_purchase_price);
      paramIndex++;
    }
    if (down_payment !== undefined) {
      fields.push('down_payment');
      values.push(down_payment);
      paramIndex++;
    }
    if (trade_in_value !== undefined) {
      fields.push('trade_in_value');
      values.push(trade_in_value);
      paramIndex++;
    }
    if (rebate_amount !== undefined) {
      fields.push('rebate_amount');
      values.push(rebate_amount);
      paramIndex++;
    }
    if (acquisition_fee !== undefined) {
      fields.push('acquisition_fee');
      values.push(acquisition_fee);
      paramIndex++;
    }
    if (doc_fee !== undefined) {
      fields.push('doc_fee');
      values.push(doc_fee);
      paramIndex++;
    }
    if (residual_percentage !== undefined) {
      fields.push('residual_percentage');
      values.push(residual_percentage);
      paramIndex++;
    }
    if (money_factor !== undefined) {
      fields.push('money_factor');
      values.push(money_factor);
      paramIndex++;
    }
    if (sales_tax_rate !== undefined) {
      fields.push('sales_tax_rate');
      values.push(sales_tax_rate);
      paramIndex++;
    }
    if (annual_mileage !== undefined) {
      fields.push('annual_mileage');
      values.push(annual_mileage);
      paramIndex++;
    }
    if (excess_mileage_rate !== undefined) {
      fields.push('excess_mileage_rate');
      values.push(excess_mileage_rate);
      paramIndex++;
    }
    if (requested_term_months !== undefined) {
      fields.push('requested_term_months');
      values.push(requested_term_months);
      paramIndex++;
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `
      INSERT INTO credit_applications (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING 
        id, dealer_id, conversation_id, customer_name, customer_email, 
        customer_phone, application_status, credit_score, preferred_lender_id,
        deal_type, vehicle_msrp, down_payment, residual_percentage, money_factor,
        estimated_monthly_payment, residual_value, total_lease_cost, created_at
    `;

    const result = await query(insertQuery, values);
    const application = result.rows[0];

    // Send notification to customer and dealer
    try {
      await financeNotificationService.notifyCreditApplicationReceived(application, dealerId);
      console.log('✅ Credit application notification sent');
    } catch (notifError) {
      console.error('⚠️ Error sending credit application notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('Error creating credit application:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create credit application',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/credit-applications
 * List all credit applications for the dealer
 */
router.get('/credit-applications', [
  queryValidator('status').optional().isIn(['pending', 'approved', 'rejected', 'reviewing']),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let whereConditions = ['ca.dealer_id = $1'];
    let params = [dealerId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`ca.application_status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM credit_applications ca WHERE ${whereConditions.join(' AND ')}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const listQuery = `
      SELECT 
        ca.id, ca.dealer_id, ca.conversation_id, ca.customer_name, ca.customer_email, 
        ca.customer_phone, ca.application_status, ca.credit_score, ca.submitted_at,
        ca.reviewed_at, ca.reviewed_by, ca.notes, ca.created_at,
        ca.preferred_lender_id, ca.approved_lender_id, ca.lender_approval_date,
        COALESCE(ca.vehicle_id, dc.vehicle_id) AS vehicle_id,
        COALESCE(ca.vehicle_purchase_price, v_app.price, v_chat.price) AS vehicle_purchase_price,
        COALESCE(ca.vehicle_year, v_chat.year, v_app.year) AS vehicle_year,
        COALESCE(NULLIF(TRIM(ca.vehicle_make), ''), v_chat.make, v_app.make) AS vehicle_make,
        COALESCE(NULLIF(TRIM(ca.vehicle_model), ''), v_chat.model, v_app.model) AS vehicle_model,
        ca.down_payment, ca.requested_term_months,
        ca.deal_type, ca.vehicle_msrp,
        NULLIF(TRIM(CONCAT_WS(' ',
          COALESCE(ca.vehicle_year, v_chat.year, v_app.year)::text,
          COALESCE(NULLIF(TRIM(ca.vehicle_make), ''), v_chat.make, v_app.make),
          COALESCE(NULLIF(TRIM(ca.vehicle_model), ''), v_chat.model, v_app.model)
        )), '') AS vehicle_display_name,
        pl.lender_name as preferred_lender_name,
        al.lender_name as approved_lender_name
      FROM credit_applications ca
      LEFT JOIN daive_conversations dc ON dc.id = ca.conversation_id AND dc.dealer_id = ca.dealer_id
      LEFT JOIN vehicles v_app ON v_app.id = ca.vehicle_id
      LEFT JOIN vehicles v_chat ON v_chat.id = dc.vehicle_id
      LEFT JOIN lenders pl ON ca.preferred_lender_id = pl.id
      LEFT JOIN lenders al ON ca.approved_lender_id = al.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ca.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await query(listQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing credit applications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list credit applications',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/credit-applications/:id
 * Get single credit application (masked sensitive data)
 */
router.get('/credit-applications/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const result = await query(`
      SELECT 
        ca.id, ca.dealer_id, ca.conversation_id, ca.customer_name, ca.customer_email, 
        ca.customer_phone, ca.application_status, ca.credit_score, ca.submitted_at,
        ca.reviewed_at, ca.reviewed_by, ca.notes, ca.created_at,
        COALESCE(ca.vehicle_id, dc.vehicle_id) AS vehicle_id,
        COALESCE(ca.vehicle_purchase_price, v_app.price, v_chat.price) AS vehicle_purchase_price,
        COALESCE(ca.vehicle_year, v_chat.year, v_app.year) AS vehicle_year,
        COALESCE(NULLIF(TRIM(ca.vehicle_make), ''), v_chat.make, v_app.make) AS vehicle_make,
        COALESCE(NULLIF(TRIM(ca.vehicle_model), ''), v_chat.model, v_app.model) AS vehicle_model,
        ca.down_payment, ca.requested_term_months,
        ca.deal_type, ca.vehicle_msrp,
        NULLIF(TRIM(CONCAT_WS(' ',
          COALESCE(ca.vehicle_year, v_chat.year, v_app.year)::text,
          COALESCE(NULLIF(TRIM(ca.vehicle_make), ''), v_chat.make, v_app.make),
          COALESCE(NULLIF(TRIM(ca.vehicle_model), ''), v_chat.model, v_app.model)
        )), '') AS vehicle_display_name,
        -- Mask encrypted fields (only show last 4 digits if decrypted)
        CASE 
          WHEN ca.ssn_encrypted IS NOT NULL THEN '***-**-****'
          ELSE NULL
        END as ssn_masked,
        CASE 
          WHEN ca.dl_number_encrypted IS NOT NULL THEN '*******'
          ELSE NULL
        END as dl_masked
      FROM credit_applications ca
      LEFT JOIN daive_conversations dc ON dc.id = ca.conversation_id AND dc.dealer_id = ca.dealer_id
      LEFT JOIN vehicles v_chat ON v_chat.id = dc.vehicle_id
      LEFT JOIN vehicles v_app ON v_app.id = ca.vehicle_id
      WHERE ca.id = $1 AND ca.dealer_id = $2
    `, [id, dealerId]);

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
    console.error('Error getting credit application:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get credit application',
      message: error.message 
    });
  }
});

/**
 * PUT /api/finance/credit-applications/:id
 * Update credit application information
 */
router.put('/credit-applications/:id', [
  body('customer_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 100 }),
  body('customer_email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('customer_phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .custom((value) => {
      if (!value) return true; // Allow empty
      // Remove all non-digit characters
      const cleaned = value.replace(/\D/g, '');
      // Must be 10 digits (or 11 with country code starting with 1)
      if (cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1')) {
        return true;
      }
      throw new Error('Phone number must be 10 digits (US format)');
    }),
  body('credit_score').optional({ nullable: true, checkFalsy: true }).isInt({ min: 300, max: 850 }),
  body('preferred_lender_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
  body('notes').optional({ nullable: true, checkFalsy: true }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify application belongs to dealer
    const checkQuery = 'SELECT id FROM credit_applications WHERE id = $1 AND dealer_id = $2';
    const checkResult = await query(checkQuery, [id, dealerId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Application not found or access denied' 
      });
    }

    const allowedFields = ['customer_name', 'customer_email', 'customer_phone', 'credit_score', 'preferred_lender_id', 'notes'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        // Convert empty strings to null for optional fields
        values.push(req.body[field] === '' ? null : req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No fields to update' 
      });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const updateQuery = `
      UPDATE credit_applications
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, dealer_id, conversation_id, customer_name, customer_email, 
                customer_phone, application_status, credit_score, preferred_lender_id, notes, 
                submitted_at, reviewed_at, reviewed_by, created_at, updated_at
    `;

    const result = await query(updateQuery, values);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Application updated successfully'
    });
  } catch (error) {
    console.error('Error updating credit application:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update credit application',
      message: error.message 
    });
  }
});

/**
 * PUT /api/finance/credit-applications/:id/status
 * Update credit application status
 */
router.put('/credit-applications/:id/status', [
  body('status').isIn(['pending', 'approved', 'rejected', 'reviewing']).withMessage('Invalid application status.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }

  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify application belongs to dealer
    const checkResult = await query(`
      SELECT id FROM credit_applications WHERE id = $1 AND dealer_id = $2
    `, [id, dealerId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Credit application not found' 
      });
    }

    // Update status
    const result = await query(`
      UPDATE credit_applications
      SET 
        application_status = $3,
        reviewed_at = NOW(),
        reviewed_by = $4,
        updated_at = NOW()
      WHERE id = $1 AND dealer_id = $2
      RETURNING 
        id, customer_name, customer_email, customer_phone, application_status, 
        credit_score, reviewed_at, reviewed_by, updated_at
    `, [id, dealerId, status, userId]);

    const application = result.rows[0];

    // Send status-specific notifications
    try {
      if (status === 'approved') {
        await financeNotificationService.notifyCreditApplicationApproved(
          application,
          dealerId,
          { approved_amount: 50000, apr: 4.9 } // You can calculate actual values
        );
        console.log('✅ Credit application approved notification sent');
      } else if (status === 'rejected') {
        await financeNotificationService.notifyCreditApplicationDeclined(
          application,
          dealerId,
          'We were unable to approve your application at this time.'
        );
        console.log('✅ Credit application declined notification sent');
      }
    } catch (notifError) {
      console.error('⚠️ Error sending status notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      data: application,
      message: `Application status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating credit application status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update application status',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/finance/credit-applications/:id
 * Delete a credit application
 */
router.delete('/credit-applications/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify application belongs to dealer
    const checkResult = await query(
      'SELECT id FROM credit_applications WHERE id = $1 AND dealer_id = $2',
      [id, dealerId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Credit application not found or access denied' 
      });
    }

    // Delete the application
    await query('DELETE FROM credit_applications WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Credit application deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting credit application:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete credit application',
      message: error.message 
    });
  }
});

// =====================================================
// FINANCE TERMS ENDPOINTS
// =====================================================

/**
 * GET /api/finance/terms
 * Get finance/lease terms by credit score
 */
router.get('/terms', [
  queryValidator('type').isIn(['finance', 'lease']).withMessage('Type must be finance or lease'),
  queryValidator('term_months').isInt({ min: 12, max: 84 }).withMessage('Term months must be between 12 and 84'),
  queryValidator('credit_score').isInt({ min: 300, max: 850 }).withMessage('Credit score must be between 300 and 850')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    const { type, term_months, credit_score } = req.query;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const term = await financeService.getTermsByCreditScore(
      dealerId,
      type,
      parseInt(term_months),
      parseInt(credit_score)
    );

    if (!term) {
      return res.status(404).json({ 
        success: false,
        error: `No ${type} program found for credit score ${credit_score} and ${term_months} month term` 
      });
    }

    // Get credit tier info
    const tierInfo = financeService.getCreditTier(parseInt(credit_score));

    res.json({
      success: true,
      data: {
        ...term,
        credit_tier: tierInfo
      }
    });
  } catch (error) {
    console.error('Error getting finance terms:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get finance terms',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/programs
 * List all finance programs for the dealer (with pagination)
 */
router.get('/programs', [
  queryValidator('type').optional().isIn(['finance', 'lease']),
  queryValidator('is_active').optional().isBoolean(),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const type = req.query.type;
    const isActive = req.query.is_active;

    let whereConditions = ['(dealer_id = $1 OR dealer_id IS NULL)'];
    let params = [dealerId];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM finance_terms_master WHERE ${whereConditions.join(' AND ')}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const listQuery = `
      SELECT *,
        CASE WHEN dealer_id IS NULL THEN 'global' ELSE 'dealer' END as program_scope
      FROM finance_terms_master
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE WHEN dealer_id IS NULL THEN 1 ELSE 0 END,
        type, term_months, tier_min_score
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await query(listQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing finance programs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list finance programs',
      message: error.message 
    });
  }
});

/**
 * POST /api/finance/programs
 * Create a new finance program (Admin/Staff only)
 */
router.post('/programs', [
  body('program_name').notEmpty().trim().isLength({ min: 3, max: 200 }),
  body('type').isIn(['finance', 'lease']),
  body('term_months').isInt({ min: 12, max: 84 }),
  body('tier_min_score').isInt({ min: 300, max: 850 }),
  body('tier_max_score').isInt({ min: 300, max: 850 }),
  body('interest_rate').optional().isFloat({ min: 0, max: 100 }),
  body('money_factor').optional().isFloat({ min: 0 }),
  body('residual_value_pct').optional().isFloat({ min: 0, max: 100 }),
  body('down_payment_min').optional().isFloat({ min: 0 }),
  body('program_source').optional().isIn(['OEM', 'Bank', 'CreditUnion', 'InHouse']),
  body('effective_date').optional().isISO8601(),
  body('expiry_date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Check permissions (staff_management or dealer admin)
    const user = req.user;
    if (user.role !== 'super_admin' && user.staff_role !== 'admin' && !user.staff_permissions?.includes('staff_management')) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions to create finance programs' 
      });
    }

    const { 
      program_name, 
      type, 
      term_months, 
      tier_min_score, 
      tier_max_score,
      interest_rate,
      money_factor,
      residual_value_pct,
      down_payment_min,
      program_source,
      effective_date,
      expiry_date
    } = req.body;

    // Validate tier range
    if (tier_min_score > tier_max_score) {
      return res.status(400).json({ 
        success: false,
        error: 'tier_min_score must be less than or equal to tier_max_score' 
      });
    }

    // Validate type-specific fields
    if (type === 'finance' && !interest_rate) {
      return res.status(400).json({ 
        success: false,
        error: 'interest_rate is required for finance programs' 
      });
    }

    if (type === 'lease' && (!money_factor || !residual_value_pct)) {
      return res.status(400).json({ 
        success: false,
        error: 'money_factor and residual_value_pct are required for lease programs' 
      });
    }

    const insertQuery = `
      INSERT INTO finance_terms_master (
        dealer_id, program_name, type, term_months, tier_min_score, tier_max_score,
        interest_rate, money_factor, residual_value_pct, down_payment_min,
        program_source, effective_date, expiry_date, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      dealerId, // Dealer-specific program
      program_name,
      type,
      term_months,
      tier_min_score,
      tier_max_score,
      interest_rate || null,
      money_factor || null,
      residual_value_pct || null,
      down_payment_min || 0,
      program_source || 'Bank',
      effective_date || new Date().toISOString().split('T')[0],
      expiry_date || null
    ]);

    // Clear cache for this dealer
    financeService.clearCache(dealerId);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating finance program:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create finance program',
      message: error.message 
    });
  }
});

/**
 * PUT /api/finance/programs/:id
 * Update finance program
 */
router.put('/programs/:id', [
  body('program_name').optional().trim().isLength({ min: 3, max: 200 }),
  body('tier_min_score').optional().isInt({ min: 300, max: 850 }),
  body('tier_max_score').optional().isInt({ min: 300, max: 850 }),
  body('interest_rate').optional().isFloat({ min: 0, max: 100 }),
  body('money_factor').optional().isFloat({ min: 0 }),
  body('residual_value_pct').optional().isFloat({ min: 0, max: 100 }),
  body('is_active').optional().isBoolean(),
  body('expiry_date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify program belongs to dealer
    const checkQuery = await query('SELECT dealer_id FROM finance_terms_master WHERE id = $1', [id]);
    
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Finance program not found' 
      });
    }

    if (checkQuery.rows[0].dealer_id !== dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot update program that belongs to another dealer' 
      });
    }

    // Build update query dynamically
    const allowedFields = [
      'program_name', 'tier_min_score', 'tier_max_score', 
      'interest_rate', 'money_factor', 'residual_value_pct',
      'down_payment_min', 'is_active', 'expiry_date'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No valid fields to update' 
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE finance_terms_master
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    // Clear cache for this dealer
    financeService.clearCache(dealerId);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating finance program:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update finance program',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/finance/programs/:id
 * Deactivate finance program (soft delete)
 */
router.delete('/programs/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify program belongs to dealer
    const checkQuery = await query('SELECT dealer_id FROM finance_terms_master WHERE id = $1', [id]);
    
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Finance program not found' 
      });
    }

    if (checkQuery.rows[0].dealer_id !== dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot delete program that belongs to another dealer' 
      });
    }

    // Soft delete (set is_active = FALSE)
    const result = await query(`
      UPDATE finance_terms_master
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    // Clear cache for this dealer
    financeService.clearCache(dealerId);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Finance program deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating finance program:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to deactivate finance program',
      message: error.message 
    });
  }
});

// =====================================================
// FINANCE DEALS ENDPOINTS
// =====================================================

/**
 * POST /api/finance/deals/stub
 * Create a blank draft deal so the user can configure everything inside the Deal Workspace.
 * Only credit_score and term_months are used; vehicle and price default to 0.
 */
router.post('/deals/stub', async (req, res) => {
  try {
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    const { credit_score = 700, term_months = 60, application_id } = req.body;

    // Determine a reasonable APR from the credit score
    let apr = 9.9;
    if (credit_score >= 750) apr = 4.9;
    else if (credit_score >= 720) apr = 5.9;
    else if (credit_score >= 680) apr = 6.9;
    else if (credit_score >= 640) apr = 7.9;
    else if (credit_score >= 600) apr = 8.9;

    const result = await query(
      `INSERT INTO finance_deals
         (dealer_id, deal_type, deal_stage, status,
          term_months, apr,
          vehicle_price, down_payment, total_amount, monthly_payment,
          application_id)
       VALUES ($1, 'finance', 'lead', 'draft',
               $2, $3,
               0, 0, 0, 0,
               $4)
       RETURNING id`,
      [dealerId, term_months, apr, application_id || null]
    );

    return res.json({ success: true, data: { id: result.rows[0].id } });
  } catch (err) {
    console.error('POST /deals/stub error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/finance/deal
 * Generate a finance deal
 */
router.post('/deal', [
  body('vehicle_id').isUUID(),
  body('price').isFloat({ min: 0 }),
  body('down_payment').optional().isFloat({ min: 0 }),
  body('credit_score').isInt({ min: 300, max: 850 }),
  body('term_months').isInt({ min: 12, max: 84 }),
  body('conversation_id').optional().isUUID(),
  body('application_id').optional().isUUID(),
  // Government fees (TTL)
  body('sales_tax_rate').optional().isFloat({ min: 0, max: 1 }),
  body('title_fee').optional().isFloat({ min: 0 }),
  body('license_fee').optional().isFloat({ min: 0 }),
  body('registration_fee').optional().isFloat({ min: 0 }),
  body('inspection_fee').optional().isFloat({ min: 0 }),
  body('processing_fee').optional().isFloat({ min: 0 }),
  // Trade-in
  body('trade_in_acv').optional().isFloat({ min: 0 }),
  body('trade_in_payoff').optional().isFloat({ min: 0 }),
  // Other
  body('add_ons').optional().isFloat({ min: 0 }),
  body('protection_products').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const { 
      vehicle_id, 
      price, 
      down_payment, 
      credit_score, 
      term_months, 
      conversation_id, 
      application_id,
      sales_tax_rate,
      title_fee,
      license_fee,
      registration_fee,
      inspection_fee,
      processing_fee,
      trade_in_acv,
      trade_in_payoff,
      add_ons,
      protection_products
    } = req.body;

    // Verify vehicle exists and belongs to dealer
    const vehicleCheck = await query('SELECT id, price FROM vehicles WHERE id = $1 AND dealer_id = $2', [vehicle_id, dealerId]);
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Vehicle not found or does not belong to dealer' 
      });
    }

    // Use vehicle price from DB if price not provided
    const finalPrice = price || vehicleCheck.rows[0].price;
    if (!finalPrice) {
      return res.status(400).json({ 
        success: false,
        error: 'Vehicle price is required' 
      });
    }

    // Generate deal with all new fields
    const deal = await financeService.generateFinanceDeal({
      dealerId,
      vehicleId: vehicle_id,
      price: finalPrice,
      downPayment: down_payment || 0,
      creditScore: credit_score,
      termMonths: term_months,
      conversationId: conversation_id,
      applicationId: application_id,
      governmentFees: {
        salesTaxRate: sales_tax_rate || 0,
        titleFee: title_fee || 0,
        licenseFee: license_fee || 0,
        registrationFee: registration_fee || 0,
        inspectionFee: inspection_fee || 0,
        processingFee: processing_fee || 0
      },
      tradeIn: {
        acv: trade_in_acv,
        payoff: trade_in_payoff || 0
      },
      addOns: add_ons || 0,
      protectionProducts: protection_products || 0
    });

    // Send deal created notification
    try {
      if (application_id) {
        // Get application and vehicle details for notification
        const appResult = await query(
          'SELECT customer_name, customer_email, customer_phone FROM credit_applications WHERE id = $1',
          [application_id]
        );
        const vehicleResult = await query(
          'SELECT year, make, model FROM vehicles WHERE id = $1',
          [vehicle_id]
        );
        
        if (appResult.rows.length > 0 && vehicleResult.rows.length > 0) {
          await financeNotificationService.notifyFinanceDealCreated(
            deal,
            appResult.rows[0],
            vehicleResult.rows[0],
            dealerId
          );
          console.log('✅ Finance deal created notification sent');
        }
      }
    } catch (notifError) {
      console.error('⚠️ Error sending deal notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      data: deal
    });
  } catch (error) {
    console.error('Error generating finance deal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate finance deal',
      message: error.message 
    });
  }
});

/**
 * POST /api/finance/lease
 * Generate a lease deal
 */
router.post('/lease', [
  body('vehicle_id').isUUID(),
  body('cap_cost').isFloat({ min: 0 }),
  body('credit_score').isInt({ min: 300, max: 850 }),
  body('term_months').isInt({ min: 12, max: 48 }),
  body('conversation_id').optional().isUUID(),
  body('application_id').optional().isUUID(),
  body('residual_pct').optional().isFloat({ min: 0, max: 100 }),
  body('money_factor').optional().isFloat({ min: 0 }),
  body('msrp').optional().isFloat({ min: 0 }),
  body('cap_cost_reductions').optional().isFloat({ min: 0 }),
  body('capitalized_fees').optional().isFloat({ min: 0 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 1 }),
  body('annual_mileage').optional().isInt({ min: 0 }),
  body('excess_mileage_rate').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const { 
      vehicle_id, 
      cap_cost, 
      credit_score, 
      term_months, 
      conversation_id, 
      application_id, 
      residual_pct, 
      money_factor,
      msrp,
      cap_cost_reductions,
      capitalized_fees,
      tax_rate,
      annual_mileage,
      excess_mileage_rate
    } = req.body;

    // Verify vehicle exists and belongs to dealer
    const vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1 AND dealer_id = $2', [vehicle_id, dealerId]);
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Vehicle not found or does not belong to dealer' 
      });
    }

    // Generate lease deal with all new fields
    const deal = await financeService.generateLeaseDeal({
      dealerId,
      vehicleId: vehicle_id,
      capCost: cap_cost,
      creditScore: credit_score,
      termMonths: term_months,
      residualPct: residual_pct,
      moneyFactor: money_factor,
      msrp: msrp,
      capCostReductions: cap_cost_reductions || 0,
      capitalizedFees: capitalized_fees || 0,
      taxRate: tax_rate || 0,
      annualMileage: annual_mileage,
      excessMileageRate: excess_mileage_rate || 0.25,
      conversationId: conversation_id,
      applicationId: application_id
    });

    // Send lease deal created notification
    try {
      if (application_id) {
        // Get application and vehicle details for notification
        const appResult = await query(
          'SELECT customer_name, customer_email, customer_phone FROM credit_applications WHERE id = $1',
          [application_id]
        );
        const vehicleResult = await query(
          'SELECT year, make, model FROM vehicles WHERE id = $1',
          [vehicle_id]
        );
        
        if (appResult.rows.length > 0 && vehicleResult.rows.length > 0) {
          await financeNotificationService.notifyFinanceDealCreated(
            deal,
            appResult.rows[0],
            vehicleResult.rows[0],
            dealerId
          );
          console.log('✅ Lease deal created notification sent');
        }
      }
    } catch (notifError) {
      console.error('⚠️ Error sending lease notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      data: deal
    });
  } catch (error) {
    console.error('Error generating lease deal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate lease deal',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/deals
 * List all deals for the dealer
 */
router.get('/deals', [
  queryValidator('status').optional().isIn(['draft', 'pending', 'approved', 'rejected', 'signed', 'completed', 'cancelled']),
  queryValidator('deal_type').optional().isIn(['finance', 'lease']),
  queryValidator('conversation_id').optional().isUUID(),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const dealType = req.query.deal_type;
    const conversationId = req.query.conversation_id;

    let whereConditions = ['fd.dealer_id = $1'];
    let params = [dealerId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`fd.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (dealType) {
      whereConditions.push(`fd.deal_type = $${paramIndex}`);
      params.push(dealType);
      paramIndex++;
    }

    if (conversationId) {
      whereConditions.push(`fd.conversation_id = $${paramIndex}`);
      params.push(conversationId);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM finance_deals fd WHERE ${whereConditions.join(' AND ')}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const listQuery = `
      SELECT 
        fd.*,
        v.make, v.model, v.year, v.vin,
        ftm.program_name, ftm.program_source,
        ca.customer_name, ca.customer_email, ca.customer_phone,
        gds.id as latest_deal_sheet_id, gds.pdf_url, gds.pdf_filename,
        sr.id as signature_request_id, sr.status as signature_status
      FROM finance_deals fd
      LEFT JOIN vehicles v ON fd.vehicle_id = v.id
      LEFT JOIN finance_terms_master ftm ON fd.term_id = ftm.id
      LEFT JOIN credit_applications ca ON fd.application_id = ca.id
      LEFT JOIN LATERAL (
        SELECT id, pdf_url, pdf_filename
        FROM generated_deal_sheets
        WHERE deal_id = fd.id
        ORDER BY created_at DESC
        LIMIT 1
      ) gds ON true
      LEFT JOIN LATERAL (
        SELECT id, status
        FROM signature_requests
        WHERE deal_id = fd.id
        ORDER BY created_at DESC
        LIMIT 1
      ) sr ON true
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY fd.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await query(listQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing deals:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list deals',
      message: error.message 
    });
  }
});

/**
 * POST /api/finance/deals/:id/update-status
 * Update deal status (for testing/workflow progression)
 * IMPORTANT: Must come BEFORE GET /deals/:id or Express will match that route first
 */
router.post('/deals/:id/update-status', [
  body('status').isIn(['draft', 'pending', 'approved', 'rejected', 'signed', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const checkQuery = 'SELECT id, status FROM finance_deals WHERE id = $1 AND dealer_id = $2';
    const checkResult = await query(checkQuery, [id, dealerId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const oldStatus = checkResult.rows[0].status;

    // Update status
    const updateQuery = `
      UPDATE finance_deals 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2 AND dealer_id = $3
      RETURNING *
    `;
    
    const result = await query(updateQuery, [status, id, dealerId]);

    res.json({
      success: true,
      data: result.rows[0],
      message: `Deal status updated from ${oldStatus} to ${status}`
    });
  } catch (error) {
    console.error('Error updating deal status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update deal status',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/deals/:id
 * Get single deal details
 * NOTE: Specific routes like /deals/:id/update-status must come BEFORE this
 */
router.get('/deals/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const result = await query(`
      SELECT 
        fd.*,
        v.make, v.model, v.year, v.vin, v.price as vehicle_current_price,
        ftm.program_name, ftm.program_source,
        ca.customer_name, ca.customer_email, ca.customer_phone,
        ca.credit_score
      FROM finance_deals fd
      LEFT JOIN vehicles v ON fd.vehicle_id = v.id
      LEFT JOIN finance_terms_master ftm ON fd.term_id = ftm.id
      LEFT JOIN credit_applications ca ON fd.application_id = ca.id
      WHERE fd.id = $1 AND fd.dealer_id = $2
    `, [id, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found' 
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting deal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get deal',
      message: error.message 
    });
  }
});

// =====================================================
// UPDATE DEAL ENDPOINT
// =====================================================

/**
 * PUT /api/finance/deals/:id
 * Update editable fields on an existing deal
 */
router.put('/deals/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ success: false, error: 'Dealer access required' });
    }

    // Verify deal belongs to this dealer
    const check = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [id, dealerId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    // Allowed updatable fields mapped to their DB column names
    const ALLOWED_FIELDS = {
      deal_type:             'deal_type',
      deal_stage:            'deal_stage',
      status:                'status',
      apr:                   'apr',
      money_factor:          'money_factor',
      residual_value_pct:    'residual_value_pct',
      term_months:           'term_months',
      down_payment:          'down_payment',
      amount_financed:       'amount_financed',
      monthly_payment:       'monthly_payment',
      total_amount:          'total_amount',
      include_warranty:      'include_warranty',
      include_gap:           'include_gap',
      include_accessories:   'include_accessories',
      notes:                 'notes',
      ai_notes:              'ai_notes',
      trade_in_acv:              'trade_in_acv',
      trade_in_payoff:           'trade_in_payoff',
      trade_in_equity:           'trade_in_equity',
      trade_in_negative_equity:  'trade_in_negative_equity',
      trade_in_net_credit:       'trade_in_net_credit',
      trade_in_year:             'trade_in_year',
      trade_in_make:             'trade_in_make',
      trade_in_model:            'trade_in_model',
      trade_in_vin:              'trade_in_vin',
      trade_in_mileage:          'trade_in_mileage',
      trade_in_condition:        'trade_in_condition',
      dealer_fee:            'dealer_fee',
      sales_tax:             'sales_tax',
      title_fee:             'title_fee',
      license_fee:           'license_fee',
      registration_fee:      'registration_fee',
      total_government_fees: 'total_government_fees',
      warranty_amount:       'warranty_amount',
      gap_amount:            'gap_amount',
      accessories_amount:    'accessories_amount',
    };

    const setClauses = [];
    const values = [];
    let paramIdx = 1;

    for (const [bodyKey, colName] of Object.entries(ALLOWED_FIELDS)) {
      if (Object.prototype.hasOwnProperty.call(req.body, bodyKey)) {
        setClauses.push(`${colName} = $${paramIdx}`);
        values.push(req.body[bodyKey]);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No updatable fields provided' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id, dealerId);

    const updateQuery = `
      UPDATE finance_deals
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx} AND dealer_id = $${paramIdx + 1}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ success: false, error: 'Failed to update deal', message: error.message });
  }
});

// =====================================================
// DEAL SHEET / PDF GENERATION ENDPOINTS
// =====================================================

import pdfGenerator from '../lib/pdfGenerator.js';

/**
 * POST /api/finance/deals/:id/send-to-fi
 * Move deal to F&I stage and notify F&I managers
 */
router.post('/deals/:id/send-to-fi', async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    // Update deal stage
    const dealResult = await query(
      `UPDATE finance_deals SET deal_stage = 'fi', updated_at = NOW()
       WHERE id = $1 AND dealer_id = $2 RETURNING *`,
      [id, dealerId]
    );
    if (dealResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found' });
    const deal = dealResult.rows[0];

    // Notify all F&I managers at this dealer via notifications bell
    try {
      const fiUsers = await query(
        `SELECT u.id FROM users u
         JOIN dealership_staff ds ON ds.user_id = u.id
         WHERE ds.dealer_id = $1 AND ds.staff_role IN ('fi_manager', 'finance_manager', 'admin')`,
        [dealerId]
      );
      const vehicleName = [deal.year, deal.make, deal.model].filter(Boolean).join(' ') || 'Vehicle';
      for (const fu of fiUsers.rows) {
        await query(
          `INSERT INTO notifications (user_id, dealer_id, type, title, message, data, read, created_at, updated_at)
           VALUES ($1, $2, 'deal_fi', $3, $4, $5, false, NOW(), NOW())`,
          [fu.id, dealerId,
           'Deal Ready for F&I',
           `Deal for ${deal.customer_name || 'customer'} (${vehicleName}) has been sent to F&I.`,
           JSON.stringify({ deal_id: id, deal_stage: 'fi' })]
        );
      }
      // Also insert a dealer-wide notification as fallback
      await query(
        `INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
         VALUES ($1, 'deal_fi', $2, $3, $4, false, NOW(), NOW())`,
        [dealerId,
         'Deal Ready for F&I',
         `Deal for ${deal.customer_name || 'customer'} (${vehicleName}) is ready for F&I processing.`,
         JSON.stringify({ deal_id: id })]
      );
    } catch (notifErr) {
      console.warn('⚠️ Could not send F&I notification:', notifErr.message);
    }

    res.json({ success: true, deal: dealResult.rows[0] });
  } catch (error) {
    console.error('Error sending deal to F&I:', error);
    res.status(500).json({ success: false, error: 'Failed to send deal to F&I', message: error.message });
  }
});

/**
 * POST /api/finance/deals/:id/request-desk-approval
 * Move deal to desk approval stage and notify desk managers
 */
router.post('/deals/:id/request-desk-approval', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    const dealResult = await query(
      `UPDATE finance_deals SET deal_stage = 'desk_approval', updated_at = NOW()
       WHERE id = $1 AND dealer_id = $2 RETURNING *`,
      [id, dealerId]
    );
    if (dealResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found' });
    const deal = dealResult.rows[0];

    try {
      const deskManagers = await query(
        `SELECT u.id FROM users u
         JOIN dealership_staff ds ON ds.user_id = u.id
         WHERE ds.dealer_id = $1 AND ds.staff_role IN ('desk_manager', 'sales_manager', 'admin')`,
        [dealerId]
      );
      const vehicleName = [deal.year, deal.make, deal.model].filter(Boolean).join(' ') || 'Vehicle';
      const noteText = notes ? ` Notes: "${notes}"` : '';
      for (const dm of deskManagers.rows) {
        await query(
          `INSERT INTO notifications (user_id, dealer_id, type, title, message, data, read, created_at, updated_at)
           VALUES ($1, $2, 'deal_desk_approval', $3, $4, $5, false, NOW(), NOW())`,
          [dm.id, dealerId,
           '🚨 Deal Needs Desk Approval',
           `${req.user.name || 'Salesperson'} is requesting desk approval for ${deal.customer_name || 'customer'} on ${vehicleName}.${noteText}`,
           JSON.stringify({ deal_id: id, deal_stage: 'desk_approval', requested_by: req.user.id })]
        );
      }
      // Dealer-wide fallback
      await query(
        `INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
         VALUES ($1, 'deal_desk_approval', $2, $3, $4, false, NOW(), NOW())`,
        [dealerId,
         '🚨 Deal Needs Desk Approval',
         `Approval requested for ${deal.customer_name || 'customer'} on ${vehicleName}.${noteText}`,
         JSON.stringify({ deal_id: id })]
      );
    } catch (notifErr) {
      console.warn('⚠️ Could not send desk approval notification:', notifErr.message);
    }

    res.json({ success: true, deal: dealResult.rows[0] });
  } catch (error) {
    console.error('Error requesting desk approval:', error);
    res.status(500).json({ success: false, error: 'Failed to request desk approval', message: error.message });
  }
});

/**
 * POST /api/finance/deals/:id/ai-followup
 * Trigger an AI follow-up message to the customer via DAIVE
 */
router.post('/deals/:id/ai-followup', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    const dealResult = await query(
      `SELECT fd.*, dc.session_id as daive_session_id
       FROM finance_deals fd
       LEFT JOIN daive_conversations dc ON dc.id = fd.conversation_id
       WHERE fd.id = $1 AND fd.dealer_id = $2`,
      [id, dealerId]
    );
    if (dealResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found' });
    const deal = dealResult.rows[0];

    const vehicleName = [deal.year, deal.make, deal.model].filter(Boolean).join(' ') || 'the vehicle';
    const followUpMsg = message || `Hi ${deal.customer_name?.split(' ')[0] || 'there'}! I wanted to follow up on your interest in the ${vehicleName}. We have a great deal ready for you — would you like to come in to finalize the paperwork?`;

    // Log the follow-up as an outbound message in the conversation if one exists
    if (deal.conversation_id) {
      try {
        await query(
          `INSERT INTO conversation_messages (conversation_id, role, content, created_at)
           VALUES ($1, 'assistant', $2, NOW())`,
          [deal.conversation_id, followUpMsg]
        );
      } catch (msgErr) {
        console.warn('⚠️ Could not log follow-up message:', msgErr.message);
      }
    }

    // Insert notification for the salesperson confirming the follow-up was queued
    await query(
      `INSERT INTO notifications (user_id, dealer_id, type, title, message, data, read, created_at, updated_at)
       VALUES ($1, $2, 'ai_followup', $3, $4, $5, false, NOW(), NOW())`,
      [req.user.id, dealerId,
       '✅ AI Follow-Up Queued',
       `Follow-up message queued for ${deal.customer_name || 'customer'} regarding ${vehicleName}.`,
       JSON.stringify({ deal_id: id, message: followUpMsg })]
    );

    res.json({
      success: true,
      message: followUpMsg,
      customer_name: deal.customer_name,
      customer_email: deal.customer_email,
      customer_phone: deal.customer_phone,
    });
  } catch (error) {
    console.error('Error triggering AI follow-up:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger AI follow-up', message: error.message });
  }
});

/**
 * POST /api/finance/deals/:id/send-sms
 * Send a text message to the customer from the deal page
 */
router.post('/deals/:id/send-sms', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'Message is required' });

    const dealResult = await query(
      `SELECT customer_name, customer_phone, year, make, model FROM finance_deals WHERE id = $1 AND dealer_id = $2`,
      [id, dealerId]
    );
    if (dealResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found' });
    const deal = dealResult.rows[0];

    if (!deal.customer_phone) return res.status(400).json({ success: false, error: 'Customer has no phone number on file' });

    const result = await financeNotificationService.sendSMS(deal.customer_phone, message.trim(), dealerId);

    if (result?.reason === 'not_configured') {
      return res.status(503).json({ success: false, error: 'SMS is not configured for this dealership' });
    }
    if (result?.reason === 'disabled') {
      return res.status(503).json({ success: false, error: 'SMS notifications are disabled for this dealership' });
    }

    // Log in conversation messages if deal has a conversation
    try {
      const convResult = await query(`SELECT conversation_id FROM finance_deals WHERE id = $1`, [id]);
      if (convResult.rows[0]?.conversation_id) {
        await query(
          `INSERT INTO conversation_messages (conversation_id, role, content, created_at) VALUES ($1, 'assistant', $2, NOW())`,
          [convResult.rows[0].conversation_id, `[SMS sent] ${message.trim()}`]
        );
      }
    } catch { /* non-critical */ }

    res.json({ success: true, phone: deal.customer_phone, customer_name: deal.customer_name });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ success: false, error: 'Failed to send SMS', message: error.message });
  }
});

/**
 * POST /api/finance/deals/:id/send-email-proposal
 * Send a formatted proposal email to the customer
 */
router.post('/deals/:id/send-email-proposal', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;
    const dealerId = req.user?.dealer_id;
    if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });

    const dealResult = await query(
      `SELECT fd.*, u.name as salesperson_name, u.email as salesperson_email,
              d.name as dealer_name, d.phone as dealer_phone, d.email as dealer_email
       FROM finance_deals fd
       LEFT JOIN users u ON u.id = $2
       LEFT JOIN dealers d ON d.id = $3
       WHERE fd.id = $1 AND fd.dealer_id = $3`,
      [id, req.user.id, dealerId]
    );
    if (dealResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found' });
    const deal = dealResult.rows[0];

    if (!deal.customer_email) return res.status(400).json({ success: false, error: 'Customer has no email on file' });

    const vehicleName = [deal.year, deal.make, deal.model].filter(Boolean).join(' ') || 'Vehicle';
    const emailSubject = subject || `Your ${vehicleName} Proposal from ${deal.dealer_name || 'Us'}`;
    const customMsg = message ? `<p style="margin:16px 0;color:#374151;">${message.replace(/\n/g, '<br>')}</p>` : '';

    const monthlyPmt = deal.monthly_payment ? `$${Number(deal.monthly_payment).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'TBD';
    const downPmt   = deal.down_payment    ? `$${Number(deal.down_payment).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : 'N/A';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:0}
.wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;padding:32px 28px}
.hdr h1{margin:0;font-size:22px;font-weight:700}
.hdr p{margin:6px 0 0;opacity:.85;font-size:14px}
.body{padding:28px}
.vehicle{background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:16px;margin:16px 0}
.vehicle h2{margin:0 0 4px;font-size:18px;color:#1e40af}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center}
.card .label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
.card .value{font-size:20px;font-weight:700;color:#111827;margin-top:4px}
.card.highlight .value{color:#2563eb}
.footer{background:#f9fafb;padding:20px 28px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <h1>Your Vehicle Proposal</h1>
    <p>Prepared for ${deal.customer_name || 'Valued Customer'}</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hi ${deal.customer_name?.split(' ')[0] || 'there'},</p>
    <p style="color:#374151">Thank you for your interest! Here is your personalized proposal for the <strong>${vehicleName}</strong>.</p>
    ${customMsg}
    <div class="vehicle">
      <h2>${vehicleName}</h2>
      <p style="margin:0;color:#3b82f6;font-size:14px">${deal.deal_type === 'lease' ? 'Lease Offer' : 'Finance Offer'} · ${deal.deal_stage ? deal.deal_stage.replace(/_/g,' ').toUpperCase() : ''}</p>
    </div>
    <div class="grid">
      <div class="card highlight">
        <div class="label">Monthly Payment</div>
        <div class="value">${monthlyPmt}<span style="font-size:13px;font-weight:400;color:#6b7280">/mo</span></div>
      </div>
      <div class="card">
        <div class="label">Down Payment</div>
        <div class="value" style="font-size:16px">${downPmt}</div>
      </div>
      <div class="card">
        <div class="label">Term</div>
        <div class="value" style="font-size:16px">${deal.term_months || '—'} Months</div>
      </div>
      <div class="card">
        <div class="label">${deal.deal_type === 'lease' ? 'Money Factor' : 'APR'}</div>
        <div class="value" style="font-size:16px">${deal.deal_type === 'lease' ? (deal.money_factor || '—') : (deal.apr ? `${Number(deal.apr).toFixed(2)}%` : '—')}</div>
      </div>
    </div>
    <p style="color:#374151;font-size:14px">Ready to move forward? Contact us or stop by the dealership — we're excited to get you into your new vehicle!</p>
    <p style="color:#374151;font-size:14px;margin-top:4px">
      <strong>${deal.salesperson_name || 'Your Sales Team'}</strong>${deal.salesperson_email ? ` · ${deal.salesperson_email}` : ''}<br>
      ${deal.dealer_name || ''}${deal.dealer_phone ? ` · ${deal.dealer_phone}` : ''}
    </p>
  </div>
  <div class="footer">This proposal is for informational purposes. Final terms subject to credit approval and availability.</div>
</div></body></html>`;

    await financeNotificationService.sendEmail(deal.customer_email, emailSubject, html, dealerId);

    res.json({ success: true, email: deal.customer_email, customer_name: deal.customer_name });
  } catch (error) {
    console.error('Error sending email proposal:', error);
    res.status(500).json({ success: false, error: 'Failed to send email proposal', message: error.message });
  }
});

/**
 * POST /api/finance/deals/:id/generate-deal-sheet (alias — frontend calls this URL)
 * Identical to /generate-sheet
 */
router.post('/deals/:id/generate-deal-sheet', async (req, res) => {
  // Reuse the same handler as /generate-sheet by calling it directly
  const { id } = req.params;
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  const dealerId = req.user.dealer_id;
  if (!dealerId) return res.status(403).json({ success: false, error: 'Dealer access required' });
  const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [id, dealerId]);
  if (dealCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
  try {
    const dealSheet = await pdfGenerator.generateDealSheet({ dealId: id, templateId: req.body?.template_id || null, userId: req.user.id, dealerId });
    res.status(201).json({ success: true, data: dealSheet, id: dealSheet.id, pdf_url: dealSheet.pdf_url, message: 'Deal sheet generated successfully' });
  } catch (error) {
    console.error('Error generating deal sheet (alias route):', error);
    res.status(500).json({ success: false, error: 'Failed to generate deal sheet', message: error.message });
  }
});

/**
 * POST /api/finance/deals/:id/generate-sheet
 * Generate PDF deal sheet for a deal
 */
router.post('/deals/:id/generate-sheet', async (req, res) => {
  console.log('\n🔵 ===== PDF GENERATION REQUEST START =====');
  console.log('📍 Endpoint: POST /api/finance/deals/:id/generate-sheet');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📋 Request Details:', {
    params: req.params,
    body: req.body,
    headers: {
      authorization: req.headers.authorization ? 'Bearer [PRESENT]' : 'MISSING',
      'content-type': req.headers['content-type']
    }
  });
  
  try {
    // Check if user is authenticated
    console.log('👤 User authentication check...');
    if (!req.user) {
      console.log('❌ No user object found - authentication failed');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }
    console.log('✅ User authenticated:', { userId: req.user.id, email: req.user.email });

    const dealerId = req.user.dealer_id;
    const { id } = req.params;
    const { template_id } = req.body;

    console.log('🏢 Dealer ID:', dealerId);
    console.log('📄 Deal ID:', id);
    console.log('🎨 Template ID:', template_id || 'default');

    if (!dealerId) {
      console.log('❌ No dealer_id found in user object');
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    console.log('🔍 Verifying deal ownership...');
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [id, dealerId]);
    console.log('📊 Deal check result:', { found: dealCheck.rows.length > 0, rowCount: dealCheck.rows.length });
    
    if (dealCheck.rows.length === 0) {
      console.log('❌ Deal not found or access denied');
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }
    console.log('✅ Deal ownership verified');

    // Generate deal sheet
    console.log('🎨 Starting PDF generation...');
    const startTime = Date.now();
    const dealSheet = await pdfGenerator.generateDealSheet({
      dealId: id,
      templateId: template_id || null,
      userId: req.user.id,
      dealerId
    });
    const duration = Date.now() - startTime;
    console.log(`✅ PDF generated successfully in ${duration}ms`);
    console.log('📄 Deal sheet details:', {
      id: dealSheet.id,
      filename: dealSheet.pdf_filename,
      url: dealSheet.pdf_url,
      size: dealSheet.pdf_size_bytes
    });

    console.log('🔵 ===== PDF GENERATION REQUEST END (SUCCESS) =====\n');
    res.status(201).json({
      success: true,
      data: dealSheet,
      message: 'Deal sheet generated successfully'
    });
  } catch (error) {
    console.error('🔴 ===== ERROR IN PDF GENERATION =====');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.log('🔴 ===== PDF GENERATION REQUEST END (ERROR) =====\n');
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate deal sheet',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/deals/:id/sheets
 * Get all deal sheets for a deal
 */
router.get('/deals/:id/sheets', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [id, dealerId]);
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const sheets = await pdfGenerator.getDealSheets(id);

    res.json({
      success: true,
      data: sheets
    });
  } catch (error) {
    console.error('Error getting deal sheets:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get deal sheets',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/deals/:id/preview-html
 * Preview HTML before PDF generation
 */
router.get('/deals/:id/preview-html', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;
    const { template_id } = req.query;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [id, dealerId]);
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const { html } = await pdfGenerator.generateHTML(id, template_id || null);

    res.send(html);
  } catch (error) {
    console.error('Error previewing HTML:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to preview HTML',
      message: error.message 
    });
  }
});

// =====================================================
// PROTECTION PRODUCTS ENDPOINTS
// =====================================================

/**
 * POST /api/finance/deals/:dealId/products
 * Add protection product to a deal
 */
router.post('/deals/:dealId/products', [
  body('product_type').isIn(['GAP', 'VSC', 'Appearance', 'TireWheel', 'ServiceContract', 'InteriorExterior', 'Other']),
  body('product_name').notEmpty().trim(),
  body('price').isFloat({ min: 0 }),
  body('is_financed').optional().isBoolean(),
  body('provider_name').optional().trim(),
  body('dealer_profit').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const dealerId = req.user.dealer_id;
    const { dealId } = req.params;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id, term_months FROM finance_deals WHERE id = $1 AND dealer_id = $2', [dealId, dealerId]);
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const termMonths = dealCheck.rows[0].term_months;

    const product = await protectionProductsService.addProduct({
      dealId,
      productType: req.body.product_type,
      productName: req.body.product_name,
      price: req.body.price,
      isFinanced: req.body.is_financed !== false,
      providerName: req.body.provider_name || null,
      dealerProfit: req.body.dealer_profit || 0,
      termMonths
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error adding protection product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add protection product',
      message: error.message 
    });
  }
});

/**
 * GET /api/finance/deals/:dealId/products
 * Get all protection products for a deal
 */
router.get('/deals/:dealId/products', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { dealId } = req.params;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [dealId, dealerId]);
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const products = await protectionProductsService.getDealProducts(dealId);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error getting protection products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get protection products',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/finance/deals/:dealId/products/:productId
 * Remove protection product from deal
 */
router.delete('/deals/:dealId/products/:productId', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { dealId, productId } = req.params;
    
    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [dealId, dealerId]);
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    await protectionProductsService.removeProduct(productId);

    res.json({
      success: true,
      message: 'Protection product removed successfully'
    });
  } catch (error) {
    console.error('Error removing protection product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove protection product',
      message: error.message 
    });
  }
});

export default router;

