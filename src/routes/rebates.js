/**
 * Rebates API Routes
 * Handles vehicle rebate management for USA dealerships
 * Allows creating, applying, and managing rebates on inventory
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Require rebate_management permission for all routes
router.use(requirePermission('rebate_management'));

// =====================================================
// REBATE MANAGEMENT ENDPOINTS
// =====================================================

/**
 * GET /api/rebates
 * Get all rebates for dealer with filtering
 */
router.get('/', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const { 
      status = 'all',
      rebate_type = 'all',
      search = '',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['dealer_id = $1'];
    const params = [dealerId];
    let paramIndex = 2;

    // Filter by status
    if (status === 'active') {
      whereConditions.push(`is_active = true AND (valid_until IS NULL OR valid_until >= NOW())`);
    } else if (status === 'expired') {
      whereConditions.push(`(is_active = false OR valid_until < NOW())`);
    }

    // Filter by rebate type
    if (rebate_type !== 'all') {
      whereConditions.push(`rebate_type = $${paramIndex}`);
      params.push(rebate_type);
      paramIndex++;
    }

    // Search by name or code
    if (search) {
      whereConditions.push(`(rebate_name ILIKE $${paramIndex} OR rebate_code ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM rebates ${whereClause}`;
    const countResult = await query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get rebates
    const rebatesQuery = `
      SELECT 
        r.*,
        u.email as created_by_email,
        (
          SELECT COUNT(*) 
          FROM rebate_applications ra 
          WHERE ra.rebate_id = r.id AND ra.status = 'active'
        ) as active_applications
      FROM rebates r
      LEFT JOIN users u ON r.created_by = u.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await query(rebatesQuery, params);

    res.json({
      rebates: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get rebates error:', error);
    res.status(500).json({ error: 'Failed to fetch rebates' });
  }
});

/**
 * GET /api/rebates/vehicle-options
 * Get available makes and models from inventory
 */
router.get('/vehicle-options', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get unique makes
    const makesQuery = `
      SELECT DISTINCT make 
      FROM vehicles 
      WHERE dealer_id = $1 AND make IS NOT NULL AND make != ''
      ORDER BY make ASC
    `;
    
    // Get unique models
    const modelsQuery = `
      SELECT DISTINCT model 
      FROM vehicles 
      WHERE dealer_id = $1 AND model IS NOT NULL AND model != ''
      ORDER BY model ASC
    `;
    
    // Get unique years
    const yearsQuery = `
      SELECT DISTINCT year 
      FROM vehicles 
      WHERE dealer_id = $1 AND year IS NOT NULL
      ORDER BY year DESC
    `;

    const [makesResult, modelsResult, yearsResult] = await Promise.all([
      query(makesQuery, [dealerId]),
      query(modelsQuery, [dealerId]),
      query(yearsQuery, [dealerId])
    ]);

    res.json({
      makes: makesResult.rows.map(r => r.make),
      models: modelsResult.rows.map(r => r.model),
      years: yearsResult.rows.map(r => r.year)
    });
  } catch (error) {
    console.error('Get vehicle options error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle options' });
  }
});

/**
 * GET /api/rebates/models-by-make
 * Get available models for a specific make
 */
router.get('/models-by-make', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { make } = req.query;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }
    
    if (!make) {
      return res.status(400).json({ error: 'Make parameter is required' });
    }

    const modelsQuery = `
      SELECT DISTINCT model 
      FROM vehicles 
      WHERE dealer_id = $1 AND make = $2 AND model IS NOT NULL AND model != ''
      ORDER BY model ASC
    `;
    
    const result = await query(modelsQuery, [dealerId, make]);

    res.json({
      make,
      models: result.rows.map(r => r.model)
    });
  } catch (error) {
    console.error('Get models by make error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * GET /api/rebates/stats
 * Get rebate statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_rebates,
        COUNT(*) FILTER (WHERE is_active = true AND (valid_until IS NULL OR valid_until >= NOW())) as active_rebates,
        COUNT(*) FILTER (WHERE is_active = false OR valid_until < NOW()) as expired_rebates,
        COALESCE(SUM(times_applied), 0) as total_applications,
        COALESCE(SUM(CASE WHEN rebate_type = 'consumer' THEN times_applied ELSE 0 END), 0) as consumer_applications,
        COALESCE(SUM(CASE WHEN rebate_type = 'dealer' THEN times_applied ELSE 0 END), 0) as dealer_applications
      FROM rebates
      WHERE dealer_id = $1
    `;

    const amountQuery = `
      SELECT 
        COALESCE(SUM(applied_amount), 0) as total_rebate_amount,
        COUNT(DISTINCT vehicle_id) as vehicles_with_rebates
      FROM rebate_applications
      WHERE dealer_id = $1 AND status = 'active'
    `;

    const [statsResult, amountResult] = await Promise.all([
      query(statsQuery, [dealerId]),
      query(amountQuery, [dealerId])
    ]);

    res.json({
      ...statsResult.rows[0],
      ...amountResult.rows[0]
    });
  } catch (error) {
    console.error('Get rebate stats error:', error);
    res.status(500).json({ error: 'Failed to fetch rebate statistics' });
  }
});

/**
 * GET /api/rebates/:id
 * Get single rebate details with application history
 */
router.get('/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get rebate details
    const rebateQuery = `
      SELECT r.*, u.email as created_by_email
      FROM rebates r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1 AND r.dealer_id = $2
    `;
    const rebateResult = await query(rebateQuery, [rebateId, dealerId]);

    if (rebateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rebate not found' });
    }

    // Get application history
    const applicationsQuery = `
      SELECT 
        ra.*,
        v.make, v.model, v.year, v.vin, v.stock_number, v.price,
        u.email as applied_by_email
      FROM rebate_applications ra
      JOIN vehicles v ON ra.vehicle_id = v.id
      LEFT JOIN users u ON ra.applied_by = u.id
      WHERE ra.rebate_id = $1
      ORDER BY ra.applied_at DESC
      LIMIT 100
    `;
    const applicationsResult = await query(applicationsQuery, [rebateId]);

    res.json({
      rebate: rebateResult.rows[0],
      applications: applicationsResult.rows
    });
  } catch (error) {
    console.error('Get rebate error:', error);
    res.status(500).json({ error: 'Failed to fetch rebate details' });
  }
});

