/**
 * Customer Management Routes
 * API endpoints for managing customers and generating application links from CRM
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../database/connection.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { attachTenantContext } from '../middleware/tenantIsolation.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import financeNotificationService from '../lib/financeNotificationService.js';

/** Ignore missing table/column so partial DBs still work */
async function runOptionalSql(client, sql, params, description = 'query') {
  try {
    await client.query(sql, params);
  } catch (e) {
    // 42P01 = undefined table, 42703 = undefined column - these are expected
    if (e.code === '42P01' || e.code === '42703') {
      console.log(`⚠️ Optional SQL ${description} skipped: ${e.code} - ${e.message}`);
      return;
    }
    // Any other error should be logged and re-thrown
    console.error(`❌ Error in ${description}:`, e.code, e.message);
    throw e;
  }
}

/**
 * Clear UUID FKs to this customer, then delete the row (matches dist behavior).
 */
async function deleteCustomerWithReferenceCleanup(poolConn, customerId) {
  const client = await poolConn.connect();
  try {
    console.log(`🗑️ Starting customer deletion for ID: ${customerId}`);
    await client.query('BEGIN');
    
    await runOptionalSql(
      client,
      'UPDATE credit_applications SET customer_id = NULL WHERE customer_id = $1',
      [customerId],
      'clear credit_applications FK'
    );
    await runOptionalSql(
      client,
      'UPDATE daive_conversations SET customer_id = NULL WHERE customer_id = $1',
      [customerId],
      'clear daive_conversations FK'
    );
    await runOptionalSql(
      client,
      'UPDATE customer_sessions SET customer_id = NULL WHERE customer_id = $1',
      [customerId],
      'clear customer_sessions FK'
    );
    await runOptionalSql(
      client,
      'UPDATE customer_leads SET customer_id = NULL WHERE customer_id = $1',
      [customerId],
      'clear customer_leads FK'
    );
    await runOptionalSql(
      client, 
      'DELETE FROM application_links WHERE customer_id = $1', 
      [customerId],
      'delete application_links'
    );
    
    console.log(`🗑️ Deleting customer record: ${customerId}`);
    const del = await client.query('DELETE FROM customers WHERE id = $1 RETURNING id', [customerId]);
    
    await client.query('COMMIT');
    console.log(`✅ Customer deleted successfully: ${customerId}`);
    return del;
  } catch (e) {
    console.error(`❌ Error during customer deletion transaction for ${customerId}:`, e);
    console.error(`Error details - Code: ${e.code}, Message: ${e.message}`);
    try {
      await client.query('ROLLBACK');
      console.log(`🔄 Transaction rolled back for customer ${customerId}`);
    } catch (rollbackError) {
      console.error(`❌ Error during rollback:`, rollbackError);
    }
    throw e;
  } finally {
    client.release();
  }
}

const router = express.Router();

// Require customer_management permission for all routes
router.use(requirePermission('customer_management'));

/** Only dealership staff admins (or super admin) may delete customer records */
function requireDealerAdminOrSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (req.user.role === 'super_admin') {
    return next();
  }
  if (req.user.staff_role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: 'Only dealership administrators can delete customers',
  });
}

/**
 * GET /api/customers
 * Get customers who have interacted with this dealer
 * Query params:
 *   - search: Search by email/name (optional)
 *   - all: If true, show all customers, not just those with interactions
 */
