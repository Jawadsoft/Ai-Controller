import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../database/connection.js';

// Generate customer session token
export const generateCustomerToken = (sessionId, customerData = {}) => {
  return jwt.sign(
    { 
      sessionId, 
      type: 'customer',
      ...customerData 
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '24h' }
  );
};

// Verify customer session token
export const verifyCustomerToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'customer') {
      throw new Error('Invalid token type');
    }

    // Verify session still exists and is valid
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
      throw new Error('Session expired or not found');
    }

    return {
      session: sessionResult.rows[0],
      customer: {
        sessionId: decoded.sessionId,
        name: decoded.customer_name,
        email: decoded.customer_email,
        phone: decoded.customer_phone
      }
    };
  } catch (error) {
    throw new Error('Invalid customer token');
  }
};

// Middleware to authenticate customer sessions
export const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Customer session token required',
        requiresAuth: true 
      });
    }

    const { session, customer } = await verifyCustomerToken(token);
    
    req.customerSession = session;
    req.customer = customer;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid customer session',
      requiresAuth: true 
    });
  }
};

// Middleware to optionally authenticate customer (for public access with enhanced features)
export const optionalCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const { session, customer } = await verifyCustomerToken(token);
        req.customerSession = session;
        req.customer = customer;
      } catch (error) {
        // Token is invalid, but we continue without customer data
        console.log('Invalid customer token, continuing without auth:', error.message);
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Create or update customer session
export const createCustomerSession = async (sessionData) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    ip_address,
    user_agent,
    access_type = 'qr_code',
    vehicle_id,
    dealer_id,
    qr_hash
  } = sessionData;

  try {
    // Check if session already exists for this QR hash
    let sessionResult;
    if (qr_hash) {
      sessionResult = await query(
        'SELECT * FROM customer_sessions WHERE qr_hash = $1 AND expires_at > NOW()',
        [qr_hash]
      );
    }

    let session;
    if (sessionResult && sessionResult.rows.length > 0) {
      // Update existing session
      session = sessionResult.rows[0];
      await query(
        `UPDATE customer_sessions 
         SET customer_name = COALESCE($1, customer_name),
             customer_email = COALESCE($2, customer_email),
             customer_phone = COALESCE($3, customer_phone),
             last_activity = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [customer_name, customer_email, customer_phone, session.id]
      );
    } else {
      // Generate a unique session token
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new session
      const newSessionResult = await query(
        `INSERT INTO customer_sessions (
          session_token, customer_name, customer_email, customer_phone, ip_address, user_agent,
          access_type, vehicle_id, dealer_id, qr_hash, is_authenticated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          sessionToken, customer_name, customer_email, customer_phone, ip_address, user_agent,
          access_type, vehicle_id, dealer_id, qr_hash, false
        ]
      );
      session = newSessionResult.rows[0];
    }

    // Log the interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, vehicle_id, dealer_id, interaction_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.id,
        'qr_scan',
        vehicle_id,
        dealer_id,
        JSON.stringify({ qr_hash, access_type, timestamp: new Date().toISOString() })
      ]
    );

    return session;
  } catch (error) {
    console.error('Error creating customer session:', error);
    throw error;
  }
};

