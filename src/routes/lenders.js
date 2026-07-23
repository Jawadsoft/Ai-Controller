/**
 * Lenders API Routes
 * Handles all lender management and submission tracking endpoints
 */

import express from 'express';
import { body, validationResult, query as queryValidator } from 'express-validator';
import { query } from '../database/connection.js';
import lendersService from '../lib/lendersService.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Note: Authentication and tenant context are handled at server.js level
// All routes below are already protected by authenticateToken and attachTenantContext

// Require finance_management permission for all lender routes
router.use(requirePermission('finance_management'));

// =====================================================
// LENDERS ENDPOINTS
// =====================================================

/**
 * GET /api/lenders
 * Get all lenders for the dealer (dealer-specific + global)
 */
router.get('/', [
  queryValidator('type').optional().isIn(['Bank', 'CreditUnion', 'OEM', 'InHouse']),
  queryValidator('is_active').optional().isBoolean(),
  queryValidator('is_preferred').optional().isBoolean()
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

    const filters = {
      type: req.query.type,
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      is_preferred: req.query.is_preferred === 'true' ? true : req.query.is_preferred === 'false' ? false : undefined
    };

    const lenders = await lendersService.getLenders(dealerId, filters);

    res.json({
      success: true,
      data: lenders
    });
  } catch (error) {
    console.error('Error listing lenders:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list lenders',
      message: error.message 
    });
  }
});

/**
 * GET /api/lenders/:id
 * Get single lender by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const lender = await lendersService.getLenderById(id, dealerId);

    if (!lender) {
      return res.status(404).json({ 
        success: false,
        error: 'Lender not found' 
      });
    }

    res.json({
      success: true,
      data: lender
    });
  } catch (error) {
    console.error('Error getting lender:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get lender',
      message: error.message 
    });
  }
});

/**
 * POST /api/lenders
 * Create a new lender (dealer-specific)
 */
router.post('/', [
  body('lender_name').notEmpty().trim().isLength({ min: 2, max: 200 }),
  body('lender_type').isIn(['Bank', 'CreditUnion', 'OEM', 'InHouse']),
  body('contact_email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('contact_phone').optional({ nullable: true, checkFalsy: true }).trim(),
  body('min_credit_score').optional({ nullable: true, checkFalsy: true }).isInt({ min: 300, max: 850 }),
  body('max_ltv').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 200 }),
  body('is_preferred').optional({ nullable: true, checkFalsy: true }).isBoolean()
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
        error: 'Insufficient permissions to create lenders' 
      });
    }

    const lenderData = {
      dealerId,
      ...req.body
    };

    const lender = await lendersService.createLender(lenderData);

    res.status(201).json({
      success: true,
      data: lender,
      message: 'Lender created successfully'
    });
  } catch (error) {
    console.error('Error creating lender:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create lender',
      message: error.message 
    });
  }
});

/**
 * PUT /api/lenders/:id
 * Update lender information
 */
router.put('/:id', [
  body('lender_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 200 }),
  body('lender_type').optional({ nullable: true, checkFalsy: true }).isIn(['Bank', 'CreditUnion', 'OEM', 'InHouse']),
  body('contact_email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('min_credit_score').optional({ nullable: true, checkFalsy: true }).isInt({ min: 300, max: 850 }),
  body('max_ltv').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 200 }),
  body('is_active').optional({ nullable: true, checkFalsy: true }).isBoolean(),
  body('is_preferred').optional({ nullable: true, checkFalsy: true }).isBoolean()
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

    // Check permissions
    const user = req.user;
    if (user.role !== 'super_admin' && user.staff_role !== 'admin' && !user.staff_permissions?.includes('staff_management')) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions to update lenders' 
      });
    }

    const lender = await lendersService.updateLender(id, dealerId, req.body);

    res.json({
      success: true,
      data: lender,
      message: 'Lender updated successfully'
    });
  } catch (error) {
    console.error('Error updating lender:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update lender',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/lenders/:id
 * Deactivate lender (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Check permissions
    const user = req.user;
    if (user.role !== 'super_admin' && user.staff_role !== 'admin' && !user.staff_permissions?.includes('staff_management')) {
      return res.status(403).json({ 
        success: false,
        error: 'Insufficient permissions to delete lenders' 
      });
    }

    const lender = await lendersService.deactivateLender(id, dealerId);

    res.json({
      success: true,
      data: lender,
      message: 'Lender deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating lender:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to deactivate lender',
      message: error.message 
    });
  }
});

/**
 * GET /api/lenders/:id/programs
 * Get finance programs for a specific lender
 */
router.get('/:id/programs', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const programs = await lendersService.getLenderPrograms(id, dealerId);

    res.json({
      success: true,
      data: programs
    });
  } catch (error) {
    console.error('Error getting lender programs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get lender programs',
      message: error.message 
    });
  }
});

// =====================================================
// LENDER SUBMISSIONS ENDPOINTS
// =====================================================

/**
 * POST /api/lenders/:id/submit
 * Submit a deal to a lender
 */
router.post('/:id/submit', [
  body('deal_id').isUUID().withMessage('Valid deal_id is required'),
  body('submission_method').optional().isIn(['manual', 'api', 'email', 'fax']),
  body('notes').optional().trim()
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
    const lenderId = req.params.id;
    const { deal_id, submission_method, notes } = req.body;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [deal_id, dealerId]);
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const submission = await lendersService.submitDealToLender({
      dealId: deal_id,
      lenderId,
      dealerId,
      submittedBy: req.user.id,
      submission_method: submission_method || 'manual',
      notes
    });

    res.status(201).json({
      success: true,
      data: submission,
      message: 'Deal submitted to lender successfully'
    });
  } catch (error) {
    console.error('Error submitting deal to lender:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit deal to lender',
      message: error.message 
    });
  }
});

/**
 * PUT /api/lenders/submissions/:id
 * Update lender submission status
 */
router.put('/submissions/:id', [
  body('submission_status').optional().isIn(['pending', 'submitted', 'approved', 'rejected', 'countered', 'withdrawn']),
  body('approved_amount').optional().isFloat({ min: 0 }),
  body('approved_apr').optional().isFloat({ min: 0, max: 100 }),
  body('approved_term_months').optional().isInt({ min: 12, max: 84 }),
  body('rejection_reason').optional().trim(),
  body('lender_reference_number').optional().trim()
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

    // Verify submission belongs to dealer
    const submissionCheck = await query('SELECT id FROM lender_submissions WHERE id = $1 AND dealer_id = $2', [id, dealerId]);
    if (submissionCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Submission not found or access denied' 
      });
    }

    const updateData = {
      ...req.body,
      reviewed_by: req.user.id
    };

    const submission = await lendersService.updateSubmission(id, updateData);

    res.json({
      success: true,
      data: submission,
      message: 'Submission updated successfully'
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update submission',
      message: error.message 
    });
  }
});

/**
 * GET /api/lenders/deals/:dealId/submissions
 * Get all submissions for a deal
 */
router.get('/deals/:dealId/submissions', async (req, res) => {
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

    const submissions = await lendersService.getDealSubmissions(dealId);

    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('Error getting deal submissions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get deal submissions',
      message: error.message 
    });
  }
});

export default router;

