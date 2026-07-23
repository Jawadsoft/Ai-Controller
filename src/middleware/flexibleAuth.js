import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';

/**
 * Flexible authentication middleware that accepts both user tokens and customer tokens
 * Use this for endpoints that should be accessible by both dealers and customers
 */
export const authenticateFlexible = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this is a customer token
    if (decoded.type === 'customer') {
      // Verify customer session
      const sessionResult = await query(
        `SELECT cs.*, v.id as vehicle_id, v.make, v.model, v.year, v.price,
                d.id as dealer_id, d.business_name, d.contact_name, d.email as dealer_email, d.phone as dealer_phone
         FROM customer_sessions cs
         LEFT JOIN vehicles v ON cs.vehicle_id = v.id
         LEFT JOIN dealers d ON cs.dealer_id = d.id
         WHERE cs.id = $1 AND cs.expires_at > NOW()`,
        [decoded.sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ error: 'Customer session expired or not found' });
      }

      req.customerSession = sessionResult.rows[0];
      req.customer = {
        sessionId: decoded.sessionId,
        name: decoded.customer_name,
        email: decoded.customer_email,
        phone: decoded.customer_phone
      };
      req.authType = 'customer';
      
      console.log('✅ Customer authenticated:', req.customer.name);
      return next();
    }
    
    // Otherwise, treat as user token
    const userResult = await query(
      `SELECT 
        u.*, 
        ur.role,
        COALESCE(d_staff.id, d_owner.id) AS dealer_id,
        COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
        COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
        ds.id as staff_id,
        ds.staff_role,
        ds.permissions as staff_permissions,
        ds.is_active as staff_active
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
    req.authType = 'user';
    
    console.log('✅ User authenticated:', user.name || user.email);
    next();
  } catch (error) {
    console.log('🔍 Flexible Auth Debug Info:');
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

/**
 * Optional flexible authentication - allows public access but enhances with auth if available
 */
export const optionalFlexibleAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // No token, continue without auth
  }

  try {
    await authenticateFlexible(req, res, next);
  } catch (error) {
    // If auth fails, continue without auth rather than blocking
    console.log('Optional auth failed, continuing without authentication');
    next();
  }
};

