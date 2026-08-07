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
      zip_code, website, description, license_number, established_year, opening_hours
    } = req.body;
    
    // If email is being updated, update it in both dealers and users tables
    if (email) {
      // Check if email is already taken by another user
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
      
      // Update user's email in users table
      await query(
        'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2',
        [email, userId]
      );
    }
    
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
       opening_hours = COALESCE($13, opening_hours),
       updated_at = NOW()
       WHERE user_id = $14
       RETURNING *`,
      [business_name, contact_name, email, phone, address, city, state, 
       zip_code, website, description, license_number, established_year,
       opening_hours ? JSON.stringify(opening_hours) : null, userId]
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

// Dealer self-activates Marbalism AI
router.post('/activate-marbalism', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) {
      return res.status(400).json({ error: 'No dealer profile found for this user' });
    }

    const result = await query(
      `UPDATE dealers
       SET marbalism_ai_enabled = true,
           marbalism_ai_activated_at = COALESCE(marbalism_ai_activated_at, NOW()),
           marbalism_ai_deactivated_by = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, marbalism_ai_enabled, marbalism_ai_activated_at`,
      [dealerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json({
      success: true,
      marbalism_ai_enabled: result.rows[0].marbalism_ai_enabled,
      marbalism_ai_activated_at: result.rows[0].marbalism_ai_activated_at
    });
  } catch (error) {
    console.error('Activate Marbalism AI error:', error);
    res.status(500).json({ error: 'Failed to activate Marbalism AI' });
  }
});

// Dealer checks their Marbalism AI status
router.get('/marbalism-status', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) {
      return res.status(400).json({ error: 'No dealer profile found for this user' });
    }

    const result = await query(
      `SELECT id, marbalism_ai_enabled, marbalism_ai_activated_at
       FROM dealers WHERE id = $1`,
      [dealerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Marbalism status error:', error);
    res.status(500).json({ error: 'Failed to fetch Marbalism AI status' });
  }
});

/**
 * Dashboard charts: dealership user logins (7d) + finance / credit application aggregates.
 * Dealer owner and staff (req.user.dealer_id) only.
 */
router.get('/dashboard-insights', authenticateToken, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    if (!dealerId) {
      return res.status(403).json({ success: false, error: 'Dealer context required' });
    }

    let loginActivity = [];
    try {
      const loginResult = await query(
        `WITH dealer_users AS (
          SELECT d.user_id AS uid FROM dealers d WHERE d.id = $1
          UNION
          SELECT ds.user_id AS uid FROM dealership_staff ds
          WHERE ds.dealer_id = $1 AND COALESCE(ds.is_active, true) = true
        ),
        days AS (
          SELECT generate_series(
            (CURRENT_DATE - INTERVAL '6 days')::date,
            CURRENT_DATE::date,
            INTERVAL '1 day'
          )::date AS day
        ),
        daily AS (
          SELECT (u.last_login_at::date) AS d, COUNT(*)::int AS c
          FROM users u
          WHERE u.id IN (SELECT uid FROM dealer_users)
            AND u.last_login_at IS NOT NULL
            AND u.last_login_at >= (CURRENT_DATE - INTERVAL '7 days')
          GROUP BY 1
        )
        SELECT
          to_char(days.day, 'Mon DD') AS label,
          days.day AS sort_key,
          COALESCE(daily.c, 0) AS logins
        FROM days
        LEFT JOIN daily ON daily.d = days.day
        ORDER BY days.day`,
        [dealerId]
      );
      loginActivity = loginResult.rows.map((r) => ({
        date: r.label,
        logins: Number(r.logins) || 0,
      }));
    } catch (loginErr) {
      console.warn('dashboard-insights login series:', loginErr?.message || loginErr);
    }

    let financeByStatus = [];
    let financeMonthly = [];
    try {
      const statusRes = await query(
        `SELECT COALESCE(NULLIF(TRIM(application_status), ''), 'unknown') AS status, COUNT(*)::int AS value
         FROM credit_applications
         WHERE dealer_id = $1
         GROUP BY 1
         ORDER BY value DESC`,
        [dealerId]
      );
      financeByStatus = statusRes.rows.map((r) => {
        const raw = (r.status || 'unknown').toString();
        const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        return { name: label, value: Number(r.value) || 0 };
      });

      const monthlyRes = await query(
        `SELECT
           to_char(date_trunc('month', COALESCE(submitted_at, created_at)), 'Mon YYYY') AS month,
           date_trunc('month', COALESCE(submitted_at, created_at)) AS sort_ts,
           COUNT(*)::int AS applications
         FROM credit_applications
         WHERE dealer_id = $1
           AND COALESCE(submitted_at, created_at) >= NOW() - INTERVAL '14 months'
         GROUP BY date_trunc('month', COALESCE(submitted_at, created_at))
         ORDER BY sort_ts ASC
         LIMIT 10`,
        [dealerId]
      );
      financeMonthly = monthlyRes.rows.map((r) => ({
        month: r.month,
        applications: Number(r.applications) || 0,
      }));
    } catch (finErr) {
      console.warn('dashboard-insights finance:', finErr?.message || finErr);
    }

    res.json({
      success: true,
      loginActivity,
      financeByStatus,
      financeMonthly,
    });
  } catch (error) {
    console.error('dashboard-insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard insights',
      message: error.message,
    });
  }
});

export default router;