/**
 * POST /api/rebates
 * Create new rebate
 */
router.post('/', [
  body('rebate_name').notEmpty().trim().withMessage('Rebate name is required'),
  body('rebate_type').isIn(['consumer', 'dealer', 'manufacturer', 'promotional']).withMessage('Invalid rebate type'),
  body('rebate_amount').optional().isFloat({ min: 0 }).withMessage('Rebate amount must be a positive number'),
  body('amount_type').isIn(['fixed', 'percentage']).withMessage('Amount type must be fixed or percentage')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const dealerId = req.user.dealer_id;
    const userId = req.user.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const {
      rebate_name, rebate_code, description, rebate_type,
      rebate_amount, amount_type, eligible_makes, eligible_models,
      eligible_years, eligible_trims, eligible_body_styles,
      eligible_vehicle_types, eligible_states, min_price, max_price,
      valid_from, valid_until, is_active, is_stackable,
      priority, max_applications, terms_and_conditions,
      requires_financing, requires_trade_in, model_specific_amounts
    } = req.body;
    
    // Custom validation: Either rebate_amount OR model_specific_amounts must be provided
    const hasModelSpecificAmounts = model_specific_amounts && 
      typeof model_specific_amounts === 'object' && 
      Object.keys(model_specific_amounts).length > 0;
    
    const hasBaseAmount = rebate_amount != null && rebate_amount > 0;
    
    if (!hasBaseAmount && !hasModelSpecificAmounts) {
      return res.status(400).json({ 
        error: 'Either rebate_amount or model_specific_amounts must be provided',
        details: 'Please set a base rebate amount or configure model-specific amounts'
      });
    }

    const insertQuery = `
      INSERT INTO rebates (
        dealer_id, rebate_name, rebate_code, description, rebate_type,
        rebate_amount, amount_type, eligible_makes, eligible_models,
        eligible_years, eligible_trims, eligible_body_styles,
        eligible_vehicle_types, eligible_states, min_price, max_price,
        valid_from, valid_until, is_active, is_stackable, priority,
        max_applications, terms_and_conditions, requires_financing,
        requires_trade_in, model_specific_amounts, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *
    `;

    const result = await query(insertQuery, [
      dealerId, rebate_name, rebate_code, description, rebate_type,
      rebate_amount || 0, // Default to 0 if using model-specific amounts
      amount_type, eligible_makes, eligible_models,
      eligible_years, eligible_trims, eligible_body_styles,
      eligible_vehicle_types, eligible_states, min_price, max_price,
      valid_from, valid_until, is_active !== false, is_stackable !== false,
      priority || 0, max_applications, terms_and_conditions,
      requires_financing || false, requires_trade_in || false, 
      model_specific_amounts ? JSON.stringify(model_specific_amounts) : null, userId
    ]);

    console.log('✅ Rebate created:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create rebate error:', error);
    res.status(500).json({ error: 'Failed to create rebate' });
  }
});

