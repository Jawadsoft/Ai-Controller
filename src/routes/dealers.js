import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get current dealer profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'SELECT * FROM dealers WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer profile not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get dealer profile error:', error);
    res.status(500).json({ error: 'Failed to fetch dealer profile' });
  }
});

// Update dealer profile
router.put('/profile', authenticateToken, [
  body('business_name').optional().notEmpty().trim(),
  body('contact_name').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const {
      business_name, contact_name, email, phone, address, city, state,
      zip_code, website, description, license_number, established_year
    } = req.body;
    
    const result = await query(
      `UPDATE dealers SET 
       business_name = COALESCE($1, business_name),
       contact_name = COALESCE($2, contact_name),
       email = COALESCE($3, email),
       phone = COALESCE($4, phone),
       address = COALESCE($5, address),
       city = COALESCE($6, city),
       state = COALESCE($7, state),
       zip_code = COALESCE($8, zip_code),
       website = COALESCE($9, website),
       description = COALESCE($10, description),
       license_number = COALESCE($11, license_number),
       established_year = COALESCE($12, established_year),
       updated_at = NOW()
       WHERE user_id = $13
       RETURNING *`,
      [business_name, contact_name, email, phone, address, city, state, 
       zip_code, website, description, license_number, established_year, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer profile not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update dealer profile error:', error);
    res.status(500).json({ error: 'Failed to update dealer profile' });
  }
});

// Get all dealers (super admin only)
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, u.email as user_email, ur.role 
       FROM dealers d 
       JOIN users u ON d.user_id = u.id 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       ORDER BY d.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get dealers error:', error);
    res.status(500).json({ error: 'Failed to fetch dealers' });
  }
});

// Get single dealer (super admin only)
router.get('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const dealerId = req.params.id;
    
    const result = await query(
      `SELECT d.*, u.email as user_email, ur.role 
       FROM dealers d 
       JOIN users u ON d.user_id = u.id 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       WHERE d.id = $1`,
      [dealerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get dealer error:', error);
    res.status(500).json({ error: 'Failed to fetch dealer' });
  }
});

// Update dealer (super admin only)
router.put('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const dealerId = req.params.id;
    const {
      business_name, contact_name, email, phone, address, city, state,
      zip_code, website, description, license_number, established_year,
      subscription_plan, subscription_status
    } = req.body;
    
    const result = await query(
      `UPDATE dealers SET 
       business_name = COALESCE($1, business_name),
       contact_name = COALESCE($2, contact_name),
       email = COALESCE($3, email),
       phone = COALESCE($4, phone),
       address = COALESCE($5, address),
       city = COALESCE($6, city),
       state = COALESCE($7, state),
       zip_code = COALESCE($8, zip_code),
       website = COALESCE($9, website),
       description = COALESCE($10, description),
       license_number = COALESCE($11, license_number),
       established_year = COALESCE($12, established_year),
       subscription_plan = COALESCE($13, subscription_plan),
       subscription_status = COALESCE($14, subscription_status),
       updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [business_name, contact_name, email, phone, address, city, state, 
       zip_code, website, description, license_number, established_year,
       subscription_plan, subscription_status, dealerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update dealer error:', error);
    res.status(500).json({ error: 'Failed to update dealer' });
  }
});

export default router;