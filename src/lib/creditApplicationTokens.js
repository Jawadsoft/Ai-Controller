/**
 * Credit Application Token Management
 * Handles generation and validation of secure tokens for credit application links
 */

import crypto from 'crypto';
import { query } from '../database/connection.js';

/**
 * Generate a secure token for credit application link
 * @param {Object} data - Token data
 * @param {string} data.conversationId - DAIVE conversation ID
 * @param {string} data.dealerId - Dealer ID
 * @param {string} data.customerEmail - Customer email address
 * @param {string} data.customerName - Customer name (optional)
 * @param {string} data.vehicleId - Vehicle ID (optional)
 * @param {Object} data.prefillData - Data to prefill in the application form
 * @returns {Promise<Object>} Token data with link
 */
export async function generateCreditApplicationToken(data) {
  const {
    conversationId,
    dealerId,
    customerEmail,
    customerName = null,
    vehicleId = null,
    prefillData = {}
  } = data;

  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Token expires in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Store token in database
  const result = await query(
    `INSERT INTO credit_application_tokens 
     (token, conversation_id, dealer_id, customer_email, customer_name, vehicle_id, prefill_data, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, token, expires_at`,
    [
      token,
      conversationId,
      dealerId,
      customerEmail,
      customerName,
      vehicleId,
      JSON.stringify(prefillData),
      expiresAt
    ]
  );

  const tokenRecord = result.rows[0];

  // Generate application link
  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:8080';
  const applicationLink = `${frontendUrl}/#/apply?dealer=${dealerId}&conversation=${conversationId}&token=${token}`;

  return {
    id: tokenRecord.id,
    token: tokenRecord.token,
    applicationLink,
    expiresAt: tokenRecord.expires_at
  };
}

/**
 * Validate and retrieve token data
 * @param {string} token - Token to validate
 * @returns {Promise<Object|null>} Token data or null if invalid
 */
export async function validateCreditApplicationToken(token) {
  const result = await query(
    `SELECT 
      id, token, conversation_id, dealer_id, customer_email, customer_name, 
      vehicle_id, prefill_data, used, expires_at, created_at
     FROM credit_application_tokens
     WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenData = result.rows[0];
  
  // Parse prefill_data if it exists and is a string
  if (tokenData.prefill_data) {
    if (typeof tokenData.prefill_data === 'string') {
      try {
        tokenData.prefill_data = JSON.parse(tokenData.prefill_data);
      } catch (error) {
        console.error('Error parsing prefill_data:', error);
        tokenData.prefill_data = {};
      }
    }
    // If it's already an object (PostgreSQL JSONB), leave it as is
  }

  return tokenData;
}

/**
 * Mark token as used
 * @param {string} token - Token to mark as used
 * @returns {Promise<boolean>} Success status
 */
export async function markTokenAsUsed(token) {
  const result = await query(
    `UPDATE credit_application_tokens
     SET used = TRUE, used_at = NOW()
     WHERE token = $1`,
    [token]
  );

  return result.rowCount > 0;
}

/**
 * Check if token exists and is valid
 * @param {string} token - Token to check
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
export async function isTokenValid(token) {
  const tokenData = await validateCreditApplicationToken(token);
  return tokenData !== null;
}

/**
 * Get all tokens for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} Array of tokens
 */
export async function getConversationTokens(conversationId) {
  const result = await query(
    `SELECT 
      id, token, customer_email, customer_name, used, expires_at, created_at
     FROM credit_application_tokens
     WHERE conversation_id = $1
     ORDER BY created_at DESC`,
    [conversationId]
  );

  return result.rows;
}

/**
 * Clean up expired tokens (can be run as a cron job)
 * @returns {Promise<number>} Number of tokens deleted
 */
export async function cleanupExpiredTokens() {
  const result = await query(
    `DELETE FROM credit_application_tokens
     WHERE expires_at < NOW() - INTERVAL '30 days'`
  );

  return result.rowCount;
}

export default {
  generateCreditApplicationToken,
  validateCreditApplicationToken,
  markTokenAsUsed,
  isTokenValid,
  getConversationTokens,
  cleanupExpiredTokens
};

