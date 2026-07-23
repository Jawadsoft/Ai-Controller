import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Enhanced query to get user with staff information
    // Fetch actual permissions from staff_permissions table
    const userResult = await query(
      `SELECT 
        u.*, 
        ur.role,
        COALESCE(d_staff.id, d_owner.id) AS dealer_id,
        COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
        COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
        ds.id as staff_id,
        ds.staff_role,
        ds.is_active as staff_active,
        COALESCE(
          (SELECT ARRAY_AGG(sp.permission_name)
           FROM staff_permissions sp
           WHERE sp.staff_id = ds.id 
           AND sp.permission_value = true),
          ARRAY[]::TEXT[]
        ) as staff_permissions
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       LEFT JOIN dealership_staff ds ON u.id = ds.user_id
       LEFT JOIN dealers d_staff ON ds.dealer_id = d_staff.id
       LEFT JOIN dealers d_owner ON d_owner.user_id = u.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Check if staff member is active
    if (user.staff_id && !user.staff_active) {
      return res.status(403).json({ error: 'Staff account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('🔍 Auth Debug Info:');
    console.log('- Token:', token ? token.substring(0, 20) + '...' : 'No token');
    console.log('- Error:', error.message);
    console.log('- Error type:', error.name);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expiredAt: error.expiredAt });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token format' });
    } else {
      return res.status(403).json({ error: 'Invalid token', details: error.message });
    }
  }
};

// New middleware for staff-specific roles
const requireStaffRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin can access everything
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has staff role
    if (!req.user.staff_role || !allowedRoles.includes(req.user.staff_role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.staff_role
      });
    }

    next();
  };
};

// New middleware for dealer access
const requireDealerAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super admin can access everything
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Check if user has dealer access (either direct dealer or staff member)
  if (!req.user.dealer_id) {
    return res.status(403).json({ error: 'Dealer access required' });
  }

  // Allow access if user is a staff member (has dealer_id)
  next();
};

// New middleware for specific permissions
const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Dealership staff admin: full dealership permissions (matches frontend usePermissions.canAccessFeature)
    if (req.user.staff_role === 'admin') {
      return next();
    }

    // Check staff permissions using database function
    try {
      const result = await query(
        'SELECT user_has_permission($1, $2) as has_permission',
        [req.user.id, permission]
      );

      if (result.rows[0].has_permission) {
        return next();
      }

      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireSuperAdmin = requireRole(['super_admin']);

export {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requireStaffRole,
  requireDealerAccess,
  requirePermission
};