/**
 * PUT /api/rebates/:id
 * Update rebate
 */
router.put('/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Check if rebate exists and belongs to dealer
    const checkQuery = `SELECT id FROM rebates WHERE id = $1 AND dealer_id = $2`;
    const checkResult = await query(checkQuery, [rebateId, dealerId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rebate not found' });
    }

    const {
      rebate_name, rebate_code, description, rebate_type,
      rebate_amount, amount_type, eligible_makes, eligible_models,
      eligible_years, eligible_trims, eligible_body_styles,
      eligible_vehicle_types, eligible_states, min_price, max_price,
      valid_from, valid_until, is_active, is_stackable,
      priority, max_applications, terms_and_conditions,
      requires_financing, requires_trade_in, model_specific_amounts
    } = req.body;

    const updateQuery = `
      UPDATE rebates SET
        rebate_name = COALESCE($1, rebate_name),
        rebate_code = COALESCE($2, rebate_code),
        description = COALESCE($3, description),
        rebate_type = COALESCE($4, rebate_type),
        rebate_amount = COALESCE($5, rebate_amount),
        amount_type = COALESCE($6, amount_type),
        eligible_makes = COALESCE($7, eligible_makes),
        eligible_models = COALESCE($8, eligible_models),
        eligible_years = COALESCE($9, eligible_years),
        eligible_trims = COALESCE($10, eligible_trims),
        eligible_body_styles = COALESCE($11, eligible_body_styles),
        eligible_vehicle_types = COALESCE($12, eligible_vehicle_types),
        eligible_states = COALESCE($13, eligible_states),
        min_price = COALESCE($14, min_price),
        max_price = COALESCE($15, max_price),
        valid_from = COALESCE($16, valid_from),
        valid_until = COALESCE($17, valid_until),
        is_active = COALESCE($18, is_active),
        is_stackable = COALESCE($19, is_stackable),
        priority = COALESCE($20, priority),
        max_applications = COALESCE($21, max_applications),
        terms_and_conditions = COALESCE($22, terms_and_conditions),
        requires_financing = COALESCE($23, requires_financing),
        requires_trade_in = COALESCE($24, requires_trade_in),
        model_specific_amounts = COALESCE($25, model_specific_amounts),
        updated_at = NOW()
      WHERE id = $26 AND dealer_id = $27
      RETURNING *
    `;

    const result = await query(updateQuery, [
      rebate_name, rebate_code, description, rebate_type,
      rebate_amount, amount_type, eligible_makes, eligible_models,
      eligible_years, eligible_trims, eligible_body_styles,
      eligible_vehicle_types, eligible_states, min_price, max_price,
      valid_from, valid_until, is_active, is_stackable,
      priority, max_applications, terms_and_conditions,
      requires_financing, requires_trade_in,
      model_specific_amounts ? JSON.stringify(model_specific_amounts) : null, 
      rebateId, dealerId
    ]);

    console.log('✅ Rebate updated:', rebateId);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update rebate error:', error);
    res.status(500).json({ error: 'Failed to update rebate' });
  }
});

/**
 * DELETE /api/rebates/:id
 * Delete rebate (soft delete - deactivate)
 */