// Register a new customer
export const registerCustomer = async (customerData) => {
  try {
    const { email, password, first_name, last_name, phone, terms_accepted, privacy_policy_accepted } = customerData;
    
    // Check if customer already exists
    const existingCustomer = await query(
      'SELECT id FROM customers WHERE email = $1',
      [email]
    );

    if (existingCustomer.rows.length > 0) {
      throw new Error('Customer with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create customer
    const customerResult = await query(
      `INSERT INTO customers (
        email, password_hash, first_name, last_name, phone,
        terms_accepted, privacy_policy_accepted, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, first_name, last_name, phone, created_at`,
      [email, passwordHash, first_name, last_name, phone, terms_accepted, privacy_policy_accepted, false]
    );

    return customerResult.rows[0];
  } catch (error) {
    console.error('Error registering customer:', error);
    throw error;
  }
};

// Login customer
export const loginCustomer = async (email, password) => {
  try {
    // Get customer with password hash
    const customerResult = await query(
      'SELECT id, email, password_hash, first_name, last_name, phone, status FROM customers WHERE email = $1',
      [email]
    );

    if (customerResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const customer = customerResult.rows[0];

    if (customer.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, customer.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await query(
      'UPDATE customers SET last_login = NOW(), login_count = login_count + 1, updated_at = NOW() WHERE id = $1',
      [customer.id]
    );

    // Return customer data without password hash
    const { password_hash, ...customerData } = customer;
    return customerData;
  } catch (error) {
    console.error('Error logging in customer:', error);
    throw error;
  }
};

// Create or get customer session
export const createOrGetCustomerSession = async (sessionData, customerId = null) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    ip_address,
    user_agent,
    access_type = 'qr_code',
    vehicle_id,
    dealer_id,
    qr_hash
  } = sessionData;

  try {
    let session;
    
    if (customerId) {
      // Customer is logged in, create session with customer_id
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newSessionResult = await query(
        `INSERT INTO customer_sessions (
          session_token, customer_id, customer_name, customer_email, customer_phone, 
          ip_address, user_agent, access_type, vehicle_id, dealer_id, qr_hash, is_authenticated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          sessionToken, customerId, customer_name, customer_email, customer_phone,
          ip_address, user_agent, access_type, vehicle_id, dealer_id, qr_hash, true
        ]
      );
      session = newSessionResult.rows[0];
    } else {
      // Check if session already exists for this QR hash
      let sessionResult;
      if (qr_hash) {
        sessionResult = await query(
          'SELECT * FROM customer_sessions WHERE qr_hash = $1 AND expires_at > NOW()',
          [qr_hash]
        );
      }

      if (sessionResult && sessionResult.rows.length > 0) {
        // Update existing session
        session = sessionResult.rows[0];
        await query(
          `UPDATE customer_sessions 
           SET customer_name = COALESCE($1, customer_name),
               customer_email = COALESCE($2, customer_email),
               customer_phone = COALESCE($3, customer_phone),
               last_activity = NOW(),
               updated_at = NOW()
           WHERE id = $4`,
          [customer_name, customer_email, customer_phone, session.id]
        );
      } else {
        // Create new session
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newSessionResult = await query(
          `INSERT INTO customer_sessions (
            session_token, customer_name, customer_email, customer_phone, ip_address, user_agent,
            access_type, vehicle_id, dealer_id, qr_hash, is_authenticated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            sessionToken, customer_name, customer_email, customer_phone, ip_address, user_agent,
            access_type, vehicle_id, dealer_id, qr_hash, false
          ]
        );
        session = newSessionResult.rows[0];
      }
    }

    // Log the interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, vehicle_id, dealer_id, interaction_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.id,
        customerId ? 'customer_login' : 'qr_scan',
        vehicle_id,
        dealer_id,
        JSON.stringify({ 
          qr_hash, 
          access_type, 
          customer_id: customerId,
          timestamp: new Date().toISOString() 
        })
      ]
    );

    return session;
  } catch (error) {
    console.error('Error creating customer session:', error);
    throw error;
  }
};

// Request password reset
export const requestPasswordReset = async (email) => {
  try {
    // Check if customer exists
    const customerResult = await query(
      'SELECT id, email, first_name, last_name FROM customers WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (customerResult.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    const customer = customerResult.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await query(
      `UPDATE customers 
       SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW()
       WHERE id = $3`,
      [resetToken, resetTokenExpires, customer.id]
    );

    // In a real application, you would send an email here
    // For now, we'll return the token for testing purposes
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`);

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
      resetToken, // Remove this in production
      resetLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}` // Remove this in production
    };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    throw error;
  }
};

// Reset password with token
export const resetPassword = async (token, newPassword) => {
  try {
    // Find customer with valid reset token
    const customerResult = await query(
      `SELECT id, email, first_name, last_name 
       FROM customers 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW() 
       AND status = $2`,
      [token, 'active']
    );

    if (customerResult.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    const customer = customerResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await query(
      `UPDATE customers 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, customer.id]
    );

    return {
      message: 'Password has been reset successfully',
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name
      }
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};

// Verify reset token
export const verifyResetToken = async (token) => {
  try {
    const customerResult = await query(
      `SELECT id, email, first_name, last_name 
       FROM customers 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW() 
       AND status = $2`,
      [token, 'active']
    );

    if (customerResult.rows.length === 0) {
      return { valid: false, message: 'Invalid or expired reset token' };
    }

    return {
      valid: true,
      customer: {
        id: customerResult.rows[0].id,
        email: customerResult.rows[0].email,
        first_name: customerResult.rows[0].first_name,
        last_name: customerResult.rows[0].last_name
      }
    };
  } catch (error) {
    console.error('Error verifying reset token:', error);
    throw error;
  }
};

// Update customer authentication status (legacy function - kept for compatibility)
export const updateCustomerAuth = async (sessionId, customerData) => {
  try {
    const { customer_name, customer_email, customer_phone } = customerData;
    
    await query(
      `UPDATE customer_sessions 
       SET customer_name = $1, customer_email = $2, customer_phone = $3,
           is_authenticated = true, updated_at = NOW()
       WHERE id = $4`,
      [customer_name, customer_email, customer_phone, sessionId]
    );

    // Log the authentication interaction
    await query(
      `INSERT INTO customer_interactions (session_id, interaction_type, interaction_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'authentication',
        JSON.stringify({ 
          customer_name, 
          customer_email, 
          customer_phone,
          timestamp: new Date().toISOString() 
        })
      ]
    );

    return true;
  } catch (error) {
    console.error('Error updating customer auth:', error);
    throw error;
  }
};
