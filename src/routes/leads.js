import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { sendNewLeadNotification } from '../lib/notificationHelper.js';

const router = express.Router();

// Get all leads for the authenticated dealer
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    let sqlQuery;
    let params;
    
    if (req.user.role === 'super_admin') {
      // Super admin can see all leads
      sqlQuery = `
        SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name
        FROM leads l 
        LEFT JOIN vehicles v ON l.vehicle_id = v.id 
        LEFT JOIN dealers d ON l.dealer_id = d.id 
        ORDER BY l.created_at DESC
      `;
      params = [];
    } else {
      // Regular dealers can only see their own leads
      sqlQuery = `
        SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name
        FROM leads l 
        LEFT JOIN vehicles v ON l.vehicle_id = v.id 
        LEFT JOIN dealers d ON l.dealer_id = d.id 
        WHERE d.user_id = $1 
        ORDER BY l.created_at DESC
      `;
      params = [userId];
    }
    
    const result = await query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead
router.get('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    
    let sqlQuery;
    let params;
    
    if (req.user.role === 'super_admin') {
      sqlQuery = `
        SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name
        FROM leads l 
        LEFT JOIN vehicles v ON l.vehicle_id = v.id 
        LEFT JOIN dealers d ON l.dealer_id = d.id 
        WHERE l.id = $1
      `;
      params = [leadId];
    } else {
      sqlQuery = `
        SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name
        FROM leads l 
        LEFT JOIN vehicles v ON l.vehicle_id = v.id 
        LEFT JOIN dealers d ON l.dealer_id = d.id 
        WHERE l.id = $1 AND d.user_id = $2
      `;
      params = [leadId, userId];
    }
    
    const result = await query(sqlQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead (public endpoint - no auth required)
router.post('/public', [
  body('vehicle_id').isUUID(),
  body('customer_name').notEmpty().trim(),
  body('customer_email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicle_id, customer_name, customer_email, customer_phone, message, interest_level = 'medium' } = req.body;
    
    // Get dealer ID from vehicle
    const vehicleResult = await query('SELECT dealer_id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const dealerId = vehicleResult.rows[0].dealer_id;
    
    const result = await query(
      `INSERT INTO leads 
       (dealer_id, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [dealerId, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, 'new']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create public lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Create new lead (authenticated)
router.post('/', [
  body('vehicle_id').isUUID(),
  body('customer_name').notEmpty().trim(),
  body('customer_email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { vehicle_id, customer_name, customer_email, customer_phone, message, interest_level = 'medium' } = req.body;
    
    // Get dealer ID for this user
    const dealerResult = await query('SELECT id FROM dealers WHERE user_id = $1', [userId]);
    if (dealerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer profile not found' });
    }
    
    const dealerId = dealerResult.rows[0].id;
    
    const result = await query(
      `INSERT INTO leads 
       (dealer_id, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [dealerId, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, 'new']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead
router.put('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    const { status, interest_level, message } = req.body;
    
    // Check if lead belongs to this dealer (unless super admin)
    let leadCheck;
    if (req.user.role === 'super_admin') {
      leadCheck = await query('SELECT id FROM leads WHERE id = $1', [leadId]);
    } else {
      leadCheck = await query(
        'SELECT l.id FROM leads l JOIN dealers d ON l.dealer_id = d.id WHERE l.id = $1 AND d.user_id = $2',
        [leadId, userId]
      );
    }
    
    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const result = await query(
      `UPDATE leads SET 
       status = COALESCE($1, status),
       interest_level = COALESCE($2, interest_level),
       message = COALESCE($3, message),
       updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, interest_level, message, leadId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Delete lead
router.delete('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    
    // Check if lead belongs to this dealer (unless super admin)
    let deleteQuery;
    let params;
    
    if (req.user.role === 'super_admin') {
      deleteQuery = 'DELETE FROM leads WHERE id = $1 RETURNING id';
      params = [leadId];
    } else {
      deleteQuery = `
        DELETE FROM leads 
        WHERE id = $1 AND dealer_id IN (
          SELECT id FROM dealers WHERE user_id = $2
        ) 
        RETURNING id
      `;
      params = [leadId, userId];
    }
    
    const result = await query(deleteQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

export default router;