router.delete('/:id', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Deactivate rebate instead of hard delete
    const updateQuery = `
      UPDATE rebates 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND dealer_id = $2
      RETURNING *
    `;

    const result = await query(updateQuery, [rebateId, dealerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rebate not found' });
    }

    console.log('✅ Rebate deactivated:', rebateId);
    res.json({ message: 'Rebate deactivated successfully' });
  } catch (error) {
    console.error('Delete rebate error:', error);
    res.status(500).json({ error: 'Failed to delete rebate' });
  }
});

/**
 * GET /api/rebates/:id/applied-vehicles
 * Get list of vehicles that have this rebate applied
 */
router.get('/:id/applied-vehicles', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehiclesQuery = `
      SELECT 
        v.id as vehicle_id,
        v.stock_number,
        v.make,
        v.model,
        v.trim,
        v.year,
        v.price,
        ra.applied_amount,
        ra.applied_at,
        ra.status
      FROM rebate_applications ra
      JOIN vehicles v ON ra.vehicle_id = v.id
      WHERE ra.rebate_id = $1 
        AND ra.dealer_id = $2
        AND ra.status = 'active'
      ORDER BY ra.applied_at DESC
    `;

    const result = await query(vehiclesQuery, [rebateId, dealerId]);

    res.json({
      vehicles: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Get applied vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch applied vehicles' });
  }
});

/**
 * GET /api/rebates/:id/debug-match
 * Debug why vehicles aren't matching rebate criteria
 */
router.get('/:id/debug-match', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Get rebate details
    const rebateQuery = `SELECT * FROM rebates WHERE id = $1 AND dealer_id = $2`;
    const rebateResult = await query(rebateQuery, [rebateId, dealerId]);
    
    if (rebateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rebate not found' });
    }
    
    const rebate = rebateResult.rows[0];
    
    // Get all vehicles that match the make
    const vehiclesQuery = `
      SELECT 
        id, stock_number, make, model, year, new_used, price, status,
        consumer_rebate, total_dealer_rebate
      FROM vehicles
      WHERE dealer_id = $1 
        AND make = ANY($2)
      ORDER BY model, year
    `;
    
    const vehiclesResult = await query(vehiclesQuery, [dealerId, rebate.eligible_makes]);
    
    // Check each vehicle against criteria
    const analysis = vehiclesResult.rows.map(vehicle => {
      const checks = {
        make_match: rebate.eligible_makes?.includes(vehicle.make) || !rebate.eligible_makes,
        year_match: !rebate.eligible_years || rebate.eligible_years.includes(vehicle.year),
        type_match: !rebate.eligible_vehicle_types || rebate.eligible_vehicle_types.includes(
          vehicle.new_used === 'N' ? 'new' : vehicle.new_used === 'U' ? 'used' : vehicle.new_used
        ),
        status_match: vehicle.status === 'available',
        price_match: (!rebate.min_price || vehicle.price >= parseFloat(rebate.min_price)) &&
                     (!rebate.max_price || vehicle.price <= parseFloat(rebate.max_price)),
        model_configured: !rebate.model_specific_amounts || 
                         (rebate.model_specific_amounts[vehicle.model]?.enabled === true)
      };
      
      const all_match = Object.values(checks).every(v => v);
      
      return {
        vehicle: {
          stock: vehicle.stock_number,
          model: vehicle.model,
          year: vehicle.year,
          type: vehicle.new_used,
          price: vehicle.price,
          status: vehicle.status
        },
        checks,
        eligible: all_match,
        model_amount: rebate.model_specific_amounts?.[vehicle.model]?.amount || rebate.rebate_amount
      };
    });
    
    res.json({
      rebate: {
        name: rebate.rebate_name,
        eligible_makes: rebate.eligible_makes,
        eligible_years: rebate.eligible_years,
        eligible_types: rebate.eligible_vehicle_types,
        model_specific_amounts: rebate.model_specific_amounts
      },
      total_vehicles: vehiclesResult.rows.length,
      eligible_vehicles: analysis.filter(a => a.eligible).length,
      analysis
    });
  } catch (error) {
    console.error('Debug match error:', error);
    res.status(500).json({ error: 'Failed to debug match' });
  }
});

/**
 * POST /api/rebates/:id/apply
 * Apply rebate to eligible vehicles
 */
