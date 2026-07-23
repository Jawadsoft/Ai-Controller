/**
 * Lenders Service - Lender Management and Submission Tracking
 * Handles lender relationships, program assignments, and deal submissions
 */

import { query } from '../database/connection.js';
import crypto from 'crypto';

class LendersService {
  constructor() {
    // Encryption key for sensitive data (API credentials, account numbers)
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32chars!!';
    this.algorithm = 'aes-256-cbc';
  }

  /**
   * Encrypt sensitive data (API credentials, account numbers)
   * @param {string} data - Plain text data to encrypt
   * @returns {string} Encrypted hex string
   */
  encrypt(data) {
    if (!data) return null;
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey.substring(0, 32).padEnd(32, '0'), 'utf8'),
        iv
      );
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted hex string with IV
   * @returns {string} Decrypted plain text
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey.substring(0, 32).padEnd(32, '0'), 'utf8'),
        iv
      );
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Get all lenders for a dealer (dealer-specific + global)
   * @param {string} dealerId - Dealer UUID
   * @param {object} filters - Optional filters { type, is_active, is_preferred }
   * @returns {Promise<Array>} Array of lender objects
   */
  async getLenders(dealerId, filters = {}) {
    try {
      const { type, is_active, is_preferred } = filters;
      
      let whereConditions = ['(dealer_id = $1 OR dealer_id IS NULL)'];
      let params = [dealerId];
      let paramIndex = 2;
      
      if (type) {
        whereConditions.push(`lender_type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }
      
      if (is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }
      
      if (is_preferred !== undefined) {
        whereConditions.push(`is_preferred = $${paramIndex}`);
        params.push(is_preferred);
        paramIndex++;
      }
      
      const sql = `
        SELECT 
          id, dealer_id, lender_name, lender_type, contact_name, contact_email,
          contact_phone, website, address, license_number, min_credit_score,
          max_ltv, preferred_terms, notes, api_enabled, is_active, is_preferred,
          created_at, updated_at,
          CASE WHEN dealer_id IS NULL THEN 'global' ELSE 'dealer' END as scope
        FROM lenders
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          is_preferred DESC,
          is_active DESC,
          CASE WHEN dealer_id IS NULL THEN 1 ELSE 0 END,
          lender_name ASC
      `;
      
      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting lenders:', error);
      throw error;
    }
  }

  /**
   * Get single lender by ID
   * @param {string} lenderId - Lender UUID
   * @param {string} dealerId - Dealer UUID (for security check)
   * @returns {Promise<object|null>} Lender object or null
   */
  async getLenderById(lenderId, dealerId) {
    try {
      const sql = `
        SELECT *,
          CASE WHEN dealer_id IS NULL THEN 'global' ELSE 'dealer' END as scope
        FROM lenders
        WHERE id = $1 AND (dealer_id = $2 OR dealer_id IS NULL)
      `;
      
      const result = await query(sql, [lenderId, dealerId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting lender:', error);
      throw error;
    }
  }

  /**
   * Create a new lender
   * @param {object} lenderData - Lender information
   * @returns {Promise<object>} Created lender object
   */
  async createLender(lenderData) {
    try {
      const {
        dealerId,
        lender_name,
        lender_type,
        contact_name,
        contact_email,
        contact_phone,
        website,
        address,
        license_number,
        routing_number,
        account_number,
        api_enabled,
        api_endpoint,
        api_credentials,
        min_credit_score,
        max_ltv,
        preferred_terms,
        notes,
        is_preferred
      } = lenderData;
      
      // Encrypt sensitive data if provided
      const accountNumberEncrypted = account_number ? this.encrypt(account_number) : null;
      const apiCredentialsEncrypted = api_credentials ? this.encrypt(JSON.stringify(api_credentials)) : null;
      
      const sql = `
        INSERT INTO lenders (
          dealer_id, lender_name, lender_type, contact_name, contact_email,
          contact_phone, website, address, license_number, routing_number,
          account_number_encrypted, api_enabled, api_endpoint, api_credentials_encrypted,
          min_credit_score, max_ltv, preferred_terms, notes, is_preferred
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id, dealer_id, lender_name, lender_type, contact_name, contact_email,
                  contact_phone, website, address, min_credit_score, max_ltv, 
                  preferred_terms, notes, api_enabled, is_active, is_preferred, created_at
      `;
      
      // Sanitize function to convert empty strings to null
      const sanitize = (value) => (value === '' || value === undefined) ? null : value;
      
      const result = await query(sql, [
        dealerId,
        lender_name,
        lender_type || 'Bank',
        sanitize(contact_name),
        sanitize(contact_email),
        sanitize(contact_phone),
        sanitize(website),
        sanitize(address),
        sanitize(license_number),
        sanitize(routing_number),
        accountNumberEncrypted,
        api_enabled || false,
        sanitize(api_endpoint),
        apiCredentialsEncrypted,
        sanitize(min_credit_score),
        sanitize(max_ltv),
        sanitize(preferred_terms),
        sanitize(notes),
        is_preferred || false
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating lender:', error);
      throw error;
    }
  }

  /**
   * Update lender information
   * @param {string} lenderId - Lender UUID
   * @param {string} dealerId - Dealer UUID (for security)
   * @param {object} updateData - Fields to update
   * @returns {Promise<object>} Updated lender object
   */
  async updateLender(lenderId, dealerId, updateData) {
    try {
      // Verify lender belongs to dealer
      const existing = await this.getLenderById(lenderId, dealerId);
      if (!existing) {
        throw new Error('Lender not found or access denied');
      }
      
      if (existing.scope === 'global') {
        throw new Error('Cannot update global lenders');
      }
      
      const allowedFields = [
        'lender_name', 'lender_type', 'contact_name', 'contact_email',
        'contact_phone', 'website', 'address', 'license_number',
        'min_credit_score', 'max_ltv', 'preferred_terms', 'notes',
        'is_active', 'is_preferred', 'api_enabled', 'api_endpoint'
      ];
      
      // Fields that should convert empty string to null
      const numericFields = ['min_credit_score', 'max_ltv'];
      const optionalFields = ['contact_name', 'contact_email', 'contact_phone', 'website', 'address', 'license_number', 'preferred_terms', 'notes', 'api_endpoint'];
      
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          
          // Sanitize value: convert empty strings to null for optional/numeric fields
          let value = updateData[field];
          if ((numericFields.includes(field) || optionalFields.includes(field)) && value === '') {
            value = null;
          }
          
          values.push(value);
          paramIndex++;
        }
      }
      
      // Handle encrypted fields separately
      if (updateData.account_number) {
        updates.push(`account_number_encrypted = $${paramIndex}`);
        values.push(this.encrypt(updateData.account_number));
        paramIndex++;
      }
      
      if (updateData.api_credentials) {
        updates.push(`api_credentials_encrypted = $${paramIndex}`);
        values.push(this.encrypt(JSON.stringify(updateData.api_credentials)));
        paramIndex++;
      }
      
      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(lenderId);
      
      const sql = `
        UPDATE lenders
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, dealer_id, lender_name, lender_type, contact_name, contact_email,
                  contact_phone, website, address, min_credit_score, max_ltv, 
                  preferred_terms, notes, api_enabled, is_active, is_preferred, updated_at
      `;
      
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating lender:', error);
      throw error;
    }
  }

  /**
   * Deactivate a lender (soft delete)
   * @param {string} lenderId - Lender UUID
   * @param {string} dealerId - Dealer UUID (for security)
   * @returns {Promise<object>} Updated lender object
   */
  async deactivateLender(lenderId, dealerId) {
    try {
      const existing = await this.getLenderById(lenderId, dealerId);
      if (!existing) {
        throw new Error('Lender not found or access denied');
      }
      
      if (existing.scope === 'global') {
        throw new Error('Cannot deactivate global lenders');
      }
      
      const sql = `
        UPDATE lenders
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(sql, [lenderId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deactivating lender:', error);
      throw error;
    }
  }

  /**
   * Get finance programs for a specific lender
   * @param {string} lenderId - Lender UUID
   * @param {string} dealerId - Dealer UUID
   * @returns {Promise<Array>} Array of finance programs
   */
  async getLenderPrograms(lenderId, dealerId) {
    try {
      const sql = `
        SELECT 
          ftm.*,
          l.lender_name
        FROM finance_terms_master ftm
        INNER JOIN lenders l ON ftm.lender_id = l.id
        WHERE ftm.lender_id = $1 
          AND (ftm.dealer_id = $2 OR ftm.dealer_id IS NULL)
          AND ftm.is_active = TRUE
        ORDER BY ftm.type, ftm.term_months, ftm.tier_min_score
      `;
      
      const result = await query(sql, [lenderId, dealerId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting lender programs:', error);
      throw error;
    }
  }

  /**
   * Submit a deal to a lender
   * @param {object} submissionData - Submission information
   * @returns {Promise<object>} Created submission object
   */
  async submitDealToLender(submissionData) {
    try {
      const {
        dealId,
        lenderId,
        dealerId,
        submittedBy,
        submission_method,
        notes,
        applicationId
      } = submissionData;
      
      // Get application_id from deal if not provided
      let finalApplicationId = applicationId;
      if (!finalApplicationId && dealId) {
        const dealResult = await query('SELECT application_id FROM finance_deals WHERE id = $1', [dealId]);
        if (dealResult.rows.length > 0) {
          finalApplicationId = dealResult.rows[0].application_id;
        }
      }
      
      const sql = `
        INSERT INTO lender_submissions (
          deal_id, lender_id, dealer_id, application_id, submission_status, submission_method,
          submitted_by, submitted_at, notes
        )
        VALUES ($1, $2, $3, $4, 'submitted', $5, $6, NOW(), $7)
        RETURNING *
      `;
      
      const result = await query(sql, [
        dealId,
        lenderId,
        dealerId,
        finalApplicationId,
        submission_method || 'manual',
        submittedBy,
        notes || null
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error submitting deal to lender:', error);
      throw error;
    }
  }

  /**
   * Update lender submission status
   * @param {string} submissionId - Submission UUID
   * @param {object} updateData - Update information
   * @returns {Promise<object>} Updated submission object
   */
  async updateSubmission(submissionId, updateData) {
    try {
      const {
        submission_status,
        approved_amount,
        approved_apr,
        approved_term_months,
        counter_offer,
        rejection_reason,
        lender_reference_number,
        response_data,
        reviewed_by
      } = updateData;
      
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      if (submission_status) {
        updates.push(`submission_status = $${paramIndex}`);
        values.push(submission_status);
        paramIndex++;
        
        // Set responded_at when status changes from submitted
        if (submission_status !== 'submitted' && submission_status !== 'pending') {
          updates.push(`responded_at = NOW()`);
        }
      }
      
      if (approved_amount) {
        updates.push(`approved_amount = $${paramIndex}`);
        values.push(approved_amount);
        paramIndex++;
      }
      
      if (approved_apr) {
        updates.push(`approved_apr = $${paramIndex}`);
        values.push(approved_apr);
        paramIndex++;
      }
      
      if (approved_term_months) {
        updates.push(`approved_term_months = $${paramIndex}`);
        values.push(approved_term_months);
        paramIndex++;
      }
      
      if (counter_offer) {
        updates.push(`counter_offer = $${paramIndex}`);
        values.push(JSON.stringify(counter_offer));
        paramIndex++;
      }
      
      if (rejection_reason) {
        updates.push(`rejection_reason = $${paramIndex}`);
        values.push(rejection_reason);
        paramIndex++;
      }
      
      if (lender_reference_number) {
        updates.push(`lender_reference_number = $${paramIndex}`);
        values.push(lender_reference_number);
        paramIndex++;
      }
      
      if (response_data) {
        updates.push(`response_data = $${paramIndex}`);
        values.push(JSON.stringify(response_data));
        paramIndex++;
      }
      
      if (reviewed_by) {
        updates.push(`reviewed_by = $${paramIndex}`);
        values.push(reviewed_by);
        paramIndex++;
      }
      
      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(submissionId);
      
      const sql = `
        UPDATE lender_submissions
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating submission:', error);
      throw error;
    }
  }

  /**
   * Get submissions for a deal
   * @param {string} dealId - Deal UUID
   * @returns {Promise<Array>} Array of submissions
   */
  async getDealSubmissions(dealId) {
    try {
      const sql = `
        SELECT 
          ls.*,
          l.lender_name,
          l.lender_type,
          u.name as submitted_by_name
        FROM lender_submissions ls
        INNER JOIN lenders l ON ls.lender_id = l.id
        LEFT JOIN users u ON ls.submitted_by = u.id
        WHERE ls.deal_id = $1
        ORDER BY ls.submitted_at DESC
      `;
      
      const result = await query(sql, [dealId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting deal submissions:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new LendersService();