router.get('/', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    console.log('📋 GET /api/customers - Fetching customers');
    console.log('👤 User:', req.user?.id, req.user?.email);
    console.log('🏢 Dealer ID:', req.user?.dealer_id);

    const dealerId = req.user.dealer_id;
    const { search, all } = req.query;

    if (!dealerId) {
      console.log('❌ No dealer ID found for user');
      return res.status(400).json({
        success: false,
        error: 'Dealer context required'
      });
    }

    console.log('🔍 Querying customers for dealer:', dealerId, { search, all });

    let query;
    let params;

    if (all === 'true' || search) {
      // Show all customers (with optional search filter)
      query = `
        SELECT DISTINCT
          c.id,
          c.email,
          c.first_name,
          c.last_name,
          c.phone,
          c.created_at,
          c.last_login,
          COUNT(DISTINCT ca.id) FILTER (WHERE ca.dealer_id = $1) as application_count,
          MAX(ca.created_at) FILTER (WHERE ca.dealer_id = $1) as last_application_date
        FROM customers c
        LEFT JOIN credit_applications ca ON ca.customer_email = c.email
        WHERE 1=1
          ${search ? `AND (
            c.email ILIKE $2 
            OR c.first_name ILIKE $2 
            OR c.last_name ILIKE $2
            OR CONCAT(c.first_name, ' ', c.last_name) ILIKE $2
          )` : ''}
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 100
      `;
      params = search ? [dealerId, `%${search}%`] : [dealerId];
    } else {
      // Show only customers with interactions (credit applications only)
      // Note: DAIVE conversations join removed - add it later if customer_id column is added
      query = `
        SELECT DISTINCT
          c.id,
          c.email,
          c.first_name,
          c.last_name,
          c.phone,
          c.created_at,
          c.last_login,
          COUNT(DISTINCT ca.id) as application_count,
          MAX(ca.created_at) as last_application_date
        FROM customers c
        INNER JOIN credit_applications ca ON ca.customer_email = c.email 
          AND ca.dealer_id = $1
        GROUP BY c.id
        ORDER BY MAX(ca.created_at) DESC
      `;
      params = [dealerId];
    }

    const result = await pool.query(query, params);

    console.log('✅ Found', result.rows.length, 'customers');

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching customers:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      message: error.message
    });
  }
});

/**
 * DELETE /api/customers/:customerId
 * Permanently remove a customer (dealership staff admin or super admin only).
 * Authorization is the admin gate above; any existing customer row may be removed.
 */
router.delete(
  '/:customerId',
  authenticateToken,
  attachTenantContext,
  requireDealerAdminOrSuperAdmin,
  async (req, res) => {
    try {
      const { customerId } = req.params;
      const dealerId = req.user.dealer_id;
      // Accept any well-formed UUID (any version/variant) — PostgreSQL validates further
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(customerId)) {
        return res.status(400).json({ success: false, error: 'Invalid customer id' });
      }
      if (!dealerId && req.user.role !== 'super_admin') {
        return res.status(400).json({ success: false, error: 'Dealer context required' });
      }

      const found = await pool.query('SELECT id FROM customers WHERE id = $1', [customerId]);
      if (found.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }

      const del = await deleteCustomerWithReferenceCleanup(pool, customerId);
      if (del.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }

      res.json({ success: true, message: 'Customer deleted', data: { id: del.rows[0].id } });
    } catch (error) {
      console.error('Error deleting customer:', error);
      console.error('Error stack:', error.stack);
      
      if (error.code === '23503') {
        return res.status(409).json({
          success: false,
          error:
            'This customer is still referenced by another table. If this persists, contact support.',
          detail: error.detail || null,
          constraint: error.constraint || null,
        });
      }
      
      if (error.code === '25P02') {
        return res.status(500).json({
          success: false,
          error: 'Database transaction error. Please try again.',
          message: process.env.NODE_ENV === 'development' ? 'Transaction was aborted due to a previous error: ' + error.message : undefined,
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete customer',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: error.code
      });
    }
  }
);

/**
 * POST /api/customers/:customerId/generate-link
 * Generate a shareable application link for a customer
 */
router.post('/:customerId/generate-link', 
  authenticateToken, 
  attachTenantContext,
  [
    body('vehicleId').optional().isUUID(),
    body('expiresIn').optional().isInt({ min: 1, max: 8760 }), // Max 1 year
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { customerId } = req.params;
      const { vehicleId, expiresIn } = req.body; // expiresIn in hours
      const dealerId = req.user.dealer_id;
      const userId = req.user.id;

      // Verify customer exists (customers are public, not tied to dealers)
      const customerCheck = await pool.query(
        'SELECT id, email, first_name, last_name, phone FROM customers WHERE id = $1',
        [customerId]
      );

      if (customerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      const customer = customerCheck.rows[0];

      // If vehicleId provided, verify it exists and belongs to dealer
      if (vehicleId) {
        const vehicleCheck = await pool.query(
          'SELECT id FROM vehicles WHERE id = $1 AND dealer_id = $2',
          [vehicleId, dealerId]
        );

        if (vehicleCheck.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Vehicle not found'
          });
        }
      }

      // Generate unique token for this link
      const linkToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) 
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      // Store link token
      const linkResult = await pool.query(`
        INSERT INTO application_links (
          id, dealer_id, customer_id, vehicle_id, token, expires_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        uuidv4(),
        dealerId,
        customerId,
        vehicleId || null,
        linkToken,
        expiresAt,
        userId
      ]);

      // Generate link
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = vehicleId
        ? `${baseUrl}/#/apply/${vehicleId}?token=${linkToken}`
        : `${baseUrl}/#/apply?token=${linkToken}`;

      console.log('✅ Application link generated:', {
        linkId: linkResult.rows[0].id,
        customer: customer.email,
        vehicleId: vehicleId || 'none',
        expiresAt
      });

      res.json({
        success: true,
        data: {
          link,
          token: linkToken,
          expiresAt,
          customer: {
            id: customer.id,
            email: customer.email,
            name: `${customer.first_name} ${customer.last_name}`,
            phone: customer.phone
          }
        }
      });
    } catch (error) {
      console.error('Error generating link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate link'
      });
    }
  }
);

