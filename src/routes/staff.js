import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../database/connection.js';
import { authenticateToken, requireDealerAccess, requireStaffRole, requirePermission } from '../middleware/auth.js';
import emailService from '../lib/emailService.js';

const router = express.Router();

// ── Photo upload storage ─────────────────────────────────────────────────────
const staffPhotosDir = 'uploads/staff-photos';
if (!fs.existsSync(staffPhotosDir)) fs.mkdirSync(staffPhotosDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, staffPhotosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `staff-${req.params.staffId}-${Date.now()}${ext}`);
  }
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireDealerAccess);

// Check for staff management permission for all routes
const requireStaffManagement = async (req, res, next) => {
  try {
    // Super admin should NOT manage individual dealership staff
    // Staff management is dealer-specific only
    
    // Check if user has admin staff role
    if (req.user.staff_role === 'admin') {
      return next();
    }

    // Check permission using database function
    const result = await query(
      'SELECT user_has_permission($1, $2) as has_permission',
      [req.user.id, 'staff_management']
    );

    if (!result.rows[0].has_permission) {
      return res.status(403).json({ error: 'Staff management permission required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

router.use(requireStaffManagement);

// Check if admin exists for current dealer
router.get('/admin-exists', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        ds.id,
        u.email,
        u.name,
        ds.created_at
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       WHERE ds.dealer_id = $1 AND ds.staff_role = 'admin' AND ds.is_active = true`,
      [req.user.dealer_id]
    );

    res.json({ 
      adminExists: result.rows.length > 0,
      admin: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error checking admin existence:', error);
    res.status(500).json({ error: 'Failed to check admin existence' });
  }
});

// Get all staff members for current dealer
router.get('/', async (req, res) => {
  try {
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dl = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dl.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const result = await query(
      `SELECT 
        ds.*,
        u.email,
        u.name,
        u.created_at as user_created_at,
        creator.email as created_by_email
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       LEFT JOIN users creator ON ds.created_by = creator.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE ds.dealer_id = $1
         AND (ur.role IS NULL OR ur.role != 'super_admin')
       ORDER BY ds.created_at DESC`,
      [dealerId]
    );

    res.json({ staff: result.rows });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// Get specific staff member
router.get('/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;

    const result = await query(
      `SELECT 
        ds.*,
        u.email,
        u.name,
        u.created_at as user_created_at,
        creator.email as created_by_email
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       LEFT JOIN users creator ON ds.created_by = creator.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE ds.id = $1 
         AND ds.dealer_id = $2
         AND (ur.role IS NULL OR ur.role != 'super_admin')`,
      [staffId, req.user.dealer_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ staff: result.rows[0] });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// Create new staff member
router.post('/', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('staff_role').custom(async (value) => {
    // Check if role exists in roles table
    const roleCheck = await query('SELECT id FROM roles WHERE name = $1', [value]);
    if (roleCheck.rows.length === 0) {
      throw new Error('Invalid role - role does not exist');
    }
    return true;
  }),
  body('permissions').optional().isArray(),
  body('name').optional().isLength({ min: 2, max: 255 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, staff_role, permissions = [], name } = req.body;

    // Resolve dealer_id robustly for both dealer owners and staff
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dealerLookup = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dealerLookup.rows[0]?.id || null;
    }

    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required to create staff' });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // For all roles, multiple staff are allowed
    console.log('Creating staff member with role:', staff_role, 'for dealer_id:', dealerId);

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Start transaction
    await query('BEGIN');

    try {
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      // Create user with verification token
      const userResult = await query(
        `INSERT INTO users (email, password_hash, name, email_verified, verification_token, verification_token_expires) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [email, passwordHash, name || email.split('@')[0], false, verificationToken, tokenExpiry]
      );
      const userId = userResult.rows[0].id;

      // Create user role
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [userId, 'dealer']
      );

      // Create staff member
      console.log('About to insert staff member with values:', {
        dealer_id: dealerId,
        user_id: userId,
        staff_role: staff_role,
        permissions: permissions,
        created_by: req.user.id
      });
      
      const staffResult = await query(
        `INSERT INTO dealership_staff (
          dealer_id, 
          user_id, 
          staff_role, 
          permissions, 
          created_by
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [dealerId, userId, staff_role, permissions, req.user.id]
      );

      // Insert default permissions for the role
      const defaultPermissions = getDefaultPermissions(staff_role);
      for (const permission of defaultPermissions) {
        await query(
          'INSERT INTO staff_permissions (staff_id, permission_name, permission_value) VALUES ($1, $2, $3)',
          [staffResult.rows[0].id, permission, true]
        );
      }

      await query('COMMIT');

      // Send staff invitation email with credentials and verification link
      try {
        // Get dealer business name
        const dealerResult = await query(
          'SELECT business_name FROM dealers WHERE id = $1',
          [dealerId]
        );
        const businessName = dealerResult.rows[0]?.business_name || 'Your Dealership';
        
        // Format role name for display
        const roleDisplayName = staff_role.charAt(0).toUpperCase() + staff_role.slice(1);
        
        await emailService.sendStaffInvitationEmail(
          email,
          name || email.split('@')[0],
          password, // Send the plain password (user needs it to login)
          roleDisplayName,
          businessName,
          verificationToken
        );
        console.log(`📧 Invitation email with verification link sent to ${email}`);
      } catch (emailError) {
        console.error('⚠️ Failed to send invitation email:', emailError);
        // Don't fail the request if email fails - staff is already created
      }

      res.status(201).json({
        message: 'Staff member created successfully. Verification email sent.',
        staff: staffResult.rows[0],
        emailSent: true,
        requiresVerification: true
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating staff member:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.status(500).json({ 
      error: 'Failed to create staff member',
      details: error.message,
      code: error.code
    });
  }
});

// Update staff member
router.put('/:staffId', [
  body('staff_role').optional().custom(async (value) => {
    if (value) {
      // Check if role exists in roles table
      const roleCheck = await query('SELECT id FROM roles WHERE name = $1', [value]);
      if (roleCheck.rows.length === 0) {
        throw new Error('Invalid role - role does not exist');
      }
    }
    return true;
  }),
  body('permissions').optional().isArray(),
  body('is_active').optional().isBoolean(),
  body('name').optional().isLength({ min: 2, max: 255 }),
  body('password').optional().isLength({ min: 6 }),
  body('sendEmail').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { staffId } = req.params;
    const { staff_role, permissions, is_active, name, password, sendEmail } = req.body;

    // Resolve dealer ID — dealer owners don't have dealer_id in their token
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dl = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dl.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    // Verify staff member belongs to current dealer AND is not super admin
    const staffCheck = await query(
      `SELECT ds.id, ur.role as user_role
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE ds.id = $1 AND ds.dealer_id = $2`,
      [staffId, dealerId]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Prevent editing super admin
    if (staffCheck.rows[0].user_role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot edit super admin account' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Update staff member
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (staff_role !== undefined) {
        updateFields.push(`staff_role = $${paramCount++}`);
        updateValues.push(staff_role);
      }

      if (permissions !== undefined) {
        updateFields.push(`permissions = $${paramCount++}`);
        updateValues.push(permissions);
      }

      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramCount++}`);
        updateValues.push(is_active);
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(staffId);

      const result = await query(
        `UPDATE dealership_staff 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramCount} AND dealer_id = $${paramCount + 1}
         RETURNING *`,
        [...updateValues, dealerId]
      );

      if (result.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Staff member not found' });
      }

      // Update user name if provided
      if (name !== undefined) {
        await query(
          'UPDATE users SET name = $1 WHERE id = $2',
          [name, result.rows[0].user_id]
        );
      }

      // Update password if provided
      let updatedPassword = null;
      if (password !== undefined && password.length > 0) {
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [passwordHash, result.rows[0].user_id]
        );
        updatedPassword = password; // Store plain password for email
        console.log(`🔐 Password updated for user: ${result.rows[0].user_id}`);
      }

      // Update permissions if staff role changed
      if (staff_role !== undefined) {
        // Clear existing permissions
        await query(
          'DELETE FROM staff_permissions WHERE staff_id = $1',
          [staffId]
        );

        // Insert new default permissions
        const defaultPermissions = getDefaultPermissions(staff_role);
        for (const permission of defaultPermissions) {
          await query(
            'INSERT INTO staff_permissions (staff_id, permission_name, permission_value) VALUES ($1, $2, $3)',
            [staffId, permission, true]
          );
        }
      }

      await query('COMMIT');

      // Send email notification if password was changed and sendEmail is true
      let emailSent = false;
      if (updatedPassword && sendEmail) {
        try {
          // Get user and dealer information
          const userInfo = await query(
            `SELECT u.email, u.name, d.business_name, ds.staff_role
             FROM users u
             JOIN dealership_staff ds ON u.id = ds.user_id
             JOIN dealers d ON ds.dealer_id = d.id
             WHERE u.id = $1`,
            [result.rows[0].user_id]
          );

          if (userInfo.rows.length > 0) {
            const user = userInfo.rows[0];
            const roleDisplayName = staff_role ? (staff_role.charAt(0).toUpperCase() + staff_role.slice(1)) : user.staff_role;
            
            await emailService.sendPasswordResetEmail(
              user.email,
              user.name || user.email.split('@')[0],
              updatedPassword,
              roleDisplayName,
              user.business_name
            );
            emailSent = true;
            console.log(`📧 Password reset email sent to ${user.email}`);
          }
        } catch (emailError) {
          console.error('⚠️ Failed to send password reset email:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.json({
        message: 'Staff member updated successfully',
        staff: result.rows[0],
        emailSent: emailSent
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// Delete staff member
router.delete('/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;

    // Resolve dealer ID — dealer owners don't have dealer_id in their token
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dl = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dl.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    // Verify staff member belongs to current dealer AND is not super admin
    const staffCheck = await query(
      `SELECT ds.id, ds.user_id, u.email, ur.role as user_role
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE ds.id = $1 AND ds.dealer_id = $2`,
      [staffId, dealerId]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const staff = staffCheck.rows[0];

    // Prevent deleting super admin
    if (staff.user_role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin account' });
    }

    // Start transaction for complete deletion
    await query('BEGIN');

    try {
      // 1. Delete from staff_permissions (will be cascaded, but explicit is safer)
      await query('DELETE FROM staff_permissions WHERE staff_id = $1', [staffId]);
      console.log(`✅ Deleted permissions for staff: ${staff.email}`);

      // 2. Delete from dealership_staff
      await query('DELETE FROM dealership_staff WHERE id = $1', [staffId]);
      console.log(`✅ Deleted dealership_staff record for: ${staff.email}`);

      // 3. Delete from user_roles
      await query('DELETE FROM user_roles WHERE user_id = $1', [staff.user_id]);
      console.log(`✅ Deleted user_roles for: ${staff.email}`);

      // 4. Delete from users (this is the main user record)
      await query('DELETE FROM users WHERE id = $1', [staff.user_id]);
      console.log(`✅ Deleted user record for: ${staff.email}`);

      await query('COMMIT');
      console.log(`🎉 Completely deleted staff member: ${staff.email}`);

      res.json({ 
        message: 'Staff member and user account deleted successfully',
        email: staff.email 
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ 
      error: 'Failed to delete staff member',
      details: error.message 
    });
  }
});

// Get staff permissions
router.get('/:staffId/permissions', async (req, res) => {
  try {
    const { staffId } = req.params;

    // Verify staff member belongs to current dealer
    const staffCheck = await query(
      'SELECT id FROM dealership_staff WHERE id = $1 AND dealer_id = $2',
      [staffId, req.user.dealer_id]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const result = await query(
      'SELECT permission_name, permission_value FROM staff_permissions WHERE staff_id = $1',
      [staffId]
    );

    res.json({ permissions: result.rows });
  } catch (error) {
    console.error('Error fetching staff permissions:', error);
    res.status(500).json({ error: 'Failed to fetch staff permissions' });
  }
});

// Update staff permissions
router.put('/:staffId/permissions', [
  body('permissions').isArray(),
  body('permissions.*.permission_name').isString(),
  body('permissions.*.permission_value').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { staffId } = req.params;
    const { permissions } = req.body;

    // Verify staff member belongs to current dealer
    const staffCheck = await query(
      'SELECT id FROM dealership_staff WHERE id = $1 AND dealer_id = $2',
      [staffId, req.user.dealer_id]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Clear existing permissions
      await query(
        'DELETE FROM staff_permissions WHERE staff_id = $1',
        [staffId]
      );

      // Insert new permissions
      for (const permission of permissions) {
        await query(
          'INSERT INTO staff_permissions (staff_id, permission_name, permission_value) VALUES ($1, $2, $3)',
          [staffId, permission.permission_name, permission.permission_value]
        );
      }

      await query('COMMIT');

      res.json({ message: 'Staff permissions updated successfully' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating staff permissions:', error);
    res.status(500).json({ error: 'Failed to update staff permissions' });
  }
});

// ── Photo Upload ──────────────────────────────────────────────────────────────

// POST /staff/:staffId/photo  — upload a profile photo
router.post('/:staffId/photo', (req, res, next) => {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { staffId } = req.params;

    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dl = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dl.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const staffCheck = await query(
      'SELECT ds.id, ds.photo_url FROM dealership_staff ds WHERE ds.id = $1 AND ds.dealer_id = $2',
      [staffId, dealerId]
    );
    if (staffCheck.rows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    if (!req.file) return res.status(400).json({ error: 'No photo file uploaded' });

    // Remove old photo file if it exists
    const oldUrl = staffCheck.rows[0].photo_url;
    if (oldUrl && oldUrl.startsWith('/uploads/staff-photos/')) {
      const oldPath = oldUrl.replace('/uploads/', 'uploads/');
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const photoUrl = `/uploads/staff-photos/${req.file.filename}`;
    await query('UPDATE dealership_staff SET photo_url = $1 WHERE id = $2', [photoUrl, staffId]);

    res.json({ success: true, photo_url: photoUrl });
  } catch (error) {
    console.error('Staff photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ── QR Code Generation ────────────────────────────────────────────────────────

// POST /staff/:staffId/generate-qr  — create or regenerate a unique QR hash
router.post('/:staffId/generate-qr', async (req, res) => {
  try {
    const { staffId } = req.params;

    // Resolve dealer_id (handles dealer owners whose dealer_id may not be on req.user directly)
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dealerLookup = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dealerLookup.rows[0]?.id || null;
    }
    if (!dealerId) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    // Verify the staff member belongs to this dealer
    const staffCheck = await query(
      'SELECT ds.id FROM dealership_staff ds WHERE ds.id = $1 AND ds.dealer_id = $2',
      [staffId, dealerId]
    );
    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const newHash = crypto.randomBytes(16).toString('hex');

    await query(
      'UPDATE dealership_staff SET staff_qr_hash = $1 WHERE id = $2',
      [newHash, staffId]
    );

    res.json({ success: true, staff_qr_hash: newHash });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// PUT /staff/:staffId/profile  — update extended profile fields
router.put('/:staffId/profile', async (req, res) => {
  try {
    const { staffId } = req.params;
    const {
      phone,
      extension_number,
      department,
      location,
      languages,
      specialties,
      years_with_company,
      employee_id,
      availability_status,
      photo_url
    } = req.body;

    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dealerLookup = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dealerLookup.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const staffCheck = await query(
      'SELECT ds.id FROM dealership_staff ds WHERE ds.id = $1 AND ds.dealer_id = $2',
      [staffId, dealerId]
    );
    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await query(
      `UPDATE dealership_staff SET
        phone = COALESCE($1, phone),
        extension_number = COALESCE($2, extension_number),
        department = COALESCE($3, department),
        location = COALESCE($4, location),
        languages = COALESCE($5, languages),
        specialties = COALESCE($6, specialties),
        years_with_company = COALESCE($7, years_with_company),
        employee_id = COALESCE($8, employee_id),
        availability_status = COALESCE($9, availability_status),
        photo_url = COALESCE($10, photo_url)
       WHERE id = $11`,
      [phone, extension_number, department, location,
       languages, specialties, years_with_company,
       employee_id, availability_status, photo_url, staffId]
    );

    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('Update staff profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /staff/:staffId/qr-info  — return QR hash + profile data for the card UI
router.get('/:staffId/qr-info', async (req, res) => {
  try {
    const { staffId } = req.params;

    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dealerLookup = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dealerLookup.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const result = await query(
      `SELECT ds.id, ds.staff_qr_hash, ds.photo_url, ds.phone, ds.extension_number,
              ds.department, ds.location, ds.languages, ds.specialties,
              ds.years_with_company, ds.employee_id, ds.availability_status,
              u.name, u.email
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       WHERE ds.id = $1 AND ds.dealer_id = $2`,
      [staffId, dealerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get QR info error:', error);
    res.status(500).json({ error: 'Failed to fetch QR info' });
  }
});

// ── My Active Customers ───────────────────────────────────────────────────────

// GET /staff/:staffId/active-customers
// Returns customers who scanned this salesperson's QR today + their conversation status.
router.get('/:staffId/active-customers', authenticateToken, async (req, res) => {
  try {
    const { staffId } = req.params;

    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dl = await query('SELECT id FROM dealers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      dealerId = dl.rows[0]?.id || null;
    }
    if (!dealerId) return res.status(403).json({ error: 'Dealer access required' });

    const result = await query(
      `SELECT
         csc.session_id,
         csc.claimed_at,
         csc.expires_at,
         dc.id              AS conversation_id,
         dc.customer_name,
         dc.customer_email,
         dc.customer_phone,
         dc.vehicle_id,
         dc.updated_at      AS last_active,
         v.make, v.model, v.year,
         (SELECT content FROM conversation_messages
          WHERE conversation_id = dc.id AND role = 'user'
          ORDER BY created_at DESC LIMIT 1)  AS last_message,
         (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = dc.id AND role = 'user') AS message_count
       FROM customer_staff_claims csc
       LEFT JOIN daive_conversations dc
         ON dc.session_id = csc.session_id
       LEFT JOIN vehicles v ON v.id = dc.vehicle_id
       WHERE csc.staff_id = $1
         AND csc.dealer_id = $2
         AND csc.expires_at > NOW()
       ORDER BY COALESCE(dc.updated_at, csc.claimed_at) DESC`,
      [staffId, dealerId]
    );

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('Active customers error:', error);
    res.status(500).json({ error: 'Failed to fetch active customers' });
  }
});

// ── Helper function to get default permissions for each role ─────────────────
function getDefaultPermissions(staffRole) {
  const rolePermissions = {
    'admin': [
      'qr_code_generation',
      'lead_management',
      'vehicle_import',
      'analytics_dashboard',
      'bulk_actions',
      'staff_management',
      'user_management',
      'custom_branding',
      'api_access',
      'priority_support',
      'marbalism_ai'
    ],
    'sales': [
      'qr_code_generation',
      'lead_management',
      'vehicle_import'
    ],
    'finance': [
      'lead_management',
      'analytics_dashboard'
    ],
    'service': [
      'lead_management'
    ],
    'inventory': [
      'vehicle_import',
      'qr_code_generation'
    ]
  };

  return rolePermissions[staffRole] || [];
}

export default router;
