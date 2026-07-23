/**
 * Public Staff Routes — no authentication required.
 * Used by customers who scan a salesperson's QR code.
 */

import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// ── Helper: strip sensitive fields before sending to public ─────────────────
const publicFields = `
  ds.id,
  ds.dealer_id,
  ds.staff_role,
  ds.availability_status,
  ds.photo_url,
  ds.phone,
  ds.extension_number,
  ds.department,
  ds.location,
  ds.languages,
  ds.specialties,
  ds.years_with_company,
  ds.employee_id,
  u.name,
  d.business_name AS dealer_name,
  d.logo_url AS dealer_logo
`;

// GET /staff/public/qr/:hash
// Customer lands here after scanning a salesperson's QR code.
router.get('/qr/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    const result = await query(
      `SELECT ${publicFields}
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       JOIN dealers d ON ds.dealer_id = d.id
       WHERE ds.staff_qr_hash = $1 AND ds.is_active = true`,
      [hash]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found or QR code is invalid' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Public staff QR lookup error:', error);
    res.status(500).json({ error: 'Failed to fetch salesperson profile' });
  }
});

// GET /staff/public/:staffId
// Public profile page lookup by staff UUID.
router.get('/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;

    const result = await query(
      `SELECT ${publicFields}
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       JOIN dealers d ON ds.dealer_id = d.id
       WHERE ds.id = $1 AND ds.is_active = true`,
      [staffId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Public staff profile error:', error);
    res.status(500).json({ error: 'Failed to fetch salesperson profile' });
  }
});

// POST /staff/public/claim
// Customer claims a salesperson for their session (QR scan → attach).
// Body: { session_id, staff_qr_hash }
router.post('/claim', async (req, res) => {
  try {
    const { session_id, staff_qr_hash } = req.body;

    if (!session_id || !staff_qr_hash) {
      return res.status(400).json({ error: 'session_id and staff_qr_hash are required' });
    }

    // Look up the staff member
    const staffResult = await query(
      `SELECT ds.id, ds.dealer_id, u.name, ds.availability_status
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       WHERE ds.staff_qr_hash = $1 AND ds.is_active = true`,
      [staff_qr_hash]
    );

    if (staffResult.rows.length === 0) {
      return res.status(404).json({ error: 'Salesperson not found' });
    }

    const staff = staffResult.rows[0];

    // Check if this session already has a claim
    const existing = await query(
      `SELECT csc.id, csc.staff_id, u.name AS staff_name
       FROM customer_staff_claims csc
       JOIN dealership_staff ds ON csc.staff_id = ds.id
       JOIN users u ON ds.user_id = u.id
       WHERE csc.session_id = $1 AND csc.expires_at > NOW()`,
      [session_id]
    );

    if (existing.rows.length > 0) {
      const claimed = existing.rows[0];
      if (claimed.staff_id === staff.id) {
        // Same salesperson — re-confirm
        return res.json({
          success: true,
          message: `You are already connected to ${claimed.staff_name}`,
          staff_id: staff.id,
          staff_name: staff.name,
          dealer_id: staff.dealer_id,
          already_claimed: true
        });
      }
      // Different salesperson trying to claim — protect the original
      return res.status(409).json({
        error: 'already_claimed',
        message: `This customer is already connected to ${claimed.staff_name}`,
        claimed_by: claimed.staff_name
      });
    }

    // Create the claim
    await query(
      `INSERT INTO customer_staff_claims (session_id, staff_id, dealer_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE
         SET staff_id = $2, dealer_id = $3, claimed_at = NOW(),
             expires_at = NOW() + INTERVAL '8 hours'`,
      [session_id, staff.id, staff.dealer_id]
    );

    console.log(`🤝 Customer session ${session_id} claimed by salesperson ${staff.name} (${staff.id})`);

    res.json({
      success: true,
      message: `You are now connected to ${staff.name}`,
      staff_id: staff.id,
      staff_name: staff.name,
      dealer_id: staff.dealer_id
    });
  } catch (error) {
    console.error('Staff claim error:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// GET /staff/public/claim/:sessionId
// Check who (if anyone) a session is currently claimed by.
router.get('/claim/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await query(
      `SELECT csc.staff_id, u.name AS staff_name, ds.photo_url,
              ds.staff_role, ds.availability_status, csc.claimed_at
       FROM customer_staff_claims csc
       JOIN dealership_staff ds ON csc.staff_id = ds.id
       JOIN users u ON ds.user_id = u.id
       WHERE csc.session_id = $1 AND csc.expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.json({ claimed: false });
    }

    res.json({ claimed: true, ...result.rows[0] });
  } catch (error) {
    console.error('Claim check error:', error);
    res.status(500).json({ error: 'Failed to check claim' });
  }
});

export default router;