/**
 * POST /api/customers/:customerId/send-link
 * Generate and send application link via email/SMS
 */
router.post('/:customerId/send-link',
  authenticateToken,
  attachTenantContext,
  [
    body('vehicleId').optional().isUUID(),
    body('expiresIn').optional().isInt({ min: 1, max: 8760 }),
    body('method').isIn(['email', 'sms', 'both']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { customerId } = req.params;
      const { vehicleId, expiresIn, method } = req.body;
      const dealerId = req.user.dealer_id;
      const userId = req.user.id;

      // Get customer details (customers are public, not tied to dealers)
      const customerCheck = await pool.query(
        'SELECT id, email, first_name, last_name, phone FROM customers WHERE id = $1',
        [customerId]
      );

      if (customerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      const customer = customerCheck.rows[0];

      // Generate link token
      const linkToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) 
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Store link
      await pool.query(`
        INSERT INTO application_links (
          id, dealer_id, customer_id, vehicle_id, token, expires_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(),
        dealerId,
        customerId,
        vehicleId || null,
        linkToken,
        expiresAt,
        userId
      ]);

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = vehicleId
        ? `${baseUrl}/#/apply/${vehicleId}?token=${linkToken}`
        : `${baseUrl}/#/apply?token=${linkToken}`;

      // Get dealer settings for notifications
      const dealerSettings = await financeNotificationService.getDealerSettings(dealerId);

      // Send via email
      if (method === 'email' || method === 'both') {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { background: #f9fafb; padding: 30px; }
              .button { 
                display: inline-block; 
                background: #2563eb; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
              }
              .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚗 Vehicle Financing Application</h1>
              </div>
              <div class="content">
                <p>Hi ${customer.first_name},</p>
                <p>We're excited to help you with your vehicle financing!</p>
                <p>Click the button below to complete your credit application:</p>
                <p style="text-align: center;">
                  <a href="${link}" class="button">Complete Application</a>
                </p>
                <p><strong>Link expires:</strong> ${new Date(expiresAt).toLocaleString()}</p>
                <p>If you have any questions, please don't hesitate to contact us.</p>
                <p>Best regards,<br>${dealerSettings?.dealerName || 'Your Dealer'}</p>
              </div>
              <div class="footer">
                <p>This link is unique to you and will expire after use.</p>
                <p>${dealerSettings?.dealerName || 'Your Dealer'} | ${dealerSettings?.dealerPhone || ''}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await financeNotificationService.sendEmail(
          customer.email,
          '🚗 Complete Your Vehicle Financing Application',
          emailHtml,
          dealerId
        );
      }

      // Send via SMS
      if ((method === 'sms' || method === 'both') && customer.phone) {
        const smsMessage = `Hi ${customer.first_name}, complete your vehicle financing application here: ${link} - ${dealerSettings?.dealerName}`;
        await financeNotificationService.sendSMS(
          customer.phone,
          smsMessage,
          dealerId
        );
      }

      res.json({
        success: true,
        message: `Application link sent via ${method}`,
        data: {
          link,
          expiresAt
        }
      });
    } catch (error) {
      console.error('Error sending link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send link'
      });
    }
  }
);

/**
 * GET /api/customers/links
 * Get all application links for the dealer
 */
router.get('/links', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;

    const result = await pool.query(`
      SELECT 
        al.id,
        al.token,
        al.expires_at,
        al.used_at,
        al.created_at,
        c.first_name,
        c.last_name,
        c.email,
        v.year,
        v.make,
        v.model,
        u.email as created_by_email
      FROM application_links al
      JOIN customers c ON al.customer_id = c.id
      LEFT JOIN vehicles v ON al.vehicle_id = v.id
      LEFT JOIN users u ON al.created_by = u.id
      WHERE al.dealer_id = $1
      ORDER BY al.created_at DESC
      LIMIT 100
    `, [dealerId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch links'
    });
  }
});

export default router;