router.post('/:id/apply', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;
    const userId = req.user.id;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('🔄 Applying rebate:', rebateId, 'for dealer:', dealerId, 'by user:', userId);

    // Use the PostgreSQL function to apply rebate
    const applyQuery = `
      SELECT * FROM apply_rebate_to_vehicles($1, $2, $3)
    `;

    console.log('📤 Executing query with params:', [rebateId, dealerId, userId]);
    const result = await query(applyQuery, [rebateId, dealerId, userId]);
    console.log('📥 Query returned', result.rows.length, 'rows');

    const summary = {
      total: result.rows.length,
      applied: result.rows.filter(r => r.ret_status === 'applied').length,
      already_applied: result.rows.filter(r => r.ret_status === 'already_applied').length,
      details: result.rows.map(r => ({
        vehicle_id: r.ret_vehicle_id,
        status: r.ret_status,
        amount: r.ret_amount,
        model: r.ret_model
      }))
    };

    console.log('✅ Rebate application completed:', summary);

    res.json({
      message: 'Rebate application completed',
      summary
    });
  } catch (error) {
    console.error('❌ Apply rebate error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    res.status(500).json({ 
      error: error.message || 'Failed to apply rebate',
      details: error.detail,
      hint: error.hint
    });
  }
});

/**
 * POST /api/rebates/:id/remove
 * Remove rebate from vehicles
 */
router.post('/:id/remove', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const rebateId = req.params.id;
    const userId = req.user.id;
    const { reason } = req.body;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    console.log('🔄 Removing rebate:', rebateId);

    // Get all active applications for this rebate
    const applicationsQuery = `
      SELECT ra.*, r.rebate_type
      FROM rebate_applications ra
      JOIN rebates r ON ra.rebate_id = r.id
      WHERE ra.rebate_id = $1 AND ra.dealer_id = $2 AND ra.status = 'active'
    `;
    const applications = await query(applicationsQuery, [rebateId, dealerId]);

    // Update each vehicle to remove the rebate amount
    for (const app of applications.rows) {
      if (app.rebate_type === 'consumer') {
        await query(`
          UPDATE vehicles
          SET consumer_rebate = GREATEST(COALESCE(consumer_rebate, 0) - $1, 0),
              total_customer_savings = GREATEST(COALESCE(total_customer_savings, 0) - $1, 0),
              updated_at = NOW()
          WHERE id = $2
        `, [app.applied_amount, app.vehicle_id]);
      } else if (app.rebate_type === 'dealer' || app.rebate_type === 'manufacturer') {
        await query(`
          UPDATE vehicles
          SET total_dealer_rebate = GREATEST(COALESCE(total_dealer_rebate, 0) - $1, 0),
              updated_at = NOW()
          WHERE id = $2
        `, [app.applied_amount, app.vehicle_id]);
      }

      // Mark application as removed
      await query(`
        UPDATE rebate_applications
        SET status = 'removed',
            removed_at = NOW(),
            removed_by = $1,
            removal_reason = $2
        WHERE id = $3
      `, [userId, reason, app.id]);
    }

    // Reset times_applied counter
    await query(`
      UPDATE rebates
      SET times_applied = 0,
          updated_at = NOW()
      WHERE id = $1
    `, [rebateId]);

    console.log('✅ Rebate removed from', applications.rows.length, 'vehicles');

    res.json({
      message: 'Rebate removed from vehicles',
      vehicles_updated: applications.rows.length
    });
  } catch (error) {
    console.error('Remove rebate error:', error);
    res.status(500).json({ error: 'Failed to remove rebate' });
  }
});

/**
 * GET /api/rebates/vehicle/:vehicleId/eligible
 * Get eligible rebates for a specific vehicle
 */
router.get('/vehicle/:vehicleId/eligible', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const vehicleId = req.params.vehicleId;

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const eligibleQuery = `
      SELECT * FROM get_eligible_rebates_for_vehicle($1, $2)
    `;

    const result = await query(eligibleQuery, [vehicleId, dealerId]);

    res.json({
      vehicle_id: vehicleId,
      eligible_rebates: result.rows
    });
  } catch (error) {
    console.error('Get eligible rebates error:', error);
    res.status(500).json({ error: 'Failed to fetch eligible rebates' });
  }
});

export default router;

