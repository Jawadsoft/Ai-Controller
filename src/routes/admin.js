import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply super admin middleware to all admin routes
router.use(requireSuperAdmin);

// Get all users with their roles and dealer info
router.get('/users', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        ur.role,
        d.business_name,
        d.contact_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealers d ON u.id = d.user_id
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.role || 'dealer',
      dealer: user.business_name ? {
        business_name: user.business_name,
        contact_name: user.contact_name
      } : null
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user
router.post('/users', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['super_admin', 'dealer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Start transaction
    await query('BEGIN');

    try {
      // Create user
      const userResult = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash]
      );
      const userId = userResult.rows[0].id;

      // Create user role
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, role]
      );

      await query('COMMIT');

      res.status(201).json({
        message: 'User created successfully',
        user: { id: userId, email, role }
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user role
router.put('/users/:id/role', [
  body('role').isIn(['super_admin', 'dealer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { role } = req.body;

    // Update user role
    const result = await query(
      'UPDATE user_roles SET role = $1 WHERE user_id = $2 RETURNING *',
      [role, id]
    );

    if (result.rows.length === 0) {
      // Insert if not exists
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [id, role]
      );
    }

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Start transaction
    await query('BEGIN');

    try {
      // Delete user role first (foreign key constraint)
      await query('DELETE FROM user_roles WHERE user_id = $1', [id]);
      
      // Delete dealer profile if exists
      await query('DELETE FROM dealers WHERE user_id = $1', [id]);
      
      // Delete user
      const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      await query('COMMIT');
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get admin stats
router.get('/stats', async (req, res) => {
  try {
    const [usersCount, dealersCount, vehiclesCount, leadsCount] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM dealers'),
      query('SELECT COUNT(*) as count FROM vehicles'),
      query('SELECT COUNT(*) as count FROM leads')
    ]);

    const superAdminsCount = await query(
      'SELECT COUNT(*) as count FROM user_roles WHERE role = $1',
      ['super_admin']
    );

    res.json({
      totalUsers: parseInt(usersCount.rows[0].count),
      totalDealers: parseInt(dealersCount.rows[0].count),
      totalVehicles: parseInt(vehiclesCount.rows[0].count),
      totalLeads: parseInt(leadsCount.rows[0].count),
      superAdmins: parseInt(superAdminsCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;